#include <Arduino.h>
#include <SPI.h>
#include <LoRa.h>
#include <DHT.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Wire.h>
#include <ArduinoJson.h>

#define DHTPIN 4
#define DHTTYPE DHT11
#define SOIL_MOISTURE_PIN 32

#define ss 5
#define rst 14
#define dio0 26

DHT dht(DHTPIN, DHTTYPE);
Adafruit_MPU6050 mpu;
bool mpuInitialized = false;

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
    delay(2000);
    while (!Serial);
    Serial.println("\nStarting Landslide Node...");

    dht.begin();
    Wire.begin();
    Wire.setTimeOut(150);
    
    if (!mpu.begin()) {
        Serial.println("Failed to find MPU6050 chip! Sending NULL values for gyro/accel.");
        mpuInitialized = false;
    } else {
        mpuInitialized = true;
        mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
        mpu.setGyroRange(MPU6050_RANGE_500_DEG);
        mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
        Serial.println("MPU6050 Initialized OK!");
    }

    LoRa.setPins(ss, rst, dio0);
    if (!LoRa.begin(433E6)) {
        Serial.println("Starting LoRa failed! Check wiring.");
        while (1) { delay(10); }
    }

    // Enable CRC to detect and reject corrupted packets before transmission
    LoRa.enableCrc();
    
    // Lowered TX Power from 20 to 2 to minimize RF interference
    LoRa.setTxPower(2);
    
    LoRa.setSpreadingFactor(9);
    LoRa.setSignalBandwidth(125E3);
    LoRa.setCodingRate4(8);

    randomSeed(analogRead(0));

    Serial.println("LoRa Initialized OK!");
    
    // Start the safe background watchdog
    xTaskCreatePinnedToCore(watchdogTask, "Watchdog", 2048, NULL, 1, NULL, 1);
}

unsigned long lastReadTime = 0;

void loop() {
    lastWatchdogFeed = millis(); // Feed the safe watchdog

    if (millis() - lastReadTime >= 300000 || lastReadTime == 0) {
        if (millis() > 3600000) {
            Serial.println("Scheduled hourly reboot...");
            delay(1000);
            ESP.restart();
        }
        lastReadTime = millis();
        
        float temp = dht.readTemperature();
        float hum = dht.readHumidity();

        sensors_event_t a, g, temp_mpu;
        float ax = 0, ay = 0, az = 0, gx = 0, gy = 0, gz = 0;
        
        if (mpuInitialized) {
            mpu.getEvent(&a, &g, &temp_mpu);
            ax = a.acceleration.x; ay = a.acceleration.y; az = a.acceleration.z;
            gx = g.gyro.x; gy = g.gyro.y; gz = g.gyro.z;
        }

        int soilMoistureRaw = analogRead(SOIL_MOISTURE_PIN);
        
        // Convert raw soil moisture (0-4095) to percentage (0-100%)
        // Raw 0 = fully wet (100%), Raw 4095 = fully dry (0%)
        float moisturePercentage = (4095.0 - soilMoistureRaw) / 4095.0 * 100.0;
        float moisturePercentageRounded = round(moisturePercentage * 10.0) / 10.0;

        JsonDocument doc;
        doc["id"] = "J1_TX_02";
        doc["type"] = "LANDSLIDE";
        
        if (isnan(temp) || isnan(hum)) {
            doc["temp"] = serialized("null");
            doc["hum"] = serialized("null");
        } else {
            doc["temp"] = round(temp * 10.0) / 10.0;
            doc["hum"] = round(hum * 10.0) / 10.0;
        }

        // Send only moisture percentage (0-100%) in "moist" field
        doc["moist"] = moisturePercentageRounded;
        
        doc["ax"] = round(ax * 100.0) / 100.0;
        doc["ay"] = round(ay * 100.0) / 100.0;
        doc["az"] = round(az * 100.0) / 100.0;
        doc["gx"] = round(gx * 100.0) / 100.0;
        doc["gy"] = round(gy * 100.0) / 100.0;
        doc["gz"] = round(gz * 100.0) / 100.0;

        String jsonString;
        serializeJson(doc, jsonString);

        Serial.println("--- LANDSLIDE NODE READINGS ---");
        Serial.print("Temperature: "); Serial.print((float)doc["temp"]); Serial.println(" °C");
        Serial.print("Humidity: "); Serial.print((float)doc["hum"]); Serial.println(" %");
        Serial.print("Soil Moisture: "); Serial.print(moisturePercentageRounded); Serial.println(" % (raw: "); Serial.print(soilMoistureRaw); Serial.println(")");
        Serial.print("JSON Output:   "); Serial.println(jsonString);

        Serial.println("Initiating LoRa transmission...");
        
        // Use absolute system time for collision avoidance
        unsigned long positionInFloodCycle = millis() % 1200;
        
        // If in danger zone, wait for Flood to finish transmitting
        if (positionInFloodCycle > 800) {
            unsigned long waitTime = (1200 - positionInFloodCycle) + 100;
            Serial.print("   Collision detected. Waiting ");
            Serial.print(waitTime);
            Serial.println("ms...");
            delay(waitTime);
        } else {
            delay(50 + random(0, 50));
        }
        
        LoRa.beginPacket();
        LoRa.print(jsonString);
        int txResult = LoRa.endPacket();
        if (txResult) {
            Serial.println("LoRa packet transmitted successfully!\n");
        } else {
            Serial.println("LoRa transmission FAILED! Check antenna/power.\n");
        }
    }
}
