# DigitalOcean personal access token.
# Supply via: export TF_VAR_do_token="<your-token>"
# or create a terraform.tfvars file (excluded from git - see .gitignore).
variable "do_token" {
  description = "DigitalOcean API token with read/write access"
  type        = string
  sensitive   = true
}

variable "cluster_name" {
  description = "DigitalOcean Kubernetes cluster name."
  type        = string
  default     = "disaster-response"

  validation {
    condition     = length(trimspace(var.cluster_name)) > 0
    error_message = "cluster_name must not be empty."
  }
}

variable "region" {
  description = "DigitalOcean region where the Kubernetes cluster is created."
  type        = string
  default     = "sgp1"

  validation {
    condition     = length(trimspace(var.region)) > 0
    error_message = "region must not be empty."
  }
}

variable "kubernetes_version" {
  description = "DigitalOcean Kubernetes version for the cluster."
  type        = string
  default     = "1.35.1-do.5"

  validation {
    condition     = length(trimspace(var.kubernetes_version)) > 0
    error_message = "kubernetes_version must not be empty."
  }
}

variable "node_pool_name" {
  description = "Name of the primary worker node pool."
  type        = string
  default     = "pool-k8o6lpuuk"

  validation {
    condition     = length(trimspace(var.node_pool_name)) > 0
    error_message = "node_pool_name must not be empty."
  }
}

variable "node_size" {
  description = "DigitalOcean Droplet size used by worker nodes."
  type        = string
  default     = "s-2vcpu-8gb-160gb-intel"

  validation {
    condition     = length(trimspace(var.node_size)) > 0
    error_message = "node_size must not be empty."
  }
}

variable "node_count" {
  description = "Number of worker nodes in the primary node pool."
  type        = number
  default     = 2

  validation {
    condition     = var.node_count >= 1
    error_message = "node_count must be at least 1."
  }
}
