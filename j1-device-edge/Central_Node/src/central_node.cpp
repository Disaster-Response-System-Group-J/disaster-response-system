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

static String normalizeLoRaJson(String payload) {
    payload.trim();

    // Keep only JSON body when noise exists before or after the packet.
    int firstBrace = payload.indexOf('{');
    int lastBrace = payload.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
        payload = payload.substring(firstBrace, lastBrace + 1);
    }

    // If opening brace is missing but we can still see fields, recover packet.
    if (!payload.startsWith("{") && payload.indexOf("\"type\"") >= 0) {
        int typeIndex = payload.indexOf("\"type\"");
        if (payload.indexOf("J1_TX_02") >= 0 || payload.indexOf("LANDSLIDE") >= 0) {
            payload = "{\"id\":\"J1_TX_02\"," + payload.substring(typeIndex);
        } else if (payload.indexOf("J1_TX_01") >= 0 || payload.indexOf("FLOOD") >= 0) {
            payload = "{\"id\":\"J1_TX_01\"," + payload.substring(typeIndex);
        } else {
            payload = "{" + payload.substring(typeIndex);
        }
    }

    if (!payload.endsWith("}")) {
        int closeBrace = payload.lastIndexOf('}');
        if (closeBrace >= 0) {
            payload = payload.substring(0, closeBrace + 1);
        } else {
            payload += "}";
        }
    }

    // Remove duplicated closing braces created by RF garbage.
    while (payload.endsWith("}}")) {
        payload.remove(payload.length() - 1);
    }

    return payload;
}

static String resolveMqttTopic(const JsonDocument& doc) {
    String nodeId = doc["node_id"] | doc["id"] | "";
    String type = doc["type"] | "";

    if (nodeId == "J1_TX_01" || type == "SENSOR_DATA" || type == "SENSOR_DATA_FLOOD" || type == "FLOOD") {
        return "j1/disaster/flood";
    }
    if (nodeId == "J1_TX_02" || type == "SENSOR_DATA_LANDSLIDE" || type == "LANDSLIDE") {
        return "j1/disaster/landslide";
    }

    return "";
}

// Flood Level Detection (max height 19cm)
// Minor: 5-9cm, Moderate: 10-14cm, Heavy: 15+cm
bool shouldPublishToMainFloodTopic(const JsonDocument& doc) {
    String type = doc["type"] | "";
    
    // Only apply flood level filtering to flood data
    if (type == "FLOOD" || type == "SENSOR_DATA_FLOOD") {
        float depth = doc["depth"] | 0.0;
        // Don't publish to main topic if depth is below minor level (5cm)
        if (depth < 5.0) {
            return false;  // Below minor level - monitoring only
        }
    }
    
    // For non-flood data or depth >= 5cm, always publish to main topic
    return true;
}

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
    
    // LoRa.enableCrc();
    LoRa.setTxPower(2);
    LoRa.setSpreadingFactor(9);
    LoRa.setSignalBandwidth(125E3);
    LoRa.setCodingRate4(8);

    Serial.println("✅ LoRa Gateway Initialized OK! Waiting for packets...");
}

// Timing control for MQTT publishing
unsigned long lastPublishToRedTopic = 0;    // For 1s interval to flood_red
unsigned long lastPublishToMainTopic = 0;   // For 5s interval to flood

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
        
        Serial.print("\n📥 [LoRa] Received ");
        Serial.print(packetSize);
        Serial.print(" bytes: ");
        Serial.println(receivedData);
        Serial.print("   RSSI: ");
        Serial.print(LoRa.packetRssi());
        Serial.print(" dBm | SNR: ");
        Serial.println(LoRa.packetSnr());

        String normalizedData = normalizeLoRaJson(receivedData);
        if (normalizedData != receivedData) {
            Serial.print("   Repaired JSON: ");
            Serial.println(normalizedData);
        }
        
        // Parse JSON to route to correct topic
        JsonDocument doc;
        DeserializationError error = deserializeJson(doc, normalizedData);
        
        if (!error) {
            String topic = resolveMqttTopic(doc);

            if (topic != "") {
                bool publishToMain = shouldPublishToMainFloodTopic(doc);
                unsigned long currentTime = millis();
                
                // Publish to j1/disaster/flood_red every 1 second
                if (currentTime - lastPublishToRedTopic >= 1000) {
                    String nodeRedTopic = topic + "_red";
                    if (client.publish(nodeRedTopic.c_str(), receivedData.c_str())) {
                        Serial.print("   ✅ Published to Node-RED topic: ");
                        Serial.println(nodeRedTopic);
                    } else {
                        Serial.println("   ❌ Node-RED topic publish failed!");
                    }
                    lastPublishToRedTopic = currentTime;
                }
                
                // Publish to j1/disaster/flood every 5 seconds (if conditions met)
                if (publishToMain && (currentTime - lastPublishToMainTopic >= 5000)) {
                    if (client.publish(topic.c_str(), receivedData.c_str())) {
                        Serial.print("   ✅ Published to MQTT topic: ");
                        Serial.println(topic);
                    } else {
                        Serial.println("   ❌ MQTT Publish Failed!");
                    }
                    lastPublishToMainTopic = currentTime;
                } else if (!publishToMain) {
                    Serial.println("   ℹ️ Skipped main topic - depth below minor level threshold (5cm)");
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
