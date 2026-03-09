# Crewmate Full-Stack Local Runbook

This document is the practical guide for running Crewmate locally, wiring real integrations, testing the live agent flow, and understanding what still needs to be built next.

It is intentionally grounded in the current codebase as of March 9, 2026. It is not a generic architecture note.

## 1. What Exists Right Now

The repo is now a real local full-stack app with these pieces:

- `Vite + React` frontend on port `3000`
- `Express + SQLite` backend on port `8787`
- passwordless local auth via verification code
- real local persistence for sessions, tasks, activity, notifications, memory, and users
- real Gemini Live session startup and turn handling
- live screen frame ingestion
- live microphone audio ingestion
- real tool wrappers for:
  - GitHub issue creation
  - Slack message posting
  - Notion page creation
  - ClickUp task creation
- real integrations catalog plus frontend-managed saved connections

What is still local-MVP and not fully production-grade yet:

- async delegated jobs are scaffolded, not fully implemented
- memory is SQLite-backed, not migrated to Google Cloud storage yet
- auth uses local dev OTP flow, not real email delivery

## 2. Ports and Processes

The app uses two processes in local development:

### Frontend

- command: `npm run dev`
- URL: `http://localhost:3000`

### Backend

- command: `npm run dev:server`
- URL: `http://localhost:8787`

Backend script from `package.json`:

```json
"dev:server": "node --import tsx server/index.ts"
```

That means the backend is not started by `npm run dev`.

If only the frontend is running, pages that depend on `/api/*` will fail or show empty/error states.

## 3. Exact Local Startup Flow

### Step 1: Install dependencies

```bash
npm install
```

### Step 2: Create a local `.env`

```bash
cp .env.example .env
```

Minimum useful local `.env`:

```env
VITE_API_URL=
PORT=8787
CORS_ORIGIN=http://localhost:3000
CREWMATE_DB_PATH=data/crewmate.db
CREWMATE_ENCRYPTION_KEY=replace_with_a_long_random_secret
GOOGLE_API_KEY=your_google_ai_studio_key
GEMINI_LIVE_MODEL=gemini-2.5-flash-native-audio-preview-12-2025
```

Important:

- leave `VITE_API_URL` empty for local dev
- Vite proxies `/api` to `http://localhost:8787`
- if you set `VITE_API_URL`, the frontend will call that URL directly instead of the local proxy
- `CREWMATE_ENCRYPTION_KEY` is required if you want users to save integration credentials from the frontend
- `GEMINI_TEXT_MODEL`, `GEMINI_RESEARCH_MODEL`, and `GEMINI_CREATIVE_MODEL` control the non-live generation lanes

### Step 3: Start the backend

In terminal 1:

```bash
npm run dev:server
```

Expected output:

```bash
Crewmate local API listening on http://localhost:8787
```

If you previously ran an older version of the app, your SQLite DB may still contain old local records. Reset it once before testing:

```bash
npm run db:reset
```

Then start the backend again:

```bash
npm run dev:server
```

### Step 4: Start the frontend

In terminal 2:

```bash
npm run dev
```

Expected URL:

```text
http://localhost:3000
```

### Step 5: Verify backend health before opening the app

```bash
curl http://localhost:8787/api/health
```

Expected response:

```json
{"ok":true}
```

If this fails, the frontend will not behave correctly.

## 4. Why `npm run dev:server` Might Not Work

If backend startup is failing locally, use this checklist.

### Problem: `tsx` not found

Cause:

- dependencies were not installed correctly

Fix:

```bash
npm install
```

Then retry:

```bash
npm run dev:server
```

### Problem: port `8787` already in use

Fix either by killing the conflicting process or changing `PORT` in `.env`.

Check the port:

```bash
lsof -i :8787
```

If needed, set a different backend port:

```env
PORT=8790
```

If you change backend port, also update the frontend proxy target or set:

```env
VITE_API_URL=http://localhost:8790
```

### Problem: database path cannot be created

Cause:

- invalid `CREWMATE_DB_PATH`
- missing write permissions in the chosen directory

Recommended value:

```env
CREWMATE_DB_PATH=data/crewmate.db
```

### Problem: backend starts but live session creation fails

Cause:

- missing `GOOGLE_API_KEY`

The backend can still run without Gemini, but `POST /api/sessions/live` will fail until the key is set.

### Problem: frontend loads but integration page shows errors

Likely causes:

- backend is not running
- frontend is calling the wrong API base URL
- backend was not restarted after env/config changes

Fix sequence:

1. confirm `curl http://localhost:8787/api/health` works
2. confirm `.env` has `VITE_API_URL=` or a correct explicit backend URL
3. restart both terminal processes

## 5. Current Local Environment Variables

These are the supported backend env vars from `server/config.ts`.

### Core runtime

```env
PORT=8787
CORS_ORIGIN=http://localhost:3000
CREWMATE_DB_PATH=data/crewmate.db
CREWMATE_ENCRYPTION_KEY=
GOOGLE_API_KEY=
GEMINI_LIVE_MODEL=gemini-2.5-flash-native-audio-preview-12-2025
GEMINI_TEXT_MODEL=gemini-2.5-flash
GEMINI_RESEARCH_MODEL=gemini-2.5-flash
GEMINI_CREATIVE_MODEL=gemini-3-pro-image-preview
```

### GitHub

```env
GITHUB_TOKEN=
GITHUB_REPO_OWNER=
GITHUB_REPO_NAME=
```

### Slack

```env
SLACK_BOT_TOKEN=
SLACK_DEFAULT_CHANNEL_ID=
```

### Notion

```env
NOTION_TOKEN=
NOTION_PARENT_PAGE_ID=
```

### ClickUp

```env
CLICKUP_TOKEN=
CLICKUP_LIST_ID=
```

## 6. Frontend-to-Backend Wiring

The frontend calls `/api/*` through `src/lib/api.ts`.

Important behavior:

- it automatically attaches `Authorization: Bearer <token>` if the auth token exists in local storage
- if `VITE_API_URL` is empty, requests go through Vite's proxy
- Vite proxy is configured to send `/api` requests to `http://localhost:8787`

So the cleanest local setup is:

- frontend on `3000`
- backend on `8787`
- `VITE_API_URL=` empty

## 7. First Login and Onboarding

The current local auth flow is dev-friendly and does not send real email.

### Login flow

1. Open `http://localhost:3000`
2. Enter an email
3. Submit
4. The backend creates a verification code
5. The verify page shows the dev code directly
6. Enter the code and continue

### Useful auth API smoke tests

Request a code:

```bash
curl -X POST http://localhost:8787/api/auth/request-code \
  -H "Content-Type: application/json" \
  -d '{"email":"varun@example.com"}'
```

Expected response:

```json
{"email":"varun@example.com","devCode":"123456"}
```

Verify the code:

```bash
curl -X POST http://localhost:8787/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"email":"varun@example.com","code":"123456"}'
```

Expected response shape:

```json
{
  "token": "auth_...",
  "user": {
    "id": "USR-...",
    "email": "varun@example.com",
    "name": "Varun",
    "plan": "MVP"
  }
}
```

Get current user:

```bash
curl http://localhost:8787/api/auth/me \
  -H "Authorization: Bearer auth_your_token_here"
```

## 8. Current API Surface

These endpoints exist today:

### Health

- `GET /api/health`

### Auth

- `POST /api/auth/request-code`
- `POST /api/auth/verify`
- `GET /api/auth/me`
- `POST /api/auth/logout`

### Dashboard and workspace data

- `GET /api/dashboard`
- `GET /api/tasks`
- `GET /api/activities`
- `GET /api/sessions/history`
- `GET /api/notifications`
- `POST /api/notifications/read-all`
- `GET /api/capabilities`
- `GET /api/integrations`
- `GET /api/integrations/:integrationId/config`
- `PUT /api/integrations/:integrationId/config`
- `DELETE /api/integrations/:integrationId/config`
- `GET /api/preferences`
- `PUT /api/preferences`
- `GET /api/jobs`
- `POST /api/jobs/research-brief`
- `POST /api/creative/generate`
- `GET /api/memory/nodes`
- `POST /api/memory/ingest`

### Live sessions

- `POST /api/sessions`
- `POST /api/sessions/live`
- `POST /api/sessions/:sessionId/messages`
- `POST /api/sessions/:sessionId/frame`
- `POST /api/sessions/:sessionId/audio`
- `POST /api/sessions/:sessionId/audio/end`
- `POST /api/sessions/:sessionId/end`

## 9. Integration Setup: How to Actually Start

Integrations can now be configured in two ways:

1. save connection details from the Integrations page
2. preload connection details through `.env`

The correct local workflow is:

1. decide which tool you want to demo
2. either save its credentials from the frontend or set its env vars
3. if you used `.env`, restart the backend
4. verify the integration page shows it as connected
5. test the raw API/tool path
6. test the live voice or typed tool request

For the hackathon, this is better than building OAuth first.

Recommended order:

1. GitHub
2. Slack
3. Notion
4. ClickUp

## 10. GitHub Integration

This is the best first integration because it is deterministic and easy to verify.

### Required values

```env
token=...
repoOwner=...
repoName=...
```

### Recommended token scope

Use a token that can create issues in the target repo.

### Best demo repo choice

Use a dedicated demo repo so the agent can safely create issues during testing.

### How to test it

1. save the GitHub connection from the Integrations page, or set the env vars and restart the backend
3. open Integrations page and confirm GitHub is connected
4. start a live session
5. use a typed test first:

Example prompt:

```text
Create a GitHub issue for the checkout button overlap bug. Include repro steps and mark it as a UI bug.
```

### What should happen

- Gemini decides to call `create_github_issue`
- backend creates the issue
- task/activity entries are recorded
- notifications are created

### Manual validation

- check the target repo issues tab
- check dashboard activity feed
- check notifications page

## 11. Slack Integration

### Required values

```env
botToken=...
defaultChannelId=...
```

### Slack app requirements

Your bot must be installed in the workspace and able to post to the chosen channel.

### How to test it

Example live prompt:

```text
Post a short update to Slack saying the checkout overlap bug was logged and is ready for frontend review.
```

### Validation

- message appears in the configured channel
- activity feed records a Slack action

## 12. Notion Integration

### Required values

```env
token=...
parentPageId=...
```

### Important Notion requirement

The parent page must be shared with the internal integration, otherwise page creation will fail.

### How to test it

Example live prompt:

```text
Create a Notion page called Checkout Bug Summary and save a short summary of the issue and next steps.
```

### Validation

- page appears under the configured parent page
- activity/task entries appear locally

## 13. ClickUp Integration

### Required values

```env
token=...
listId=...
```

### How to test it

Example live prompt:

```text
Create a ClickUp task for fixing the checkout button overlap with repro steps and expected behavior.
```

### Validation

- task appears in the chosen ClickUp list
- local task/activity entries update

## 14. How to Test the Live Agent End to End

### Minimum setup

- backend running
- frontend running
- `GOOGLE_API_KEY` configured

### Strong local test sequence

1. log in using local OTP
2. go through onboarding
3. open dashboard
4. click `Start Live Session`
5. allow microphone access
6. allow screen share
7. wait for session to start
8. send a simple test prompt first

Example:

```text
Introduce yourself and describe the tools you can currently use.
```

Then test one action:

```text
Create a GitHub issue for the visual bug on this screen.
```

Then test one communication action:

```text
Post a Slack update saying the issue has been filed.
```

Then test one artifact action:

```text
Create a Notion page summarizing what we just found.
```

## 15. API Smoke Tests Without the Frontend

You can validate the local API independently before blaming the UI.

### Health

```bash
curl http://localhost:8787/api/health
```

### Integrations

```bash
curl http://localhost:8787/api/integrations
```

### Capabilities

```bash
curl http://localhost:8787/api/capabilities
```

### Notifications

```bash
curl http://localhost:8787/api/notifications
```

### Memory

```bash
curl http://localhost:8787/api/memory/nodes
```

### Create a memory node manually

```bash
curl -X POST http://localhost:8787/api/memory/ingest \
  -H "Content-Type: application/json" \
  -d '{"title":"Competitor pricing teardown","type":"document"}'
```

## 16. What To Do If a Specific Tool Fails

### GitHub failures

Check:

- token is valid
- repo owner/name are correct
- token can create issues in that repo

### Slack failures

Check:

- bot token is valid
- app is installed
- channel ID is correct
- bot can post in that channel

### Notion failures

Check:

- token is valid
- parent page ID is correct
- integration has access to the parent page

### ClickUp failures

Check:

- token is valid
- list ID is correct
- token has workspace access

## 17. Best Local Demo Setup

If you want the fastest stable demo path, configure only these first:

1. `GOOGLE_API_KEY`
2. `GITHUB_TOKEN`
3. `GITHUB_REPO_OWNER`
4. `GITHUB_REPO_NAME`
5. optionally `SLACK_BOT_TOKEN`
6. optionally `SLACK_DEFAULT_CHANNEL_ID`

That gives you:

- real live multimodal session
- one strong deterministic action path
- one strong communication path

This is enough for a convincing MVP before adding Notion and ClickUp.

## 18. What Still Needs To Be Built Next

These are the strongest next engineering passes.

### Pass 1: Persist account/runtime preferences

Current issue:

- account settings are local UI state only

Needed changes:

- add a `user_preferences` table in SQLite
- add `GET /api/preferences`
- add `PUT /api/preferences`
- load preferences into `Account`
- wire settings into runtime behavior

Suggested preference fields:

- `voice_model`
- `reasoning_level`
- `proactive_suggestions`
- `auto_start_screen_share`
- `blur_sensitive_fields`

### Pass 2: Delegated async jobs

Current issue:

- async handoff exists only as a concept/scaffold

Needed changes:

- add a `jobs` table
- add a background worker loop
- support statuses like `queued`, `running`, `completed`, `failed`
- allow live runtime to enqueue research or follow-up tasks
- post results into Slack/Notion when complete

### Pass 3: Richer memory consolidation

Current issue:

- live turns are checkpointed, but memory is still shallow

Needed changes:

- store session summaries
- store tool outputs as memory artifacts
- consolidate multiple turns into structured insights
- add retrieval hooks for live sessions and async jobs

### Pass 4: More autonomous live tool routing

Current issue:

- current tool routing is good, but still fairly explicit

Needed changes:

- improve system instructions for when tools should be used
- chain actions safely
- allow one request to create issue + Slack update + Notion note
- add clear confirmation/guardrails in the UI

### Pass 5: Cloud migration

When local behavior is stable:

- move SQLite-backed data to Google Cloud storage systems
- deploy backend to Google Cloud Run
- switch env-based credentials to proper secret management
- replace local OTP dev flow with real auth/email flow

## 19. Recommended Immediate Next Build Order

If continuing from this exact codebase, the order should be:

1. persist account/runtime preferences
2. add async delegated jobs
3. improve memory consolidation and retrieval
4. support chained multi-tool actions
5. move storage/runtime to Google Cloud

That order is low-risk and keeps the product demo improving without unnecessary rewrites.

## 20. Local Verification Commands

Use these after changes:

```bash
npm run lint
npm run test
npm run build
```

Current expectation:

- lint should pass
- tests should pass
- build should pass

## 21. Short Version

If you want the shortest path to a real local demo:

1. `npm install`
2. `cp .env.example .env`
3. set `GOOGLE_API_KEY`
4. set GitHub env vars
5. run `npm run dev:server`
6. run `npm run dev`
7. open `http://localhost:3000`
8. log in with local OTP
9. start live session
10. ask it to create a GitHub issue from what it sees

That is the current best local proof that the app is no longer just a frontend prototype.
