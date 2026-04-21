import json
import logging
from kafka import KafkaConsumer
from sqlalchemy.orm import Session
from database import SessionLocal
from models.cancellation import CancellationRequest, CancellationStatus
import sys

logger = logging.getLogger(__name__)


def start_consumer():
    consumer = KafkaConsumer(
        "refund.initiated",
        bootstrap_servers=["kafka:9092"],
        value_deserializer=lambda m: json.loads(m.decode("utf-8")),
        group_id="cancellation-group",
    )
    for message in consumer:
        try:
            data = message.value
            process_refund_initiated(data)
        except Exception as e:
            logger.error(f"Error processing message: {e}")


def process_refund_initiated(data):
    db: Session = SessionLocal()
    try:
        cancellation_id = data.get("cancellation_id")
        if not cancellation_id:
            return

        cancellation = (
            db.query(CancellationRequest)
            .filter(CancellationRequest.id == cancellation_id)
            .first()
        )
        if cancellation:
            cancellation.status = CancellationStatus.APPROVED
            db.commit()

            # TODO: Publish notification.send
            logger.info(
                f"Cancellation {cancellation_id} approved following refund initiation."
            )
    finally:
        db.close()


if __name__ == "__main__":
    start_consumer()
