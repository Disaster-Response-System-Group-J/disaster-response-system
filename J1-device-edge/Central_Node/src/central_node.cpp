#include <Arduino.h>
#include <SPI.h>
#include <LoRa.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// Network & MQTT Settings
const char* ssid = "Fiber 5 GHz";
const char* password = "methuki123";
const char* mqtt_server = "broker.hivemq.com";

WiFiClient espClient;
PubSubClient client(espClient);

// LoRa Pins (Standard ESP32 VSPI)
#define ss 5
#define rst 14
#define dio0 26

void setup_wifi() {
    Serial.print("\nConnecting to Wi-Fi: ");
    Serial.println(ssid);
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nWiFi connected.");
}

void reconnect() {
    while (!client.connected()) {
        Serial.print("Connecting to MQTT...");
        String clientId = "J1_Gateway_Client_" + String(random(0xffff), HEX);
        if (client.connect(clientId.c_str())) {
            Serial.println("connected!");
        } else {
            Serial.print("failed, rc=");
            Serial.print(client.state());
            delay(5000);
        }
    }
}

void setup() {
    Serial.begin(115200);
    setup_wifi();
    client.setServer(mqtt_server, 1883);

    LoRa.setPins(ss, rst, dio0);
    if (!LoRa.begin(433E6)) {
        Serial.println("Starting LoRa failed!");
        while (1);
    }
    Serial.println("LoRa Initialized OK!");
}

void loop() {
    if (!client.connected()) {
        reconnect();
    }
    client.loop();

    int packetSize = LoRa.parsePacket();
    if (packetSize) {
        String receivedData = "";
        while (LoRa.available()) {
            receivedData += (char)LoRa.read();
        }
        
        Serial.print("Received packet: ");
        Serial.println(receivedData);

        // Parse JSON to route to correct topic
        JsonDocument doc;
        DeserializationError error = deserializeJson(doc, receivedData);
        
        if (!error) {
            String nodeId = doc["node_id"] | "";
            String type = doc["type"] | "";

            String topic = "";
            if (nodeId == "J1_TX_01" || type == "SENSOR_DATA" || type == "SENSOR_DATA_FLOOD") {
                topic = "j1/disaster/flood";
            } else if (nodeId == "J1_TX_02" || type == "SENSOR_DATA_LANDSLIDE") {
                topic = "j1/disaster/landslide";
            }

            if (topic != "") {
                client.publish(topic.c_str(), receivedData.c_str());
                Serial.println("Published to topic: " + topic);
            } else {
                Serial.println("Unknown node or type. Packet ignored.");
            }
        } else {
            Serial.println("Failed to parse JSON packet");
        }
    }
}