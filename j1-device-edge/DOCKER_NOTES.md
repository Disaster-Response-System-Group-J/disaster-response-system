# Docker setup — build when ready

When the team is ready to containerize J1, create docker-compose.yml with:

services:
  j1-bridge-api:
    build: ./backend
    ports:
      - "8081:8081"
    env_file: .env
    networks:
      - disaster-net

  j1-mqtt-forwarder:
    build: ./backend
    command: python -m app.mqtt_kafka_bridge
    env_file: .env
    networks:
      - disaster-net

networks:
  disaster-net:
    external: true
    name: disaster-net

Both services join the root platform network. Kafka resolves as kafka:29092 via that network.
No Kafka, no database, no Mosquitto defined here — those live in the root compose.
