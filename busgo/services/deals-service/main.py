from fastapi import FastAPI, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from datetime import datetime
from uuid import UUID
from typing import List, Optional
from database import engine, Base, get_db
from models import PromoCode, FlashSale, DiscountType
from schemas import (
    PromoCodeCreate, PromoCodeUpdate, PromoCodeResponse,
    FlashSaleCreate, FlashSaleUpdate, FlashSaleResponse,
    ValidatePromoRequest, ValidatePromoResponse,
    ApplyPromoRequest
)
from redis_client import has_user_used_promo, mark_promo_used
import os

Base.metadata.create_all(bind=engine)

from sqlalchemy import text
with engine.connect() as conn:
    for stmt in [
        "ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS operator_id VARCHAR(255)",
        "ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS title VARCHAR(255)",
        "ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS description TEXT",
        "ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS operator_id VARCHAR(255)",
        "ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS description TEXT",
        "ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS applicable_routes JSON",
    ]:
        conn.execute(text(stmt))
    conn.commit()

app = FastAPI(title='Deals Service', root_path=os.environ.get('ROOT_PATH', ''))

@app.get('/health')
def health_check():
    return {'status': 'ok'}

@app.post('/validate-promo', response_model=ValidatePromoResponse)
def validate_promo(req: ValidatePromoRequest, db: Session = Depends(get_db)):
    code_upper = req.code.upper()
    promo = db.query(PromoCode).filter(PromoCode.code == code_upper).first()
    
    if not promo:
        return ValidatePromoResponse(valid=False, message='Promo code not found')
    if not promo.is_active:
        return ValidatePromoResponse(valid=False, message='Promo code is inactive')
    
    now = datetime.utcnow()
    if now < promo.valid_from or now > promo.valid_until:
        return ValidatePromoResponse(valid=False, message='Promo code is not valid at this time')
        
    if promo.current_uses >= promo.max_uses:
        return ValidatePromoResponse(valid=False, message='Promo code usage limit reached')
        
    if req.fare_amount < float(promo.min_fare):
        return ValidatePromoResponse(valid=False, message=f'Minimum fare required is {promo.min_fare}')
        
    mock_trip_operator = 'OPERATOR_A' 
    if len(promo.applicable_operators) > 0 and mock_trip_operator not in promo.applicable_operators:
        return ValidatePromoResponse(valid=False, message='Promo code not valid for this operator')
        
    if has_user_used_promo(code_upper, str(req.user_id)):
        return ValidatePromoResponse(valid=False, message='You have already used this promo code')
        
    discount = 0.0
    fare = float(req.fare_amount)
    
    if promo.discount_type == DiscountType.PERCENTAGE:
        calculated_discount = fare * (float(promo.discount_value) / 100.0)
        max_discount = float(promo.max_discount) if promo.max_discount else calculated_discount
        discount = min(calculated_discount, max_discount)
    elif promo.discount_type == DiscountType.FLAT:
        discount = min(float(promo.discount_value), fare)
        
    return ValidatePromoResponse(
        valid=True,
        discount_amount=discount,
        final_fare=max(0.0, fare - discount),
        message='Promo applied successfully'
    )

@app.post('/apply-promo')
def apply_promo(req: ApplyPromoRequest, db: Session = Depends(get_db)):
    code_upper = req.code.upper()
    promo = db.query(PromoCode).filter(PromoCode.code == code_upper).first()
    if not promo:
        raise HTTPException(status_code=400, detail='Invalid promo code')
    
    promo.current_uses += 1
    db.commit()
    
    mark_promo_used(code_upper, str(req.user_id))
    return {'status': 'success', 'message': 'Promo applied'}

@app.get('/flash-sales/active', response_model=List[FlashSaleResponse])
def get_active_flash_sales(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    sales = db.query(FlashSale).filter(
        FlashSale.is_active == True,
        FlashSale.start_time <= now,
        FlashSale.end_time >= now
    ).all()
    return sales

@app.get('/promos/', response_model=List[PromoCodeResponse])
def list_promos(operator_id: Optional[str] = Query(None), db: Session = Depends(get_db)):
    q = db.query(PromoCode)
    if operator_id:
        q = q.filter(PromoCode.operator_id == operator_id)
    return q.all()

@app.post('/promos/', response_model=PromoCodeResponse)
def admin_create_promo(promo_data: PromoCodeCreate, db: Session = Depends(get_db)):
    promo = PromoCode(**promo_data.dict())
    promo.code = promo.code.upper()
    db.add(promo)
    db.commit()
    db.refresh(promo)
    return promo

@app.put('/promos/{id}', response_model=PromoCodeResponse)
def admin_update_promo(id: UUID, promo_data: PromoCodeUpdate, db: Session = Depends(get_db)):
    promo = db.query(PromoCode).filter(PromoCode.id == id).first()
    if not promo:
        raise HTTPException(status_code=404, detail='Promo not found')
        
    for key, value in promo_data.dict(exclude_unset=True).items():
        setattr(promo, key, value)
        
    db.commit()
    db.refresh(promo)
    return promo

@app.delete('/promos/{id}')
def admin_delete_promo(id: UUID, db: Session = Depends(get_db)):
    promo = db.query(PromoCode).filter(PromoCode.id == id).first()
    if not promo:
        raise HTTPException(status_code=404, detail='Promo not found')

    db.delete(promo)
    db.commit()
    return {'status': 'success', 'message': 'Promo deleted'}

@app.get('/flash-sales', response_model=List[FlashSaleResponse])
@app.get('/flash-sales/', response_model=List[FlashSaleResponse])
def list_flash_sales(operator_id: Optional[str] = Query(None), db: Session = Depends(get_db)):
    q = db.query(FlashSale)
    if operator_id:
        q = q.filter(FlashSale.operator_id == operator_id)
    return q.all()

@app.post('/flash-sales/', response_model=FlashSaleResponse)
def create_flash_sale(data: FlashSaleCreate, db: Session = Depends(get_db)):
    sale = FlashSale(**data.dict())
    db.add(sale)
    db.commit()
    db.refresh(sale)
    return sale

@app.put('/flash-sales/{id}', response_model=FlashSaleResponse)
def update_flash_sale(id: UUID, data: FlashSaleUpdate, db: Session = Depends(get_db)):
    sale = db.query(FlashSale).filter(FlashSale.id == id).first()
    if not sale:
        raise HTTPException(status_code=404, detail='Flash sale not found')
    for key, value in data.dict(exclude_unset=True).items():
        setattr(sale, key, value)
    db.commit()
    db.refresh(sale)
    return sale

@app.delete('/flash-sales/{id}')
def delete_flash_sale(id: UUID, db: Session = Depends(get_db)):
    sale = db.query(FlashSale).filter(FlashSale.id == id).first()
    if not sale:
        raise HTTPException(status_code=404, detail='Flash sale not found')
    db.delete(sale)
    db.commit()
    return {'status': 'success'}

