#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-crewmate}"
REPOSITORY="${REPOSITORY:-crewmate}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${SERVICE_NAME}:latest"
MIN_INSTANCES="${MIN_INSTANCES:-1}"
MAX_INSTANCES="${MAX_INSTANCES:-1}"
CPU="${CPU:-1}"
MEMORY="${MEMORY:-1Gi}"
TIMEOUT="${TIMEOUT:-300}"
CONCURRENCY="${CONCURRENCY:-2}"

if ! gcloud artifacts repositories describe "${REPOSITORY}" \
  --location "${REGION}" \
  --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${REPOSITORY}" \
    --repository-format docker \
    --location "${REGION}" \
    --description "Crewmate deployment images" \
    --project "${PROJECT_ID}"
fi

gcloud builds submit --tag "${IMAGE}"

gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --cpu "${CPU}" \
  --memory "${MEMORY}" \
  --timeout "${TIMEOUT}" \
  --concurrency "${CONCURRENCY}" \
  --min-instances "${MIN_INSTANCES}" \
  --max-instances "${MAX_INSTANCES}" \
  --allow-unauthenticated
