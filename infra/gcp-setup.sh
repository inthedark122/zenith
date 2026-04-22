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
#   - Firewall rules (IAP SSH ingress for manual access, egress for exchanges)
#   - Compute Engine VM using Container-Optimized OS — no Docker install needed,
#     GCP runs the container directly from the Artifact Registry image.
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
echo "[1/8] Enabling GCP APIs..."
gcloud services enable \
    compute.googleapis.com \
    artifactregistry.googleapis.com \
    iap.googleapis.com \
    --project="$GCP_PROJECT_ID" \
    --quiet

# ── Artifact Registry ─────────────────────────────────────────────────────────
echo "[2/8] Creating Artifact Registry repository..."
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
echo "[3/8] Creating VPC and subnet..."
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
echo "[4/8] Reserving static external IP for Cloud NAT..."
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
echo "[5/8] Creating Cloud Router and Cloud NAT..."
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
echo "[6/8] Creating VM service account..."
VM_SA_EMAIL="${VM_SA_NAME}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
if ! gcloud iam service-accounts describe "$VM_SA_EMAIL" \
        --project="$GCP_PROJECT_ID" &>/dev/null; then
    gcloud iam service-accounts create "$VM_SA_NAME" \
        --display-name="Zenith Worker VM" \
        --project="$GCP_PROJECT_ID"
fi
# COS uses this SA to pull images from Artifact Registry automatically
gcloud artifacts repositories add-iam-policy-binding "$AR_REPO" \
    --location="$REGION" \
    --member="serviceAccount:${VM_SA_EMAIL}" \
    --role="roles/artifactregistry.reader" \
    --project="$GCP_PROJECT_ID" \
    --quiet

# ── Firewall rules ────────────────────────────────────────────────────────────
echo "[7/8] Creating firewall rules..."
# Allow SSH only from Google IAP range (for manual debugging)
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
        --description="Allow all outbound TCP (exchange APIs, DB)" \
        --project="$GCP_PROJECT_ID" \
        --quiet
fi

# ── Create VM (Container-Optimized OS) ───────────────────────────────────────
# COS has Docker built-in. No startup script needed — GCP pulls and runs the
# container image directly. Env vars are stored securely in VM metadata and
# updated without SSH via: gcloud compute instances update-container
echo "[8/8] Creating Compute Engine VM (Container-Optimized OS)..."
INITIAL_IMAGE="$REGION-docker.pkg.dev/$GCP_PROJECT_ID/$AR_REPO/zenith-worker:latest"
if ! gcloud compute instances describe "$VM_NAME" \
        --zone="$ZONE" --project="$GCP_PROJECT_ID" &>/dev/null; then
    gcloud compute instances create-with-container "$VM_NAME" \
        --zone="$ZONE" \
        --machine-type="e2-micro" \
        --network="$NETWORK" \
        --subnet="$SUBNET" \
        --no-address \
        --service-account="$VM_SA_EMAIL" \
        --scopes="cloud-platform" \
        --tags="zenith-worker" \
        --image-family="cos-stable" \
        --image-project="cos-cloud" \
        --container-image="$INITIAL_IMAGE" \
        --container-restart-policy="always" \
        --container-env="DATABASE_URL=PLACEHOLDER,SECRET_KEY=PLACEHOLDER,MARKET_POLL_INTERVAL=60" \
        --metadata="enable-oslogin=TRUE" \
        --boot-disk-size=20GB \
        --boot-disk-type=pd-standard \
        --project="$GCP_PROJECT_ID" \
        --quiet
    echo "  VM created with Container-Optimized OS."
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
echo "  2. Set real env vars on the VM (DATABASE_URL, SECRET_KEY):"
echo ""
echo "     gcloud compute instances update-container $VM_NAME \\"
echo "       --zone=$ZONE \\"
echo "       --container-env=\"DATABASE_URL=postgresql://...\" \\"
echo "       --container-env=\"SECRET_KEY=your-secret\" \\"
echo "       --project=$GCP_PROJECT_ID"
echo ""
echo "  3. Run: bash infra/gcp-wif-setup.sh  (GitHub Actions auth)"
echo "  4. Add GitHub Actions variables/secrets — see DEPLOYMENT.md §11"

