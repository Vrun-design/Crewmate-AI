<div align="center">

# 🤖 Crewmate

### Your AI-powered company — run an entire business with a crew of AI agents

**14 specialist agents · 30+ real integrations · Real-time voice via Gemini Live · Custom skill builder · Slack notifications · MCP server**

[![Built with Gemini](https://img.shields.io/badge/Built%20with-Gemini%20Live%20API-4285F4?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev/)
[![Gemini Live Challenge](https://img.shields.io/badge/Gemini%20Live%20Agent%20Challenge-2025-orange?style=flat-square)](https://ai.google.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Tests](https://img.shields.io/badge/Tests-43%2F43%20passing-22c55e?style=flat-square)](./server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](./LICENSE)

</div>

---

## 🌟 What is Crewmate?

Crewmate is a **full-stack, multimodal AI orchestration platform** built on Google's Gemini ecosystem. Think of it as hiring an entire company's worth of AI specialists — each with their own domain expertise, tools, and real integration access — all coordinated by an intelligent orchestrating layer.

You open the app, type (or speak) a task in plain English:

> *"Research our competitor Notion and write a competitive analysis"*

Crewmate's orchestrator (powered by Gemini Pro) instantly classifies intent, selects the Research Agent, dispatches it, watches it call `web.search` (with Tavily AI-optimized results), stream every step back to your browser in real time, and finish with a full analysis — while simultaneously sending you a Slack notification that the task is done.

No prompt engineering. No API calls. No configuration. Just work.

---

## 🎯 Hackathon Category: Live Agents 🗣️

**Category: Live Agents — Real-time Interaction (Audio/Vision)**

Crewmate fully leverages the **Gemini Live API** (`gemini-2.5-flash-native-audio-preview-12-2025`) for:

- 🎙️ **Real-time bidirectional voice sessions** — WebSocket-based streaming audio that supports natural conversation flow with no turn delays
- 🖥️ **Screen-aware context** — WebRTC screen capture fed to the Live session so the agent sees exactly what you're working on
- ⚡ **Native barge-in** — Interrupt the agent mid-sentence, just like a real conversation
- 🎭 **5 official voices** — Aoede, Charon, Fenrir, Kore, Puck — all from Gemini Live's native audio model
- 🧬 **Persona-driven system prompts** — Every one of the 5 built-in personas (developer, marketer, founder, sales, designer) customizes how the Live agent speaks and reasons

The Gemini Live API is not just for voice — it's the real-time backbone of the whole "conversation-with-your-company" metaphor. When a manager asks their team for status updates, they talk. Crewmate works the same way.

---

## 🏗️ Full System Architecture

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              CREWMATE PLATFORM                               ║
╠══════════════════════════╦════════════════════════════════════════════════════╣
║   BROWSER (React + Vite) ║            SERVER (Express + TypeScript)          ║
║                          ║                                                    ║
║  ┌────────────────────┐  ║  ┌──────────────────────────────────────────────┐ ║
║  │  Dashboard         │  ║  │              ORCHESTRATOR                     │ ║
║  │  • Command bar     │◄─╫──│  • Gemini Pro intent classification           │ ║
║  │  • Task stream     │  ║  │  • Confidence-scored agent routing            │ ║
║  │  • Gmail inbox     │  ║  │  • Async background execution                 │ ║
║  └────────────────────┘  ║  │  • SSE event broadcasting                     │ ║
║           │ SSE           ║  └──────────────────────┬───────────────────────┘ ║
║  ┌────────▼───────────┐  ║                         │ routes to                ║
║  │  Agent Network     │  ║  ┌──────────────────────▼───────────────────────┐ ║
║  │  • Live timeline   │  ║  │           14-AGENT SPECIALIST CREW            │ ║
║  │  • Step events     │  ║  │                                               │ ║
║  │  • Task status     │  ║  │  🔬 Research   💼 Sales    📣 Marketing       │ ║
║  └────────────────────┘  ║  │  ✍️  Content    🛠️  DevOps   📋 Product        │ ║
║                          ║  │  📧 Comms      👥 HR       🎧 Support         │ ║
║  ┌────────────────────┐  ║  │  📅 Calendar   📱 Social   💰 Finance         │ ║
║  │  Skill Builder     │  ║  │  ⚖️  Legal      📊 Data                        │ ║
║  │  • LLM Recipes     │  ║  │                                               │ ║
║  │  • Webhook skills  │  ║  │  Each agent: emitStep() → SSE stream          │ ║
║  │  • Test runner     │  ║  └──────────────────────┬───────────────────────┘ ║
║  └────────────────────┘  ║                         │ calls                    ║
║                          ║  ┌──────────────────────▼───────────────────────┐ ║
║  ┌────────────────────┐  ║  │            SKILL REGISTRY (30+ skills)        │ ║
║  │  Notifications     │  ║  │                                               │ ║
║  │  • Feed            │  ║  │  web.search        gmail.*        github.*    │ ║
║  │  • Slack settings  │  ║  │  calendar.*        slack.*        notion.*    │ ║
║  └────────────────────┘  ║  │  clickup.*         creative.*     memory.*   │ ║
║                          ║  │  terminal.*        + custom skills (SQLite)   │ ║
║  ┌────────────────────┐  ║  └──────────────────────┬───────────────────────┘ ║
║  │  Gemini Live       │  ║                         │                          ║
║  │  WebSocket session │◄─╫──────────────────────┐  │                          ║
║  │  Screen capture    │  ║  Gemini Live API       │  │ fires                   ║
║  │  5 voices          │  ║  (real-time audio)     │  ▼                        ║
║  └────────────────────┘  ║                  ┌────▼──────────────────────┐    ║
║                          ║                  │  NOTIFICATION LAYER        │    ║
║  ┌────────────────────┐  ║                  │  In-app SSE + Slack Block  │    ║
║  │  Account           │  ║                  │  Kit webhooks per user     │    ║
║  │  6-tier model UI   │  ║                  └───────────────────────────┘    ║
║  │  All 5 Gemini      │  ║                                                    ║
║  │  Live voices       │  ║  ┌──────────────────────────────────────────────┐ ║
║  └────────────────────┘  ║  │  MCP PROTOCOL SERVER                          │ ║
║                          ║  │  • All 30+ skills exposed as Claude tools     │ ║
║                          ║  │  • Claude Desktop integration                 │ ║
║                          ║  │  • Cursor IDE integration                     │ ║
║                          ║  └──────────────────────────────────────────────┘ ║
╚══════════════════════════╩════════════════════════════════════════════════════╝
```

### How a Task Flows Through the System

```
1. User submits intent (text or voice)
        │
        ▼
2. Orchestrator (Gemini Pro) classifies:
   "Write a cold email to John at Acme Corp" 
   → { agent: "sales", confidence: 0.94, reasoning: "outreach task" }
        │
        ▼
3. Sales Agent is invoked with emitStep() callback
        │
        ├── emitStep("routing", "Routing to Sales Agent")
        ├── emitStep("thinking", "Analyzing intent...")
        ├── emitStep("skill_call", "Researching Acme Corp...", { skillId: "web.search" })
        │       └── Tavily API → cleaned AI results
        ├── emitStep("skill_result", "Research gathered", { durationMs: 1432 })
        ├── emitStep("generating", "Crafting personalized email...")
        │       └── Gemini Pro generates SUBJECT + BODY
        ├── emitStep("skill_call", "Sending email...", { skillId: "gmail.send" })
        └── emitStep("done", "Outreach sent", { success: true })
        │
        ▼
4. Steps persist to SQLite agent_tasks table with full step log
        │
        ▼
5. SSE stream delivers each step to browser in real time
   → Agent Network page shows animated live timeline
        │
        ▼
6. notifyTaskComplete() fires:
   → In-app notification bell
   → Slack Block Kit message (if webhook configured)
```

---

## 🤖 The Full Crew — 14 Specialist Agents

Each agent is an **inline async function** that accepts an intent string, a skill run context, and an `emitStep` callback. Agents are stateless, composable, and can call any registered skill.

### 🔬 Research Agent
**ID:** `crewmate-research-agent` | **Model:** Gemini Pro (research tier)

The backbone analyst of your crew. Researches any topic using Tavily AI-optimized web search, synthesizes multiple sources with Gemini Pro, and produces structured reports.

**What it does:**
- Market research and competitive analysis
- Topic deep-dives with multi-source synthesis
- News monitoring and trend analysis
- Background checks on companies or people
- Literature reviews and fact-gathering

**Skills used:** `web.search`, `web.summarize-url`

**Example task:** *"Research the current state of AI coding assistants and who the top 5 players are"*

---

### ✍️ Content Agent
**ID:** `crewmate-content-agent` | **Model:** Gemini Pro (research tier)

Professional-grade copywriter. Can optionally research the topic first before writing, producing data-backed, original content.

**What it does:**
- Long-form blog posts and articles
- Landing page copy and headlines
- Product descriptions and feature announcements
- Email newsletters and campaign copy
- Technical documentation and how-to guides
- SEO-optimized content with keyword integration

**Skills used:** `web.search` (when `researchFirst: true`), Gemini Pro generation

**Example task:** *"Write a 1500-word blog post about why B2B companies should invest in AI agents in 2025"*

---

### 📧 Communications Agent
**ID:** `crewmate-communications-agent` | **Model:** Gemini Flash (quick tier)

The hub of all written communications. Drafts, sends, and manages messages across Slack, Gmail, and Notion.

**What it does:**
- Compose and send professional emails
- Draft and schedule Slack announcements
- Create Notion documentation pages
- Write status update messages
- Internal memos and company communications

**Skills used:** `gmail.send`, `gmail.draft`, `slack.post-message`, `notion.create-page`

**Example task:** *"Send a weekly update to the #team channel summarizing what we shipped this week"*

---

### 🛠️ DevOps Agent
**ID:** `crewmate-devops-agent` | **Model:** Gemini Flash (quick tier)

Your software engineering execution arm. Creates GitHub issues, opens PRs, reviews code, and can run sandboxed terminal commands.

**What it does:**
- Create GitHub issues from bug reports or feature requests
- Open pull requests with context
- List and summarize open PRs
- Run safe, sandboxed terminal commands (from an allowlist)
- Generate CI/CD config and deployment scripts
- Code review automation

**Skills used:** `github.create-issue`, `github.create-pr`, `github.list-prs`, `terminal.run-command`

**Example task:** *"Create a GitHub issue for the login page performance regression we discussed"*

---

### 📅 Calendar Agent
**ID:** `crewmate-calendar-agent` | **Model:** Gemini Flash (quick tier)

Schedule and time management specialist. Finds free time, creates events, and manages your Google Calendar through real OAuth2 integration.

**What it does:**
- Schedule meetings across participants
- Find mutually available time slots
- Create calendar events with descriptions and attendees
- List upcoming events and daily agenda
- Handle timezone-aware scheduling

**Skills used:** `calendar.schedule`, `calendar.find-free-time`, `calendar.list-events`

**Example task:** *"Schedule a 1-hour product review on Friday between 2pm and 5pm"*

---

### 💼 Sales Agent
**ID:** `crewmate-sales-agent` | **Model:** Gemini Pro (orchestration tier)

Expert B2B sales professional. Researches prospects, writes personalized outreach, and manages pipeline communications.

**What it does:**
- Research target companies and contacts before outreach
- Write personalized cold emails with a clear value proposition and soft CTA
- Follow-up email sequences
- CRM note drafting
- Pipeline summaries and deal status updates
- LinkedIn connection message drafts

**Skills used:** `web.search`, `gmail.send`, `notion.create-page`

**Outreach format:**
```
SUBJECT: <personalized subject line>
BODY:
Opener referencing something specific about them
Value proposition in 1-2 sentences
Social proof or differentiation
Soft CTA with clear next step
```

**Example task:** *"Write a cold email to Sarah Chen at Stripe about our payment API integration tool"*

---

### 📣 Marketing Agent
**ID:** `crewmate-marketing-agent` | **Model:** Gemini Pro (research tier)

Full-stack marketer — from positioning strategy to ad copy to campaign execution.

**What it does:**
- Campaign strategy and messaging frameworks
- Landing page and ad copy
- A/B test variant creation
- SEO keyword research and content strategy
- Competitor marketing analysis
- Launch plan creation
- Conversion rate optimization suggestions

**Skills used:** `web.search`, `creative.generate-image`, Gemini Pro

**Example task:** *"Create a go-to-market strategy for our new analytics dashboard targeting SMB founders"*

---

### 📋 Product Agent
**ID:** `crewmate-product-agent` | **Model:** Gemini Pro (research tier)

The product manager that never sleeps. Turns rough ideas into structured PRDs, user stories, and roadmaps.

**What it does:**
- Product Requirements Documents (PRDs) with problem statement, goals, success metrics
- User story generation (As a... I want... So that...)
- Feature prioritization frameworks (MoSCoW, ICE scoring)
- Roadmap documentation
- Sprint planning documents
- Acceptance criteria writing
- Stakeholder update summaries

**Skills used:** `notion.create-page`, `clickup.create-task`, Gemini Pro

**Example task:** *"Write a PRD for a dark mode feature — target users are developers who work late nights"*

---

### 👥 HR Agent  
**ID:** `crewmate-hr-agent` | **Model:** Gemini Pro (research tier)

People operations for the modern startup. Handles hiring, onboarding, policies, and people programs.

**What it does:**
- Job description writing (inclusive language, competitive positioning)
- Interview question generation by role and seniority
- Onboarding checklists and email sequences
- HR policy drafting (PTO, remote work, code of conduct)
- Performance review templates
- Offer letter templates
- HRIS documentation

**Skills used:** `gmail.send`, `notion.create-page`, Gemini Pro

**Example task:** *"Write a job description for a Senior Full Stack Engineer — remote, Series A startup, $150-180k"*

---

### 🎧 Support Agent
**ID:** `crewmate-support-agent` | **Model:** Gemini Flash (quick tier)

Customer happiness specialist. Responds to tickets, generates FAQs, and creates support content at scale.

**What it does:**
- Customer ticket responses (empathetic, solution-focused)
- FAQ generation from product documentation
- Knowledge base article writing
- Escalation triage and routing suggestions
- Customer communication templates for incidents
- NPS survey response analysis

**Skills used:** `web.search`, `gmail.send`, Gemini Flash

**Example task:** *"Draft a response to this customer ticket: 'I've been charged twice for my subscription this month'"*

---

### 📱 Social Agent
**ID:** `crewmate-social-agent` | **Model:** Gemini Pro (research tier) + Gemini Image

Content creator for every social platform. Understands platform-specific formats, tone, and virality signals.

**What it does:**
- Twitter/X threads (hook + numbered points + CTA)
- LinkedIn posts (professional, thought leadership tone)
- Instagram captions with hashtag strategy
- TikTok script outlines
- YouTube video descriptions and titles
- Social media images (via Gemini Flash Image)
- Content calendar planning

**Skills used:** `web.search`, `creative.generate-image`, Gemini Pro

**Example task:** *"Write a Twitter thread about why most startup pitches fail — make it go viral"*

---

### 💰 Finance Agent
**ID:** `crewmate-finance-agent` | **Model:** Gemini Pro (research tier)

Financial analyst and CFO-in-your-pocket. Builds models, analyzes data, and creates investor-grade financial content.

**What it does:**
- Financial projection models (text-based with formulas)
- P&L summaries and variance analysis
- Fundraising materials (financials section)
- Budget planning documents
- Unit economics calculations (CAC, LTV, payback period, gross margin)
- Investor update financial sections
- Cash runway analysis
- Market sizing (TAM/SAM/SOM)

**Skills used:** `web.search`, Gemini Pro

**Example task:** *"Calculate our unit economics: $500 CAC, $120 MRR per customer, 15-month average lifetime"*

---

### ⚖️ Legal Agent
**ID:** `crewmate-legal-agent` | **Model:** Gemini Pro (research tier)

Legal analyst and policy drafter. Not a lawyer — but can generate first-draft legal documents and explain complex terms in plain English.

> ⚠️ Output is for informational purposes. Always have a licensed attorney review legal documents before use.

**What it does:**
- Privacy Policy and Terms of Service drafts
- NDA templates (mutual or one-way)
- Contract clause explanation in plain English
- GDPR/CCPA compliance checklist generation
- SaaS subscription agreement templates
- Employment agreement clause drafting
- IP assignment template generation

**Skills used:** `web.search`, Gemini Pro

**Example task:** *"Draft a mutual NDA for a partnership discussion with a potential enterprise client"*

---

### 📊 Data Agent
**ID:** `crewmate-data-agent` | **Model:** Gemini Pro (research tier)

Your data science and analytics partner. Interprets data, builds frameworks, and generates insights-driven reports.

**What it does:**
- Data analysis and trend identification from raw numbers
- Dashboard design recommendations
- KPI definition and tracking framework
- SQL query generation from natural language
- Data visualization recommendations
- A/B test result interpretation
- Cohort analysis explanations
- Growth accounting breakdown (new, retained, resurrected, churned)

**Skills used:** `web.search`, Gemini Pro

**Example task:** *"Analyze this monthly retention data and identify the key drop-off points: [0: 100%, 1: 58%, 2: 41%, 3: 35%...]"*

---

## 🛠️ Skills System — 30+ Built-in Skills

Skills are the atomic tools that agents use. Each skill has:
- A unique ID (e.g. `web.search`)
- Input/output JSON schema
- A typed `handler` function that agents call
- A persona list (which agent types can use it)
- Trigger phrases for the MCP server

### 🔍 Research Skills

#### `web.search` (v2.0 — Tavily primary, DuckDuckGo fallback)
The most heavily used skill across all 14 agents. Phase 14 upgraded this to **Tavily AI-optimized search**.

| Mode | When | What you get |
|------|------|-------------|
| **Tavily** | `TAVILY_API_KEY` is set | AI-pre-summarized snippets + optional AI answer sentence |
| **DuckDuckGo** | No API key | Raw related topics (free, no rate limits) |

Tavily returns content specifically optimized for LLM consumption — pre-cleaned, de-duplicated, with relevance scoring. The difference in research quality is night and day.

```typescript
// What the skill returns from Tavily:
{
  answer: "Anthropic was founded in 2021 by former OpenAI researchers...",
  results: [
    { title: "Anthropic - Wikipedia", url: "...", content: "...", score: 0.95 },
    ...
  ]
}
```

#### `web.summarize-url`
Fetches any URL, strips HTML, and uses Gemini Flash to produce a clean 3-5 paragraph summary. Used when agents need to deep-read a specific page.

---

### 📧 Gmail Skills (OAuth2)

Requires Google OAuth2 setup. Tokens stored encrypted in SQLite.

| Skill | Description |
|-------|-------------|
| `gmail.send` | Send email with to, subject, body + optional CC |
| `gmail.draft` | Create a draft without sending |
| `gmail.read-inbox` | Fetch last N emails with sender + subject preview |

The Gmail skills use a full OAuth2 flow with token refresh — no manual token management required.

---

### 📅 Calendar Skills (OAuth2)

| Skill | Description |
|-------|-------------|
| `calendar.schedule` | Create an event with title, start, end, attendees, description |
| `calendar.find-free-time` | Find available slots in a date range with minimum duration |
| `calendar.list-events` | List upcoming events with attendees and descriptions |

---

### 🐙 GitHub Skills

| Skill | Description |
|-------|-------------|
| `github.create-issue` | Create issue with title, body, labels, assignees |
| `github.create-pr` | Open PR with branch, title, body, base branch |
| `github.list-prs` | List open PRs with status and metadata |

---

### 💬 Slack Skills

| Skill | Description |
|-------|-------------|
| `slack.post-message` | Post to any channel or DM with rich text |
| `slack.list-channels` | List workspace channels and their descriptions |

---

### 📓 Notion Skills

| Skill | Description |
|-------|-------------|
| `notion.create-page` | Create a new page under a parent with markdown content |
| `notion.list-pages` | List child pages of the parent with titles and URLs |

---

### ✅ ClickUp Skills

| Skill | Description |
|-------|-------------|
| `clickup.create-task` | Create task with name, description, assignees, status |
| `clickup.list-tasks` | List tasks in a list with status and assignees |

---

### 🎨 Creative Skills

| Skill | Description |
|-------|-------------|
| `creative.generate-image` | Generate images via Gemini 3.1 Flash Image Preview model |

Used by Marketing and Social agents for campaign visuals, social media images, and product mockups.

---

### 🖥️ Code Skills (Sandboxed)

| Skill | Description |
|-------|-------------|
| `terminal.run-command` | Execute shell commands from a strict allowlist |

**Security model:** Only the following commands are permitted in the allowlist. Anything not on this list is rejected before execution:
```
ls, cat, echo, pwd, date, node, npm, npx, git status, git log, 
git diff, find, grep, curl (read-only), wc, head, tail, sort, uniq
```

Destructive commands (`rm`, `mv`, `chmod`, overwriting writes) are never permitted regardless of context.

---

### 🧠 Memory Skills

| Skill | Description |
|-------|-------------|
| `memory.store` | Store a tagged memory entry for future retrieval |
| `memory.retrieve` | Search memories by tag or semantic content |
| `memory.list` | List all stored memory entries |

Memory is persisted to SQLite and passed into Live session system prompts so the agent has long-term context across sessions.

---

### 🔧 Custom Skills — Build Your Own

Crewmate has a full **no-code Skill Builder** at `/skills/build`. Users can create custom skills in two modes:

#### Mode A: LLM Recipe
Write a plain-English system prompt. Crewmate calls Gemini Flash with your instruction as the system prompt and the user's intent as the user message.

```
Name: "Japanese Translator"
Trigger phrases: "translate to japanese", "in japanese"
Instructions: "You are a professional Japanese translator. Translate the user's
input to formal Japanese. Return ONLY the translation, no explanation."
```

The skill is immediately available in the registry as `custom.{id}` and all 14 agents can route to it.

**5 one-click recipe examples** included:
- 🌏 Translate to Spanish
- 📝 Summarize in 3 bullet points  
- 📨 Write a cold email template
- 🗄️ Generate a SQL query
- ✅ Extract action items from a meeting

#### Mode B: Webhook
Point to your own external API. Crewmate POSTs `{"args": {"input": "..."}}` and uses the response body as the skill output.

```
Name: "Sentiment Analyzer"
Webhook URL: https://api.myservice.com/analyze
Auth Header: Bearer sk-yourtoken
```

**Security features:**
- 10 second timeout (no hanging requests)
- 256KB response size cap (no memory bomb)
- Auth header stored encrypted in SQLite
- Input args sanitized before transmission

Custom skills are stored in a `custom_skills` SQLite table and dynamically loaded into the registry on server startup via `loadCustomSkills()` — no restart required after creating/deleting.

---

## 🎙️ Gemini Live API Integration

The most differentiated feature — a real-time, bidirectional voice AI that sees your screen.

### Architecture

```
Browser                              Server                    Gemini Live API
  │                                    │                              │
  ├─ getUserMedia() [microphone] ──────►│                              │
  ├─ getDisplayMedia() [screen] ───────►│                              │
  │                                    ├─ WebSocket ─────────────────►│
  │◄──── audio chunks (streaming) ─────┤◄──── native audio (PCM16) ──┤
  │                                    │                              │
  │  liveGateway.ts handles:           │  Supports:                   │
  │  • Audio chunk accumulation        │  • Real interruptibility     │
  │  • Session lifecycle               │  • Tool calls (skill calls)  │
  │  • Persona system prompt injection │  • Turn detection            │
  │  • Screen frame injection          │  • Barge-in                  │
```

### 5 Official Gemini Live Voices

| Voice | Character | Best for |
|-------|-----------|----------|
| **Aoede** | Warm, expressive, engaging | General use, demos |
| **Charon** | Deep, authoritative, calm | Technical explanations |
| **Fenrir** | Clear, energetic, crisp | Sales calls, pitches |
| **Kore** | Calm, confident, measured | Analytics, reports |
| **Puck** | Lively, playful, creative | Creative brainstorming |

Select your preferred voice in **Account → AI Models → Live Voice**.

### Persona System

5 built-in personas — each changes the Live session system prompt:

| Persona | Focus areas | System prompt flavor |
|---------|------------|---------------------|
| **Developer** | Code, architecture, debugging | Technical depth, precise terminology |
| **Marketer** | Campaigns, copy, growth | Business impact, conversion focus |
| **Founder** | Strategy, fundraising, hiring | Decisions, trade-offs, investor lens |
| **Sales** | Prospects, pipeline, outreach | Deal velocity, relationship building |
| **Designer** | UX, visual systems, critique | User empathy, aesthetic sensibility |

### Memory Injection

Before every Live session, the agent's system prompt is enriched with:
1. The active persona's custom system prompt
2. Recent memory entries (semantic recall from SQLite)
3. User's name and workspace context

This means the agent remembers what you talked about last time. It knows your stack. It knows your calendar.

---

## 📡 Real-Time Agent Transparency

One of the core UX innovations in Crewmate: every single step an agent takes is streamed to the browser in real time via **Server-Sent Events (SSE)**.

### Step Event Types

| Type | When fired | What the UI shows |
|------|-----------|-------------------|
| `routing` | Intent classified | "Routing to Sales Agent (94% confidence)" |
| `thinking` | Model is reasoning | Animated thinking indicator |
| `skill_call` | About to call a skill | Tool name + skill ID badge |
| `skill_result` | Skill returned | Duration, success/fail, char count |
| `generating` | Generating output | Writing animation |
| `done` | Task complete | Green checkmark + result |
| `error` | Something failed | Red with error message |

### Agent Network Page

The `/agents` page shows a live timeline for every task. Tasks auto-expand while running and collapse when complete. Each step event is animated in as it arrives — you see the agent work in real time, tool call by tool call.

This is the "glass box" principle: you should never have to wonder what Crewmate is doing or why. Everything is visible.

---

## 📣 Notification Layer

When a task completes or fails, Crewmate fires notifications to all configured channels.

### In-App Notifications
- Bell icon in top bar shows unread count
- Notification feed at `/notifications` with type icons (✅ success, ❌ failure, ℹ️ info)
- Real-time delivery via SSE — bell updates without page refresh
- Each notification links to the relevant task (`/agents?task={id}`)

### Slack Notifications  
Configure at **Notifications → Delivery Settings**.

What you get in Slack (Block Kit rich message):
```
✅ Crewmate Task Complete
> Write a competitive analysis of Notion's pricing page

Steps executed:
• Routing to Research Agent
• web.search — Notion pricing competitors
• web.summarize-url — notion.so/pricing
• Generating competitive analysis...

Agent: research  ·  Duration: 23s
```

For failed tasks:
```
❌ Crewmate Task Failed  
> Send email to john@example.com about the proposal
Error: Gmail not connected — configure OAuth in Integrations

Agent: communications  ·  Duration: 3s
```

### Per-Event Toggles
- **Notify on success** — task completed ✅
- **Notify on error** — task failed ❌
- **In-app notifications** — global on/off switch

### Test Button
Before saving, send a test message to verify your webhook is working. One click — Crewmate posts "🎉 Crewmate is connected!" to your Slack.

---

## 🔀 Multi-Model Routing Architecture

Crewmate automatically routes each job to the optimal Gemini model for that task type. No single model fits all workloads — routing is the key to both quality and cost efficiency.

### 6 Model Tiers

| Tier | Default Model | What uses it |
|------|-------------|-------------|
| **Live Audio** | `gemini-2.5-flash-native-audio-preview-12-2025` | Real-time voice sessions |
| **Orchestration** | `gemini-3.1-pro-preview` | Intent classification, routing decisions |
| **Research** | `gemini-3.1-pro-preview` | Deep analysis, report generation, legal/finance |
| **Creative** | `gemini-3.1-flash-image-preview` | Image generation (Social, Marketing agents) |
| **Quick** | `gemini-2.5-flash` | Fast responses, simple skill calls |
| **Lite** | `gemini-3.1-flash-lite-preview` | Ultra-fast confirmations, routing pre-filters |

All tiers are overridable per-environment via `GEMINI_*` env vars. Users can also select preferred models for Orchestration, Research, and Voice in **Account → AI Models**.

### Why This Matters

Using Gemini Pro for everything would be expensive and slow. Using Flash for everything would produce shallow research. The 6-tier system means:
- Routine skill calls use Flash (fast, cheap)
- Deep research and legal/financial analysis uses Pro (accurate, comprehensive)
- Voice sessions use the native audio model (low latency, natural prosody)
- Image generation uses the specialized image model (better visual output)

---

## 🧠 Memory & Summarization System

### Memory Architecture

```
User input / Live session
        │
        ▼
memory.store skill → SQLite user_memory table
        │
        Fields: user_id, tag, content, embedding_hint, created_at
        │
        ▼
memory.retrieve → semantic/tag search → context injection
        │
        ▼
Live session system prompt + orchestrator context
```

### Memory Summarization Worker

Every hour, a background worker (`memorySummaryWorker.ts`) runs:
1. Fetches all memories older than 24h that haven't been summarized
2. Calls Gemini Flash to produce a condensed summary
3. Replaces verbose memories with compact summaries
4. Frees up context window for new memories

This means memory scales indefinitely without growing the system prompt unboundedly.

---

## 🌐 MCP Protocol Server

Crewmate doubles as a **Model Context Protocol (MCP) server**, exposing all 30+ skills as tools to any MCP-compatible client — including Claude, Cursor, and the future standard for AI tool integration.

### Discovery

```bash
curl http://localhost:8787/mcp
# Returns: All skills as MCP tool definitions with input schemas
```

### Claude Desktop Integration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "crewmate": {
      "url": "http://localhost:8787/mcp",
      "transport": "http"
    }
  }
}
```

After restarting Claude Desktop, you'll see all Crewmate skills available as tools. Claude can now call `web.search`, `gmail.send`, `notion.create-page`, etc. through Crewmate.

### Cursor Integration

In Cursor settings, add Crewmate as an MCP tool server. Any skill Crewmate can execute, Cursor's AI can call.

---

## 🚀 Getting Started

### Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| npm | 10+ | Included with Node |
| GOOGLE_API_KEY | Any | [Get free at aistudio.google.com](https://aistudio.google.com/app/apikey) |

### Installation (5 steps)

**Step 1: Clone the repository**
```bash
git clone https://github.com/YOUR_USER/crewmate-dashboard.git
cd crewmate-dashboard
```

**Step 2: Install dependencies**
```bash
npm install
```

**Step 3: Configure environment**
```bash
cp .env.example .env
```

Open `.env` and set the two required variables:
```bash
GOOGLE_API_KEY=AIza...            # Required — your Gemini API key
CREWMATE_ENCRYPTION_KEY=abc123... # Required — openssl rand -hex 16
```

**Step 4: Start the development server**
```bash
npm run dev
```

This starts both the Vite frontend (port 5173) and Express backend (port 8787) concurrently.

**Step 5: Open the app**
```
http://localhost:5173
```

That's it. You're running a 14-agent AI company locally.

### Enable Web Search (Strongly Recommended — Free)

Tavily gives agents vastly better web search quality:

```bash
# In .env:
TAVILY_API_KEY=tvly-...
```

Get a free API key at [app.tavily.com](https://app.tavily.com) — free tier includes 1,000 searches/month, which is plenty for development and demos. Without it, Crewmate automatically falls back to DuckDuckGo.

### Enable Gmail + Google Calendar

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → APIs & Services → Credentials → OAuth 2.0 Client
3. Enable Gmail API and Google Calendar API
4. Add redirect URI: `http://localhost:8787/api/auth/google/callback`
5. Add to `.env`:
```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:8787/api/auth/google/callback
```
6. Go to Integrations in the app → click Connect for Gmail and Calendar

### Enable GitHub

```bash
GITHUB_TOKEN=ghp_...
GITHUB_REPO_OWNER=your-username
GITHUB_REPO_NAME=your-repo
```

Generate a Personal Access Token at [github.com/settings/tokens](https://github.com/settings/tokens) with `repo` scope.

### Enable Slack

```bash
SLACK_BOT_TOKEN=xoxb-...
SLACK_DEFAULT_CHANNEL_ID=C08XXXXXXX
```

Create a Slack App at [api.slack.com/apps](https://api.slack.com/apps), enable Incoming Webhooks, and add the `chat:write` and `channels:read` OAuth scopes.

---

## ☁️ Cloud Deployment (Google Cloud Run)

Crewmate ships with a one-shot deployment script for GCP Cloud Run.

### Prerequisites
- `gcloud` CLI installed and authenticated
- A GCP project with billing enabled

### Deploy

```bash
./cloud-deploy.sh YOUR_GCP_PROJECT_ID
```

The script automatically:
1. Enables required GCP APIs (`cloudbuild`, `run`, `secretmanager`, `containerregistry`)
2. Creates secrets in GCP Secret Manager for your API keys (prompts you interactively)
3. Builds the Docker image via Cloud Build
4. Deploys to Cloud Run (auto-scaling, HTTPS, global CDN)
5. Prints the live URL and health check endpoint

### Manual Docker Build (optional)

```bash
docker build -t crewmate .
docker run -p 8787:8787 \
  -e GOOGLE_API_KEY=your-key \
  -e CREWMATE_ENCRYPTION_KEY=your-key \
  crewmate
```

---

## 🔑 Environment Variables Reference

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `GOOGLE_API_KEY` | Gemini API key for all model calls | `AIzaSy...` |
| `CREWMATE_ENCRYPTION_KEY` | 32-char AES-256 key for secrets | `openssl rand -hex 16` |

### Recommended

| Variable | Description | Sign up |
|----------|-------------|---------|
| `TAVILY_API_KEY` | AI-optimized web search (1000/mo free) | [app.tavily.com](https://app.tavily.com) |

### Server Config

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8787` | Backend API port |
| `CORS_ORIGIN` | `http://localhost:5173` | Frontend URL |
| `CREWMATE_DB_PATH` | `data/crewmate.db` | SQLite database path |

### Model Overrides (all optional)

| Variable | Default | Controls |
|----------|---------|---------|
| `GEMINI_LIVE_MODEL` | `gemini-2.5-flash-native-audio-preview-12-2025` | Voice sessions |
| `GEMINI_ORCHESTRATION_MODEL` | `gemini-3.1-pro-preview` | Intent routing |
| `GEMINI_RESEARCH_MODEL` | `gemini-3.1-pro-preview` | Deep research |
| `GEMINI_CREATIVE_MODEL` | `gemini-3.1-flash-image-preview` | Image generation |
| `GEMINI_TEXT_MODEL` | `gemini-2.5-flash` | Quick tasks |
| `GEMINI_LITE_MODEL` | `gemini-3.1-flash-lite-preview` | Ultra-fast calls |

### Integrations (all optional but unlock specific agents)

| Variable | Required by |
|----------|------------|
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Gmail + Calendar skills |
| `GITHUB_TOKEN` | GitHub skills (issues, PRs) |
| `GITHUB_REPO_OWNER` + `GITHUB_REPO_NAME` | GitHub skills |
| `SLACK_BOT_TOKEN` | Slack post-message skill |
| `SLACK_DEFAULT_CHANNEL_ID` | Slack default target channel |
| `NOTION_TOKEN` | Notion create-page, list-pages |
| `NOTION_PARENT_PAGE_ID` | Notion root page |
| `CLICKUP_TOKEN` | ClickUp task creation |
| `CLICKUP_LIST_ID` | ClickUp target list |

---

## 📁 Full Project Structure

```
crewmate-dashboard/
│
├── server/                                  # Express + TypeScript API
│   ├── index.ts                             # Server startup, loadCustomSkills()
│   ├── config.ts                            # All env vars + model routing config
│   ├── db.ts                                # SQLite initialization (better-sqlite3)
│   ├── routes.ts                            # All API routes (~880 lines)
│   ├── types.ts                             # Shared TypeScript interfaces
│   │
│   ├── services/
│   │   ├── orchestrator.ts                  # Intent routing + agent dispatch + SSE
│   │   ├── agentNotifier.ts                 # In-app + Slack Block Kit notifications
│   │   ├── notificationPrefsService.ts      # Per-user notification prefs (SQLite)
│   │   ├── notificationService.ts           # In-app notification CRUD
│   │   ├── customSkillRunner.ts             # LLM Recipe + Webhook skill runner
│   │   ├── preferencesService.ts            # User preferences (model, voice, etc.)
│   │   ├── personaService.ts                # 5 built-in personas
│   │   ├── gmailService.ts                  # OAuth2 Gmail (read/send/draft/refresh)
│   │   ├── calendarService.ts               # OAuth2 Google Calendar
│   │   ├── sessionService.ts                # Live session management
│   │   ├── memoryService.ts                 # Memory store/retrieve
│   │   ├── memorySummaryWorker.ts           # Hourly Gemini Flash summarization
│   │   ├── delegationService.ts             # Background delegation queue
│   │   ├── eventService.ts                  # SSE broadcast infrastructure
│   │   ├── geminiClient.ts                  # Gemini AI client factory
│   │   ├── liveGateway.ts                   # Gemini Live WebSocket gateway
│   │   ├── integrationCatalog.ts            # Integration registry + OAuth URLs
│   │   ├── integrationCredentials.ts        # AES-256 encrypted credential storage
│   │   │
│   │   └── agents/                          # 14 specialist agents
│   │       ├── researchAgent.ts             # 🔬 Research
│   │       ├── contentAgent.ts              # ✍️ Content
│   │       ├── communicationsAgent.ts       # 📧 Communications
│   │       ├── devOpsAgent.ts               # 🛠️ DevOps
│   │       ├── calendarAgent.ts             # 📅 Calendar
│   │       ├── salesAgent.ts                # 💼 Sales
│   │       ├── marketingAgent.ts            # 📣 Marketing
│   │       ├── productAgent.ts              # 📋 Product
│   │       ├── hrAgent.ts                   # 👥 HR
│   │       ├── supportAgent.ts              # 🎧 Support
│   │       ├── socialAgent.ts               # 📱 Social
│   │       ├── financeAgent.ts              # 💰 Finance
│   │       ├── legalAgent.ts                # ⚖️ Legal
│   │       ├── dataAgent.ts                 # 📊 Data
│   │       └── agentDiscovery.ts            # A2A discovery protocol
│   │
│   ├── skills/
│   │   ├── index.ts                         # Master skill loader (all 30+ skills)
│   │   ├── registry.ts                      # Registry + run history + custom skills DB
│   │   ├── types.ts                         # Skill, SkillRunContext interfaces
│   │   ├── research/
│   │   │   └── web.skills.ts               # web.search (Tavily→DDG), web.summarize-url
│   │   ├── communication/
│   │   │   ├── gmail.skills.ts             # gmail.send, gmail.draft, gmail.read-inbox
│   │   │   └── slack-post-message.skill.ts # slack.post-message, slack.list-channels
│   │   ├── productivity/
│   │   │   ├── calendar.skills.ts          # calendar.schedule, .find-free-time, .list
│   │   │   ├── notion.skills.ts            # notion.create-page, notion.list-pages
│   │   │   └── clickup.skills.ts           # clickup.create-task, clickup.list-tasks
│   │   ├── code/
│   │   │   └── terminal-sandbox.skill.ts   # terminal.run-command (allowlist enforced)
│   │   ├── browser/
│   │   │   └── browserExtract.skill.ts     # browser.extract (page fetch + parse)
│   │   └── creative/
│   │       └── imageGen.skill.ts           # creative.generate-image (Gemini Image)
│   │
│   ├── mcp/
│   │   ├── mcpProtocolServer.ts            # StreamableHTTP MCP server
│   │   └── mcpRoutes.ts                    # Express routes for /mcp
│   │
│   └── types/
│       └── agentEvents.ts                  # AgentStepEvent, EmitStep types
│
└── src/                                     # React frontend (Vite + TypeScript)
    ├── App.tsx                              # Router with 14 lazy routes
    ├── index.css                            # Design system tokens, dark mode
    │
    ├── pages/
    │   ├── Dashboard.tsx                    # Command bar, task feed, Gmail preview
    │   ├── Agents.tsx                       # Live agent task timeline (SSE)
    │   ├── Skills.tsx                       # Skills Hub marketplace
    │   ├── SkillBuilder.tsx                 # Custom skill builder (LLM/Webhook)
    │   ├── Notifications.tsx               # Feed + Delivery settings tabs
    │   ├── Personas.tsx                     # Persona management
    │   ├── Account.tsx                      # AI model selector, preferences
    │   ├── Integrations.tsx                 # Integration management
    │   ├── Sessions.tsx                     # Live session history
    │   ├── Delegations.tsx                  # Background task queue
    │   ├── Tasks.tsx                        # Task list
    │   ├── ActivityLog.tsx                  # Full audit log
    │   ├── MemoryBase.tsx                   # Memory management
    │   ├── CreativeStudio.tsx               # Image generation
    │   └── auth/
    │       ├── Login.tsx
    │       ├── Verify.tsx
    │       └── Onboarding.tsx
    │
    ├── components/
    │   ├── layout/
    │   │   ├── MainLayout.tsx               # Sidebar + content wrapper
    │   │   └── Sidebar.tsx                  # Navigation with all 14 pages
    │   ├── shared/
    │   │   ├── EmptyStateCard.tsx
    │   │   └── RouteLoader.tsx
    │   └── ui/
    │       ├── Button.tsx
    │       ├── Card.tsx
    │       ├── Select.tsx
    │       ├── Toggle.tsx
    │       └── PageHeader.tsx
    │
    ├── hooks/
    │   ├── useLiveSession.ts               # Gemini Live WebSocket hook
    │   ├── useMicrophoneCapture.ts         # Microphone capture + audio streaming
    │   ├── useScreenShareCapture.ts        # WebRTC screen capture
    │   ├── useNotifications.ts             # SSE notification subscription
    │   ├── usePreferences.ts               # Preferences API hook
    │   ├── usePersonas.ts                  # Personas CRUD hook
    │   ├── useSkills.ts                    # Skills registry hook
    │   └── useAuth.ts                      # Auth state hook
    │
    ├── services/
    │   ├── authService.ts                  # JWT auth, session management
    │   └── dashboardMappers.ts             # API response transformers
    │
    └── lib/
        └── api.ts                          # Typed fetch wrapper
```

---

## 🧪 Tests

```bash
npm test          # Run all 43 tests (watch mode)
npm run typecheck # TypeScript strict mode check
```

### Test Coverage

| Suite | Tests | What's covered |
|-------|-------|---------------|
| `Dashboard.test.tsx` | 2 | CTA clicks, live session start |
| `Agents.test.tsx` | 1 | Agent task timeline rendering |
| `Delegations.test.tsx` | 1 | Background task queue |
| `Sessions.test.tsx` | 1 | Session history |
| `Tasks.test.tsx` | 1 | Task drawer |
| `Skills.test.tsx` | 1 | Skills Hub marketplace |
| `Integrations.test.tsx` | 1 | Integration drawer |
| `ActivityLog.test.tsx` | 1 | Activity details |
| `Account.test.tsx` | 1 | Auth + sign out |
| `Notifications.test.tsx` | 1 | Feed + mark all read |
| `CreativeStudio.test.tsx` | 1 | Image generation |
| `useLiveSession.test.tsx` | 3 | WebSocket lifecycle |
| `useMicrophoneCapture.test.tsx` | 2 | Audio capture |
| `useScreenShareCapture.test.tsx` | 2 | Screen capture |
| `sessionService.test.ts` | 2 | Session DB |
| `integrationCatalog.test.ts` | 1 | Catalog validation |
| `dashboardMappers.test.ts` | 2 | Data transformation |
| `githubService.test.ts` | 2 | GitHub API calls |
| `terminal-sandbox.test.ts` | 17 | **Sandbox security** (allowlist, injection) |

The terminal sandbox has the most comprehensive tests — 17 test cases covering every allowlisted command, every blocked command, and various injection attempts.

---

## 🎨 Design System

Built on CSS custom properties (no Tailwind — full control):

- **Dark mode by default** (`@media (prefers-color-scheme: dark)`)
- **Design tokens**: `--foreground`, `--background`, `--accent`, `--border`, `--muted`
- **Primary color**: `#E95420` (Ubuntu orange — Crewmate brand)
- **Typography**: System font stack with `font-mono` for technical UI elements
- **Animations**: CSS `animate-in` + `motion/react` for micro-interactions
- **Glassmorphism**: Semi-transparent cards with `backdrop-blur` on overlays

---

## 🔒 Security Model

| Concern | How handled |
|---------|------------|
| **API keys** | Stored encrypted (AES-256) in SQLite via `integrationCredentials.ts` |
| **Auth sessions** | JWT tokens, server-side validation on every authenticated route |
| **Terminal commands** | Strict allowlist — pattern matching before execution |
| **Webhook skills** | 10s timeout, 256KB response cap, args sanitized |
| **CORS** | Origin whitelist via `CORS_ORIGIN` env var |
| **SQL injection** | All queries use prepared statements (better-sqlite3) |

---

## 🏆 Why Crewmate Wins the Gemini Live Agent Challenge

### Multimodal — All Three Pillars

1. **See** — Screen capture via WebRTC passed to Gemini Live vision
2. **Hear** — Real-time audio input via native microphone stream
3. **Speak** — Gemini Live native audio output in 5 official voices

### Beyond Chat

Crewmate is not a chatbot with a persistent conversation window. It's an **agentic execution platform** where:
- Multiple agents can run in parallel
- Each agent has access to real external tools
- Every action is transparent and auditable
- The system gets smarter over time (memory)

### Real Tool Execution

Unlike most demos, every integration is real:
- Gmail sends actual emails
- Calendar creates actual events
- GitHub opens actual PRs
- Slack posts actual messages
- Tavily performs actual web searches

### "Full Company" Model

No other hackathon entry has 14 specialist agents with clearly delineated domains. Crewmate demonstrates a future where small teams can punch far above their weight by delegating entire departments to AI.

---

## 📄 License

MIT © 2025 Crewmate

Built for the **Google Gemini Live Agent Challenge 2025**.

> *"The best way to predict the future is to build it."* — and we just built your entire company.
