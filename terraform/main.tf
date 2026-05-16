# DigitalOcean Project to group all related resources
resource "digitalocean_project" "disaster_system" {
  name        = var.project_name
  description = var.project_description
  purpose     = "IoT"
  environment = "Production"
}

# DigitalOcean Managed Kubernetes cluster
resource "digitalocean_kubernetes_cluster" "disaster_response" {
  name    = var.cluster_name
  region  = var.region
  version = var.kubernetes_version

  # Primary node pool with optional auto-scaling
  node_pool {
    name       = var.node_pool_name
    size       = var.node_size
    node_count = var.auto_scale ? null : var.node_count
    
    auto_scale = var.auto_scale
    min_nodes  = var.auto_scale ? var.min_nodes : null
    max_nodes  = var.auto_scale ? var.max_nodes : null
  }
}

# Link the cluster to the project
resource "digitalocean_project_resources" "project_assets" {
  project = digitalocean_project.disaster_system.id
  resources = [
    digitalocean_kubernetes_cluster.disaster_response.urn
  ]
}
