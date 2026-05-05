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
#define SOIL_MOISTURE_PIN 32 // Analog pin for Soil Moisture Sensor v1.2

// LoRa Pins (Standard ESP32 VSPI)
#define ss 5
#define rst 14
#define dio0 26

DHT dht(DHTPIN, DHTTYPE);
Adafruit_MPU6050 mpu;
bool mpuInitialized = false;

void setup() {
    Serial.begin(115200);
    delay(2000); // Allow Serial Monitor time to connect
    while (!Serial);
    Serial.println("\n====================================");
    Serial.println("     Starting Landslide Node...");
    Serial.println("====================================");

    dht.begin();
    
    // MPU6050 Setup (I2C using default SDA 21, SCL 22 on ESP32)
    if (!mpu.begin()) {
        Serial.println("⚠️ Failed to find MPU6050 chip! Sending NULL values for gyro/accel.");
        // Removed the dead-end while(1) loop so it can still transmit other sensor data
        mpuInitialized = false;
    } else {
        mpuInitialized = true;
        mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
        mpu.setGyroRange(MPU6050_RANGE_500_DEG);
        mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
        Serial.println("MPU6050 Initialized OK!");
    }

    Serial.println("Initializing LoRa...");
    LoRa.setPins(ss, rst, dio0);
    if (!LoRa.begin(433E6)) { // Set your region frequency
        Serial.println("❌ Starting LoRa failed! Check wiring.");
        while (1) {
            delay(10);
        }
    }
    Serial.println("LoRa.begin OK!");

    // Enable CRC (Cyclic Redundancy Check) to ensure receiver only gets perfect, uncorrupted packets
    LoRa.enableCrc();

    Serial.println("Setting Spreading Factor...");
    // Set transmission power to MAXIMUM (20dBm) for better obstacle penetration
    LoRa.setTxPower(20);

    // Increase Spreading Factor to 9 (much better range and noise immunity)
    LoRa.setSpreadingFactor(9);
    
    // Narrow bandwidth back to 125E3 for more focused, stable signal strength
    LoRa.setSignalBandwidth(125E3);
    
    Serial.println("Setting Coding Rate...");
    // INCREASE CODING RATE to max (4/8) to improve data integrity over the air
    LoRa.setCodingRate4(8);

    Serial.println("✅ LoRa Initialized OK!");
}

unsigned long lastReadTime = 0;

void loop() {
    if (millis() - lastReadTime >= 5000 || lastReadTime == 0) { // Transmit every 5 seconds to avoid colliding with Flood node
        lastReadTime = millis();
        // Shift this by half a second so it never mathematically perfectly syncs up with flood
        delay(500);
        
        float temp = dht.readTemperature();
        float hum = dht.readHumidity();

        // Get new sensor events with the readings if MPU is connected
        sensors_event_t a, g, temp_mpu;
        float ax = 0, ay = 0, az = 0, gx = 0, gy = 0, gz = 0;
        
        // Only read MPU if it was successfully initialized during setup
        if (mpuInitialized) {
            mpu.getEvent(&a, &g, &temp_mpu);
            ax = a.acceleration.x; ay = a.acceleration.y; az = a.acceleration.z;
            gx = g.gyro.x; gy = g.gyro.y; gz = g.gyro.z;
        }

        // Read Soil Moisture (Analog value 0-4095 on ESP32)
        int soilMoistureRaw = analogRead(SOIL_MOISTURE_PIN);

        // Prepare JSON (Keys shortened to reduce LoRa payload size and prevent buffer overflow)
        JsonDocument doc;
        doc["id"] = "J1_TX_02";
        doc["type"] = "LANDSLIDE";
        
        if (isnan(temp) || isnan(hum)) {
            doc["temp"] = serialized("null");
            doc["hum"] = serialized("null");
        } else {
            // Round DHT to 1 decimal
            doc["temp"] = round(temp * 10.0) / 10.0;
            doc["hum"] = round(hum * 10.0) / 10.0;
        }

        doc["moist"] = soilMoistureRaw;
        
        // Round MPU data to 2 decimals to save massive amounts of string padding bytes
        doc["ax"] = round(ax * 100.0) / 100.0;
        doc["ay"] = round(ay * 100.0) / 100.0;
        doc["az"] = round(az * 100.0) / 100.0;
        doc["gx"] = round(gx * 100.0) / 100.0;
        doc["gy"] = round(gy * 100.0) / 100.0;
        doc["gz"] = round(gz * 100.0) / 100.0;

        String jsonString;
        serializeJson(doc, jsonString);

        Serial.println("--- LANDSLIDE NODE READINGS ---");
        Serial.print("Temperature:   "); Serial.print(temp); Serial.println(" °C");
        Serial.print("Humidity:      "); Serial.print(hum); Serial.println(" %");
        Serial.print("Soil Moisture: "); Serial.println(soilMoistureRaw);
        Serial.print("Accel (m/s^2): X="); Serial.print(ax); Serial.print(" Y="); Serial.print(ay); Serial.print(" Z="); Serial.println(az);
        Serial.print("Gyro (rad/s):  X="); Serial.print(gx); Serial.print(" Y="); Serial.print(gy); Serial.print(" Z="); Serial.println(gz);
        Serial.print("JSON Output:   "); Serial.println(jsonString);
        Serial.println("-------------------------------\n");

        // Send packet
        Serial.println("Initiating LoRa transmission...");
        LoRa.beginPacket();
        LoRa.print(jsonString);
        LoRa.endPacket();
        Serial.println("✅ LoRa packet transmitted successfully!\n");
    }
}