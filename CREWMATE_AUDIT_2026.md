# Crewmate Platform — Full Product Audit
**Date:** March 14, 2026
**Scope:** Full codebase review, bugs, gaps, UX issues, improvement roadmap
**Goal:** Turn Crewmate into a true remote-employee-grade AI platform

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Critical Bugs](#critical-bugs)
3. [Browser Automation — The Core Problem](#browser-automation)
4. [Agent Quality Issues](#agent-quality)
5. [Session & Auth Persistence](#session-and-auth-persistence)
6. [Real-Time & SSE Issues](#real-time-sse-issues)
7. [Google Workspace (Slides, Docs, Sheets)](#google-workspace)
8. [Crew Network — Active Status](#crew-network)
9. [UI/UX Gaps](#uiux-gaps)
10. [Integration Gaps](#integration-gaps)
11. [High-Impact Quick Wins](#high-impact-quick-wins)
12. [Strategic Improvements for "Remote Employee" Grade](#strategic-improvements)
13. [Implementation Roadmap](#implementation-roadmap)

---

## Executive Summary

Crewmate is a well-architected platform with a strong foundation — Gemini Live, 14 agents, 51 skills, Google Workspace, memory, and a clean React UI. However, there is a significant gap between what the architecture *promises* and what actually *works reliably* in practice. The system has:

- **Browser automation that fails on real-world sites** (captchas, anti-bot, login walls)
- **Task status that gets permanently stuck** after SSE disconnects
- **Session state lost on every refresh or re-login** — feels like a demo, not a product
- **Slides and complex document creation that silently fails** or produces bare output
- **Research that runs 5x slower than it needs to** (sequential not parallel)
- **Active agent indicators that lag 15 seconds** or never update
- **No mechanism to resume tasks or recover from crashes**

The vision is right. The plumbing needs hardening.

---

## Critical Bugs

### Bug 1: Task Status Permanently Stuck as "Working on it" / "In Progress"

**Where:** `LiveSessionContext.tsx` → `liveTaskCue` state + `Tasks.tsx` → `AgentTask` status

**What happens:** When a background task is running and the SSE connection drops (network hiccup, page navigation, server restart), the `liveTaskCue` in the dashboard sidebar stays in `running` state permanently. It is only cleared when a terminal SSE event (`completed` / `failed`) arrives. If that event was missed, nothing resets it.

**Root cause:**
```typescript
// LiveSessionContext.tsx line 164
React.useEffect(() => {
  // Keep 'running' cues visible indefinitely — they will be replaced by completed/failed
  if (!liveTaskCue || liveTaskCue.status === 'running') {
    return;
  }
  const timer = window.setTimeout(() => setLiveTaskCue(null), 7000);
  return () => window.clearTimeout(timer);
}, [liveTaskCue]);
```
If the `completed`/`failed` event is never received, `liveTaskCue` with `status === 'running'` stays forever.

**Same bug in Tasks page:** When the task detail drawer's SSE stream disconnects mid-run (`onError` in `subscribeToTask`), the task stays "Running" in the list. The `loadAgentTasks()` auto-refresh only fires after terminal events (line 204), which may never come if SSE drops.

**Fix:**
1. Add a `lastUpdatedAt` timestamp to `liveTaskCue` and set a 3-minute maximum display time for running state, then clear it and show a "task status unknown — check Tasks page" fallback.
2. In `Tasks.tsx`, add a polling fallback: if the SSE stream errors out and the task still shows as `running`, poll `GET /api/agents/tasks/:id` every 10 seconds as a recovery mechanism.
3. On server: add a startup job that marks all `task_runs` with `status = 'running'` older than 10 minutes as `failed` with `error = 'Server restart — task interrupted'`. Prevents indefinite orphaned state.

---

### Bug 2: Orphaned "Running" Tasks Across Server Restarts

**Where:** `server/services/orchestratorShared.ts` + `server/repositories/workspaceRepository.ts`

**What happens:** When the server restarts (during development or deployment), any task that was `running` in the `task_runs` table remains `running` forever. The in-memory task queue (`taskListeners` map) is wiped on restart, but the DB entries persist. On next load, the Tasks page shows tasks stuck in `in_progress` / `running` indefinitely.

**Root cause:** There is no cleanup job on server startup to mark orphaned running tasks as failed.

**Fix:**
```typescript
// In server/index.ts, run on startup:
db.prepare(`
  UPDATE task_runs
  SET status = 'failed',
      error = 'Server restarted while task was running',
      completed_at = ?
  WHERE status IN ('running', 'queued')
    AND created_at < datetime('now', '-5 minutes')
`).run(new Date().toISOString());

// Also update the parent workspace tasks:
db.prepare(`
  UPDATE tasks
  SET status = 'failed'
  WHERE status = 'in_progress'
    AND id IN (
      SELECT t.id FROM tasks t
      WHERE NOT EXISTS (
        SELECT 1 FROM task_runs tr
        WHERE tr.task_id = t.id AND tr.status IN ('running', 'queued')
      )
    )
`).run();
```

---

### Bug 3: Task Content Lost After Page Refresh / Re-Login

**Where:** `src/pages/Tasks.tsx` — `createdTasks` state

**What happens:** When you create a task and it appears in the UI, it's added to `createdTasks` — an in-memory React state array. If you navigate away, refresh the page, or log out and back in, `createdTasks` is reset to `[]`. The task IS saved in the DB, but it won't appear in the list if the workspace query doesn't return it (e.g., because it's filtered, paginated, or its status doesn't match the default query).

**Root cause:** `createdTasks` is ephemeral state used to give instant feedback. But the `useWorkspaceCollection` hook that fetches persisted tasks may not include newly created tasks if the DB write hasn't committed or the cache hasn't refreshed.

**Secondary issue:** Agent tasks (`/api/agents/tasks`) are stored in-memory in the orchestrator process (the `taskListeners` map), NOT in the DB. After server restart, the running task history is lost.

**Fix:**
1. Make `createdTasks` state cleared after the server-side data loads and merges (this partly exists already via `mergeCreatedTasks`). Add a `useEffect` that checks if any `createdTask` ID now exists in `tasks` from the server, and removes it from local state.
2. **Most importantly:** Ensure `task_runs` has a proper `user_id` and `workspace_id` index and that the workspace tasks endpoint joins them correctly so all user tasks are always visible.
3. Persist agent task state to DB on every status update (currently in-memory map in `orchestratorShared.ts`).

---

### Bug 4: Crew Network Agents Never Show as "Active"

**Where:** `src/pages/Agents.tsx` → `loadActiveAgents()`, `src/components/agents/AgentNodeMap.tsx`

**What happens:** The active agent detection polls `/api/agents/tasks` every 15 seconds and looks for tasks with `status === 'running' || status === 'queued'`, then maps them to `agentId`. If an agent task completes in under 15 seconds, the crew network never visually lights up.

**Secondary issue:** The `agentId` stored in agent task runs must exactly match the agent manifest IDs (`crewmate-research-agent`, etc.). If tasks are routed via skill (not agent), `agentId` may be empty, so no node lights up even for active work.

**Fix:**
1. Subscribe to SSE events in the Agents page: listen for `live_task_update` events and immediately update `activeAgentIds` in real-time (instead of only polling).
2. Add a `live_agent_update` SSE event type that broadcasts when an agent task starts/stops, with the `agentId`.
3. Reduce polling interval to 5 seconds as a fallback.

---

### Bug 5: Live Session SSE Interruption When Switching Dashboard → Tasks

**Where:** `src/hooks/useLiveEvents.ts` + `src/lib/liveEventsStream.ts`

**What happens:** The `useLiveEvents` hook subscribes to SSE on mount. When you navigate from Dashboard to Tasks (or any other page), React may remount components that re-subscribe. If the SSE connection briefly drops during navigation and task events were in-flight, those events are lost. The MiniSessionBar shows the session timer correctly (it's in `LiveSessionContext`), but task completion events may be missed.

**Root cause:** The SSE stream in `liveEventsStream.ts` has no replay or reconnect-with-backoff. If the connection drops for any reason, events emitted during the gap are permanently lost.

**Fix:**
1. Add auto-reconnect with exponential backoff (1s → 2s → 4s → 8s → max 30s) in `liveEventsStream.ts`.
2. Add a `last_event_id` header support so the server can replay missed events (Last-Event-ID SSE spec).
3. Add a `connected` event heartbeat from the server every 25 seconds, and if the client misses 2 heartbeats, auto-reconnect.

---

### Bug 6: Firebase Auth Token Expiry Not Handled Gracefully

**Where:** `src/lib/api.ts` → `getAuthHeader()` + `src/services/firebaseAuth.ts`

**What happens:** Firebase ID tokens expire after 1 hour. The Firebase SDK auto-refreshes them, but there can be a window (e.g., if the tab is in the background, computer sleeps) where the token is stale. The app's `getAuthHeader()` calls `firebaseAuthService.getIdToken()` which should trigger a refresh, but if Firebase initialization failed (misconfigured .env), it falls through to localStorage dev token. If neither works, API calls silently fail with 401s.

**Specific bug:** In `api.ts` line 59-62, when a 401 happens, `clearAuthSession()` removes the localStorage token AND dispatches `crewmate:auth-expired`. But in `App.tsx`, there's no listener for `crewmate:auth-expired` to redirect the user to `/login`. The user stays on the page with a broken state.

**Fix:**
```typescript
// In App.tsx, add a global auth expiry listener:
useEffect(() => {
  const handleAuthExpired = () => {
    window.location.href = '/login';
  };
  window.addEventListener('crewmate:auth-expired', handleAuthExpired);
  return () => window.removeEventListener('crewmate:auth-expired', handleAuthExpired);
}, []);
```

---

## Browser Automation

### The Core Problem

The current browser automation stack is: **Stagehand (Browserbase) → Local Playwright → Gemini 2.5 Flash**

This works for simple tasks (extract text, navigate, fill basic forms) but fails consistently on:
- Sites with bot detection (Cloudflare, Datadome, PerimeterX)
- Sites requiring login (newsletter signups behind auth walls)
- Multi-step flows with dynamic JS (SPAs with complex state)
- CAPTCHAs
- Sites that block headless Chrome User-Agents

**Evidence in code** — `stagehandExecutor.ts` checks for blocked hints (captcha, 2FA, sign in required) and immediately returns `status: 'blocked'`. This means any site with these protections silently fails with no fallback.

### Current Architecture Issues

1. **New browser instance per task**: Every call to `executeWithStagehand()` creates a fresh `new Stagehand({...})`, initializes it, and closes it after. This means:
   - 3-8 second cold start per task (Chrome initialization)
   - No persistent cookies or session state
   - Newsletter signups typically require you to be in an "authenticated-looking" browser session

2. **Default User-Agent is detected as headless**: The browser launches with `--headless: true`. Many modern websites detect this and block or serve degraded content.

3. **No human-like behavior**: Stagehand's `act()` drives interactions but doesn't simulate realistic mouse movements, typing delays, or page-reading time. This is a red flag for anti-bot systems.

4. **`gemini-2.5-flash` is fine for navigation decisions, but not vision-heavy tasks**: When the page is visually complex (a slide deck tool, a rich editor, a complex form), Flash may make incorrect decisions about what to click.

### Recommended Fix: Playwright + Gemini Vision 3.1 Pro

Switch to a **Playwright-direct approach** with Gemini Vision for complex tasks:

**For simple tasks** (navigate, extract, fill forms):
- Use Playwright directly with stealth mode (`playwright-extra` + `puppeteer-extra-plugin-stealth`)
- Remove headless flag or use `headless: 'new'` (chromium headless that is harder to detect)
- Add realistic delays and human-like mouse movement patterns

**For complex tasks** (login flows, SPAs, visual navigation):
- Screenshot → Gemini Vision 3.1 Pro (`gemini-3.1-pro-preview`) for action planning
- The Pro model has much better vision reasoning than Flash for complex UI states
- Run 1-3 screenshot → plan → act loops until success

**For anti-bot sites** (newsletter signups, LinkedIn, etc.):
- Use Browserbase cloud (Stagehand `env: 'BROWSERBASE'`) for tasks that need residential IPs and human fingerprinting
- Gate this behind an `BROWSERBASE_API_KEY` check; fall back to local if unavailable

**Code changes needed:**
- `server/services/uiNavigator/stagehandExecutor.ts`: Add `playwright-extra` + stealth plugin
- `server/config.ts`: Add `ENABLE_BROWSERBASE_CLOUD` flag
- `server/services/uiNavigator/uiNavigatorPlanner.ts`: Upgrade vision model to Pro for complex flows
- Add persistent browser session pool: one browser instance per user, reused across tasks (preserves cookies)

### Persistent Browser Sessions (Critical for Login-Required Tasks)

The biggest gap: there's no way for the agent to log in to a site once and reuse that session. Every task starts fresh. This means:
- "Sign me up for this newsletter" fails if the site requires email verification or has rate-limiting
- "Post this on LinkedIn" fails because LinkedIn blocks headless browsers
- "Check my Gmail and summarize" requires GWS OAuth, not browser login

**Fix:** Implement a `BrowserSession` manager that:
1. Maintains one Playwright browser context per user
2. Saves/restores cookies from a secure per-user storage
3. Allows agents to "log in" to a site once and reuse that session for subsequent tasks

---

## Agent Quality

### Research Agent Issues

**Location:** `server/services/agents/researchAgent.ts`

**Issue 1: Sequential searches (5x slower than needed)**
```typescript
// Line 228 — This runs searches ONE AT A TIME:
for (let i = 0; i < searchQueries.length; i++) {
  const searchRun = await runSkill('web.search', ctx, { query, maxResults: 5 });
}
```
For 5 search queries, this takes 5× the time of a single search. Switching to `Promise.all()` or `Promise.allSettled()` would cut research time by 60-80%.

**Fix:**
```typescript
const searchResults = await Promise.allSettled(
  searchQueries.map((query) => runSkill('web.search', ctx, { query, maxResults: 5 }))
);
```

**Issue 2: `researchGrounding` feature flag probably disabled in production**
The deep-URL extraction step (lines 257-280) is gated behind `isFeatureEnabled('researchGrounding')`. If this flag is off, the agent only uses search snippet text (100-200 chars per result), not full article content. This dramatically limits research depth. This should be ON by default.

**Issue 3: Content cap at 5000 chars for synthesis**
Line 290: `evidenceBlock` is capped at `totalContext.slice(0, 6000)`. For a 5-query research run with 5 sources each, the raw context could be 30-50K chars. Gemini Pro context window can handle this — the cap is too aggressive.

**Issue 4: No image/chart support**
Research reports have no visual elements. A competitor landscape or market analysis without charts is much less useful than one with a visual positioning map. The research agent should be able to create a Google Sheet with the data AND a Slides deck with charts.

### Slides Creation Issues

**Location:** `server/services/agents/agentWorkspaceOutput.ts`

**Issue 1: Plain text only, no formatting**
The slides conversion creates `{"title": "...", "body": "bullet 1\nbullet 2"}` and passes this to the Google Slides skill. The Slides API supports text boxes only — no images, themes, colors, fonts, charts, or layouts are applied. The resulting presentation looks like a 1990s PowerPoint.

**Issue 2: Content capped at 5000 chars**
`content.slice(0, 5000)` in `convertToSlides()`. Complex research reports can be 10-20K chars — the tail (often the most important findings) gets cut.

**Issue 3: No user-visible feedback when slides fail silently**
`convertToSlides()` returns `null` on any error, and `maybeSaveAgentOutputToWorkspace` returns `undefined`. The orchestrator degrades gracefully but the user just never gets a deck. There's no "Slides creation failed because: [reason]" message.

**Issue 4: `outputTarget` must be explicitly set**
The `outputTarget` parameter in `runResearchAgent()` is optional and defaults to `undefined`. Unless the user explicitly says "put it in Google Slides" in their intent, and the orchestrator parses that into `outputTarget: 'google.slides-create-presentation'`, slides are never created. The routing logic for this is underdeveloped.

**Fix for all slide issues:**
1. Use the Google Slides API's Layout templates (TITLE, TITLE_AND_BODY, MAIN_POINT, etc.)
2. Add theme selection (minimal, corporate, modern)
3. Parse intent for output target: if the user says "create a deck" or "make slides", auto-set `outputTarget`
4. Use Gemini to generate speaker notes per slide
5. Double the content window to 10K chars

### Browser Task Quality for Complex Flows

The UI Navigator agent is used for tasks like "go to website and sign up for newsletter." Beyond the browser automation issues above, the agent itself has a gap: **it doesn't know when a multi-step flow requires waiting for email verification**.

For example:
1. Fill signup form ✓ (Stagehand can do this)
2. "Check your email to confirm" — the flow is paused waiting for an external action
3. Agent returns "completed" because the form was submitted, but the signup is incomplete

The agent needs to:
1. Detect "waiting for email confirmation" states
2. Store the pending state
3. Offer to watch the user's inbox (via Gmail skill) and complete the flow when the email arrives

---

## Session and Auth Persistence

### The Real Problem: No Session Continuity

The user's core complaint: *"If I log off and come back it forgets me... even time new session it begins that's not how a real employee would work"*

**What actually happens:**
1. Auth token is stored in `localStorage` — persists across browser refreshes ✓
2. BUT: the live session (Gemini connection) is NOT persisted. Each new app load creates a new session.
3. The `useCurrentSession(true)` hook fetches the DB session, but sessions with `status: 'ended'` or `status: 'live'` (orphaned from previous connection) are returned as-is. The frontend tries to reuse them but the actual Gemini Live WebSocket is gone.
4. Context from the previous session (what was discussed, what was being worked on) is NOT automatically loaded into the new session's system prompt.

**What a "real employee" experience looks like:**
- You come back after a week. The assistant remembers:
  - What was discussed last time (memory)
  - What tasks are still pending or in-progress
  - Your preferences, integrations, and ongoing projects
- There's a "resuming from where we left off" experience
- NOT: "Hi! I'm Crewmate. How can I help you today?"

**Fix — Session Continuity:**
1. When a new session starts, auto-query memory for the last 5 relevant context items and add them to the initial system prompt: *"Last time we spoke: [summary]. Your pending tasks: [task list]."*
2. Add a "Session Recap" feature: when a session starts, Gemini reads recent memory and gives a 1-sentence "Welcome back" with context.
3. On the server: in `liveGatewayPromptBuilder.ts`, add a "previous session summary" block if a session exists from the last 7 days.

**Tasks Disappearing After Re-Login:**
- Root cause: Some tasks only exist in `createdTasks` (React state) and are lost on refresh
- Fix: After `workspaceService.createTask()` successfully writes to DB, the task should always appear in the server-fetched list — verify the `status` filter in `workspaceRepository.listTasks()` includes all statuses, not just `completed` ones.
- Also: Add `task_runs` → `tasks` sync: if a `task_run` completes but the parent `task` status wasn't updated (race condition), add a DB trigger or post-completion hook.

---

## Real-Time SSE Issues

### SSE Architecture Weakness

The app uses two SSE channels:
1. **Global events** (`/api/events`) — for session updates, notifications, task cue updates
2. **Task-specific events** (`/api/agents/tasks/:id/events`) — for live step streaming in the drawer

**Problem 1: No reconnection logic**
The `subscribeToLiveEvents()` in `liveEventsStream.ts` uses `fetch()` + `ReadableStream`. If the network drops, the stream reader throws and `onError` is called. But there's no automatic reconnect. The user gets stale UI.

**Problem 2: Task SSE is torn down when leaving the Tasks page**
In `Tasks.tsx`, `sseRef.current?.abort()` is called on unmount (line 175-178). If a task is actively running and you navigate away, you lose live updates. When you come back, you need to manually open the task again to see its current state.

**Problem 3: No heartbeat / keepalive**
The server sends SSE without a heartbeat. Nginx/CloudRun/Firebase proxies may timeout idle SSE connections (typically 60-300 seconds). This silently kills the stream.

**Fix:**
```typescript
// In server/services/eventService.ts, add heartbeat every 25s:
setInterval(() => {
  for (const [, clients] of userClients) {
    for (const res of clients) {
      res.write(': heartbeat\n\n');
    }
  }
}, 25000);

// In liveEventsStream.ts, add reconnect:
async function connect(retryMs = 1000) {
  try {
    // ... existing connection code ...
  } catch (error) {
    if (!aborted) {
      setTimeout(() => connect(Math.min(retryMs * 2, 30000)), retryMs);
    }
  }
}
```

---

## Google Workspace

### Screenshots Not Saving to Notion/Docs

**Location:** `src/contexts/LiveSessionContext.tsx` → `captureScreenshotArtifact()`

**What works:** The `live_capture-screenshot` skill captures the current browser/screen frame and stores it as an artifact in `/data/artifacts/`.

**What doesn't work:** There's no automated flow to:
1. Insert the screenshot into an active Notion page
2. Insert the screenshot into a Google Doc
3. Add it to a Google Slides deck

The screenshot is saved as an artifact with a `publicUrl` but the agent has no skill to "insert image into active Notion page" or "insert image at cursor position in Google Doc."

**Fix:**
1. Add a `notion.upload-image` skill that takes a `publicUrl` and inserts it into a Notion page
2. Add a `google.docs-insert-image` skill using the Google Docs API's `insertInlineImage` method
3. Train the live session system prompt to offer this: *"I can take a screenshot and add it to your current Notion page or Google Doc."*

### Google Slides — Basic vs. Rich Output

**Current state:** The `google.slides-create-presentation` skill creates slides with plain text boxes. No formatting, no themes, no images.

**What GWS CLI does well (inspiration):**
- Uses the Slides batch update API to apply layouts
- Sets slide backgrounds, font families, and brand colors
- Inserts image placeholders with proper sizing
- Creates speaker notes with talking points
- Exports as PDF

**Fix:**
1. Rewrite the slides skill to use `batchUpdate` with proper `SlideElement` types (not just text insertion)
2. Add a "deck theme" option (minimal, corporate, dark, gradient)
3. Add a `create-chart-slide` step that converts tabular data to a Sheets chart embedded in the deck
4. Use the `exportLinks` field from the Presentations API to return a PDF download link

### Google Docs — Complex Document Creation

**Current state:** `google.docs-write-content` appends text to a doc. This works for simple documents.

**What doesn't work:**
- Headings, formatting (bold, italic, tables) don't survive the text-only append
- Screenshots can't be inserted
- Multi-section long-form documents (e.g., a full market report with sections, citations, tables) come out as an unformatted wall of text

**Fix:** Use the Docs `batchUpdate` API to insert formatted content:
- `insertText` + `updateTextStyle` for headings/bold/italic
- `insertInlineImage` for screenshots
- `insertTable` for data tables

---

## Crew Network

### Issues Summary

1. **Active status not real-time** — 15-second poll means you never see agents activate and complete for short tasks
2. **agentId mapping gaps** — Tasks routed as `delegated_skill` don't have an `agentId`, so no node lights up even though work is happening
3. **No task history per agent** — Clicking an agent shows capabilities but no "recent tasks this agent ran" history
4. **All nodes look identical** — No visual differentiation between an agent that has run 50 tasks successfully vs one that has never been used

**Fix:**
1. Subscribe to `live_task_update` SSE in Agents page for real-time activation
2. For `delegated_skill` route type, map skill category to a pseudo-agent (e.g., `browser.*` skills → UI Navigator agent node lights up)
3. Add `recent_runs` to the agent manifest API response
4. Add a "task count" badge to each agent node showing historical usage

---

## UI/UX Gaps

### 1. No Loading State for Task Delegation
When a task is delegated from the live session, the user gets a toast notification. But in the dashboard, there's no visual indication that "an agent is currently working." Only the `liveTaskCue` badge shows this, and it's only visible during an active live session. When you're not in a live session, background agent tasks are invisible.

**Fix:** Add an "Active Tasks" indicator in the sidebar showing N running tasks, always visible.

### 2. No Task Progress in Dashboard
The dashboard has a `RecentTasksCard` and `ActiveDelegatedTasksCard` but these are static lists. There's no live progress bar or step-by-step trace visible without clicking into the task.

**Fix:** Show the last emitted step label inline in the task row (e.g., "Research Agent — Running 3/5 searches...")

### 3. Session "Live" State Confusion
When a live Gemini session is active and you navigate to Tasks, the MiniSessionBar appears at the bottom. But the actual live session audio/video continues in the background. Users don't realize they're still "on" — they think navigating away paused the session.

**Fix:** Add a persistent "Live Session Active" pill in the sidebar nav (not just MiniSessionBar at bottom) with a pulsing indicator and session duration.

### 4. Error Messages Are Not Actionable
Many error states show technical messages ("API request failed: 502") or generic fallbacks ("Unable to load tasks"). Users need to know what to do.

**Fix:** Map common errors to user-friendly messages with suggested actions:
- 502: "The server is temporarily unavailable. Try again in a moment."
- 401: "Your session expired. [Re-authenticate →]"
- Agent task failed: "The Research Agent encountered an error. [Retry task] or [View error details]"

### 5. No "What Can I Ask?" Guidance
New users land on the Dashboard with a blinking "How can I help you today?" but no examples, no capability overview, no guided onboarding beyond the initial setup.

**Fix:** Add 3-5 suggested prompts on the dashboard that demonstrate real capabilities:
- "Research our top 3 competitors and create a comparison deck"
- "Draft a project update email to the team"
- "Sign me up for the [newsletter] newsletter at [URL]"
- "Summarize my last 10 Gmail emails"

### 6. Tasks Page — No Pagination or Virtual Scroll
If a user has 200+ tasks, the task list renders all of them. There's no pagination, no infinite scroll, no virtualization.

**Fix:** Add pagination (or virtual scroll with `react-virtual`) with 25 tasks per page.

### 7. Memory Page — No Bulk Actions
The Memory/Knowledge Base page shows individual memories but there's no way to:
- Select and delete multiple memories
- Export memories
- Import memories from a file

---

## Integration Gaps

### 1. Notion — Screenshot Insertion Not Implemented
As noted above, screenshots are captured but can't be inserted into Notion pages. The `notion.create-page` skill creates text-only pages.

### 2. Slack — No Proactive Notifications
The Slack integration can send messages when asked, but there's no way to configure Crewmate to proactively notify the user on Slack when:
- A background task completes
- An important email arrives
- A calendar event is 30 minutes away

### 3. No Email/Calendar Monitoring
The platform doesn't have "watching" capabilities. A real employee would monitor their inbox and flag important items. Crewmate can only respond when asked.

**Fix:** Add a polling worker (runs every 5-15 minutes) that:
- Checks for new emails matching user-defined criteria
- Checks calendar for upcoming events in the next 24 hours
- Triggers proactive tasks or notifications

### 4. ClickUp — Limited Integration
The `clickupService.ts` exists but the ClickUp skills are limited. Creating tasks is possible but updating status, adding comments, or managing projects is not wired.

### 5. No Zapier/Webhook Outbound Triggers
The automation skill references Zapier but there's no mechanism to trigger Zapier webhooks when Crewmate completes a task or makes a decision. This is a key integration point for non-technical users.

### 6. GitHub Integration Missing
There's a `devOpsAgent.ts` but no GitHub skill implementation. The DevOps agent can run terminal commands but can't:
- Create PRs
- Review code and leave comments
- Check CI/CD status
- Manage issues

---

## High-Impact Quick Wins

These are changes that can be done in 1-3 days each and have immediate user-visible impact:

### QW-1: Parallel Research Searches (1 day)
**File:** `server/services/agents/researchAgent.ts` line 228
**Change:** Replace `for` loop with `Promise.allSettled()`
**Impact:** Research tasks complete 3-5x faster. Most noticeable quality-of-life improvement.

### QW-2: Startup Task Cleanup (1 day)
**File:** `server/index.ts`
**Change:** Add DB cleanup on startup for orphaned running tasks
**Impact:** Eliminates "stuck forever" task status. Tasks that were running when server crashed will now show as Failed.

### QW-3: Auth Expiry Redirect (0.5 day)
**File:** `src/App.tsx`
**Change:** Listen for `crewmate:auth-expired` event and redirect to `/login`
**Impact:** Instead of broken API calls, users get a clean re-auth flow.

### QW-4: SSE Heartbeat + Reconnect (1 day)
**Files:** `server/services/eventService.ts`, `src/lib/liveEventsStream.ts`
**Change:** Add 25s server heartbeat, add client-side reconnect with backoff
**Impact:** Eliminates dropped live updates. Tasks complete/fail notifications become reliable.

### QW-5: Real-Time Agent Active State (1 day)
**File:** `src/pages/Agents.tsx`
**Change:** Subscribe to `live_task_update` SSE events to immediately update `activeAgentIds`
**Impact:** Crew Network shows agents as active in real-time, not 15 seconds later.

### QW-6: Enable `researchGrounding` by Default (0.5 day)
**File:** `.env` / `server/config.ts`
**Change:** Set `FEATURE_RESEARCH_GROUNDING=true` as default
**Impact:** Research agent reads full article content, not just snippets. Much deeper research quality.

### QW-7: Live Task Cue Timeout (0.5 day)
**File:** `src/contexts/LiveSessionContext.tsx`
**Change:** Add 3-minute maximum for `running` task cue before showing "Check Tasks page"
**Impact:** Eliminates permanently stuck "Working on it" banners.

### QW-8: Stealth Browser Mode (2 days)
**File:** `server/services/uiNavigator/stagehandExecutor.ts`
**Change:** Add `playwright-extra` with stealth plugin, remove obvious headless signals
**Impact:** Newsletter signups, LinkedIn, and many other sites stop blocking the browser agent.

---

## Strategic Improvements for "Remote Employee" Grade

These are larger features that define whether Crewmate is a demo or a real product.

### S-1: Session Memory & Continuity (1 week)

**What it is:** When a new session starts, Crewmate automatically loads the last session summary, pending tasks, and recent memory. The user experience: you open Crewmate and it says "Welcome back. Your research on [X] is complete. You have 3 pending tasks. What would you like to work on?"

**Implementation:**
1. After each session ends, generate a session summary (use Gemini to summarize the transcript) and store in `memory_records` with `kind = 'session_summary'`
2. In `liveGatewayPromptBuilder.ts`, fetch the last 3 session summaries and inject into system prompt
3. Add pending tasks count to system prompt: "User has N tasks in progress: [title list]"
4. Build a "Welcome back" message template that's triggered at session start

### S-2: Persistent Browser Identity (1 week)

**What it is:** The agent maintains a browser identity per user — cookies, preferences, logged-in accounts. When told "log in to LinkedIn," it logs in once and remembers. When you ask it to post something next week, it's still logged in.

**Implementation:**
1. Add `browser_sessions` table: `user_id`, `domain`, `cookies_json` (encrypted), `last_used`, `created_at`
2. In `browserSession.ts`, check for an existing saved session before creating a new one
3. After task completion, extract and save cookies for domains that were logged into
4. Add a UI in Settings to see and revoke saved browser sessions

### S-3: Proactive Intelligence (2 weeks)

**What it is:** Crewmate monitors connected services (Gmail, Slack, Calendar) and proactively surfaces important information without being asked.

**Examples:**
- "You have a board meeting in 45 minutes. Want me to prepare a status update?"
- "An email from [important sender] arrived. It looks urgent. Want me to summarize and draft a reply?"
- "The research task you requested 2 hours ago is complete."

**Implementation:**
1. Add a `monitoringWorker.ts` that runs every 5 minutes
2. Check Gmail for emails from priority senders (user-configurable)
3. Check Calendar for upcoming events in next 2 hours
4. For each match, create a `notification` and optionally send a Slack DM
5. In the live session, at session start, announce any pending notifications

### S-4: Rich Document Creation (2 weeks)

**What it is:** When creating Google Slides, Docs, or Sheets, the output is professional-quality, not plain text.

**Implementation:**
1. Rewrite all Google Workspace skills to use `batchUpdate` APIs
2. For Slides: Add layout templates, theme colors, speaker notes, image placeholder support
3. For Docs: Add heading styles, bold/italic, tables, inline images
4. For Sheets: Add formatting, conditional formatting, charts
5. Add a "document template" library — user can pick a template style for different output types

### S-5: Multi-Step Task Memory (1 week)

**What it is:** The agent can run a task today, store intermediate results, and continue it tomorrow. Tasks are never "lost."

**Example:** "Research the top 10 SaaS tools in project management and create a comparison. This will take a while — check back tomorrow."

**Implementation:**
1. Add `task_state_json` to `task_runs` table for storing intermediate state
2. Add `resume_at` field for scheduled task continuation
3. Add a task worker that picks up incomplete tasks on next run
4. In the live session, at start, check for resumable tasks and offer to continue

### S-6: Vision-Powered Quality Assurance (1 week)

**What it is:** After the browser agent completes a task, take a screenshot and use Gemini Vision to verify the task was actually completed correctly.

**Example:** "I signed up for the newsletter" — before returning success, take a screenshot, use Gemini Vision to confirm the success message/confirmation page is visible.

**Implementation:**
1. Add a `verifyCompletion()` function to `stagehandExecutor.ts`
2. After each task, use Gemini Pro vision to analyze the final page screenshot
3. Ask: "Did the task '[intent]' appear to succeed based on this screenshot? Look for: success messages, confirmation emails, completed states."
4. If verification fails, retry or report "Task may not have completed — please verify."

---

## Implementation Roadmap

### Phase 1: Stability (Week 1-2) — Stop the bleeding
Priority: Fix bugs that make the product look broken.

| Item | File | Effort | Impact |
|------|------|--------|--------|
| Startup task cleanup (orphaned tasks) | `server/index.ts` | 0.5d | High |
| Live task cue max timeout | `LiveSessionContext.tsx` | 0.5d | High |
| SSE heartbeat + reconnect | `eventService.ts`, `liveEventsStream.ts` | 1d | High |
| Auth expiry redirect | `App.tsx` | 0.5d | High |
| Real-time agent active state | `Agents.tsx` | 1d | Medium |
| Parallel research searches | `researchAgent.ts` | 0.5d | High |
| Enable researchGrounding | `.env` | 0.5d | High |

**Total: ~5 days**

### Phase 2: Browser Reliability (Week 2-3) — Fix the biggest UX pain
Priority: Make browser tasks work on real-world sites.

| Item | File | Effort | Impact |
|------|------|--------|--------|
| Stealth browser mode | `stagehandExecutor.ts` | 1d | High |
| Persistent browser session pool | new `browserSessionManager.ts` | 3d | High |
| Vision verification after task completion | `stagehandExecutor.ts` | 1d | High |
| Upgrade to Gemini Pro vision for complex tasks | `stagehandExecutor.ts`, `config.ts` | 0.5d | Medium |
| Browserbase cloud fallback for blocked sites | `stagehandExecutor.ts` | 1d | Medium |

**Total: ~6.5 days**

### Phase 3: Document Quality (Week 3-4) — Make outputs worth sharing
Priority: Slides and docs that look professional.

| Item | File | Effort | Impact |
|------|------|--------|--------|
| Slides batchUpdate API (themes, layouts) | `google.slides.skill.ts` | 3d | High |
| Docs batchUpdate API (formatting, tables, images) | `google.docs.skill.ts` | 2d | High |
| Screenshot insertion into Notion/Docs | new `notion.upload-image.skill.ts` | 1d | Medium |
| Intent-based output target detection | `orchestratorAgents.ts` | 1d | Medium |
| Double content window for slides/research | `agentWorkspaceOutput.ts` | 0.5d | Low |

**Total: ~7.5 days**

### Phase 4: Continuity (Week 4-6) — Feel like a real employee
Priority: Session memory, task persistence, proactive intelligence.

| Item | File | Effort | Impact |
|------|------|--------|--------|
| Session summary on end | `liveGatewayLifecycle.ts` | 1d | High |
| Welcome-back context injection | `liveGatewayPromptBuilder.ts` | 1d | High |
| Task persistence after server restart | `orchestratorShared.ts` | 2d | High |
| Proactive email/calendar monitoring | new `monitoringWorker.ts` | 3d | High |
| Persistent browser identity (cookies) | `browserSession.ts` | 3d | High |
| Proactive Slack notifications | `slackService.ts` | 1d | Medium |

**Total: ~11 days**

### Phase 5: Polish & Power (Week 6-8) — Production-ready
Priority: UI polish, power user features, performance.

| Item | Effort | Impact |
|------|--------|--------|
| Sidebar active tasks indicator | 0.5d | Medium |
| Suggested prompts on dashboard | 0.5d | Medium |
| Task list pagination | 1d | Medium |
| Multi-step task resumption | 3d | High |
| Vision-powered task verification | 2d | High |
| GitHub integration | 3d | Medium |
| Email/Calendar monitoring UI | 2d | Medium |
| Onboarding improvements | 1d | Medium |

**Total: ~13 days**

---

## Summary Table

| Category | Severity | # Issues | Priority |
|----------|----------|----------|----------|
| Critical Bugs | P0 | 6 | Immediate |
| Browser Automation | P0 | 5 | Week 1-2 |
| Session Persistence | P1 | 4 | Week 1-2 |
| SSE/Real-time | P1 | 3 | Week 1 |
| Agent Quality | P1 | 6 | Week 2-3 |
| Google Workspace | P1 | 5 | Week 3-4 |
| UI/UX | P2 | 7 | Week 4-6 |
| Integration Gaps | P2 | 6 | Week 4-8 |
| Strategic Features | P3 | 6 | Week 4-8 |

---

## Inspiration: What GWS CLI Does Right

The Google Workspace CLI (`gws` or similar tools) succeeds because:

1. **Stateful operations** — it knows your workspace state and can chain operations (`list → filter → modify → confirm`)
2. **Rich API usage** — it uses the full breadth of Google APIs, not just the basic CRUD
3. **Idempotent** — running the same command twice doesn't create duplicates
4. **Dry-run mode** — shows what will happen before doing it
5. **Proper error messages** — specific, actionable, with fix suggestions

Crewmate should adopt these principles:
- Show "What I'm about to do" before executing (confirmation step for write operations)
- Use `batchUpdate` APIs for rich document operations, not just text append
- Check for existing resources before creating duplicates
- Return specific, human-readable error messages with next steps

---

*This audit was generated on 2026-03-14 after a full codebase review.*
*All file paths reference the project root: `/Users/varun/Desktop/Dev_projects/crewmate-dashboard copy/`*
