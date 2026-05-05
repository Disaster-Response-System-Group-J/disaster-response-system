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

    // Enable CRC (Cyclic Redundancy Check) to ensure receiver only gets perfect, uncorrupted packets
    LoRa.enableCrc();

    // Set transmission power to MAXIMUM (20dBm) for better obstacle penetration
    LoRa.setTxPower(20);

    // Increase Spreading Factor to 9 (much better range and noise immunity)
    LoRa.setSpreadingFactor(9);
    
    // Narrow bandwidth back to 125E3 for more focused, stable signal strength
    LoRa.setSignalBandwidth(125E3);
    
    // INCREASE CODING RATE to max (4/8) to improve data integrity over the air
    LoRa.setCodingRate4(8);

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

unsigned long lastDHTReadTime = 0;
float temp = NAN;
float hum = NAN;

void loop() {
    // DHT11 requires at least 2 seconds between reads
    if (millis() - lastDHTReadTime >= 5000 || lastDHTReadTime == 0) {
        temp = dht.readTemperature();
        hum = dht.readHumidity();
        
        float depth = measureDistance();

        // Prepare JSON - SHORTENED keys to prevent buffer overflows
        JsonDocument doc;
        doc["id"] = "J1_TX_01";
        doc["type"] = "FLOOD";
        
        if (isnan(temp) || isnan(hum)) {
            Serial.println("Failed to read from DHT sensor! Sending only depth.");
            doc["temp"] = serialized("null");
            doc["hum"] = serialized("null");
        } else {
            // Round to 1 decimal to save bytes
            doc["temp"] = round(temp * 10.0) / 10.0;
            doc["hum"] = round(hum * 10.0) / 10.0;
        }
        
        doc["depth"] = round(depth * 10.0) / 10.0;

        String jsonString;
        serializeJson(doc, jsonString);

        Serial.println("--- SENSOR READINGS ---");
        Serial.print("Temperature: "); Serial.print(temp); Serial.println(" °C");
        Serial.print("Humidity:    "); Serial.print(hum); Serial.println(" %");
        Serial.print("Water Depth: "); Serial.print(depth); Serial.println(" cm");
        Serial.print("JSON Output: "); Serial.println(jsonString);
        Serial.println("-----------------------\n");

        // Send packet
        Serial.println("Initiating LoRa transmission...");
        LoRa.beginPacket();
        LoRa.print(jsonString);
        LoRa.endPacket();
        Serial.println("✅ LoRa packet transmitted successfully!\n");

        lastDHTReadTime = millis();
    }
}