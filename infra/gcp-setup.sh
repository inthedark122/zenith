#!/usr/bin/env bash
# =============================================================================
# Zenith — GCP Infrastructure Setup (run once)
#
# Creates:
#   - Artifact Registry repository for Docker images
#   - VPC + subnet (private, no external IPs on VMs)
#   - Reserved static external IP (whitelist this on exchanges)
#   - Cloud Router + Cloud NAT (all outbound traffic exits via the static IP)
#   - VM service account (pulls images from Artifact Registry)
#   - Firewall rules (IAP SSH ingress, HTTPS+PostgreSQL egress)
#   - Compute Engine VM (e2-micro, no external IP, OS Login enabled)
#
# Usage:
#   export GCP_PROJECT_ID=your-project-id
#   bash infra/gcp-setup.sh
#
# After this script, run infra/gcp-wif-setup.sh to configure GitHub Actions.
# =============================================================================
set -euo pipefail

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID before running this script}"

REGION="asia-southeast1"
ZONE="asia-southeast1-b"
NETWORK="zenith-vpc"
SUBNET="zenith-subnet"
SUBNET_RANGE="10.0.0.0/24"
VM_NAME="zenith-worker"
STATIC_IP_NAME="zenith-nat-ip"
ROUTER_NAME="zenith-router"
NAT_NAME="zenith-nat"
VM_SA_NAME="zenith-worker-sa"
AR_REPO="zenith"

echo "=== Zenith GCP Setup ==="
echo "Project : $GCP_PROJECT_ID"
echo "Region  : $REGION"
echo "Zone    : $ZONE"
echo ""

# ── Enable required APIs ──────────────────────────────────────────────────────
echo "[1/9] Enabling GCP APIs..."
gcloud services enable \
    compute.googleapis.com \
    artifactregistry.googleapis.com \
    iap.googleapis.com \
    oslogin.googleapis.com \
    --project="$GCP_PROJECT_ID" \
    --quiet

# ── Artifact Registry ─────────────────────────────────────────────────────────
echo "[2/9] Creating Artifact Registry repository..."
if ! gcloud artifacts repositories describe "$AR_REPO" \
        --location="$REGION" --project="$GCP_PROJECT_ID" &>/dev/null; then
    gcloud artifacts repositories create "$AR_REPO" \
        --repository-format=docker \
        --location="$REGION" \
        --project="$GCP_PROJECT_ID" \
        --description="Zenith trading worker Docker images"
    echo "  Created: $REGION-docker.pkg.dev/$GCP_PROJECT_ID/$AR_REPO"
else
    echo "  Already exists — skipping."
fi

# ── VPC + subnet ─────────────────────────────────────────────────────────────
echo "[3/9] Creating VPC and subnet..."
if ! gcloud compute networks describe "$NETWORK" --project="$GCP_PROJECT_ID" &>/dev/null; then
    gcloud compute networks create "$NETWORK" \
        --subnet-mode=custom \
        --project="$GCP_PROJECT_ID" \
        --quiet
fi
if ! gcloud compute networks subnets describe "$SUBNET" \
        --region="$REGION" --project="$GCP_PROJECT_ID" &>/dev/null; then
    gcloud compute networks subnets create "$SUBNET" \
        --network="$NETWORK" \
        --region="$REGION" \
        --range="$SUBNET_RANGE" \
        --project="$GCP_PROJECT_ID" \
        --quiet
fi

# ── Static external IP ────────────────────────────────────────────────────────
echo "[4/9] Reserving static external IP for Cloud NAT..."
if ! gcloud compute addresses describe "$STATIC_IP_NAME" \
        --region="$REGION" --project="$GCP_PROJECT_ID" &>/dev/null; then
    gcloud compute addresses create "$STATIC_IP_NAME" \
        --region="$REGION" \
        --project="$GCP_PROJECT_ID" \
        --quiet
fi
STATIC_IP=$(gcloud compute addresses describe "$STATIC_IP_NAME" \
    --region="$REGION" \
    --project="$GCP_PROJECT_ID" \
    --format="get(address)")
echo ""
echo "  ★  Static outbound IP: $STATIC_IP"
echo "  ★  Whitelist this IP on all exchange API keys — it will never change."
echo ""

# ── Cloud Router + NAT ────────────────────────────────────────────────────────
echo "[5/9] Creating Cloud Router and Cloud NAT..."
if ! gcloud compute routers describe "$ROUTER_NAME" \
        --region="$REGION" --project="$GCP_PROJECT_ID" &>/dev/null; then
    gcloud compute routers create "$ROUTER_NAME" \
        --network="$NETWORK" \
        --region="$REGION" \
        --project="$GCP_PROJECT_ID" \
        --quiet
fi
if ! gcloud compute routers nats describe "$NAT_NAME" \
        --router="$ROUTER_NAME" --region="$REGION" --project="$GCP_PROJECT_ID" &>/dev/null; then
    gcloud compute routers nats create "$NAT_NAME" \
        --router="$ROUTER_NAME" \
        --region="$REGION" \
        --nat-external-ip-pool="$STATIC_IP_NAME" \
        --nat-all-subnet-ip-ranges \
        --project="$GCP_PROJECT_ID" \
        --quiet
fi

# ── VM service account ────────────────────────────────────────────────────────
echo "[6/9] Creating VM service account..."
VM_SA_EMAIL="${VM_SA_NAME}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
if ! gcloud iam service-accounts describe "$VM_SA_EMAIL" \
        --project="$GCP_PROJECT_ID" &>/dev/null; then
    gcloud iam service-accounts create "$VM_SA_NAME" \
        --display-name="Zenith Worker VM" \
        --project="$GCP_PROJECT_ID"
fi
# Grant read access to Artifact Registry
gcloud artifacts repositories add-iam-policy-binding "$AR_REPO" \
    --location="$REGION" \
    --member="serviceAccount:${VM_SA_EMAIL}" \
    --role="roles/artifactregistry.reader" \
    --project="$GCP_PROJECT_ID" \
    --quiet

# ── Firewall rules ────────────────────────────────────────────────────────────
echo "[7/9] Creating firewall rules..."
# Allow SSH only from Google IAP range (no public SSH exposure)
if ! gcloud compute firewall-rules describe zenith-allow-iap-ssh \
        --project="$GCP_PROJECT_ID" &>/dev/null; then
    gcloud compute firewall-rules create zenith-allow-iap-ssh \
        --network="$NETWORK" \
        --direction=INGRESS \
        --allow=tcp:22 \
        --source-ranges="35.235.240.0/20" \
        --target-tags="zenith-worker" \
        --description="Allow SSH via Google IAP tunneling only" \
        --project="$GCP_PROJECT_ID" \
        --quiet
fi
# Allow all outbound (NAT routes it through the static IP)
if ! gcloud compute firewall-rules describe zenith-allow-egress \
        --project="$GCP_PROJECT_ID" &>/dev/null; then
    gcloud compute firewall-rules create zenith-allow-egress \
        --network="$NETWORK" \
        --direction=EGRESS \
        --allow=tcp \
        --destination-ranges="0.0.0.0/0" \
        --target-tags="zenith-worker" \
        --description="Allow all outbound TCP (exchange APIs, DB, pkg installs)" \
        --project="$GCP_PROJECT_ID" \
        --quiet
fi

# ── VM startup script ─────────────────────────────────────────────────────────
echo "[8/9] Preparing VM startup script..."
STARTUP_SCRIPT=$(cat << 'STARTUP'
#!/bin/bash
# Runs once on first boot. Subsequent reboots skip this.
[ -f /var/lib/zenith-setup-done ] && exit 0
set -e

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
    docker.io docker-compose-plugin \
    apt-transport-https ca-certificates gnupg curl

systemctl enable docker
systemctl start docker

# Install gcloud CLI (needed for Artifact Registry Docker auth)
curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg \
    | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg
echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" \
    > /etc/apt/sources.list.d/google-cloud-sdk.list
apt-get update -y
apt-get install -y google-cloud-cli

# Configure Docker credential helper for Artifact Registry (root user)
gcloud auth configure-docker asia-southeast1-docker.pkg.dev --quiet

# Worker directory + placeholder env
mkdir -p /opt/zenith-worker
cat > /opt/zenith-worker/.env << 'ENV'
# Fill in these values after setup — see DEPLOYMENT.md §11
DATABASE_URL=
SECRET_KEY=
MARKET_POLL_INTERVAL=60
WORKER_IMAGE=asia-southeast1-docker.pkg.dev/PLACEHOLDER/zenith/zenith-worker:latest
ENV

touch /var/lib/zenith-setup-done
STARTUP
)

# ── Create VM ─────────────────────────────────────────────────────────────────
echo "[9/9] Creating Compute Engine VM..."
if ! gcloud compute instances describe "$VM_NAME" \
        --zone="$ZONE" --project="$GCP_PROJECT_ID" &>/dev/null; then
    # Write startup script to a temp file to avoid issues with commas/newlines
    # in inline --metadata values
    STARTUP_SCRIPT_FILE=$(mktemp /tmp/zenith-startup-XXXXXX.sh)
    echo "$STARTUP_SCRIPT" > "$STARTUP_SCRIPT_FILE"
    trap "rm -f $STARTUP_SCRIPT_FILE" EXIT

    gcloud compute instances create "$VM_NAME" \
        --zone="$ZONE" \
        --machine-type="e2-micro" \
        --network="$NETWORK" \
        --subnet="$SUBNET" \
        --no-address \
        --service-account="$VM_SA_EMAIL" \
        --scopes="cloud-platform" \
        --tags="zenith-worker" \
        --metadata="enable-oslogin=TRUE" \
        --metadata-from-file="startup-script=${STARTUP_SCRIPT_FILE}" \
        --boot-disk-size=20GB \
        --boot-disk-type=pd-standard \
        --project="$GCP_PROJECT_ID" \
        --quiet
    echo "  VM created. Startup script is running (Docker install takes ~2 min)."
else
    echo "  VM already exists — skipping."
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "  Static outbound IP : $STATIC_IP"
echo "  VM                 : $VM_NAME ($ZONE)"
echo "  Artifact Registry  : $REGION-docker.pkg.dev/$GCP_PROJECT_ID/$AR_REPO"
echo ""
echo "Next steps:"
echo "  1. Whitelist $STATIC_IP on all exchange API keys"
echo "  2. Run: bash infra/gcp-wif-setup.sh  (GitHub Actions auth)"
echo "  3. SSH in to fill out /opt/zenith-worker/.env:"
echo "     gcloud compute ssh $VM_NAME --zone=$ZONE --tunnel-through-iap --project=$GCP_PROJECT_ID"
echo "  4. Add GitHub Actions variables/secrets — see DEPLOYMENT.md §11"
