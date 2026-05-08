#!/bin/bash
# Script to generate Prometheus file-based service discovery config
# from Docker labels. Run this periodically or on service changes.

OUTPUT_FILE="/tmp/sd_config.json"

# Generate JSON targets from running containers with prometheus-scrape label
docker ps --format "table {{.Names}}\t{{.Label \"prometheus-scrape\"}}\t{{.Label \"prometheus-port\"}}\t{{.Label \"prometheus-path\"}}\t{{.Label \"prometheus-job\"}}" | \
  awk 'NR>1 && $2=="true" {
    job = $5 ~ /^$/ ? "docker" : $5
    port = $3 ~ /^$/ ? "9090" : $3
    path = $4 ~ /^$/ ? "/metrics" : $4
    printf "  { \"targets\": [\"%s:%s\"], \"labels\": { \"job\": \"%s\", \"__metrics_path__\": \"%s\" } },\n", $1, port, job, path
  }' | sed '$ s/,$//' > /tmp/sd_targets.txt

cat > "$OUTPUT_FILE" << 'EOF'
[
EOF

cat /tmp/sd_targets.txt >> "$OUTPUT_FILE"

cat >> "$OUTPUT_FILE" << 'EOF'
]
EOF

echo "Generated $OUTPUT_FILE"
cat "$OUTPUT_FILE"
