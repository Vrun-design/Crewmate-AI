# Crewmate Production Deployment Runbook

This is the lowest-risk path to deploy Crewmate for a hackathon or a very small public demo.

It is written for the current repo architecture:

- frontend on Firebase Hosting
- backend on one Google Cloud Run service
- Firebase Authentication for login
- SQLite, screenshot artifacts, and live runtime state kept on one backend instance

Important:

- "No risk at all" is not realistic on the public internet.
- This runbook is designed to keep risk and surprise cost as low as practical.

## What Deploys Where

Frontend:

- React/Vite app
- deployed to Firebase Hosting

Backend:

- Express API
- live session gateway
- task orchestrator
- integrations
- SQLite database
- screenshot artifacts
- deployed to one Cloud Run service

## Very Important Order

Do not deploy frontend first.

Use this order:

1. Prepare cloud projects, billing alerts, and auth settings
2. Prepare backend secrets and config
3. Deploy backend first
4. Copy the backend URL
5. Build and deploy frontend with `VITE_API_URL` pointing to that backend URL
6. Update callback URLs and authorized domains
7. Run smoke tests

## Before You Start

You need:

- a Google Cloud project
- billing enabled
- a Firebase project attached to that Google Cloud project
- `gcloud` installed and logged in
- `firebase-tools` installed and logged in
- this repo passing local checks

Install and log in:

```bash
npm install
gcloud auth login
firebase login
```

Set the active cloud project:

```bash
gcloud config set project YOUR_PROJECT_ID
```

## Cost Safety First

Do these before you deploy anything.

### 1. Use a dedicated cloud project

Do not share this deploy with a project that contains important production workloads.

### 2. Create a billing budget

In Google Cloud Billing:

- create a budget for this project only
- set a small amount like `$10` or `$20`
- set alerts at `50%`, `90%`, and `100%`

Reminder:

- budgets are alerts, not a hard spending cap

### 3. Keep Cloud Run tiny

For this repo, safest first deploy is:

- `MIN_INSTANCES=0`
- `MAX_INSTANCES=1`

This is both cheaper and safer because the app is currently single-instance oriented.

### 4. Keep optional integrations off until needed

Only configure the integrations you actually plan to demo.

## Local Checks Before Any Deploy

Run all of these locally:

```bash
npm run lint
npm test
npm run build
npm run test:smoke
```

If one fails, stop and fix that first.

## Secrets vs Public Config

This part matters a lot.

### Server-only secrets

These belong on Cloud Run or in Secret Manager.

Do not put them in Firebase Hosting.
Do not put them in `VITE_*`.

Examples:

- `GOOGLE_API_KEY`
- `CREWMATE_ENCRYPTION_KEY`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `GOOGLE_WORKSPACE_CLIENT_SECRET`
- `NOTION_CLIENT_SECRET`
- `SLACK_CLIENT_SECRET`
- `CLICKUP_CLIENT_SECRET`
- `TAVILY_API_KEY`
- any token such as `NOTION_TOKEN`, `SLACK_BOT_TOKEN`, `CLICKUP_TOKEN`

### Frontend public build-time config

These are expected to be visible in the browser bundle.

That is normal.

Examples:

- `VITE_API_URL`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MEASUREMENT_ID`

## Exact Variables To Prepare

Use [.env.example](/Users/varun/Desktop/Dev_projects/crewmate-dashboard copy/.env.example) as the master template.

### Required backend values

- `NODE_ENV=production`
- `AUTH_EXPOSE_DEV_CODE=false`
- `GOOGLE_API_KEY`
- `CREWMATE_ENCRYPTION_KEY`
- `CORS_ORIGIN`
- `PUBLIC_APP_URL`
- `PUBLIC_WEB_APP_URL`
- `FIREBASE_PROJECT_ID`

Usually also:

- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

### Required frontend values

- `VITE_API_URL`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`

Optional but commonly filled:

- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MEASUREMENT_ID`

### Required if using Google Workspace in the demo

- `GOOGLE_WORKSPACE_CLIENT_ID`
- `GOOGLE_WORKSPACE_CLIENT_SECRET`
- `GOOGLE_WORKSPACE_REDIRECT_URI`

## Step 1: Create Firebase and Enable Auth

This app supports:

- Google sign-in
- email link sign-in

You can see that in [firebaseAuth.ts](/Users/varun/Desktop/Dev_projects/crewmate-dashboard copy/src/services/firebaseAuth.ts).

### In Firebase Console

1. Create or open your Firebase project.
2. Add a Web App.
3. Copy the Firebase web config values.
4. Go to Authentication.
5. Click "Get started" if Auth is not enabled yet.
6. In Sign-in method:
   - enable `Google`
   - enable `Email link (passwordless sign-in)` if you want the backup path this app supports
7. In Settings or Authorized domains:
   - add `localhost`
   - add your Firebase Hosting domain
   - add any custom domain you plan to use

### Values you need from Firebase

Put these into frontend build config:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- optionally the messaging sender ID, storage bucket, and measurement ID

Put this into backend config:

- `FIREBASE_PROJECT_ID`

If your Cloud Run service does not use Application Default Credentials automatically for Admin verification, also provide:

- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

## Step 2: Enable Google Workspace OAuth

Only do this if the demo needs Google Workspace actions.

In Google Cloud Console:

1. Open APIs & Services.
2. Configure the OAuth consent screen.
3. Add your own email as a test user if the app is still in testing mode.
4. Enable the Google Workspace APIs you plan to use.
5. Create an OAuth Client ID for a web application.
6. Add this exact redirect URI:

```text
https://YOUR_FRONTEND_DOMAIN/api/integrations/google-workspace/callback
```

Set:

- `GOOGLE_WORKSPACE_CLIENT_ID`
- `GOOGLE_WORKSPACE_CLIENT_SECRET`
- `GOOGLE_WORKSPACE_REDIRECT_URI`

## Step 3: Decide Where Secrets Live

Recommended beginner-safe approach:

- keep a local `.env` only as your checklist
- put real backend secrets into Cloud Run environment variables or Secret Manager
- never commit `.env`

Your repo already ignores `.env`.

## Step 4: Deploy Backend First

This repo already includes:

- [Dockerfile](/Users/varun/Desktop/Dev_projects/crewmate-dashboard copy/Dockerfile)
- [deploy-cloud-run.sh](/Users/varun/Desktop/Dev_projects/crewmate-dashboard copy/scripts/deploy-cloud-run.sh)

### Backend deploy command

```bash
export PROJECT_ID=YOUR_PROJECT_ID
export REGION=us-central1
export SERVICE_NAME=crewmate
export MIN_INSTANCES=0
export MAX_INSTANCES=1
./scripts/deploy-cloud-run.sh
```

### After backend deploy

Open Cloud Run and set or confirm all backend env vars.

At minimum:

- `NODE_ENV=production`
- `AUTH_EXPOSE_DEV_CODE=false`
- `GOOGLE_API_KEY`
- `CREWMATE_ENCRYPTION_KEY`
- `CORS_ORIGIN=https://YOUR_FRONTEND_DOMAIN`
- `PUBLIC_APP_URL=https://YOUR_FRONTEND_DOMAIN`
- `PUBLIC_WEB_APP_URL=https://YOUR_FRONTEND_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

If using Google Workspace:

- `GOOGLE_WORKSPACE_CLIENT_ID`
- `GOOGLE_WORKSPACE_CLIENT_SECRET`
- `GOOGLE_WORKSPACE_REDIRECT_URI=https://YOUR_FRONTEND_DOMAIN/api/integrations/google-workspace/callback`

Then copy the Cloud Run service URL.

You will need it for `VITE_API_URL`.

## Step 5: Build Frontend Against the Real Backend

Now that backend exists, set:

```env
VITE_API_URL=https://YOUR_CLOUD_RUN_BACKEND_URL
```

Also set the Firebase `VITE_*` vars for the frontend build.

Then build:

```bash
npm run build
```

## Step 6: Deploy Frontend to Firebase Hosting

This repo already includes [firebase.json](/Users/varun/Desktop/Dev_projects/crewmate-dashboard copy/firebase.json).

Deploy with:

```bash
firebase deploy --only hosting
```

After deploy, copy the Firebase Hosting URL.

If this final frontend URL changed from what you used earlier, go back and update:

- `CORS_ORIGIN`
- `PUBLIC_APP_URL`
- `PUBLIC_WEB_APP_URL`
- Firebase Auth authorized domains
- Google Workspace redirect URI
- any other OAuth redirect URIs

## Step 7: Final Domain and Callback Check

Before testing, all of these must match the real deployed frontend origin:

- Firebase authorized domains
- `CORS_ORIGIN`
- `PUBLIC_APP_URL`
- `PUBLIC_WEB_APP_URL`
- `GOOGLE_WORKSPACE_REDIRECT_URI`
- `NOTION_REDIRECT_URI` if used
- `SLACK_REDIRECT_URI` if used
- `CLICKUP_REDIRECT_URI` if used

## Step 8: Smoke Test Everything

### Minimum smoke test list

1. Open the frontend URL.
2. Log in with Firebase Auth.
3. Refresh the page and confirm you stay signed in.
4. Open dashboard.
5. Open tasks.
6. Start a live session.
7. Confirm microphone works.
8. Confirm screen share works.
9. Confirm responses stream back.
10. Delegate a task.
11. Confirm task updates appear.
12. Run one browser UI navigator task.
13. If using Google Workspace, connect it and complete one real action.

### What to watch for

- auth errors
- CORS errors
- SSE disconnects
- 401 errors after refresh
- OAuth callback mismatch errors
- backend crashes on startup

## If Something Fails

### Backend startup fails in production

Check [startupValidation.ts](/Users/varun/Desktop/Dev_projects/crewmate-dashboard copy/server/services/startupValidation.ts).

In production, these are required:

- `CREWMATE_ENCRYPTION_KEY`
- `FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_APP_ID`
- `AUTH_EXPOSE_DEV_CODE=false`

### Google sign-in fails

Check:

- Firebase Authentication is enabled
- Google provider is enabled
- your frontend domain is in authorized domains
- frontend build has correct `VITE_FIREBASE_*` values

### Email link sign-in fails

Check:

- Email link provider is enabled
- `/verify` is reachable on your frontend
- the frontend domain is authorized in Firebase

### Google Workspace OAuth fails

Check:

- redirect URI matches exactly
- consent screen is configured
- your tester email is added if app is still in testing mode

## Update Flow After First Deploy

If backend code changed:

```bash
export PROJECT_ID=YOUR_PROJECT_ID
export REGION=us-central1
export SERVICE_NAME=crewmate
export MIN_INSTANCES=0
export MAX_INSTANCES=1
./scripts/deploy-cloud-run.sh
```

If frontend code changed:

```bash
npm run build
firebase deploy --only hosting
```

If both changed:

1. deploy backend
2. rebuild frontend if needed
3. deploy frontend

## Recommended GitHub Flow

GitHub is not required for deploy, but it is recommended.

Do this before the first real deploy:

1. confirm `.env` is ignored
2. commit your code
3. push to GitHub
4. deploy from your machine

Why:

- safer rollback
- easier backup
- cleaner future updates

## Emergency Stop Plan

If you think spend or traffic is getting weird:

1. remove or pause the frontend from Firebase Hosting
2. set Cloud Run traffic to zero or delete the service
3. rotate any key you suspect may be exposed
4. check billing and usage pages

## Official References

- Firebase Auth web setup: https://firebase.google.com/docs/auth/web/start
- Firebase email link auth: https://firebase.google.com/docs/auth/web/email-link-auth
- Firebase Hosting deploy: https://firebase.google.com/docs/hosting/quickstart
- Cloud Run deploy containers: https://cloud.google.com/run/docs/deploying
- Cloud Run environment variables: https://cloud.google.com/run/docs/configuring/services/environment-variables
- Cloud billing budgets: https://cloud.google.com/billing/docs/how-to/budgets
- Cloud Run pricing: https://cloud.google.com/run/pricing
