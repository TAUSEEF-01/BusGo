import json
import logging
from kafka import KafkaConsumer
from sqlalchemy.orm import Session
from datetime import datetime
import threading
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from database import SessionLocal
from models import NotificationLog, NotificationChannel, NotificationStatus
from handlers import send_email, send_sms, send_push, send_whatsapp

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def process_notification(event):
    template = event.get("template")
    data = event.get("data", {})
    user_id = event.get("user_id")
    phone = event.get("phone")
    email = event.get("email")
    fcm_token = event.get("fcm_token")

    db: Session = SessionLocal()
    
    def log_and_send(channel, send_func, *args, **kwargs):
        template_name = template if channel != NotificationChannel.EMAIL else f"{template}_email"
        log = NotificationLog(
            user_id=user_id,
            channel=channel,
            template_name=template_name,
            payload=data,
            status=NotificationStatus.PENDING
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        
        try:
            res = send_func(*args, **kwargs)
            if isinstance(res, dict) and res.get("status") == "SENT":
                log.status = NotificationStatus.SENT
                log.sent_at = datetime.utcnow()
            else:
                log.status = NotificationStatus.FAILED
                log.error_message = res.get("error", "Unknown error")
        except Exception as e:
            log.status = NotificationStatus.FAILED
            log.error_message = str(e)
            
        db.commit()

    if template == "booking_confirmed":
        if phone:
            msg = f"BusGo: Booking confirmed! Ref: {data.get('booking_id')}. {data.get('origin')}->{data.get('dest')} on {data.get('date')}. Seat: {data.get('seats')}"
            log_and_send(NotificationChannel.SMS, send_sms, phone, msg)
        if email:
            log_and_send(NotificationChannel.EMAIL, send_email, email, "Booking Confirmed", template, **data)

    elif template == "booking_cancelled":
        if phone:
            amount = data.get('amount', 0)
            if amount > 0:
                msg = f"BusGo: Booking {data.get('booking_id')} cancelled. Refund of {amount} BDT initiated."
            else:
                msg = f"BusGo: Booking {data.get('booking_id')} cancelled."
            log_and_send(NotificationChannel.SMS, send_sms, phone, msg)

    elif template == "departure_reminder":
        if phone:
            msg = f"BusGo Reminder: Your bus departs in 2 hours. Boarding at {data.get('boarding_point')}"
            log_and_send(NotificationChannel.SMS, send_sms, phone, msg)
        if fcm_token:
            log_and_send(NotificationChannel.PUSH, send_push, fcm_token, "Departure Reminder", "Your bus departs in 2 hours! \ud83d\ude8c")

    elif template == "ticket_issued":
        if email:
            log_and_send(NotificationChannel.EMAIL, send_email, email, "Your E-Ticket", template, **data)
        if phone:
            msg = f"Your e-ticket is ready: {data.get('pdf_url')}"
            log_and_send(NotificationChannel.WHATSAPP, send_whatsapp, phone, msg)
    
    db.close()

def start_consumer():
    try:
        consumer = KafkaConsumer(
            'notification.send',
            bootstrap_servers=[os.getenv("KAFKA_BROKER", 'kafka:9092')],
            value_deserializer=lambda m: json.loads(m.decode('utf-8')),
            group_id='notification-group'
        )
        logger.info("Kafka consumer for notification.send started.")
        for message in consumer:
            event = message.value
            logger.info(f"Received notification event: {event}")
            process_notification(event)
    except Exception as e:
        logger.error(f"Error starting Kafka consumer: {e}")

def run_consumer_bg():
    thread = threading.Thread(target=start_consumer, daemon=True)
    thread.start()

if __name__ == "__main__":
    start_consumer()
