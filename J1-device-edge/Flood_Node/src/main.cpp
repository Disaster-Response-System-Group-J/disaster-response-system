#include <Arduino.h>
#include <SPI.h>
#include <LoRa.h>
#include <DHT.h>
#include <ArduinoJson.h>

// Sensor Pins
#define DHTPIN 4
#define DHTTYPE DHT11
#define TRIG_PIN 32
#define ECHO_PIN 33

// LoRa Pins (Standard ESP32 VSPI)
#define ss 5
#define rst 14
#define dio0 26

DHT dht(DHTPIN, DHTTYPE);

void setup() {
    Serial.begin(115200);
    while (!Serial);

    Serial.println("Starting Transmitter Node...");

    dht.begin();
    pinMode(TRIG_PIN, OUTPUT);
    pinMode(ECHO_PIN, INPUT);

    LoRa.setPins(ss, rst, dio0);
    if (!LoRa.begin(433E6)) { // Set to 433MHz / 868MHz / 915MHz depending on your module
        Serial.println("Starting LoRa failed!");
        while (1);
    }
    Serial.println("LoRa Initialized OK!");
}

float measureDistance() {
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(2);
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);
    
    long duration = pulseIn(ECHO_PIN, HIGH, 30000); // 30ms timeout
    if (duration == 0) return -1; // Out of range or error
    return duration * 0.034 / 2;
}

void loop() {
    float temp = dht.readTemperature();
    float hum = dht.readHumidity();
    float depth = measureDistance();

    // Prepare JSON
    JsonDocument doc;
    doc["node_id"] = "J1_TX_01";
    doc["type"] = "SENSOR_DATA";
    
    if (isnan(temp) || isnan(hum)) {
        Serial.println("Failed to read from DHT sensor! Sending only depth.");
        doc["temperature"] = serialized("null");
        doc["humidity"] = serialized("null");
    } else {
        doc["temperature"] = temp;
        doc["humidity"] = hum;
    }
    
    doc["water_depth_cm"] = depth;

    String jsonString;
    serializeJson(doc, jsonString);

    Serial.print("Sending packet: ");
    Serial.println(jsonString);

    // Send packet
    LoRa.beginPacket();
    LoRa.print(jsonString);
    LoRa.endPacket();

    delay(5000); // Send data every 5 seconds
}