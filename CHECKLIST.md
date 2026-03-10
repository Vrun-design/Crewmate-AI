# Crewmate — Pre-Launch Checklist

> Complete every item before submitting to the hackathon or going live.

---

## 1. Local Dev Setup ✅

- [ ] `cp .env.example .env` and fill in `GOOGLE_API_KEY` + `CREWMATE_ENCRYPTION_KEY`
- [ ] `npm install` completes without errors
- [ ] `npm run dev` starts (frontend on :3000, backend on :8787)
- [ ] Visit http://localhost:3000 — onboarding flow loads
- [ ] Sign up with an email, land on Dashboard

---

## 2. Core Features — Test Manually

### Live Session
- [ ] Click "Start Session" → mic permission prompt appears
- [ ] Grant mic → session starts, Gemini Live connects
- [ ] Say "Hello" → agent responds with audio
- [ ] Enable screen share → agent can see your screen (check Network tab for frame POSTs)
- [ ] Say "What's on my screen?" → agent describes what it sees
- [ ] Say "Check git status" → terminal skill executes, result returned in audio
- [ ] End session → session appears in Sessions page

### Skills Hub (`/skills`)
- [ ] All 20 skills listed
- [ ] Click a skill → drawer opens with input form
- [ ] Run `web.search` with a query → result returned
- [ ] Run `browser.search-google` → Playwright executes, results returned
- [ ] Run `calendar.find-free-time` (if Calendar connected) → free slots returned
- [ ] Skill history tab shows previous runs

### Agent Network (`/agents`)
- [ ] Agent cards show all 5 agents (Research, DevOps, Comms, Calendar, Content)
- [ ] Type "Research the latest AI agent frameworks" → task dispatches
- [ ] Task appears in Live Task Feed with SSE streaming updates
- [ ] Task completes → result card expands with output
- [ ] Type "Draft an email to my team about the new release" → Communications Agent handles it

### Memory Base (`/memory`)
- [ ] Memory nodes appear after a live session
- [ ] Search bar filters by keyword
- [ ] Source filter (Live / Skill / Agent) works
- [ ] Toggle a node off → it disappears from active retrieval
- [ ] Subsequent session references earlier context correctly

### Integrations (`/integrations`)
- [ ] All integrations listed with correct status
- [ ] "Connect with Google" OAuth flow works (Gmail + Calendar)
- [ ] After OAuth, Gmail inbox preview appears on Dashboard
- [ ] Slack: post a message via skill → appears in channel

---

## 3. Terminal Sandbox Security Test

- [ ] `npm test` → all 44 tests pass (26 core + 18 sandbox)
- [ ] Run skill `terminal.run-command` with `rm -rf /` → **blocked immediately**
- [ ] Run with `sudo ls` → blocked
- [ ] Run with `git status` → executes successfully
- [ ] Run with `npm test` → executes successfully
- [ ] Try cwd `../../../etc` → blocked ("outside project root")

---

## 4. API Health Check

```bash
curl http://localhost:8787/api/health
```

Expected:
```json
{
  "ok": true,
  "service": "crewmate",
  "skills": 20,
  "uptime": 42,
  "version": "0.1.0"
}
```

- [ ] `ok: true`
- [ ] `skills: 20`
- [ ] Response time < 200ms

---

## 5. MCP Server

```bash
# List MCP tools
curl -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

- [ ] Returns all 20 tools
- [ ] Add to Claude Desktop config → tools visible in Claude
- [ ] Call a tool from Claude → executes correctly

---

## 6. GCP Deployment

### Pre-deploy checklist
- [ ] `gcloud auth login` successful
- [ ] `gcloud config set project YOUR_PROJECT_ID`
- [ ] Billing enabled on the project
- [ ] `GOOGLE_API_KEY` ready to put into Secret Manager

### Deploy
```bash
./cloud-deploy.sh YOUR_PROJECT_ID
```

- [ ] Script runs without errors
- [ ] Docker build completes (≈ 5 min first time)
- [ ] Image appears in Container Registry
- [ ] Cloud Run service created in `us-central1`
- [ ] URL printed at end of script

### Post-deploy verification
```bash
CLOUD_URL=$(gcloud run services describe crewmate --region us-central1 --format 'value(status.url)')
curl $CLOUD_URL/api/health
```

- [ ] `ok: true` from Cloud Run URL
- [ ] Skills count = 20
- [ ] Frontend loads at Cloud Run URL (static files served)
- [ ] Live session starts from Cloud Run URL

### Take the GCP proof screenshot
- [ ] Open GCP Console → Cloud Run → crewmate → show logs
- [ ] **Screenshot this** — required for hackathon submission

---

## 7. Database Strategy

### Current: SQLite (`better-sqlite3`)
- ✅ Zero config, works locally and on Cloud Run
- ⚠️ Data resets on container restart (Cloud Run is ephemeral)
- ✅ Fine for hackathon demo — fresh state is acceptable

### For Production (Post-Hackathon): Migrate to Cloud Firestore
**Recommendation: Cloud Firestore** (not Firebase Realtime DB, not Cloud SQL)

| Option | Pros | Cons |
|---|---|---|
| **Cloud Firestore** ✅ | Google-native, serverless, real-time, free tier | requires SDK migration |
| Cloud SQL (Postgres) | Full SQL, familiar schema | requires always-on instance ($$$) |
| PlanetScale / Neon | Serverless Postgres, free tier | not Google ecosystem |
| Firebase Realtime DB | Simple, real-time | JSON-only, not great for relational data |

**Migration path:**
1. Replace `better-sqlite3` calls in `server/db.ts` with Firestore SDK
2. Keep the same service interfaces (memoryService, orchestrator, etc.) — only the storage layer changes
3. Memory embeddings → Vertex AI Vector Search for production scale

### For hackathon: Keep SQLite
No change needed. The contest runs for 1 session — SQLite is fine.

---

## 8. Custom Skills (User-Defined)

### Currently: No UI for custom skills
Skills are TypeScript files in `server/skills/`. Power users can add skills by:
1. Creating a new file following the `Skill` interface in `server/skills/types.ts`
2. Importing + registering it in `server/skills/index.ts`
3. Restarting the server

### Roadmap: Custom Skill Editor (Post-Hackathon)
Build a UI at `/skills/create` where users can:
- Define skill name, description, trigger phrases
- Write the handler as a simple JSON-passthrough or UI-configured webhook
- Point to a webhook URL (their own API) → Crewmate calls it as a skill
- Upload skill packs (like OpenClaw's skill marketplace)

This is the OpenClaw equivalent of thousands of community skills.

---

## 9. Hackathon Submission Checklist

- [ ] **Demo video recorded** (< 4 min, shows multimodal features working in real-time)
  - [ ] Shows audio input + agent voice response
  - [ ] Shows screen share → agent describes screen
  - [ ] Shows skill execution (at least 2 skills)
  - [ ] Shows agent network routing a task
  - [ ] Pitches the problem + value
- [ ] **README.md** updated with YouTube video link (line ~43)
- [ ] **Public GitHub repo** — `git push` done
- [ ] **GCP proof screenshot/recording** — Cloud Run console or logs visible
- [ ] **Architecture diagram** — in README (Mermaid rendered on GitHub)
- [ ] **Text description** — Summary for submission form (copy from README intro + findings)
- [ ] **Submission form filled** on lablab.ai

### Bonus points
- [ ] Blog post / video published with `#GeminiLiveAgentChallenge`
- [ ] `cloud-deploy.sh` IaC script visible in repo (already done ✅)
- [ ] GDG profile linked

---

## 10. Soul & Orchestration

- [ ] Read `SOUL.md` — understand the agent's identity
- [ ] Live sessions load system prompt from persona settings
- [ ] Voice is selectable in onboarding (Aoede / Charon / Fenrir / Kore / Puck)
- [ ] Orchestrator routes to correct specialist agent (test with 5 different intent types)
- [ ] Agent results appear in real-time via SSE in `/agents` page

---

*Last updated: 2026-03-10*
