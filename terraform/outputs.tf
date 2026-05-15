# Cluster ID - useful for referencing the cluster in other Terraform resources
# (e.g. digitalocean_kubernetes_node_pool, firewall rules).
output "cluster_id" {
  description = "The unique ID of the Kubernetes cluster"
  value       = digitalocean_kubernetes_cluster.disaster_response.id
}

output "cluster_name" {
  description = "The Kubernetes cluster name"
  value       = digitalocean_kubernetes_cluster.disaster_response.name
}

output "cluster_region" {
  description = "The DigitalOcean region where the cluster is running"
  value       = digitalocean_kubernetes_cluster.disaster_response.region
}

# API server endpoint - use this as the server URL in kubeconfig or CI pipelines.
output "cluster_endpoint" {
  description = "The HTTPS endpoint of the Kubernetes API server"
  value       = digitalocean_kubernetes_cluster.disaster_response.endpoint
}

output "primary_node_pool_name" {
  description = "The configured primary node pool name"
  value       = var.node_pool_name
}
