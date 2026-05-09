# AWS EC2 Kubernetes Deployment Roadmap
### Disaster Response System — Beginner's Complete Guide

> This guide walks you through every step to deploy your application on AWS EC2 running Kubernetes.  
> Your project already has a `k8s/` folder with manifests — we will adapt and use those.

---

## Table of Contents

1. [Before You Start — Big Picture](#1-before-you-start--big-picture)
2. [Prerequisites & Tools](#2-prerequisites--tools)
3. [AWS Account Setup](#3-aws-account-setup)
4. [Launch Your EC2 Instances](#4-launch-your-ec2-instances)
5. [Connect to Your EC2 Instances](#5-connect-to-your-ec2-instances)
6. [Install Kubernetes on EC2](#6-install-kubernetes-on-ec2)
7. [Set Up Amazon ECR (Container Registry)](#7-set-up-amazon-ecr-container-registry)
8. [Build & Push Your Docker Images](#8-build--push-your-docker-images)
9. [Update Your k8s Manifests for EC2](#9-update-your-k8s-manifests-for-ec2)
10. [Configure Kubernetes Secrets](#10-configure-kubernetes-secrets)
11. [Deploy Everything to Kubernetes](#11-deploy-everything-to-kubernetes)
12. [Configure External Access & Security Groups](#12-configure-external-access--security-groups)
13. [Verify Your Deployment](#13-verify-your-deployment)
14. [Useful Commands Cheat Sheet](#14-useful-commands-cheat-sheet)
15. [Troubleshooting Common Issues](#15-troubleshooting-common-issues)

---

## 1. Before You Start — Big Picture

### What You're Building

```
Your Laptop
    │
    │  git push / kubectl apply
    ▼
AWS Cloud
┌─────────────────────────────────────────────────┐
│  EC2 Instance (Master Node)                     │
│  ┌─────────────────────────────────────────┐   │
│  │  Kubernetes Cluster                      │   │
│  │                                          │   │
│  │  ┌──────────┐  ┌──────────┐             │   │
│  │  │  J2 Pod  │  │  J3 Pod  │  ...        │   │
│  │  └──────────┘  └──────────┘             │   │
│  │  ┌──────────┐  ┌──────────┐             │   │
│  │  │ Postgres │  │  Kafka   │  ...        │   │
│  │  └──────────┘  └──────────┘             │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
         │
         │ ECR (Amazon Container Registry)
         │ Stores your Docker images
```

### Key Concepts to Understand First

| Term | What it means in plain English |
|------|-------------------------------|
| **EC2** | A virtual computer (server) renting from AWS |
| **Kubernetes (K8s)** | Software that runs and manages your containers on that server |
| **Pod** | The smallest unit in K8s — one or more containers running together |
| **Deployment** | A K8s resource that says "run N copies of this pod" |
| **Service** | A K8s resource that gives a stable network address to pods |
| **Namespace** | A logical grouping of K8s resources (yours is `disaster-response`) |
| **ECR** | Amazon's Docker Hub — where you store your built images |
| **kubectl** | The command-line tool you use to talk to Kubernetes |
| **kubeadm** | The tool that installs and sets up Kubernetes on a server |
| **NodePort** | Exposes a K8s service on a port of the actual EC2 machine |

### What's Already in Your k8s/ Folder

```
k8s/
├── namespace.yaml              ← Creates the disaster-response namespace
├── secrets.yaml                ← All passwords / credentials
├── secrets.example.yaml        ← Template for secrets
├── setup.sh                    ← Helper script (was for minikube, we'll adapt)
├── infrastructure/
│   ├── postgres.yaml           ← PostgreSQL database
│   └── kafka.yaml              ← Apache Kafka message broker
├── auth/
│   └── keycloak.yaml           ← Keycloak authentication server
├── gateway/
│   └── kong.yaml               ← Kong API gateway
├── j2/
│   ├── deployment.yaml         ← J2 Data Intelligence service
│   └── service.yaml
├── j3/
│   ├── dms.yaml                ← J3 Dashboard (Next.js)
│   ├── event-bridge.yaml       ← J3 Event Bridge
│   └── mock-producer.yaml
├── j4/
│   ├── hardhat.yaml            ← Blockchain node
│   └── audit-api.yaml          ← Audit API
└── monitoring/
    ├── configmaps.yaml         ← Prometheus & Grafana config
    ├── prometheus.yaml         ← Prometheus monitoring
    ├── grafana.yaml            ← Grafana dashboards
    └── postgres-exporter.yaml
```

---

## 2. Prerequisites & Tools

### On Your Local Machine (Mac)

Install all of these before doing anything else.

#### Step 2.1 — Install AWS CLI
```bash
# Install via Homebrew
brew install awscli

# Verify
aws --version
# Expected: aws-cli/2.x.x
```

#### Step 2.2 — Install kubectl
```bash
brew install kubectl

# Verify
kubectl version --client
```

#### Step 2.3 — Install Docker Desktop
- Download from: https://www.docker.com/products/docker-desktop/
- Make sure it's running (you'll see the whale icon in your menu bar)

#### Step 2.4 — Make sure you have an AWS Account
- Go to https://aws.amazon.com and create an account if you don't have one
- You'll need a credit card — the free tier covers most of this if you're careful
- **Important:** Set a billing alert at $10 so you don't get surprised

---

## 3. AWS Account Setup

### Step 3.1 — Create an IAM User (Don't use root)

The "root" account is like the master key. Create a separate user for this work.

1. Log in to AWS Console → search "IAM" → click IAM
2. Left panel → **Users** → **Create user**
3. Username: `k8s-deployer`
4. Select **Programmatic access** AND **AWS Management Console access**
5. Permissions: Attach these policies:
   - `AmazonEC2FullAccess`
   - `AmazonECRFullAccess`
   - `AmazonVPCFullAccess`
6. Complete creation → **Download the CSV** with credentials (you only get this once!)

### Step 3.2 — Configure AWS CLI on Your Mac

```bash
aws configure
```

You'll be prompted for:
```
AWS Access Key ID: [paste from CSV]
AWS Secret Access Key: [paste from CSV]
Default region name: us-east-1        ← type this (or your preferred region)
Default output format: json
```

Verify it works:
```bash
aws sts get-caller-identity
# Should show your account ID and username
```

### Step 3.3 — Create a Key Pair (SSH Access to EC2)

This is like a password to SSH into your EC2 server.

```bash
# Create the key pair and save it
aws ec2 create-key-pair \
  --key-name disaster-response-key \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/disaster-response-key.pem

# Restrict permissions (required for SSH to work)
chmod 400 ~/.ssh/disaster-response-key.pem
```

---

## 4. Launch Your EC2 Instances

### Instance Sizing Decision

Your application has 20+ services (Postgres, Kafka, Keycloak, Kong, ELK stack, J2, J3, J4, Prometheus, Grafana, etc.). This needs serious resources.

**Recommended for this project:**

| Setup | Instance Type | vCPU | RAM | Cost/month | Best for |
|-------|--------------|------|-----|------------|----------|
| Single node (simplest) | `t3.2xlarge` | 8 | 32GB | ~$240 | Demo / student |
| Single node (minimum) | `t3.xlarge` | 4 | 16GB | ~$120 | May struggle with ELK |
| Master + 1 Worker | `t3.medium` + `t3.xlarge` | — | — | ~$180 | More realistic |

> **For a student project: Use a single `t3.xlarge` or `t3.2xlarge` and stop it when not in use.**  
> A stopped instance does NOT charge compute (only storage, ~$1/month).

### Step 4.1 — Find the Ubuntu AMI ID

```bash
# Get the latest Ubuntu 22.04 LTS AMI for your region
aws ec2 describe-images \
  --owners 099720109477 \
  --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" \
  --query 'sort_by(Images, &CreationDate)[-1].ImageId' \
  --output text
```

Copy the output — it looks like `ami-0abc1234def56789`. Call it `YOUR_AMI_ID`.

### Step 4.2 — Create a Security Group

A security group is a firewall that controls what traffic can reach your EC2.

```bash
# Create the security group
aws ec2 create-security-group \
  --group-name disaster-response-sg \
  --description "Security group for disaster response k8s cluster"
```

Copy the `GroupId` from the output (looks like `sg-0abc123`). Call it `YOUR_SG_ID`.

```bash
# Allow SSH (your access)
aws ec2 authorize-security-group-ingress \
  --group-id YOUR_SG_ID \
  --protocol tcp --port 22 --cidr 0.0.0.0/0

# Allow Kubernetes API (port 6443)
aws ec2 authorize-security-group-ingress \
  --group-id YOUR_SG_ID \
  --protocol tcp --port 6443 --cidr 0.0.0.0/0

# Allow all NodePort range (30000-32767) — your app's services
aws ec2 authorize-security-group-ingress \
  --group-id YOUR_SG_ID \
  --protocol tcp --port 30000-32767 --cidr 0.0.0.0/0

# Allow HTTP/HTTPS
aws ec2 authorize-security-group-ingress \
  --group-id YOUR_SG_ID \
  --protocol tcp --port 80 --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id sg-0e1e293d23ed6c2a4 \
  --protocol tcp --port 443 --cidr 0.0.0.0/0

# Allow all internal traffic (needed for K8s pod-to-pod communication)
aws ec2 authorize-security-group-ingress \
  --group-id sg-0e1e293d23ed6c2a4 \
  --protocol -1 --source-group sg-0e1e293d23ed6c2a4
```

### Step 4.3 — Launch the EC2 Instance

```bash
aws ec2 run-instances \
  --image-id ami-0a936bb624678fd88 \
  --instance-type t3.micro \
  --key-name disaster-response-key \
  --security-group-ids sg-0e1e293d23ed6c2a4 \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":20,"VolumeType":"gp3"}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=disaster-response-master}]' \
  --count 1
```

> The `--block-device-mappings` gives you 50GB of disk. Docker images are large — you need this.

### Step 4.4 — Get Your EC2 Public IP

```bash
aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=disaster-response-master" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text
```

Save this IP. Call it `YOUR_EC2_IP`. Example: `54.123.45.67`

> **Note:** The public IP changes every time you stop/start the instance unless you allocate an Elastic IP (optional, costs ~$3.6/month if unattached).

---

## 5. Connect to Your EC2 Instances

### Step 5.1 — SSH Into Your Server

```bash
ssh -i ~/.ssh/disaster-response-key.pem ubuntu@YOUR_EC2_IP
```

If you see a prompt like `ubuntu@ip-172-...:~$` — you're in!

**You'll run all commands in Steps 6–11 on this EC2 server (not your Mac)**, unless stated otherwise.

---

## 6. Install Kubernetes on EC2

> All commands below run on the EC2 server via SSH.

### Step 6.1 — Update the System

```bash
sudo apt-get update && sudo apt-get upgrade -y
```

### Step 6.2 — Install Docker (Container Runtime)

```bash
# Install Docker
sudo apt-get install -y ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io

# Allow ubuntu user to run docker without sudo
sudo usermod -aG docker ubuntu
newgrp docker

# Verify
docker --version
```

### Step 6.3 — Configure containerd for Kubernetes

```bash
# Generate default config
sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml

# Enable SystemdCgroup (required for kubeadm)
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml

sudo systemctl restart containerd
sudo systemctl enable containerd
```

### Step 6.4 — Disable Swap (Kubernetes requirement)

```bash
sudo swapoff -a
# Permanently disable swap
sudo sed -i '/ swap / s/^\(.*\)$/#\1/g' /etc/fstab
```

### Step 6.5 — Enable Kernel Modules for Networking

```bash
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF

sudo modprobe overlay
sudo modprobe br_netfilter

cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF

sudo sysctl --system
```

### Step 6.6 — Install kubeadm, kubelet, kubectl

```bash
sudo apt-get update
sudo apt-get install -y apt-transport-https ca-certificates curl gpg

curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.29/deb/Release.key | \
  sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg

echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] \
  https://pkgs.k8s.io/core:/stable:/v1.29/deb/ /' | \
  sudo tee /etc/apt/sources.list.d/kubernetes.list

sudo apt-get update
sudo apt-get install -y kubelet kubeadm kubectl
sudo apt-mark hold kubelet kubeadm kubectl

# Verify
kubeadm version
kubectl version --client
```

### Step 6.7 — Initialize the Kubernetes Cluster

```bash
# Get the private IP of this EC2 instance
PRIVATE_IP=$(hostname -I | awk '{print $1}')
echo "Private IP: $PRIVATE_IP"

# Initialize the cluster
# Replace YOUR_EC2_IP with your actual public IP
sudo kubeadm init \
  --apiserver-advertise-address=$PRIVATE_IP \
  --pod-network-cidr=10.244.0.0/16 \
  --apiserver-cert-extra-sans=YOUR_EC2_IP
```

This takes 2–3 minutes. At the end you'll see a `kubeadm join` command — **save it** if you plan to add worker nodes later.

### Step 6.8 — Configure kubectl Access

```bash
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config

# Verify the cluster is running
kubectl get nodes
# You should see: NAME   STATUS   NotReady   ...
```

"NotReady" is expected — we need to install networking next.

### Step 6.9 — Install Pod Networking (Flannel)

Without this, pods cannot communicate with each other.

```bash
kubectl apply -f https://raw.githubusercontent.com/flannel-io/flannel/master/Documentation/kube-flannel.yml

# Wait ~60 seconds, then check
kubectl get nodes
# STATUS should change to: Ready
```

### Step 6.10 — Allow Pods to Run on Master (Single Node Setup)

Since you have only one node, you need to allow the master to run application pods:

```bash
kubectl taint nodes --all node-role.kubernetes.io/control-plane-
```

### Step 6.11 — Verify the Cluster

```bash
kubectl get nodes
# NAME                    STATUS   ROLES           AGE   VERSION
# ip-172-xx-xx-xx         Ready    control-plane   5m    v1.29.x

kubectl get pods -n kube-system
# All pods should be Running or Completed
```

---

## 7. Set Up Amazon ECR (Container Registry)

> Run these commands on **your Mac** (not EC2). ECR stores your Docker images so EC2 can pull them.

### Step 7.1 — Create ECR Repositories

You need one repository per custom Docker image in your project.

```bash
# Set your AWS region
REGION=us-east-1
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Create a repository for each service
for service in j2-data-intelligence j3-dms j3-event-bridge j4-audit-api j4-hardhat; do
  aws ecr create-repository \
    --repository-name disaster-response/$service \
    --region $REGION
  echo "Created: $service"
done
```

### Step 7.2 — Log Docker Into ECR

```bash
aws ecr get-login-password --region $REGION | \
  docker login --username AWS \
  --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com
```

You should see: `Login Succeeded`

---

## 8. Build & Push Your Docker Images

> Run these on **your Mac** in the project directory.

```bash
cd "/Users/dehanns/Dehan/Uni/Software Engineering/disaster-response-system"

REGION=us-east-1
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_BASE=$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/disaster-response
```

### Step 8.1 — Build & Push J2 Data Intelligence

```bash
docker build -t $ECR_BASE/j2-data-intelligence:latest ./j2-data-intelligence/
docker push $ECR_BASE/j2-data-intelligence:latest
```

### Step 8.2 — Build & Push J3 DMS (Next.js Dashboard)

```bash
docker build -t $ECR_BASE/j3-dms:latest ./j3-system-interaction/dms/
docker push $ECR_BASE/j3-dms:latest
```

### Step 8.3 — Build & Push J3 Event Bridge

```bash
docker build -f ./j3-system-interaction/dms/Dockerfile.mock \
  -t $ECR_BASE/j3-event-bridge:latest \
  ./j3-system-interaction/dms/
docker push $ECR_BASE/j3-event-bridge:latest
```

### Step 8.4 — Build & Push J4 Audit API

```bash
docker build -t $ECR_BASE/j4-audit-api:latest \
  ./j4-platform-security/blockchain-audit/
docker push $ECR_BASE/j4-audit-api:latest
```

### Step 8.5 — Build & Push J4 Hardhat

```bash
docker build -f ./j4-platform-security/blockchain-audit/Dockerfile.hardhat \
  -t $ECR_BASE/j4-hardhat:latest \
  ./j4-platform-security/blockchain-audit/
docker push $ECR_BASE/j4-hardhat:latest
```

### Step 8.6 — Build & Push J4 Contract Deployer

```bash
docker build -f ./j4-platform-security/blockchain-audit/Dockerfile.deployer \
  -t $ECR_BASE/j4-deployer:latest \
  ./j4-platform-security/blockchain-audit/
docker push $ECR_BASE/j4-deployer:latest
```

### Step 8.7 — Verify Images Are in ECR

```bash
aws ecr list-images \
  --repository-name disaster-response/j2-data-intelligence \
  --region $REGION
```

---

## 9. Update Your k8s Manifests for EC2

> Your current manifests use `imagePullPolicy: Never` (for minikube).  
> On EC2, images come from ECR, so we need to update image references.

Run these on **your Mac**.

```bash
cd "/Users/dehanns/Dehan/Uni/Software Engineering/disaster-response-system"

REGION=us-east-1
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_BASE=$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/disaster-response
```

### Step 9.1 — Update J2 Deployment Image

Edit `k8s/j2/deployment.yaml`:
- Find the line with `image:` for the j2 container
- Change `imagePullPolicy: Never` to `imagePullPolicy: Always`
- Change the image to `YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/disaster-response/j2-data-intelligence:latest`

```bash
# Find the current image line
grep -n "image:" k8s/j2/deployment.yaml
```

Open the file and make the change manually, or use sed:

```bash
sed -i "s|imagePullPolicy: Never|imagePullPolicy: Always|g" k8s/j2/deployment.yaml
```

Repeat this process for:
- `k8s/j3/dms.yaml` → use `$ECR_BASE/j3-dms:latest`
- `k8s/j3/event-bridge.yaml` → use `$ECR_BASE/j3-event-bridge:latest`
- `k8s/j3/mock-producer.yaml` → use `$ECR_BASE/j3-event-bridge:latest`
- `k8s/j4/hardhat.yaml` → use `$ECR_BASE/j4-hardhat:latest`
- `k8s/j4/audit-api.yaml` → use `$ECR_BASE/j4-audit-api:latest`

### Step 9.2 — Allow EC2 to Pull from ECR

On your **EC2 server**, install AWS CLI and log in to ECR:

```bash
# On EC2
sudo apt-get install -y awscli

# Configure with the same credentials
aws configure
# Enter your Access Key, Secret Key, region

# Log docker into ECR
aws ecr get-login-password --region us-east-1 | \
  sudo docker login --username AWS \
  --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
```

### Step 9.3 — Create an Image Pull Secret in Kubernetes

K8s needs credentials to pull from ECR:

```bash
# On EC2
kubectl create secret docker-registry ecr-secret \
  --docker-server=YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com \
  --docker-username=AWS \
  --docker-password=$(aws ecr get-login-password --region us-east-1) \
  --namespace=disaster-response
```

Then add `imagePullSecrets` to your deployments that use ECR images. In each deployment YAML, under `spec.template.spec`, add:

```yaml
imagePullSecrets:
  - name: ecr-secret
```

---

## 10. Configure Kubernetes Secrets

### Step 10.1 — Copy Your k8s Folder to EC2

On your **Mac**:

```bash
scp -i ~/.ssh/disaster-response-key.pem -r \
  "/Users/dehanns/Dehan/Uni/Software Engineering/disaster-response-system/k8s" \
  ubuntu@YOUR_EC2_IP:~/disaster-response-k8s/
```

Also copy the postgres init SQL:
```bash
scp -i ~/.ssh/disaster-response-key.pem -r \
  "/Users/dehanns/Dehan/Uni/Software Engineering/disaster-response-system/postgres" \
  ubuntu@YOUR_EC2_IP:~/disaster-response-k8s/
```

### Step 10.2 — Edit the Secrets File on EC2

SSH into EC2 and edit `secrets.yaml`:

```bash
# On EC2
cd ~/disaster-response-k8s/k8s
nano secrets.yaml
```

Your `secrets.yaml` contains base64-encoded values. To encode a new value:

```bash
echo -n "your-password-here" | base64
```

Set strong passwords for production. At minimum update:
- `POSTGRES_PASSWORD`
- `KEYCLOAK_ADMIN_PASSWORD`
- `GF_SECURITY_ADMIN_PASSWORD`
- `AUDIT_PRIVATE_KEY`

---

## 11. Deploy Everything to Kubernetes

> All commands on **EC2** from `~/disaster-response-k8s/k8s/`

### Step 11.1 — Create the Namespace

```bash
kubectl apply -f namespace.yaml
kubectl get namespaces
# You should see: disaster-response
```

### Step 11.2 — Apply Secrets

```bash
kubectl apply -f secrets.yaml
kubectl get secrets -n disaster-response
```

### Step 11.3 — Deploy Infrastructure (Postgres & Kafka)

```bash
kubectl apply -f infrastructure/postgres.yaml
kubectl apply -f infrastructure/kafka.yaml

# Wait for them to be ready
kubectl get pods -n disaster-response -w
# Wait until postgres and kafka show "Running"
# Press Ctrl+C to stop watching
```

### Step 11.4 — Deploy Authentication (Keycloak)

```bash
kubectl apply -f auth/keycloak.yaml

# Keycloak depends on Postgres and takes 2-3 minutes to start
kubectl get pods -n disaster-response -w
```

### Step 11.5 — Deploy API Gateway (Kong)

```bash
kubectl apply -f gateway/kong.yaml

# Kong runs a migration job first, then the main deployment
kubectl get pods -n disaster-response
```

### Step 11.6 — Deploy Application Services

```bash
kubectl apply -f j2/deployment.yaml
kubectl apply -f j2/service.yaml

kubectl apply -f j3/dms.yaml
kubectl apply -f j3/event-bridge.yaml
kubectl apply -f j3/mock-producer.yaml
```

### Step 11.7 — Deploy Blockchain (J4)

```bash
kubectl apply -f j4/hardhat.yaml

# Wait for hardhat to be running before deploying audit-api
kubectl wait --for=condition=ready pod -l app=hardhat -n disaster-response --timeout=120s

kubectl apply -f j4/audit-api.yaml
```

### Step 11.8 — Deploy Monitoring

```bash
kubectl apply -f monitoring/configmaps.yaml
kubectl apply -f monitoring/prometheus.yaml
kubectl apply -f monitoring/grafana.yaml
kubectl apply -f monitoring/postgres-exporter.yaml
```

### Step 11.9 — Check Everything Is Running

```bash
kubectl get pods -n disaster-response
```

Expected output (all should eventually show `Running` or `Completed`):
```
NAME                              READY   STATUS      RESTARTS   AGE
postgres-0                        1/1     Running     0          10m
kafka-xxx                         1/1     Running     0          10m
keycloak-xxx                      1/1     Running     0          8m
kong-xxx                          1/1     Running     0          7m
kong-migration-xxx                0/1     Completed   0          8m
j2-data-intelligence-xxx          1/1     Running     0          5m
j3-dms-xxx                        1/1     Running     0          5m
j3-event-bridge-xxx               1/1     Running     0          5m
hardhat-xxx                       1/1     Running     0          4m
j4-audit-api-xxx                  1/1     Running     0          3m
prometheus-xxx                    1/1     Running     0          3m
grafana-xxx                       1/1     Running     0          3m
```

---

## 12. Configure External Access & Security Groups

### Your Application URLs

Once deployed, access your services at `http://YOUR_EC2_IP:NODE_PORT`:

| Service | NodePort | URL |
|---------|----------|-----|
| J3 Dashboard (DMS) | 30000 | `http://YOUR_EC2_IP:30000` |
| Event Bridge | 30001 | `http://YOUR_EC2_IP:30001` |
| Kong API Gateway | 30800 | `http://YOUR_EC2_IP:30800` |
| Kong Admin | 30801 | `http://YOUR_EC2_IP:30801` |
| Keycloak | 30180 | `http://YOUR_EC2_IP:30180` |
| Prometheus | 30090 | `http://YOUR_EC2_IP:30090` |
| Grafana | 30030 | `http://YOUR_EC2_IP:30030` |
| J4 Audit API | 30084 | `http://YOUR_EC2_IP:30084` |
| Hardhat RPC | 30545 | `http://YOUR_EC2_IP:30545` |

### Verify Security Group Has the Ports Open

You already opened 30000–32767 in Step 4.2. Confirm in AWS Console:
1. EC2 → Security Groups → `disaster-response-sg`
2. Inbound rules tab
3. You should see a rule for port range 30000-32767

---

## 13. Verify Your Deployment

### Step 13.1 — Check All Pods

```bash
kubectl get pods -n disaster-response
```

### Step 13.2 — Check Services and Their Ports

```bash
kubectl get services -n disaster-response
```

### Step 13.3 — View Logs for a Specific Service

```bash
# Replace POD_NAME with the actual name from 'kubectl get pods'
kubectl logs POD_NAME -n disaster-response

# Follow logs in real time
kubectl logs -f POD_NAME -n disaster-response

# For a deployment (shows latest pod's logs)
kubectl logs deployment/j3-dms -n disaster-response
```

### Step 13.4 — Test Access

```bash
# From your Mac, test each endpoint
curl http://YOUR_EC2_IP:30000
curl http://YOUR_EC2_IP:30090/-/healthy   # Prometheus health
curl http://YOUR_EC2_IP:30030             # Grafana login page
```

### Step 13.5 — Open Grafana Dashboard

1. Go to `http://YOUR_EC2_IP:30030`
2. Login: admin / (the password you set in secrets.yaml)
3. Navigate to Dashboards → check your pre-configured dashboards

---

## 14. Useful Commands Cheat Sheet

### Checking Status

```bash
# See all resources in your namespace
kubectl get all -n disaster-response

# See all pods with more detail
kubectl get pods -n disaster-response -o wide

# Describe a pod (shows events, useful for debugging)
kubectl describe pod POD_NAME -n disaster-response

# Check node resources
kubectl top nodes
kubectl top pods -n disaster-response
```

### Debugging

```bash
# Get logs from a crashed pod
kubectl logs POD_NAME -n disaster-response --previous

# Shell into a running pod
kubectl exec -it POD_NAME -n disaster-response -- /bin/bash
# Or /bin/sh if bash isn't available

# Check events (shows errors)
kubectl get events -n disaster-response --sort-by='.lastTimestamp'
```

### Managing Deployments

```bash
# Restart a deployment (e.g., after updating config)
kubectl rollout restart deployment/j3-dms -n disaster-response

# Scale a deployment
kubectl scale deployment j3-dms --replicas=2 -n disaster-response

# Delete and recreate a resource
kubectl delete -f k8s/j3/dms.yaml
kubectl apply -f k8s/j3/dms.yaml
```

### Applying Changes

```bash
# Apply a single file
kubectl apply -f k8s/j2/deployment.yaml

# Apply all files in a directory
kubectl apply -f k8s/infrastructure/

# Apply everything
kubectl apply -f k8s/ --recursive
```

### Stopping the Cluster (to save AWS costs)

```bash
# STOP the EC2 instance from AWS console or:
aws ec2 stop-instances --instance-ids YOUR_INSTANCE_ID

# Start it again:
aws ec2 start-instances --instance-ids YOUR_INSTANCE_ID
```

> Stopping the EC2 instance pauses all charges except EBS storage (~$0.08/GB/month).  
> A 50GB volume = ~$4/month when stopped.

---

## 15. Troubleshooting Common Issues

### Pod Stuck in `Pending`

```bash
kubectl describe pod POD_NAME -n disaster-response
```
Look at `Events` at the bottom. Common causes:
- **Insufficient CPU/memory**: Your instance is too small. Use `kubectl top nodes` to check usage.
- **PVC not bound**: Check `kubectl get pvc -n disaster-response`
- **Image pull error**: Check Step 9 (ECR credentials)

### Pod in `CrashLoopBackOff`

```bash
kubectl logs POD_NAME -n disaster-response --previous
```
The app started but crashed. Read the error. Common causes:
- Missing environment variable (check secrets.yaml)
- Can't connect to Postgres/Kafka (deploy order matters — see Step 11)
- Wrong image built

### Pod in `ImagePullBackOff`

```bash
kubectl describe pod POD_NAME -n disaster-response
```
K8s can't pull the Docker image. Common causes:
- ECR login expired (tokens last 12 hours — re-run Step 9.2 and recreate the secret)
- Image name is wrong in the YAML
- ECR repository doesn't exist

### `kubectl: command not found` on EC2

```bash
export PATH=$PATH:/usr/local/bin
# Or reinstall: sudo apt-get install -y kubectl
```

### Keycloak Won't Start

Keycloak takes 2–4 minutes and depends on Postgres. Check:
```bash
kubectl logs deployment/keycloak -n disaster-response
# Look for "Keycloak 24.0 on JVM ... started"
```

### Kong Migration Job Failing

```bash
kubectl logs job/kong-migration -n disaster-response
```
Usually means Postgres isn't ready yet. Delete and re-apply:
```bash
kubectl delete job kong-migration -n disaster-response
kubectl apply -f k8s/gateway/kong.yaml
```

### EC2 Running Out of Memory

```bash
# Check memory on EC2
free -h

# Check which pods use most memory
kubectl top pods -n disaster-response --sort-by=memory
```

Consider upgrading to `t3.2xlarge` or temporarily disabling the ELK stack (Elasticsearch uses ~4GB alone):
```bash
kubectl scale deployment elasticsearch --replicas=0 -n disaster-response
kubectl scale deployment logstash --replicas=0 -n disaster-response
kubectl scale deployment kibana --replicas=0 -n disaster-response
```

---

## Summary of Access URLs After Deployment

Replace `YOUR_EC2_IP` with your actual public IP from Step 4.4.

| What | URL | Default Login |
|------|-----|---------------|
| **J3 Dashboard** | `http://YOUR_EC2_IP:30000` | via Keycloak |
| **Keycloak Admin** | `http://YOUR_EC2_IP:30180/admin` | admin / (your secret) |
| **Grafana** | `http://YOUR_EC2_IP:30030` | admin / (your secret) |
| **Prometheus** | `http://YOUR_EC2_IP:30090` | none |
| **Kong Admin API** | `http://YOUR_EC2_IP:30801` | none |
| **J4 Audit API** | `http://YOUR_EC2_IP:30084` | via Kong |

---

*Generated for: Disaster Response System — Group J*  
*Target: AWS EC2 + Kubernetes (kubeadm, single node)*  
*Date: May 2026*
