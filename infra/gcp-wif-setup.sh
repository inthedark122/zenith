#!/usr/bin/env bash
# =============================================================================
# Zenith — Workload Identity Federation Setup for GitHub Actions (run once)
#
# Allows GitHub Actions to authenticate to GCP without storing service account
# keys as secrets. Uses OIDC — the workflow proves its identity via a token
# signed by GitHub, which GCP verifies and exchanges for a short-lived credential.
#
# Creates:
#   - Deploy service account (zenith-deploy-sa)
#   - IAM roles on the deploy SA:
#       roles/artifactregistry.writer     — push Docker images
#       roles/compute.instanceAdmin.v1    — update-container (update VM metadata + restart)
#
# No SSH roles needed — COS deployment uses gcloud compute instances update-container,
# which only requires compute API access, not SSH into the VM.
#   - Workload Identity Pool + GitHub OIDC Provider
#   - WIF binding: this repo's workflows can impersonate the deploy SA
#
# Usage:
#   export GCP_PROJECT_ID=your-project-id
#   export GITHUB_REPO=livectar/zenith       # owner/repo
#   bash infra/gcp-wif-setup.sh
#
# After running, add to GitHub Actions variables/secrets:
#   vars.GCP_PROJECT_ID                  — your GCP project ID
#   vars.GCP_REGION                      — asia-southeast1
#   vars.GCP_ZONE                        — asia-southeast1-b
#   secrets.GCP_WORKLOAD_IDENTITY_PROVIDER — printed at end of this script
#   secrets.GCP_DEPLOY_SERVICE_ACCOUNT    — printed at end of this script
# =============================================================================
set -euo pipefail

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID before running this script}"
: "${GITHUB_REPO:?Set GITHUB_REPO (e.g. livectar/zenith) before running this script}"

REGION="asia-southeast1"
AR_REPO="zenith"
DEPLOY_SA_NAME="zenith-deploy-sa"
WIF_POOL_ID="github-pool"
WIF_PROVIDER_ID="github-provider"

echo "=== Zenith WIF Setup ==="
echo "Project     : $GCP_PROJECT_ID"
echo "GitHub repo : $GITHUB_REPO"
echo ""

DEPLOY_SA_EMAIL="${DEPLOY_SA_NAME}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
PROJECT_NUMBER=$(gcloud projects describe "$GCP_PROJECT_ID" --format="get(projectNumber)")

# ── Deploy service account ────────────────────────────────────────────────────
echo "[1/5] Creating deploy service account..."
if ! gcloud iam service-accounts describe "$DEPLOY_SA_EMAIL" \
        --project="$GCP_PROJECT_ID" &>/dev/null; then
    gcloud iam service-accounts create "$DEPLOY_SA_NAME" \
        --display-name="Zenith GitHub Actions Deploy" \
        --project="$GCP_PROJECT_ID"
fi

# ── IAM roles for the deploy SA ───────────────────────────────────────────────
echo "[2/5] Granting IAM roles to deploy SA..."

# Push Docker images to Artifact Registry
gcloud artifacts repositories add-iam-policy-binding "$AR_REPO" \
    --location="$REGION" \
    --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
    --role="roles/artifactregistry.writer" \
    --project="$GCP_PROJECT_ID" \
    --quiet

# Update container declaration on VM and restart it (update-container)
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
    --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
    --role="roles/compute.instanceAdmin.v1" \
    --quiet

# ── Workload Identity Pool ────────────────────────────────────────────────────
echo "[3/5] Creating Workload Identity Pool..."
if ! gcloud iam workload-identity-pools describe "$WIF_POOL_ID" \
        --location=global --project="$GCP_PROJECT_ID" &>/dev/null; then
    gcloud iam workload-identity-pools create "$WIF_POOL_ID" \
        --location=global \
        --display-name="GitHub Actions Pool" \
        --project="$GCP_PROJECT_ID"
fi

# ── OIDC Provider (GitHub) ────────────────────────────────────────────────────
echo "[4/5] Creating GitHub OIDC provider..."
if ! gcloud iam workload-identity-pools providers describe "$WIF_PROVIDER_ID" \
        --location=global \
        --workload-identity-pool="$WIF_POOL_ID" \
        --project="$GCP_PROJECT_ID" &>/dev/null; then
    gcloud iam workload-identity-pools providers create-oidc "$WIF_PROVIDER_ID" \
        --location=global \
        --workload-identity-pool="$WIF_POOL_ID" \
        --display-name="GitHub OIDC" \
        --issuer-uri="https://token.actions.githubusercontent.com" \
        --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
        --attribute-condition="assertion.ref == 'refs/heads/main'" \
        --project="$GCP_PROJECT_ID"
fi

# ── Bind GitHub repo to deploy SA ─────────────────────────────────────────────
echo "[5/5] Binding GitHub repo to deploy SA..."
WIF_POOL_RESOURCE="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL_ID}"

gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA_EMAIL" \
    --member="principalSet://iam.googleapis.com/${WIF_POOL_RESOURCE}/attribute.repository/${GITHUB_REPO}" \
    --role="roles/iam.workloadIdentityUser" \
    --project="$GCP_PROJECT_ID"

WIF_PROVIDER_RESOURCE="${WIF_POOL_RESOURCE}/providers/${WIF_PROVIDER_ID}"

echo ""
echo "=== WIF Setup complete ==="
echo ""
echo "Add these to GitHub → Settings → Secrets and variables → Actions:"
echo ""
echo "  Variables (not secrets — safe to be public):"
echo "    GCP_PROJECT_ID  = $GCP_PROJECT_ID"
echo "    GCP_REGION      = $REGION"
echo "    GCP_ZONE        = asia-southeast1-b"
echo ""
echo "  Secrets:"
echo "    GCP_WORKLOAD_IDENTITY_PROVIDER = $WIF_PROVIDER_RESOURCE"
echo "    GCP_DEPLOY_SERVICE_ACCOUNT     = $DEPLOY_SA_EMAIL"
echo ""
echo "Then push to main — the deploy-worker workflow will fire automatically."
