# DigitalOcean personal access token.
# Supply via: export TF_VAR_do_token="<your-token>"
# or create a terraform.tfvars file (excluded from git — see .gitignore).
variable "do_token" {
  description = "DigitalOcean API token with read/write access"
  type        = string
  sensitive   = true
}
