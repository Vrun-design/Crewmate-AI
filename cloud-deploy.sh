#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Crewmate — One-shot Cloud Run deployment script
# Usage: ./cloud-deploy.sh [GCP_PROJECT_ID]
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ID="${1:-${GOOGLE_CLOUD_PROJECT:-}}"
REGION="us-central1"
SERVICE="crewmate"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE}:latest"

if [[ -z "$PROJECT_ID" ]]; then
  echo "❌ Usage: ./cloud-deploy.sh <GCP_PROJECT_ID>"
  exit 1
fi

echo "🚀 Deploying Crewmate to Cloud Run..."
echo "   Project : $PROJECT_ID"
echo "   Region  : $REGION"
echo "   Service : $SERVICE"
echo ""

# ── Ensure APIs are enabled ───────────────────────────────────────────────────
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  containerregistry.googleapis.com \
  --project="$PROJECT_ID" --quiet

# ── Create secrets (only if they don't exist) ─────────────────────────────────
function ensure_secret() {
  local name="$1"
  local label="$2"
  if ! gcloud secrets describe "$name" --project="$PROJECT_ID" &>/dev/null; then
    echo "🔑 Creating secret: $name"
    echo "   Enter $label (or press Ctrl+C to skip secrets for now):"
    read -rs secret_value
    echo -n "$secret_value" | gcloud secrets create "$name" \
      --data-file=- \
      --project="$PROJECT_ID" \
      --replication-policy=automatic
  else
    echo "✅ Secret $name already exists"
  fi
}

ensure_secret "crewmate-gemini-key"  "GOOGLE_API_KEY (Gemini)"
ensure_secret "crewmate-enc-key"     "CREWMATE_ENCRYPTION_KEY (random 32-char string)"

# ── Build & push image via Cloud Build ───────────────────────────────────────
echo ""
echo "🔨 Building image with Cloud Build..."
gcloud builds submit . \
  --config=cloudbuild.yaml \
  --project="$PROJECT_ID" \
  --substitutions="_REGION=${REGION}"

echo ""
echo "✅ Deployment complete!"
echo ""
SERVICE_URL=$(gcloud run services describe "$SERVICE" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --format='value(status.url)' 2>/dev/null || echo "")

if [[ -n "$SERVICE_URL" ]]; then
  echo "🌐 Live at: $SERVICE_URL"
  echo "   Health : $SERVICE_URL/api/health"
fi
