terraform {
  required_version = ">= 1.3.0"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
}

# Configure the DigitalOcean provider using the token variable.
# Never hardcode the token — pass it via TF_VAR_do_token or a .tfvars file.
provider "digitalocean" {
  token = var.do_token
}
