import os
import time
import json
import logging
import ssl

from kafka import KafkaProducer
import paho.mqtt.client as mqtt

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')

MQTT_BROKER = os.getenv('MQTT_BROKER', '8e659da889be4ff7a3d839144a0f8aaa.s1.eu.hivemq.cloud')
MQTT_PORT = int(os.getenv('MQTT_PORT', '8883'))
MQTT_USERNAME = os.getenv('MQTT_USERNAME')
MQTT_PASSWORD = os.getenv('MQTT_PASSWORD')
MQTT_TOPICS = os.getenv('MQTT_TOPICS', 'j1/disaster/#')

KAFKA_BOOTSTRAP = os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'kafka:29092')
KAFKA_TOPIC = os.getenv('KAFKA_TOPIC', 'disaster_data_stream')
KAFKA_TOPIC_FLOOD = os.getenv('KAFKA_TOPIC_FLOOD', 'j1.sensor.telemetry.flood')
KAFKA_TOPIC_LANDSLIDE = os.getenv('KAFKA_TOPIC_LANDSLIDE', 'j1.sensor.telemetry.landslide')

CLIENT_ID = os.getenv('CLIENT_ID', 'mqtt-kafka-bridge')


def create_producer():
    return KafkaProducer(
        bootstrap_servers=[s.strip() for s in KAFKA_BOOTSTRAP.split(',') if s.strip()],
        value_serializer=lambda v: v if isinstance(v, (bytes, bytearray)) else json.dumps(v).encode('utf-8'),
        retries=5,
        linger_ms=100,
    )


def on_connect(client, userdata, flags, rc):
    if rc == 0:
        logging.info('Connected to MQTT broker, subscribing to %s', MQTT_TOPICS)
        for t in MQTT_TOPICS.split(','):
            client.subscribe(t.strip())
    else:
        logging.error('MQTT connect failed with rc=%s', rc)


def resolve_kafka_topic(mqtt_topic):
    topic = mqtt_topic.strip().lower()
    if topic.endswith('/flood'):
        return KAFKA_TOPIC_FLOOD
    if topic.endswith('/landslide'):
        return KAFKA_TOPIC_LANDSLIDE
    return KAFKA_TOPIC


def make_on_message(producer):
    def on_message(client, userdata, msg):
        try:
            payload = msg.payload
            kafka_topic = resolve_kafka_topic(msg.topic)
            # try to decode JSON for logging convenience
            try:
                disp = json.loads(payload.decode('utf-8'))
            except Exception:
                disp = payload.decode('utf-8', errors='ignore')
            logging.info('MQTT %s -> Kafka %s: %s', msg.topic, kafka_topic, disp)
            # use topic name as key to help downstream partitioning
            key = msg.topic.encode('utf-8')
            producer.send(kafka_topic, value=payload, key=key)
            producer.flush()
        except Exception as e:
            logging.exception('Failed to forward message: %s', e)

    return on_message


def run_bridge():
    while True:
        try:
            logging.info('Starting bridge: MQTT %s:%s -> Kafka %s', MQTT_BROKER, MQTT_PORT, KAFKA_BOOTSTRAP)
            producer = create_producer()

            client = mqtt.Client(client_id=CLIENT_ID)
            if MQTT_USERNAME:
                client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
            client.tls_set(cert_reqs=ssl.CERT_REQUIRED)
            client.on_connect = on_connect
            client.on_message = make_on_message(producer)

            client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
            client.loop_forever()
        except Exception:
            logging.exception('Bridge encountered an error, will retry in 5s')
            try:
                producer.close()
            except Exception:
                pass
            time.sleep(5)


if __name__ == '__main__':
    run_bridge()
