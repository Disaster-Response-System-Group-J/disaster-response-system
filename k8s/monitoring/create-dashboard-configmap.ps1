# Create dashboard ConfigMap from JSON file
# Usage: .\create-dashboard-configmap.ps1

$namespace = "disaster-response"
$jsonFile = ".\dashboards\drs-overview.json"
$configMapName = "grafana-dashboards-data"

if (-not (Test-Path $jsonFile)) {
    Write-Error "Dashboard JSON file not found: $jsonFile"
    exit 1
}

# Create ConfigMap from the JSON file
kubectl create configmap $configMapName `
  --from-file="drs-overview.json=$jsonFile" `
  --namespace=$namespace `
  --dry-run=client `
  -o yaml | kubectl apply -f -

Write-Host "Dashboard ConfigMap created successfully!" -ForegroundColor Green
Write-Host "Dashboard will be auto-provisioned on next Grafana pod restart/redeploy" -ForegroundColor Cyan
