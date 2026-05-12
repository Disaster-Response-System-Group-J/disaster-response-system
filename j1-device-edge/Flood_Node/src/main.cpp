#include <Arduino.h>
#include <SPI.h>
#include <LoRa.h>
#include <DHT.h>
#include <ArduinoJson.h>
#include <algorithm>


// Sensor Pins
#define DHTPIN 4
#define DHTTYPE DHT11
#define TRIG_PIN 32
#define ECHO_PIN 33

// LoRa Pins
#define ss 5
#define rst 14
#define dio0 26

DHT dht(DHTPIN, DHTTYPE);

// FreeRTOS Safe Background Watchdog
unsigned long lastWatchdogFeed = 0;
void watchdogTask(void *parameter) {
    while (true) {
        delay(2000);
        if (millis() - lastWatchdogFeed > 30000 && lastWatchdogFeed > 0) {
            Serial.println("⚠️ SYSTEM HANG DETECTED! Hard rebooting...");
            delay(100);
            ESP.restart();
        }
    }
}

void setup() {
    Serial.begin(115200);
    while (!Serial);

    Serial.println("Starting Transmitter Node...");

    dht.begin();
    pinMode(TRIG_PIN, OUTPUT);
    pinMode(ECHO_PIN, INPUT);

    LoRa.setPins(ss, rst, dio0);
    if (!LoRa.begin(433E6)) {
        Serial.println("Starting LoRa failed!");
        while (1);
    }

    // Enable CRC to detect and reject corrupted packets before transmission
    // This prevents RF-corrupted data from being sent
    LoRa.enableCrc();
    
    // 🔥 CRITICAL FIX: Lowered TX Power from 20 to 2
    // 20dBm causes extreme RF interference at close range, which physically corrupts 
    // the SPI data lines and crashes the LoRa chip permanently until power cycled.
    // 2dBm minimizes RF saturation at the receiver.
    LoRa.setTxPower(2); 
    
    LoRa.setSpreadingFactor(9);
    LoRa.setSignalBandwidth(125E3);
    LoRa.setCodingRate4(8);

    randomSeed(analogRead(0));

    Serial.println("LoRa Initialized OK!");
    
    // Start the safe background watchdog
    xTaskCreatePinnedToCore(watchdogTask, "Watchdog", 2048, NULL, 1, NULL, 1);
}

float measureDistance() {
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(2);
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);
    
    long duration = pulseIn(ECHO_PIN, HIGH, 30000);
    if (duration == 0) return -1;
    return duration * 0.034 / 2;
}

unsigned long lastDHTReadTime = 0;
float temp = NAN;
float hum = NAN;

void loop() {
    lastWatchdogFeed = millis(); // Feed the safe watchdog

    if (millis() - lastDHTReadTime >= 1200 || lastDHTReadTime == 0) {
        if (millis() > 3600000) {
            Serial.println("Scheduled hourly reboot...");
            delay(1000);
            ESP.restart();
        }

        temp = dht.readTemperature();
        hum = dht.readHumidity();
        float depth = measureDistance();

        JsonDocument doc;
        doc["id"] = "J1_TX_01";
        doc["type"] = "FLOOD";
        
        if (isnan(temp) || isnan(hum)) {
            doc["temp"] = serialized("null");
            doc["hum"] = serialized("null");
        } else {
            doc["temp"] = round(temp * 10.0) / 10.0;
            doc["hum"] = round(hum * 10.0) / 10.0;
        }
        doc["depth"] = std::max(0.0f, 19.0f - (depth > 0 ? depth : 0));

        String jsonString;
        serializeJson(doc, jsonString);

        Serial.println("--- SENSOR READINGS ---");
        Serial.print("JSON Output: "); Serial.println(jsonString);

        Serial.println("Initiating LoRa transmission...");
        
        // ✅ FIXED: Use absolute system time for collision avoidance
        // Landslide transmits at: 0ms, 3700ms, 7400ms, 11100ms, etc.
        // Flood transmits at: 0ms, 1200ms, 2400ms, 3600ms, 4800ms, 6000ms, 7200ms, etc.
        // Check current position in Landslide's 3700ms cycle
        unsigned long positionInLandslideCycle = millis() % 3700;
        
        // Landslide is transmitting during the last 100ms of its cycle (3600-3700ms)
        // If we're in danger zone (past 3300ms), wait for Landslide to finish transmitting
        if (positionInLandslideCycle > 3300) {
            unsigned long waitTime = (3700 - positionInLandslideCycle) + 100;  // Wait until Landslide completes + 100ms buffer
            Serial.print("   ⚠️ Collision danger detected (in Landslide window). Waiting ");
            Serial.print(waitTime);
            Serial.println("ms...");
            delay(waitTime);
        } else {
            // Safe to transmit - add small jitter for robustness
            delay(50 + random(0, 50));
        }
        
        LoRa.beginPacket();
        LoRa.print(jsonString);
        int txResult = LoRa.endPacket();
        if (txResult) {
            Serial.println("✅ LoRa packet transmitted successfully!\n");
        } else {
            Serial.println("❌ LoRa transmission FAILED! Check antenna/power.\n");
        }

        lastDHTReadTime = millis();
    }
}
