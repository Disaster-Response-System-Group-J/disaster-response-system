# Continuous Deployment to DigitalOcean Kubernetes

This document explains the CD workflow and the Kubernetes manifests included in `k8s/`.

Required GitHub repository secrets
- `DO_TOKEN` — DigitalOcean API token (used by `doctl`).
- `DO_CLUSTER_NAME` — the name of your DigitalOcean Kubernetes cluster (used to fetch kubeconfig).
- Optionally, set `GHCR_PAT` if you cannot use the default `GITHUB_TOKEN` for GHCR pushes.

What the workflow does
- Builds all `Dockerfile` images found in the repo and pushes them to GitHub Container Registry (GHCR).
- Uses `doctl` to fetch kubeconfig for the named DO cluster and runs `kubectl apply -f k8s/`.

Where manifests live
- The repository `k8s/` directory contains infrastructure manifests for in-cluster Postgres, Kafka (with Zookeeper), and Prometheus.

How to run locally (manual)
1. Install `doctl` and authenticate: `doctl auth init --access-token $DO_TOKEN`.
2. Save kubeconfig: `doctl kubernetes cluster kubeconfig save "$DO_CLUSTER_NAME"`.
3. Create required Kubernetes secrets (example below) and apply manifests:

```bash
# create DB creds secret (example)
kubectl create secret generic db-creds \
  --from-literal=POSTGRES_USER=pguser \
  --from-literal=POSTGRES_PASSWORD=replace_me \
  --from-literal=POSTGRES_DB=appdb

# apply manifests
kubectl apply -f k8s/
```

Notes and caveats
- These manifests are minimal examples intended for development or small-scale deployments. For production, add backups, readiness/liveness probes, resource requests/limits, etc.
- Kafka is deployed as a single broker for simplicity; consider a StatefulSet with multiple replicas for production.
