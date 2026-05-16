#!/bin/bash
# USB debug runner for J1 disaster response app
# Usage: ./run_usb.sh <YOUR_LAN_IP>
# Example: ./run_usb.sh 192.168.1.47
#
# Find your LAN IP:
#   Windows:   ipconfig  (look for IPv4 under your WiFi adapter)
#   Mac/Linux: ifconfig  (look for inet under en0 or wlan0)

IP=${1:?"Provide your LAN IP. Usage: ./run_usb.sh 192.168.1.47"}

echo "Checking for connected Android device..."
flutter devices

echo ""
echo "Starting app on USB device..."
echo "Backend URL: http://$IP:8081"
echo ""
echo "Controls after launch:"
echo "  r  = hot reload"
echo "  R  = full restart (no reinstall)"
echo "  q  = quit"
echo ""

flutter run \
  --dart-define=J1_API_BASE_URL=http://$IP:8081 \
  --dart-define=J1_WS_BASE_URL=ws://$IP:8081
