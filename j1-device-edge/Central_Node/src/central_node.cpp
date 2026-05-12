#include <Arduino.h>
#include <SPI.h>
#include <LoRa.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <LittleFS.h>

// Network & MQTT Settings
const char* ssid = "Sudil's Pixel 7";
const char* password = "1234567898";
const char* mqtt_server = "8e659da889be4ff7a3d839144a0f8aaa.s1.eu.hivemq.cloud";
const char* mqtt_user = "j1_gateway"; 
const char* mqtt_pass = "8797Sudil"; 

WiFiClientSecure espClient;
PubSubClient client(espClient);

// LoRa Pins (Standard ESP32 VSPI)
#define ss 5
#define rst 14
#define dio0 26

// === OFFLINE BUFFER MANAGEMENT ===
#define BUFFER_DIR "/buffer"
#define BUFFER_INDEX_FILE "/buffer/index.txt"
#define MAX_BUFFER_FILES 100
#define MAX_BUFFER_SIZE 1048576  // 1MB max for buffer storage

bool wifiWasConnected = false;  // Track WiFi state changes
unsigned long bufferFileCounter = 0;  // Counter for unique buffer file names

// Initialize LittleFS and create buffer directory
void initializeBuffer() {
    Serial.println("\n⏳ Initializing LittleFS filesystem...");
    
    // Try to mount LittleFS
    if (!LittleFS.begin(true)) {  // true = format if mount fails
        Serial.println("⚠️ LittleFS mount failed, attempting format...");
        if (!LittleFS.format()) {
            Serial.println("❌ LittleFS format failed! Buffer system unavailable.");
            return;
        }
        if (!LittleFS.begin()) {
            Serial.println("❌ LittleFS mount still failed after format!");
            return;
        }
    }
    
    // Create buffer directory if it doesn't exist
    if (!LittleFS.exists(BUFFER_DIR)) {
        if (LittleFS.mkdir(BUFFER_DIR)) {
            Serial.println("📁 Buffer directory created: " BUFFER_DIR);
        } else {
            Serial.println("⚠️ Failed to create buffer directory");
        }
    } else {
        Serial.println("📁 Buffer directory already exists: " BUFFER_DIR);
    }
    
    Serial.println("✅ LittleFS initialized. Buffer ready.");
}

// Save a packet to buffer when WiFi is offline
void bufferPacket(const String& data, const String& topic, bool isMainTopic) {
    // Validate filesystem is available
    if (!LittleFS.exists(BUFFER_DIR)) {
        if (!LittleFS.mkdir(BUFFER_DIR)) {
            Serial.println("   ⚠️ Buffer directory unavailable - skipping buffer");
            return;
        }
    }
    
    // Create filename with counter
    String filename = String(BUFFER_DIR) + "/pkt_" + String(bufferFileCounter++) + ".json";
    
    // Create JSON wrapper with metadata
    JsonDocument bufferDoc;
    bufferDoc["timestamp"] = millis();
    bufferDoc["topic"] = topic;
    bufferDoc["isMainTopic"] = isMainTopic;
    bufferDoc["data"] = data;
    
    // Write to file with error checking
    File file = LittleFS.open(filename, "w");
    if (file) {
        size_t bytesWritten = serializeJson(bufferDoc, file);
        file.close();
        if (bytesWritten > 0) {
            Serial.print("   💾 Buffered to: ");
            Serial.println(filename);
        } else {
            Serial.print("   ⚠️ Failed to write data to: ");
            Serial.println(filename);
        }
    } else {
        Serial.print("   ❌ Cannot open file for writing: ");
        Serial.println(filename);
    }
}

// Get total buffer size in bytes
unsigned long getBufferSize() {
    unsigned long totalSize = 0;
    File root = LittleFS.open(BUFFER_DIR);
    File file = root.openNextFile();
    
    while (file) {
        totalSize += file.size();
        file = root.openNextFile();
    }
    root.close();
    return totalSize;
}

// Sync all buffered packets to MQTT broker
void syncBufferedData() {
    if (!client.connected()) {
        Serial.println("⚠️ MQTT not connected - cannot sync yet. Will retry...");
        return;
    }
    
    Serial.println("\n🔄 Starting buffer sync to broker...");
    
    File root = LittleFS.open(BUFFER_DIR);
    File file = root.openNextFile();
    
    unsigned long syncedCount = 0;
    unsigned long failedCount = 0;
    
    while (file) {
        String filename = file.name();
        
        // Read buffer file
        JsonDocument bufferDoc;
        DeserializationError error = deserializeJson(bufferDoc, file);
        
        if (!error) {
            String topic = bufferDoc["topic"] | "";
            String data = bufferDoc["data"] | "";
            bool isMainTopic = bufferDoc["isMainTopic"] | false;
            
            // Publish to appropriate topic
            const char* targetTopic = topic.c_str();
            
            // Ensure MQTT is still connected before publishing
            if (!client.connected()) {
                Serial.println("   ⚠️ MQTT disconnected during sync - pausing sync");
                break;
            }
            
            if (client.publish(targetTopic, data.c_str())) {
                Serial.print("   ✅ Synced: ");
                Serial.print(filename);
                Serial.print(" → ");
                Serial.println(targetTopic);
                syncedCount++;
                
                // Delete file after successful sync
                file.close();
                LittleFS.remove(filename);
                file = root.openNextFile();
            } else {
                Serial.print("   ⚠️ Sync failed: ");
                Serial.println(filename);
                failedCount++;
                file = root.openNextFile();
            }
        } else {
            Serial.print("   ❌ Parse error in: ");
            Serial.println(filename);
            file = root.openNextFile();
        }
    }
    root.close();
    
    Serial.print("📊 Sync complete - Synced: ");
    Serial.print(syncedCount);
    Serial.print(" | Failed: ");
    Serial.println(failedCount);
}

// Clear all buffered data (useful for debugging)
void clearBuffer() {
    File root = LittleFS.open(BUFFER_DIR);
    File file = root.openNextFile();
    
    unsigned long deletedCount = 0;
    while (file) {
        String filename = file.name();
        file.close();
        LittleFS.remove(filename);
        deletedCount++;
        file = root.openNextFile();
    }
    root.close();
    
    Serial.print("🗑️ Buffer cleared - Deleted ");
    Serial.print(deletedCount);
    Serial.println(" files.");
}

static String normalizeLoRaJson(String payload) {
    payload.trim();

    // Step 1: Remove non-printable/corrupted bytes (keep only ASCII 32-126 and newline)s
    String cleaned = "";
    for (int i = 0; i < payload.length(); i++) {
        char c = payload[i];
        // Keep printable ASCII, braces, quotes, colons, commas
        if ((c >= 32 && c <= 126) || c == '\n' || c == '\r') {
            cleaned += c;
        } else {
            // Replace corrupted byte with placeholder to help with field detection
            if (c >= '0' && c <= '9') cleaned += '0';  // Corrupted digit -> 0
        }
    }
    payload = cleaned;

    // Step 2: Keep only JSON body when noise exists before or after the packet
    int firstBrace = payload.indexOf('{');
    int lastBrace = payload.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
        payload = payload.substring(firstBrace, lastBrace + 1);
    }

    // Step 3: If opening brace is missing but we can still see fields, recover packet
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

    // Step 4: Fix missing colons after field names (RF corruption: "depth"20 -> "depth":20)
    payload.replace("\"depth\"2", "\"depth\":2");
    payload.replace("\"temp\"3", "\"temp\":3");
    payload.replace("\"hum\"8", "\"hum\":8");
    payload.replace("\"hum\"9", "\"hum\":9");
    payload.replace("\"moist\"2", "\"moist\":2");
    payload.replace("\"ax\"0", "\"ax\":0");
    payload.replace("\"ay\"0", "\"ay\":0");
    payload.replace("\"az\"0", "\"az\":0");
    payload.replace("\"gx\"0", "\"gx\":0");
    payload.replace("\"gy\"0", "\"gy\":0");
    payload.replace("\"gz\"0", "\"gz\":0");

    // Step 5: Ensure proper closing
    if (!payload.endsWith("}")) {
        int closeBrace = payload.lastIndexOf('}');
        if (closeBrace >= 0) {
            payload = payload.substring(0, closeBrace + 1);
        } else {
            payload += "}";
        }
    }

    // Step 6: Remove duplicated closing braces
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
        if (depth < 3.0) {
            return false;  // Below minor level - monitoring only
        }
    }
    
    // For non-flood data or depth >= 3cm, always publish to main topic
    return true;
}

// Landslide Soil Moisture Detection
// Soil moisture percentage: < 30% = dry soil (don't alert), >= 30% = critical moisture level (alert)
bool shouldPublishToMainLandslideTopic(const JsonDocument& doc) {
    String type = doc["type"] | "";
    
    // Only apply soil moisture filtering to landslide data
    if (type == "LANDSLIDE" || type == "SENSOR_DATA_LANDSLIDE") {
        float moisturePercent = doc["moist"] | 0.0;  // moist field contains percentage (0-100%)
        
        // Don't publish to main topic if soil moisture is below 30% (dry soil = not critical)
        if (moisturePercent < 30.0) {
            return false;  // Below critical level - monitoring only (still goes to _red)
        }
    }
    
    // For non-landslide data or moisture >= 30%, always publish to main topic
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
    
    // Initialize LittleFS buffer FIRST
    Serial.println("\n⏳ Initializing offline buffer system...");
    initializeBuffer();
    
    // Initialize LoRa FIRST - before WiFi interference
    Serial.println("\n⏳ Initializing LoRa module...");
    LoRa.setPins(ss, rst, dio0);
    if (!LoRa.begin(433E6)) {
        Serial.println("❌ Starting LoRa failed! Check wiring.");
        while (1);
    }
    
    // Wait for LoRa SPI to stabilize
    delay(1000);
    
    // Configure LoRa parameters
    LoRa.enableCrc();  // Enable CRC for packet validation
    LoRa.setTxPower(2);
    LoRa.setSpreadingFactor(9);
    LoRa.setSignalBandwidth(125E3);
    LoRa.setCodingRate4(8);
    
    // Explicitly set to receive mode
    LoRa.receive();
    delay(200);  // Give LoRa time to enter RX mode
    Serial.println("✅ LoRa Gateway Initialized OK!");
    
    // Now initialize WiFi and MQTT (after LoRa is stable)
    setup_wifi();
    
    client.setServer(mqtt_server, 8883);
    client.setBufferSize(512); // Increase buffer for HiveMQ TLS packets
    
    // Mark that WiFi was initially connected
    wifiWasConnected = (WiFi.status() == WL_CONNECTED);
    
    Serial.println("✅ Ready! Waiting for LoRa packets...");
}

// Timing control for MQTT publishing
unsigned long lastPublishToRedTopic = 0;    // For 1s interval to flood_red
unsigned long lastPublishToMainTopic = 0;   // For 5s interval to flood
unsigned long lastLoRaSafetyRefresh = 0;    // Track when we last refreshed RX mode for safety
unsigned long lastBufferSizeCheck = 0;      // Track buffer size periodically
unsigned long lastSyncAttempt = 0;          // Track last sync attempt time
bool syncRequired = false;                   // Flag to track if sync is needed

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

    // ✅ NEW: Track WiFi status changes
    bool wifiNowConnected = (WiFi.status() == WL_CONNECTED);
    
    if (wifiNowConnected && !wifiWasConnected) {
        // WiFi just came back online - set sync flag
        Serial.println("\n✅ WiFi reconnected! Will sync buffered data once MQTT connects...");
        wifiWasConnected = true;
        syncRequired = true;  // Set flag to sync when MQTT is ready
        lastSyncAttempt = millis();
    } else if (!wifiNowConnected && wifiWasConnected) {
        // WiFi just went down - enter offline mode
        Serial.println("\n⚠️ WiFi disconnected! Entering offline buffering mode...");
        wifiWasConnected = false;
        syncRequired = false;  // Clear sync flag
    }
    
    // If WiFi is down, show buffer status periodically
    if (!wifiNowConnected) {
        if (millis() - lastBufferSizeCheck > 5000) {
            unsigned long bufferSize = getBufferSize();
            Serial.print("📦 Buffer size: ");
            Serial.print(bufferSize / 1024);
            Serial.print(" KB | Files: ");
            
            File root = LittleFS.open(BUFFER_DIR);
            int fileCount = 0;
            File file = root.openNextFile();
            while (file) {
                fileCount++;
                file = root.openNextFile();
            }
            root.close();
            
            Serial.println(fileCount);
            lastBufferSizeCheck = millis();
        }
    }
    
    // Try to maintain MQTT connection if WiFi is available
    if (wifiNowConnected) {
        if (!client.connected()) {
            reconnect();
        } else {
            client.loop();
        }
    }
    
    // ✅ NEW: If sync is required and MQTT is now connected, sync buffered data
    if (syncRequired && client.connected()) {
        Serial.println("\n🔄 MQTT connected. Starting sync of buffered data...");
        syncBufferedData();
        syncRequired = false;  // Clear flag after sync attempt
    }
    
    // ✅ NEW: Periodically retry sync if it was required but MQTT wasn't ready
    if (syncRequired && wifiNowConnected && (millis() - lastSyncAttempt > 10000)) {
        if (client.connected()) {
            Serial.println("\n🔄 Retrying buffer sync...");
            syncBufferedData();
            syncRequired = false;
        }
        lastSyncAttempt = millis();
    }

    static unsigned long lastDebugTime = 0;
    if (millis() - lastDebugTime > 3000) {
        if (wifiNowConnected && client.connected()) {
            Serial.print(".");
        } else if (wifiNowConnected && !client.connected()) {
            Serial.print("M");  // MQTT connecting
        } else {
            Serial.print("W");  // WiFi down
        }
        lastDebugTime = millis();
    }

    // SAFETY: Very infrequent RX mode refresh (every 30 seconds) to recover from any hangs
    // Normal operation: parsePacket() handles receiving without this being called frequently
    if (millis() - lastLoRaSafetyRefresh > 30000) {
        LoRa.receive();
        lastLoRaSafetyRefresh = millis();
    }
    
    // Check for incoming LoRa packets - this does NOT interfere with RX mode
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
            // Validate that required fields exist to ensure packet isn't too corrupted
            String nodeId = doc["id"] | "";
            String type = doc["type"] | "";
            
            if (nodeId.length() == 0 || type.length() == 0) {
                Serial.println("   ⚠️ Packet missing required fields (id or type) - likely too corrupted, skipping.");
            } else {
                String topic = resolveMqttTopic(doc);

                if (topic != "") {
                    // Determine if we should publish to main topic based on data type
                    bool publishToMain = false;
                    String type = doc["type"] | "";
                    
                    if (type == "FLOOD" || type == "SENSOR_DATA_FLOOD") {
                        publishToMain = shouldPublishToMainFloodTopic(doc);
                    } else if (type == "LANDSLIDE" || type == "SENSOR_DATA_LANDSLIDE") {
                        publishToMain = shouldPublishToMainLandslideTopic(doc);
                    } else {
                        publishToMain = true;  // Default: publish to main for unknown types
                    }
                    
                    unsigned long currentTime = millis();
                    
                    // ✅ NEW: If WiFi is down, buffer all data
                    if (!wifiNowConnected) {
                        String nodeRedTopic = topic + "_red";
                        bufferPacket(normalizedData, nodeRedTopic, false);
                        if (publishToMain) {
                            bufferPacket(normalizedData, topic, true);
                        }
                    } else if (client.connected()) {
                        // WiFi is up and MQTT connected - publish normally
                        
                        // Publish to j1/disaster/flood_red or landslide_red every 1 second
                        if (currentTime - lastPublishToRedTopic >= 1000) {
                            String nodeRedTopic = topic + "_red";
                            if (client.publish(nodeRedTopic.c_str(), normalizedData.c_str())) {
                                Serial.print("   ✅ Published to Node-RED topic: ");
                                Serial.println(nodeRedTopic);
                            } else {
                                Serial.println("   ❌ Node-RED topic publish failed - buffering!");
                                bufferPacket(normalizedData, nodeRedTopic, false);
                            }
                            lastPublishToRedTopic = currentTime;
                        }
                        
                        // Publish to j1/disaster/flood every 5 seconds (if conditions met)
                        if (publishToMain && (currentTime - lastPublishToMainTopic >= 5000)) {
                            if (client.publish(topic.c_str(), normalizedData.c_str())) {
                                Serial.print("   ✅ Published to MQTT topic: ");
                                Serial.println(topic);
                            } else {
                                Serial.println("   ❌ MQTT Publish Failed - buffering!");
                                bufferPacket(normalizedData, topic, true);
                            }
                            lastPublishToMainTopic = currentTime;
                        } else if (!publishToMain) {
                            // Show reason for skipping based on data type
                            if (type == "FLOOD" || type == "SENSOR_DATA_FLOOD") {
                                Serial.println("   ℹ️ Skipped main topic - flood depth below threshold (< 3cm)");
                            } else if (type == "LANDSLIDE" || type == "SENSOR_DATA_LANDSLIDE") {
                                float moisturePercent = doc["moist"] | 0.0;
                                Serial.print("   ℹ️ Skipped main topic - soil moisture ");
                                Serial.print(moisturePercent, 1);
                                Serial.println("% below critical threshold (< 30%)");
                            } else {
                                Serial.println("   ℹ️ Skipped main topic - conditions not met");
                            }
                        }
                    } else {
                        // WiFi is up but MQTT is not connected - buffer temporarily
                        Serial.println("   ⚠️ MQTT not connected - buffering data...");
                        String nodeRedTopic = topic + "_red";
                        bufferPacket(normalizedData, nodeRedTopic, false);
                        if (publishToMain) {
                            bufferPacket(normalizedData, topic, true);
                        }
                    }
                } else {
                    Serial.println("   ⚠️ Unknown node or type. Packet ignored.");
                }
            }
        } else {
            Serial.print("   ❌ Failed to parse JSON packet: ");
            Serial.println(error.c_str());
        }
    } else {
        // No packet available - small delay to prevent CPU spinning
        delay(10);
    }
}
