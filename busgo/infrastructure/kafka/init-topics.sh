#!/bin/bash
# Wait for Kafka to be ready
echo "Waiting for Kafka to be ready..."
sleep 15

# Create Kafka topics
TOPICS=(
  "booking.created"
  "payment.completed"
  "seat.locked"
  "seat.lock.expired"
  "ticket.issued"
  "booking.cancelled"
  "refund.initiated"
  "notification.send"
  "audit.log"
)

for topic in "${TOPICS[@]}"; do
  echo "Creating topic: $topic"
  kafka-topics --create --if-not-exists --bootstrap-server kafka:9092 --partitions 3 --replication-factor 1 --topic "$topic"
done

echo "Kafka topics created successfully."
