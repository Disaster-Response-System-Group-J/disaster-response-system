import json
import os
from datetime import datetime
from confluent_kafka import Producer

KAFKA_BROKER = os.getenv("KAFKA_BROKER", "localhost:9092")

conf = {
    'bootstrap.servers': KAFKA_BROKER,
    'client.id': 'j2-data-intelligence'
}

_producer = None

def get_producer():
    global _producer
    if _producer is None:
        try:
            _producer = Producer(conf)
        except Exception as e:
            print(f"Failed to connect to Kafka: {e}")
    return _producer

def publish_predictions(predictions):
    producer = get_producer()
    if not producer:
        return
        
    topic = 'j2.engine.risk-alerts'
    for pred in predictions:
        # Publish only if consideration score is significant, or publish all (depending on needs)
        if pred["consideration_score"] > 0.3:
            message = {
                "divisionId": pred["division_id"],
                "flood_probability": pred["flood"],
                "landslide_probability": pred["landslide"],
                "drought_probability": pred["drought"],
                "consideration_score": pred["consideration_score"],
                "timestamp": datetime.combine(pred["date"], datetime.min.time()).isoformat()
            }
            producer.produce(topic, key=str(pred["division_id"]), value=json.dumps(message))
            
    producer.flush()
