# DigitalOcean Managed Kubernetes cluster for the Disaster Response System.
# Defaults are defined in variables.tf so the same code can be reused for
# development, staging, or production without editing this resource.
resource "digitalocean_kubernetes_cluster" "disaster_response" {
  name    = var.cluster_name
  region  = var.region
  version = var.kubernetes_version

  # Primary node pool - all workload pods are scheduled here.
  node_pool {
    name       = var.node_pool_name
    size       = var.node_size
    node_count = var.node_count
  }
}
