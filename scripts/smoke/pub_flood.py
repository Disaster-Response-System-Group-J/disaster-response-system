"""Publish a test flood payload to HiveMQ → j1/disaster/flood.
Verifies: HiveMQ Cloud TLS → j1-mqtt-forwarder → Kafka j1.sensor.telemetry → iot_flood row.
"""
import json, ssl, time, uuid
import paho.mqtt.client as mqtt

DEVICE = f"test-flood-{uuid.uuid4().hex[:6]}"
PAYLOAD = {
    "id": DEVICE,
    "type": "FLOOD",
    "temp": 31.2,
    "hum": 88,
    "depth": 55.0,
    "latitude": 6.9271,
    "longitude": 79.8612,
}

connected = []


def on_connect(client, userdata, flags, rc, props=None):
    connected.append(rc)
    print(f"HiveMQ connect rc={rc}")


client = mqtt.Client(
    callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
    client_id=f"smoke-{uuid.uuid4().hex[:6]}",
    protocol=mqtt.MQTTv5,
)
client.username_pw_set("j1_gateway", "8797Sudil")
client.tls_set(tls_version=ssl.PROTOCOL_TLS_CLIENT)
client.tls_insecure_set(False)
client.on_connect = on_connect

client.connect("8e659da889be4ff7a3d839144a0f8aaa.s1.eu.hivemq.cloud", 8883, keepalive=30)
client.loop_start()

for _ in range(30):
    if connected:
        break
    time.sleep(0.2)

result = client.publish("j1/disaster/flood", json.dumps(PAYLOAD), qos=1)
result.wait_for_publish(timeout=10)
print(f"Published — device={DEVICE}  rc={result.rc}")
print(f"  Check J2 logs: iot_flood inserted: device={DEVICE}")
client.loop_stop()
client.disconnect()
