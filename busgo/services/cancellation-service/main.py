from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import cancellation
from database import engine
from models.cancellation import Base
import os

app = FastAPI(title='Cancellation Service', root_path=os.environ.get('ROOT_PATH', ''))

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
    allow_credentials=True,
)

app.include_router(cancellation.router)

@app.on_event('startup')
def startup():
    Base.metadata.create_all(bind=engine)

@app.get('/')
async def root():
    return {'message': 'cancellation-service is running'}

