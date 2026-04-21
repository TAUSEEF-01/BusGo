import json
import logging
import uuid
from kafka import KafkaConsumer
from sqlalchemy.orm import Session
from datetime import datetime
import threading
import os

from database import SessionLocal
from models import AuditLog

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def process_audit_log(event):
    db: Session = SessionLocal()
    try:

        def try_uuid(val):
            if val is None:
                return None
            try:
                return uuid.UUID(str(val))
            except ValueError:
                return None

        # Event fields standard format:
        # action/event_type, entity_type, entity_id, user_id, operator_id, payload, ip_address
        log = AuditLog(
            event_type=event.get("event_type") or event.get("action", "unknown_action"),
            entity_type=event.get("entity_type", "unknown"),
            entity_id=try_uuid(event.get("entity_id")) or uuid.uuid4(),
            user_id=try_uuid(event.get("user_id")),
            operator_id=try_uuid(event.get("operator_id")),
            payload=event.get("payload", event),
            ip_address=event.get("ip_address"),
        )
        db.add(log)
        db.commit()
        logger.info(f"Audit log saved: {log.id} - {log.event_type}")
    except Exception as e:
        logger.error(f"Error creating audit log: {e}")
        db.rollback()
    finally:
        db.close()


def start_consumer():
    try:
        consumer = KafkaConsumer(
            "audit.log",
            bootstrap_servers=[os.getenv("KAFKA_BROKER", "kafka:9092")],
            value_deserializer=lambda m: json.loads(m.decode("utf-8")),
            group_id="audit-group",
        )
        logger.info("Kafka consumer for audit.log started.")
        for message in consumer:
            event = message.value
            process_audit_log(event)
    except Exception as e:
        logger.error(f"Error starting Kafka consumer: {e}")


def run_consumer_bg():
    thread = threading.Thread(target=start_consumer, daemon=True)
    thread.start()


if __name__ == "__main__":
    start_consumer()
