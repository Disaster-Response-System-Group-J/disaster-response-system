#include <Arduino.h>
#include <SPI.h>
#include <LoRa.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// Network & MQTT Settings
const char* ssid = "Fiber 2.4GHz";
const char* password = "salligewwamakiyannam";
const char* mqtt_server = "8e659da889be4ff7a3d839144a0f8aaa.s1.eu.hivemq.cloud";
const char* mqtt_user = "j1_gateway"; 
const char* mqtt_pass = "8797Sudil"; 

WiFiClientSecure espClient;
PubSubClient client(espClient);

// LoRa Pins (Standard ESP32 VSPI)
#define ss 5
#define rst 14
#define dio0 26

void setup_wifi() {
    Serial.print("\nConnecting to Wi-Fi: ");
    Serial.println(ssid);
    WiFi.begin(ssid, password);
    
    unsigned long startAttempt = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 15000) {
        delay(500);
        Serial.print(".");
    }
    
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("\n❌ WiFi failed to connect. Rebooting...");
        delay(1000);
        WiFi.disconnect(true);
        WiFi.mode(WIFI_OFF);
        delay(100);
        ESP.restart();
    }
    
    Serial.println("\n✅ WiFi connected.");
    
    // Skip SSL certificate validation
    espClient.setInsecure();
}

void reconnect() {
    while (!client.connected()) {
        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("WiFi dropped. Reconnecting...");
            setup_wifi();
        }
        
        Serial.print("Connecting to MQTT...");
        String clientId = "J1_Gateway_" + String(random(0xffff), HEX);
        if (client.connect(clientId.c_str(), mqtt_user, mqtt_pass)) {
            Serial.println("✅ connected!");
        } else {
            Serial.print("❌ failed, rc=");
            Serial.print(client.state());
            Serial.println(" trying again in 5 seconds");
            delay(5000);
        }
    }
}

void setup() {
    Serial.begin(115200);
    delay(2000); 
    Serial.println("\n====================================");
    Serial.println("   Starting Central Gateway Node ");
    Serial.println("====================================");
    
    setup_wifi();
    
    client.setServer(mqtt_server, 8883);
    client.setBufferSize(512); // Increase buffer for HiveMQ TLS packets

    LoRa.setPins(ss, rst, dio0);
    if (!LoRa.begin(433E6)) {
        Serial.println("❌ Starting LoRa failed! Check wiring.");
        while (1);
    }
    
    LoRa.enableCrc();
    LoRa.setTxPower(20);
    LoRa.setSpreadingFactor(9);
    LoRa.setSignalBandwidth(125E3);
    LoRa.setCodingRate4(8);

    Serial.println("✅ LoRa Gateway Initialized OK! Waiting for packets...");
}

void loop() {
    // Watchdog: If no packets received for 45 seconds, reboot!
    static unsigned long lastPacketTime = millis();
    if (millis() - lastPacketTime > 45000) {
        Serial.println("\n⚠️ WATCHDOG: No LoRa packets for 45s. Rebooting to clear radio hang...");
        delay(1000);
        WiFi.disconnect(true);
        WiFi.mode(WIFI_OFF);
        delay(100);
        ESP.restart();
    }

    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("\n⚠️ WiFi Connection Lost! Rebooting to recover clean state...");
        delay(1000);
        WiFi.disconnect(true);
        WiFi.mode(WIFI_OFF);
        delay(100);
        ESP.restart(); // Safest way to recover TLS stack on ESP32
    }

    if (!client.connected()) {
        reconnect();
    }
    client.loop();

    static unsigned long lastDebugTime = 0;
    if (millis() - lastDebugTime > 3000) {
        Serial.print(".");
        lastDebugTime = millis();
    }

    int packetSize = LoRa.parsePacket();
    if (packetSize) {
        lastPacketTime = millis(); // Reset watchdog
        String receivedData = "";
        while (LoRa.available()) {
            receivedData += (char)LoRa.read();
        }
        
        Serial.print("\n📥 [LoRa] Received packet: ");
        Serial.println(receivedData);
        Serial.print("   RSSI: ");
        Serial.println(LoRa.packetRssi());

        // ROCK-SOLID JSON RECOVERY
        // The ESP32 LoRa module might receive slightly corrupted first bytes due to RF saturation
        // (RSSI is -17 to -37, which is extremely strong).
        // If the string contains `"type"`, we can rebuild the beginning perfectly.
        int typeIndex = receivedData.indexOf("\"type\"");
        if (typeIndex > 0) {
            if (receivedData.indexOf("J1_TX_02") > 0) {
                receivedData = "{\"id\":\"J1_TX_02\"," + receivedData.substring(typeIndex);
                Serial.print("   🔧 Repaired JSON: ");
                Serial.println(receivedData);
            } else if (receivedData.indexOf("J1_TX_01") > 0) {
                receivedData = "{\"node_id\":\"J1_TX_01\"," + receivedData.substring(typeIndex);
                Serial.print("   🔧 Repaired JSON: ");
                Serial.println(receivedData);
            }
        }
        
        // Ensure trailing braces are correct
        if (!receivedData.endsWith("}")) {
            // Trim any garbage at the end
            int lastBrace = receivedData.lastIndexOf('}');
            if (lastBrace > 0) {
                receivedData = receivedData.substring(0, lastBrace + 1);
            } else {
                receivedData += "}";
            }
        }
        
        // Force cleanup of random multiple trailing brackets
        while(receivedData.endsWith("}}")) {
             receivedData.remove(receivedData.length()-1);
        }
        
        // Parse JSON to route to correct topic
        JsonDocument doc;
        DeserializationError error = deserializeJson(doc, receivedData);
        
        if (!error) {
            String nodeId = doc["node_id"] | doc["id"] | "";
            String type = doc["type"] | "";

            String topic = "";
            if (nodeId == "J1_TX_01" || type == "SENSOR_DATA" || type == "SENSOR_DATA_FLOOD" || type == "FLOOD") {
                topic = "j1/disaster/flood";
            } else if (nodeId == "J1_TX_02" || type == "SENSOR_DATA_LANDSLIDE" || type == "LANDSLIDE") {
                topic = "j1/disaster/landslide";
            }

            if (topic != "") {
                if (client.publish(topic.c_str(), receivedData.c_str())) {
                    Serial.print("   ✅ Published to MQTT topic: ");
                    Serial.println(topic);
                } else {
                    Serial.println("   ❌ MQTT Publish Failed!");
                }
            } else {
                Serial.println("   ⚠️ Unknown node or type. Packet ignored.");
            }
        } else {
            Serial.print("   ❌ Failed to parse JSON packet: ");
            Serial.println(error.c_str());
        }
    }
}
