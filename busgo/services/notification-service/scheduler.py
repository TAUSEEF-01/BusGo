import time
import requests
import os
import json
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta

# Mock Kafka publisher
import sys

sys.path.append(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)
from shared.kafka_producer import publish_message

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def check_departure_reminders():
    logger.info("Running scheduled departure reminder check...")
    # Mock Booking Service Call
    try:
        # In prod: res = requests.get("https://busgo-nhbi.onrender.com/api/bookings/trips/upcoming?hours=2")
        mock_bookings = [
            {
                "user_id": "00000000-0000-0000-0000-000000000000",
                "phone": "+8801700000000",
                "fcm_token": "mocked-token-123",
                "template": "departure_reminder",
                "data": {
                    "boarding_point": "Gabtoli",
                    "time": (datetime.utcnow() + timedelta(hours=2)).isoformat(),
                },
            }
        ]

        for bk in mock_bookings:
            # Publish to notification.send
            logger.info(f"Publishing reminder for user {bk['user_id']}")
            publish_message("notification.send", bk)

    except Exception as e:
        logger.error(f"Error checking departure reminders: {e}")


def start_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(check_departure_reminders, "interval", minutes=30)
    scheduler.start()
    logger.info(
        "APScheduler for departure reminders started (running every 30 minutes)."
    )


if __name__ == "__main__":
    start_scheduler()
    while True:
        time.sleep(1)
