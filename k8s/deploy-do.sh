#!/usr/bin/env bash
# deployment script for Digital Ocean Kubernetes (DOKS)
# Usage: bash k8s/deploy-do.sh <REGISTRY_NAME>
# Example: bash k8s/deploy-do.sh docker.io/myuser

set -e

REGISTRY=$1

if [ -z "$REGISTRY" ]; then
  echo "Usage: $0 <REGISTRY_NAME>"
  exit 1
fi

echo "==> 1. Creating namespace"
kubectl apply -f k8s/namespace.yaml

echo "==> 2. Creating secrets and configmaps"
kubectl apply -f k8s/secrets.yaml

kubectl create configmap keycloak-realm \
  --from-file=realm-export.json=j4-platform-security/keycloak/realm-export.json \
  -n disaster-response --dry-run=client -o yaml | kubectl apply -f -

kubectl create configmap grafana-dashboard-drs \
  --from-file=drs-overview.json=j4-platform-security/grafana/dashboards/drs-overview.json \
  -n disaster-response --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -f k8s/monitoring/configmaps.yaml

echo "==> 3. Building and Pushing images to $REGISTRY"

# Build J3 DMS (using registry path)
docker build -t $REGISTRY/j3-dms:latest \
  --build-arg NEXT_PUBLIC_API_URL=/api/v1/system \
  --build-arg NEXT_PUBLIC_SOCKET_URL=/socket.io \
  j3-system-interaction/dms
docker push $REGISTRY/j3-dms:latest

# Build others
docker build -t $REGISTRY/j3-event-bridge:latest -f j3-system-interaction/dms/Dockerfile.mock j3-system-interaction/dms
docker push $REGISTRY/j3-event-bridge:latest

docker build -t $REGISTRY/j3-mock-producer:latest -f j3-system-interaction/dms/Dockerfile.mock j3-system-interaction/dms
docker push $REGISTRY/j3-mock-producer:latest

docker build -t $REGISTRY/j2-data-intelligence:latest j2-data-intelligence
docker push $REGISTRY/j2-data-intelligence:latest

docker build -t $REGISTRY/j4-audit-api:latest j4-platform-security/blockchain-audit
docker push $REGISTRY/j4-audit-api:latest

docker build -t $REGISTRY/hardhat-node:latest -f j4-platform-security/blockchain-audit/Dockerfile.hardhat j4-platform-security/blockchain-audit
docker push $REGISTRY/hardhat-node:latest

# j4-hardhat is the deployer image (also pushed as hardhat-deployer for compatibility)
docker build -t $REGISTRY/hardhat-deployer:latest -f j4-platform-security/blockchain-audit/Dockerfile.deployer j4-platform-security/blockchain-audit
docker push $REGISTRY/hardhat-deployer:latest
docker tag $REGISTRY/hardhat-deployer:latest $REGISTRY/j4-hardhat:latest
docker push $REGISTRY/j4-hardhat:latest

echo "==> 4. Updating manifests with registry path and applying"

# Temporary directory for updated manifests — always clean to prevent stale registry URLs
rm -rf k8s/output
mkdir -p k8s/output

for dir in infrastructure auth gateway monitoring j2 j3 j4; do
  mkdir -p k8s/output/$dir
  for file in k8s/$dir/*.yaml; do
    filename=$(basename $file)
    sed -E "s#image: (j3-dms|j3-event-bridge|j3-mock-producer|j2-data-intelligence|j4-audit-api|hardhat-node|hardhat-deployer|j4-hardhat):latest#image: $REGISTRY/\1:latest#g" $file > k8s/output/$dir/$filename
    sed -i "s|imagePullPolicy: Never|imagePullPolicy: IfNotPresent|g" k8s/output/$dir/$filename
  done
  kubectl apply -f k8s/output/$dir/
done

echo "==> Done! Deployment complete."
echo "Check status with: kubectl get pods -n disaster-response"
