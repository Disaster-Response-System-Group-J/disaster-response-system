import sys

file_path = "/home/sudil-minthaka/Documents/disaster-response-system/J1-device-edge/Central_Node/src/central_node.cpp"
with open(file_path, "r") as f:
    content = f.read()

# Replace all ESP.restart() with a safe sequence
bad_restart = "ESP.restart();"
safe_restart = """WiFi.disconnect(true);
        WiFi.mode(WIFI_OFF);
        delay(100);
        ESP.restart();"""

content = content.replace(bad_restart, safe_restart)

with open(file_path, "w") as f:
    f.write(content)

print("Central node restart fixed")
