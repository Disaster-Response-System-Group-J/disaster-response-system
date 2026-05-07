#!/usr/bin/env bash
# Run this script from the project ROOT directory:
#   bash k8s/setup.sh
#
# Prerequisites:
#   - kubectl installed and pointing at a cluster (minikube or Docker Desktop k8s)
#   - Docker installed (to build images)
#   - For minikube: run "minikube start" first
set -e

echo "==> 1. Creating namespace"
kubectl apply -f k8s/namespace.yaml

echo "==> 2. Creating secrets (edit k8s/secrets.yaml with real passwords first!)"
kubectl apply -f k8s/secrets.yaml

echo "==> 3. Creating ConfigMaps from source files"
kubectl create configmap keycloak-realm \
  --from-file=realm-export.json=j4-platform-security/keycloak/realm-export.json \
  -n disaster-response --dry-run=client -o yaml | kubectl apply -f -

kubectl create configmap grafana-dashboard-drs \
  --from-file=drs-overview.json=j4-platform-security/grafana/dashboards/drs-overview.json \
  -n disaster-response --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -f k8s/monitoring/configmaps.yaml

echo "==> 4. Building custom images (directly inside minikube's Docker daemon)"
eval $(minikube docker-env)

docker build -t j3-dms:latest \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:30800/api/v1/system \
  --build-arg NEXT_PUBLIC_SOCKET_URL=http://localhost:30001 \
  j3-system-interaction/dms

docker build -t j3-event-bridge:latest \
  -f j3-system-interaction/dms/Dockerfile.mock \
  j3-system-interaction/dms

docker build -t j3-mock-producer:latest \
  -f j3-system-interaction/dms/Dockerfile.mock \
  j3-system-interaction/dms

docker build -t j4-audit-api:latest \
  j4-platform-security/blockchain-audit

docker build -t hardhat-node:latest \
  -f j4-platform-security/blockchain-audit/Dockerfile.hardhat \
  j4-platform-security/blockchain-audit

docker build -t hardhat-deployer:latest \
  -f j4-platform-security/blockchain-audit/Dockerfile.deployer \
  j4-platform-security/blockchain-audit

echo "==> 5. Images are already in minikube (built with minikube docker-env)"

echo "==> 6. Applying all Kubernetes manifests"
kubectl apply -f k8s/infrastructure/
kubectl apply -f k8s/auth/
kubectl apply -f k8s/gateway/
kubectl apply -f k8s/monitoring/
kubectl apply -f k8s/j3/
kubectl apply -f k8s/j4/

echo ""
echo "==> Done! Check pod status with:"
echo "    kubectl get pods -n disaster-response"
echo ""
echo "==> Access URLs (replace MINIKUBE_IP with: minikube ip)"
echo "    J3 Dashboard:   http://MINIKUBE_IP:30000"
echo "    Event Bridge:   http://MINIKUBE_IP:30001"
echo "    Kong Proxy:     http://MINIKUBE_IP:30800"
echo "    Keycloak:       http://MINIKUBE_IP:30180"
echo "    Prometheus:     http://MINIKUBE_IP:30090"
echo "    Grafana:        http://MINIKUBE_IP:30030  (admin / your-password)"
echo "    J4 Audit API:   http://MINIKUBE_IP:30084"
echo "    Hardhat RPC:    http://MINIKUBE_IP:30545"
