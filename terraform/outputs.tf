# Cluster ID — useful for referencing the cluster in other Terraform resources
# (e.g. digitalocean_kubernetes_node_pool, firewall rules).
output "cluster_id" {
  description = "The unique ID of the Kubernetes cluster"
  value       = digitalocean_kubernetes_cluster.disaster_response.id
}

# API server endpoint — use this as the server URL in kubeconfig or CI pipelines.
output "cluster_endpoint" {
  description = "The HTTPS endpoint of the Kubernetes API server"
  value       = digitalocean_kubernetes_cluster.disaster_response.endpoint
}
