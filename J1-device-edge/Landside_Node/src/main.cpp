#include <Arduino.h>
#include <SPI.h>
#include <LoRa.h>
#include <DHT.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Wire.h>
#include <ArduinoJson.h>

// Sensor Pins
#define DHTPIN 4
#define DHTTYPE DHT11

// LoRa Pins (Standard ESP32 VSPI)
#define ss 5
#define rst 14
#define dio0 26

DHT dht(DHTPIN, DHTTYPE);
Adafruit_MPU6050 mpu;

void setup() {
    Serial.begin(115200);
    while (!Serial);
    Serial.println("Starting Landslide Node...");

    dht.begin();
    
    // MPU6050 Setup (I2C using default SDA 21, SCL 22 on ESP32)
    if (!mpu.begin()) {
        Serial.println("Failed to find MPU6050 chip!");
    } else {
        mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
        mpu.setGyroRange(MPU6050_RANGE_500_DEG);
        mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
        Serial.println("MPU6050 Initialized OK!");
    }

    LoRa.setPins(ss, rst, dio0);
    if (!LoRa.begin(433E6)) { // Set your region frequency
        Serial.println("Starting LoRa failed!");
        while (1);
    }
    Serial.println("LoRa Initialized OK!");
}

unsigned long lastReadTime = 0;

void loop() {
    if (millis() - lastReadTime >= 2000 || lastReadTime == 0) {
        lastReadTime = millis();
        
        float temp = dht.readTemperature();
        float hum = dht.readHumidity();

        // Get new sensor events with the readings
        sensors_event_t a, g, temp_mpu;
        mpu.getEvent(&a, &g, &temp_mpu);

        // Prepare JSON
        JsonDocument doc;
        doc["node_id"] = "J1_TX_02";
        doc["type"] = "SENSOR_DATA_LANDSLIDE";
        
        if (isnan(temp) || isnan(hum)) {
            doc["temperature"] = serialized("null");
            doc["humidity"] = serialized("null");
        } else {
            doc["temperature"] = temp;
            doc["humidity"] = hum;
        }

        doc["accel_x"] = a.acceleration.x;
        doc["accel_y"] = a.acceleration.y;
        doc["accel_z"] = a.acceleration.z;
        doc["gyro_x"] = g.gyro.x;
        doc["gyro_y"] = g.gyro.y;
        doc["gyro_z"] = g.gyro.z;

        String jsonString;
        serializeJson(doc, jsonString);

        Serial.println("--- LANDSLIDE NODE READINGS ---");
        Serial.print("JSON Output: "); Serial.println(jsonString);

        // Send packet
        LoRa.beginPacket();
        LoRa.print(jsonString);
        LoRa.endPacket();
    }
}