# DigitalOcean Managed Kubernetes cluster for the Disaster Response System.
# Cluster is provisioned in the Singapore (sgp1) region with a fixed node pool.
resource "digitalocean_kubernetes_cluster" "disaster_response" {
  name    = "disaster-response"
  region  = "sgp1"
  version = "1.35.1-do.5"

  # Primary node pool — all workload pods are scheduled here.
  node_pool {
    name       = "pool-k8o6lpuuk"
    size       = "s-2vcpu-8gb-160gb-intel"
    node_count = 2
  }
}
