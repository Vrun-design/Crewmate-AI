# GitHub Push And Redeploy Checklist

## Before pushing

- Keep `.env` local only. Do not commit it.
- Verify `.env.example` contains placeholders only.
- Make sure Firebase local cache is not tracked:
  - `.firebase/`
- Sanity check local build:
  - `npm run lint`
  - `npm run build`

## Push to GitHub

```bash
git status
git add .
git commit -m "Prepare production deploy and auth reliability updates"
git push origin YOUR_BRANCH
```

## Redeploy backend

```bash
export PROJECT_ID=project-6ebea76d-998d-4a10-954
export REGION=us-central1
export SERVICE_NAME=crewmate
export MIN_INSTANCES=0
export MAX_INSTANCES=1
./scripts/deploy-cloud-run.sh
```

## Redeploy frontend

```bash
firebase deploy --only hosting --project project-6ebea76d-998d-4a10-954
```

## Test on deployed site

- Open the hosted app.
- Test Google sign-in.
- Confirm dashboard loads without `401` errors.
- Open Crew Network and verify the center icon uses `Crewmate_logo.svg`.
- Start a live session and confirm the new greeting/tone feels natural.
- Open Integrations and test:
  - Google Workspace connect
  - cancel OAuth and confirm the app shows a friendly error
- If needed, reconnect Slack / Notion / ClickUp and confirm each returns to the app cleanly.

## If something breaks

- Check Cloud Run logs in GCP
- Check browser console and network tab
- Confirm production env vars still exist on Cloud Run
- Confirm OAuth redirect URIs still match the deployed frontend URL
