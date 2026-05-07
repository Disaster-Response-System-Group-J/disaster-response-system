# Prometheus Auto-Discovery Guide

## How It Works

Prometheus now uses **file-based service discovery** with `sd_config.json` to automatically discover and scrape metrics from services.

- Prometheus watches `/etc/prometheus/sd_config.json` for changes
- When the file is updated, Prometheus re-reads it within 30 seconds
- No manual prometheus.yml editing required

## Adding a New Service

### Step 1: Add Labels to docker-compose.yml

Add the following labels to your service in `docker-compose.yml`:

```yaml
my-new-service:
  image: my-image:latest
  ports:
    - "9999:9999"
  labels:
    prometheus-scrape: "true"           # Enable scraping
    prometheus-port: "9999"              # Metrics port (default: 9090)
    prometheus-path: "/metrics"          # Metrics endpoint (default: /metrics)
    prometheus-job: "my-job"             # Job name in Prometheus (default: docker)
  networks:
    - disaster-net
```

### Step 2: Update sd_config.json

Add an entry to `prometheus/sd_config.json`:

```json
{
  "targets": ["my-new-service:9999"],
  "labels": {
    "job": "my-job",
    "__metrics_path__": "/metrics"
  }
}
```

### Step 3: Restart Services

```bash
# Start the new service
docker compose up -d my-new-service

# Prometheus will auto-detect it within 30 seconds
# Check targets at http://localhost:9090/targets
```

## Examples

### Service with custom metrics path

```json
{
  "targets": ["api-service:3000"],
  "labels": {
    "job": "api",
    "__metrics_path__": "/api/metrics"
  }
}
```

### Service with non-standard port

```yaml
my-metrics-service:
  image: metrics-exporter:latest
  ports:
    - "8888:8888"
  labels:
    prometheus-scrape: "true"
    prometheus-port: "8888"
    prometheus-path: "/metrics"
    prometheus-job: "custom-exporter"
```

## Verification

Check if your service is being scraped:

```bash
curl http://localhost:9090/api/v1/targets | grep -i "my-job"
```

Or visit the Prometheus UI: http://localhost:9090/targets

## Troubleshooting

**Service shows as "down":**
- Check if the service is running: `docker compose ps my-service`
- Verify the metrics endpoint is accessible: `curl http://localhost:PORT/PATH`
- Check Prometheus logs: `docker compose logs prometheus`

**Service not appearing in targets:**
- Verify sd_config.json syntax is valid JSON: `jq . prometheus/sd_config.json`
- Make sure docker-compose.yml labels are set correctly
- Prometheus checks sd_config.json every 30 seconds; wait a bit and refresh

**504 errors or "connection refused":**
- Ensure service is on the `disaster-net` network
- Verify the port and path are correct
- Check if the service is actually exposing metrics on that endpoint
