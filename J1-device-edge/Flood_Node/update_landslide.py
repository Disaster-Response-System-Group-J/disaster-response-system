import sys

file_path = "/home/sudil-minthaka/Documents/disaster-response-system/J1-device-edge/Landside_Node/src/main.cpp"
with open(file_path, "r") as f:
    content = f.read()

# Add Ticker include
if "#include <Ticker.h>" not in content:
    content = content.replace("#include <ArduinoJson.h>", "#include <ArduinoJson.h>\n#include <Ticker.h>")

# Add global Ticker object
if "Ticker watchdog;" not in content:
    content = content.replace("Adafruit_MPU6050 mpu;", "Adafruit_MPU6050 mpu;\nTicker watchdog;\nvoid wdtReset() {\n    ESP.restart();\n}")

# Add to setup
if "watchdog.attach(" not in content:
    content = content.replace("Serial.println(\"✅ LoRa Initialized OK!\");", "Serial.println(\"✅ LoRa Initialized OK!\");\n    watchdog.attach(25, wdtReset); // 25-second hardware watchdog")

# Add to loop
if "watchdog.attach(" in content and "watchdog.detach()" not in content:
    content = content.replace("void loop() {", "void loop() {\n    watchdog.detach();\n    watchdog.attach(25, wdtReset); // Feed the dog\n")

# Use non-blocking LoRa endPacket
if "LoRa.endPacket();" in content:
    content = content.replace("LoRa.endPacket();", "LoRa.endPacket(true); // Non-blocking async TX to prevent freezing")

with open(file_path, "w") as f:
    f.write(content)

print("Landslide updated")
