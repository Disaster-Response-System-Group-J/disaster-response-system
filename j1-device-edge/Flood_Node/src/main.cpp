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

    // LoRa.enableCrc(); // Disabled: CRC drops packets corrupted by RF saturation before the Gateway's JSON recovery can fix them
    
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

    if (millis() - lastDHTReadTime >= 6200 || lastDHTReadTime == 0) {
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
        doc["depth"] = round(depth * 10.0) / 10.0;

        String jsonString;
        serializeJson(doc, jsonString);

        Serial.println("--- SENSOR READINGS ---");
        Serial.print("JSON Output: "); Serial.println(jsonString);

        Serial.println("Initiating LoRa transmission...");
        delay(random(10, 800));
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
