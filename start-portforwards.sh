#!/bin/bash

# Kill existing port-forwards
pkill -f "kubectl port-forward" 2>/dev/null
sleep 2

# Start all port-forwards
kubectl port-forward svc/j3-dms -n disaster-response 3000:3000 &
kubectl port-forward svc/grafana -n disaster-response 3001:3000 &
kubectl port-forward svc/keycloak -n disaster-response 8080:8080 &
kubectl port-forward svc/kong -n disaster-response 8000:8000 8001:8001 &
kubectl port-forward svc/prometheus -n disaster-response 9090:9090 &

echo "⏳ Waiting for services to be ready..."
sleep 3

# Open all in browser
open http://localhost:3000
open http://localhost:3001
open http://localhost:8080
open http://localhost:9090

echo "✅ All services started and opened in browser!"
echo ""
echo "🌐 j3-dms      → http://localhost:3000"
echo "📊 Grafana     → http://localhost:3001"
echo "🔐 Keycloak    → http://localhost:8080"
echo "⚙️  Kong Admin  → http://localhost:8001"
echo "📈 Prometheus  → http://localhost:9090"