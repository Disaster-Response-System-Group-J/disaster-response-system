import sys

# Fix Flood Node
file_path = "/home/sudil-minthaka/Documents/disaster-response-system/J1-device-edge/Flood_Node/src/main.cpp"
with open(file_path, "r") as f:
    content = f.read()

bad_loop = """void loop() {
    watchdog.detach();
    watchdog.attach(25, wdtReset); // Feed the dog

    // Use a 6.2 second interval to prevent continuous collisions with Landslide Node
    if (millis() - lastDHTReadTime >= 6200 || lastDHTReadTime == 0) {"""

good_loop = """void loop() {
    // Use a 6.2 second interval to prevent continuous collisions with Landslide Node
    if (millis() - lastDHTReadTime >= 6200 || lastDHTReadTime == 0) {
        watchdog.detach();
        watchdog.attach(25, wdtReset); // Feed the dog
"""
content = content.replace(bad_loop, good_loop)
with open(file_path, "w") as f:
    f.write(content)

# Fix Landslide Node
file_path = "/home/sudil-minthaka/Documents/disaster-response-system/J1-device-edge/Landside_Node/src/main.cpp"
with open(file_path, "r") as f:
    content = f.read()

bad_loop2 = """void loop() {
    watchdog.detach();
    watchdog.attach(25, wdtReset); // Feed the dog

    // Use an 8.7 second interval to prevent continuous collisions with Flood Node
    if (millis() - lastReadTime >= 8700 || lastReadTime == 0) {"""

good_loop2 = """void loop() {
    // Use an 8.7 second interval to prevent continuous collisions with Flood Node
    if (millis() - lastReadTime >= 8700 || lastReadTime == 0) {
        watchdog.detach();
        watchdog.attach(25, wdtReset); // Feed the dog
"""
content = content.replace(bad_loop2, good_loop2)
with open(file_path, "w") as f:
    f.write(content)

print("Nodes fixed")
