# Crewmate — Architecture

> **Gemini Live Agent Challenge** · Category: Live Agents 🗣️ + UI Navigator ☸️

---

## System Overview

Crewmate is a multimodal AI remote employee. It connects a real-time Gemini Live session (voice + screen) to a full backend orchestration layer. Voice commands reach 14 specialist agents, read and write real documents, chain into multi-step pipelines, and report progress in real-time — all while remembering context from past sessions.

**What's changed recently:**
- Live sessions can now reach all 14 specialist agents via `live.delegate-to-agent`
- Agents chain sequentially via `live.run-pipeline` with context passed between steps
- Every agent run gets relevant memory injected before starting
- Agents perform a self-critique pass before returning output
- Full document reading: Google Docs, Sheets, Slides, Notion pages, Gmail bodies
- Editable Soul: user name + custom personality injected into every agent and live prompt
- Firebase OAuth race condition fixed — no more logout after Google Workspace connect



![Crewmate Dev Diagram](../public/Document_diag.png)



![Crewmate Dev Diagram](../public/DIAGRAM_2.png)



```
┌─────────────────────────────────────────────────────────────────┐
│                          USER                                   │
│                  Voice  ·  Screen  ·  Text                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                FRONTEND  (Firebase Hosting)                      │
│                React + Vite + TypeScript                         │
│                                                                  │
│   Dashboard ── Live Session Card ── Screen Share Overlay         │
│   Tasks ─────── SSE Streaming Trace ── Task Cue Badge            │
│   Memory ─────── Knowledge Base Viewer                          │
│   Integrations ─ OAuth Connect Flows                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │  REST + SSE
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│               BACKEND API  (Google Cloud Run)                    │
│                Node.js + Express + TypeScript                    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    LIVE LAYER                            │   │
│  │                                                          │   │
│  │  liveGateway ◄──── WebSocket ────► Gemini Live API       │   │
│  │       │                           (gemini-2.5-flash-     │   │
│  │       │                            native-audio)         │   │
│  │  promptBuilder                                           │   │
│  │  (Memory + Integrations + User Name + Soul injected)     │   │
│  │       │                                                  │   │
│  │  messageProcessor ── toolRunner                          │   │
│  │                           │                             │   │
│  │               ┌───────────┴────────────┐                │   │
│  │               │  executionPolicy       │                │   │
│  │               │  inline / delegated /  │                │   │
│  │               │  delegate-to-agent /   │                │   │
│  │               │  run-pipeline          │                │   │
│  │               └───────────┬────────────┘                │   │
│  └───────────────────────────┼──────────────────────────────┘   │
│                              │                                   │
│     ┌────────────────────────┼─────────────────────┐            │
│     │                        │                     │            │
│     ▼                        ▼                     ▼            │
│  ┌──────────┐   ┌────────────────────────┐  ┌──────────────┐   │
│  │  INLINE  │   │     ORCHESTRATOR       │  │ PIPELINE     │   │
│  │  SKILLS  │   │  Intent Router         │  │ ORCHESTRATOR │   │
│  │  (< 2s)  │   │  (gemini-3.1-pro)      │  │ Sequential   │   │
│  └──────────┘   │                        │  │ Agent Chain  │   │
│                 │  Memory injected →     │  └──────────────┘   │
│                 │  14 Specialist Agents  │         │           │
│                 │  (+ self-critique)     │         │           │
│                 │                        │         │           │
│                 │  60 Skills             │←────────┘           │
│                 └────────────┬───────────┘                     │
│                               │                                  │
│                               ▼                                  │
│                    ┌──────────────────────┐                     │
│                    │   EXTERNAL SERVICES  │                     │
│                    │                      │                     │
│                    │  Google Workspace    │                     │
│                    │  (Gmail, Docs,       │                     │
│                    │   Sheets, Slides,    │                     │
│                    │   Drive, Calendar)   │                     │
│                    │                      │                     │
│                    │  Notion · Slack      │                     │
│                    │  ClickUp · GitHub    │                     │
│                    │                      │                     │
│                    │  Browser (Stagehand  │                     │
│                    │  + Playwright)       │                     │
│                    └──────────────────────┘                     │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               EVENT SERVICE (SSE)                        │   │
│  │   Broadcasts live_task_update, step, completed,          │   │
│  │   failed events back to connected frontend clients       │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Google Cloud Services

| Service | Role |
|---|---|
| **Google Cloud Run** | Hosts the Node.js backend API — containerised, auto-scaling, HTTPS |
| **Firebase Hosting** | Hosts the React frontend — global CDN, instant deploy |
| **Firebase Authentication** | JWT-based user auth — token verified on every API request |
| **Gemini Live API** | Real-time audio + vision model (`gemini-2.5-flash-native-audio`) |
| **Google GenAI SDK** | `@google/genai` v1.44.0 — all Gemini model calls |
| **Google Workspace APIs** | Gmail, Calendar, Docs, Sheets, Slides, Drive (OAuth 2.0) |

---

## Request Flow — Full Mermaid Diagram

```mermaid
flowchart TD
    U[👤 User — Voice + Screen] --> FE

    subgraph Frontend["Frontend · Firebase Hosting (React + Vite)"]
        FE[App Shell / Router]
        DASH[Dashboard\nLive Controls + Cue Badge]
        TASKS[Tasks\nSSE Streaming Trace]
        MEMORY[Memory\nKnowledge Base]
    end

    FE --> DASH & TASKS & MEMORY

    subgraph Backend["Backend · Google Cloud Run (Node.js + Express)"]
        API[REST API — 8 route modules]

        subgraph LiveLayer["Live Layer"]
            LGW[liveGateway]
            LPB[promptBuilder\nMemory + Integrations]
            LMP[messageProcessor\nTool Routing]
            LTR[toolRunner\nInline vs Delegated]
        end

        subgraph ExecutionLayer["Execution Layer"]
            ORCH[Orchestrator\nIntent Router]
            PIPE[Pipeline Orchestrator\nSequential Agent Chaining]
            POLICY[Execution Policy\nInline · Delegated · Agent · Pipeline]
            REG[Skill Registry\n60 Skills]
        end

        subgraph AgentLayer["Agent Layer — 14 Specialists"]
            AG_RES[Research Agent]
            AG_PRD[Product Agent]
            AG_UI[UI Navigator Agent]
            AG_ETC[... 11 more agents]
        end

        subgraph MemoryLayer["Memory Layer"]
            MEM[memoryService\nRead + Write]
            EMB[embeddingService\nVector Search]
        end

        subgraph DataLayer["Data Layer"]
            DB[(SQLite\n19 Tables)]
            SSE[EventService\nSSE Broadcast]
        end

        GEMINI["☁️ Gemini Live API\ngemini-2.5-flash-native-audio"]
        FB["🔥 Firebase Auth\n(Google Cloud)"]
        GCP["☁️ Google Cloud Run\n(this backend)"]
    end

    FE -->|REST + SSE| API
    API --> LiveLayer & ExecutionLayer
    LGW <-->|WebSocket| GEMINI
    LPB --> MemoryLayer
    LTR --> POLICY --> REG
    LTR -->|live.delegate-to-agent| ORCH
    LTR -->|live.run-pipeline| PIPE
    ORCH --> AgentLayer
    PIPE -->|sequential steps\ncontext forwarded| AgentLayer
    AgentLayer -->|memory injected before run| MemoryLayer
    AgentLayer --> REG
    REG -->|Notion, Slack, ClickUp\nGmail, Docs, Sheets, Slides\nBrowser, Terminal| ExtServices["🔌 External Services"]
    MEM --> EMB --> DB
    ORCH --> DB
    SSE -->|live_task_update\nstep · completed · failed| FE
    API -->|verify JWT| FB
```

---

## Live Session Sequence

How a voice command becomes a real-world action:

```mermaid
sequenceDiagram
    actor User
    participant UI as Dashboard (Firebase Hosting)
    participant API as Cloud Run API
    participant GW as liveGateway
    participant Gemini as Gemini Live API
    participant TR as toolRunner
    participant Orch as Orchestrator
    participant Skills as Skill Registry

    User->>UI: Speaks (audio stream)
    UI->>API: POST /sessions/:id/messages
    API->>GW: sendLiveMessage(audio + screenshot)
    GW->>Gemini: user turn (multimodal — audio + image)
    Note over Gemini: Processes voice + screen context together

    alt Normal conversational response
        Gemini-->>GW: text/audio stream
        GW-->>UI: transcript + audio chunks
    else Tool call required
        Gemini-->>GW: function_call(skill, args)
        GW->>TR: handleToolCall()
        TR->>TR: executionPolicy.check()

        alt inline skill (quick, safe, < 2s)
            TR->>Skills: runSkill(skillId, args)
            Skills-->>TR: result
            TR-->>Gemini: tool_response
            Gemini-->>UI: continues speaking with result
        else live.delegate-to-agent (complex task)
            TR->>Orch: orchestrate(intent)
            Orch->>Orch: retrieveRelevantMemories() → enrichedIntent
            Orch->>Orch: routeIntent() → specialist agent
            Note over Orch: Agent runs self-critique before returning
            Orch-->>UI: SSE: task_created + streaming steps
            TR-->>Gemini: tool_response {taskId, routeType}
            Gemini-->>UI: "Running that in the background"
        else live.run-pipeline (multi-step chain)
            TR->>Orch: runPipeline([step1, step2, ...])
            Note over Orch: Each step awaits previous output\nContext forwarded automatically
            Orch-->>UI: SSE: steps per agent in chain
            TR-->>Gemini: tool_response {stepCount}
            Gemini-->>UI: "Pipeline of N steps started"
        else delegated skill (slow or has side-effects)
            TR->>Orch: delegateSkillExecution()
            Orch-->>UI: SSE: task_created + streaming steps
            TR-->>Gemini: tool_response {delegatedTaskId}
            Gemini-->>UI: "I've kicked that off for you"
        end
    end

    GW->>GW: ingestLiveTurnMemory()
    Note over GW: Every turn enriches memory for future context
```

---

## Task Cue Reliability Flow

How the "Working on it" badge stays accurate across page refreshes:

```mermaid
flowchart TD
    A[User delegates task or speaks command] --> B[live_task_update SSE event: status=running]
    B --> C[LiveSessionContext sets liveTaskCue]
    C --> D[Dashboard shows 'Working on it' badge]

    D --> E{Task terminal event received?}
    E -->|Yes — completed/failed via SSE| F[Badge updates to Done or Failed\nclears after 7s]
    E -->|No — 45s safety cap| G[Badge auto-clears]

    H[User refreshes page] --> I[LiveSessionContext mounts]
    I --> J[Fetch /api/agents/tasks on mount]
    J --> K{Any running tasks?}
    K -->|Yes| L[Restore liveTaskCue immediately]
    K -->|No| M[No badge — correct]

    L --> D
```

---

## Memory Architecture

```mermaid
flowchart TD
    subgraph WritePath["Write Path"]
        LT["Live Turn"] --> ING1["ingestLiveTurnMemory"]
        SK["Skill Result"] --> ING2["ingestSkillResult"]
        AG["Agent Result"] --> ING3["ingestAgentResult"]
        ART["Screenshot Artifact"] --> ING4["ingestArtifactMemory"]
    end

    ING1 & ING2 & ING3 & ING4 --> STORE[("memory_records\nSQLite")]
    STORE --> EMB["embedAndStore\nasync · fire-and-forget"]
    EMB --> VEC["embedding column\ncosine similarity search"]

    subgraph ReadPath["Read Path — injected into Live sessions AND every Agent run"]
        RETRIEVE["retrieveRelevantMemories\ntopK=4-5"]
        VEC --> RETRIEVE
        RETRIEVE -->|"vector similarity + lexical fallback"| INJECT["Inject into System Prompt"]
    end

    INJECT --> LIVE["Gemini Live Session\nContext-aware from turn 1"]
    INJECT --> AGENTS["Every Specialist Agent\nReceives past context before running\n(Research, Sales, Product, Content...)"]
```

---

## UI Navigator — Browser Automation Loop

```mermaid
flowchart TD
    START["User voice command:\n'Navigate to X and do Y'"] --> ROUTE["Orchestrator routes\nto UI Navigator Agent"]
    ROUTE --> LOOP

    subgraph LOOP["Perceive → Reason → Act Loop (up to 30 steps)"]
        P["PERCEIVE\nScreenshot + DOM + ARIA tree"]
        R["REASON\nGemini multimodal analyzes state\n→ chooses next action"]
        ACT["ACT\nStagehand executes in\nreal Chromium browser"]
        P --> R --> ACT --> P
    end

    ACT -->|step event| SSE["SSE → Tasks UI\n(live trace)"]
    LOOP -->|done/blocked| RESULT["Structured result\n+ memory write"]
    RESULT --> PIP["Screenshot PiP\nupdated in Dashboard"]
```

---

## Execution Policy Decision

Every Gemini tool call goes through the same policy gate:

```mermaid
flowchart LR
    CALL["Gemini function_call\n(skill name + args)"] --> POLICY["executionPolicy.check()\n\n· executionMode\n· latencyClass\n· sideEffectLevel"]

    POLICY -->|"inline\n(quick, sideEffect=none/low)"| INLINE["Run immediately\nduring live turn\n< 2s"]
    POLICY -->|"delegated\n(slow or sideEffect=high)"| DELEGATE["Create background task\nSpeak acknowledgement\nStream via SSE"]
    POLICY -->|"either\n(runtime decides)"| EITHER["Use latency + context\nto pick inline or delegated"]
```

---

## Agent Quality Architecture

Every specialist agent now runs through a consistent quality pipeline:

```
1. MEMORY INJECTION
   retrieveRelevantMemories(userId, intent, 4)
   → Past work, preferences, company context prepended to the intent
       ↓
2. ROUTING
   LLM classifies intent → picks specialist agent (Research, Sales, Product, etc.)
       ↓
3. AGENT EXECUTION
   Agent runs multi-step reasoning with skills (search, read docs, write docs)
       ↓
4. SELF-CRITIQUE (built into every agent system prompt)
   Before returning: "Does this fully answer the question? Are claims backed by data?
   Is this immediately usable? Is anything obviously missing?" → improve if not.
       ↓
5. OUTPUT + SAVE
   Result saved to Notion/ClickUp/Slack as appropriate
   Result ingested into memory for future sessions
```

---

## Document Reading Layer

Crewmate can now read real content from all major document types:

| Source | Skill | Returns |
|---|---|---|
| Google Docs | `google.docs-read-document` | Full plain text |
| Google Sheets | `google.sheets-read-spreadsheet` | All sheets, rows/cells (up to 200 rows per sheet) |
| Google Slides | `google.slides-read-presentation` | All slide titles + body text |
| Gmail | `google.gmail-read-message` | Subject, from, to, date, full decoded body |
| Notion | `notion.read-page` | All block content as plain text |

This enables flows like: *"Read my Q3 strategy doc, then research our competitors, then write a PRD"* — the agent actually understands what's in the doc before acting.

---

## Agent Pipeline (Sequential Chaining)

`live.run-pipeline` lets voice commands trigger a chain of agents where each step feeds into the next:

```
User: "Research our top 3 competitors, then write a battle card, then draft an outreach email"
↓
Pipeline step 1: Research Agent → competitor analysis
Pipeline step 2: Sales Agent    → receives step 1 output as context → battle card
Pipeline step 3: Sales Agent    → receives step 2 output as context → outreach email
```

Each step runs `orchestrate()` with the previous step's output appended. Steps time out at 5 minutes each. On failure, the pipeline stops and reports which step failed.

---

## Tech Stack Summary

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS, Motion (v12) |
| Backend | Node.js, Express, TypeScript |
| AI | Gemini 2.5 Flash Live (audio/vision), `gemini-3.1-pro-preview` (agents/orchestration), `gemini-3.1-flash-lite-preview` (inline/quick), `gemini-embedding-2` (memory), @google/genai SDK |
| Database | SQLite (19 tables, vector embeddings column) |
| Auth | Firebase Authentication (JWT) + dev email-code login |
| Browser Automation | Stagehand + Playwright + Chromium |
| Hosting | Google Cloud Run (backend) · Firebase Hosting (frontend) |
| Integrations | Google Workspace (full read+write), Notion, Slack (inc. DMs), ClickUp, GitHub |
| Real-time | Server-Sent Events (SSE) for task streaming |
| Memory | Vector similarity search (cosine) with lexical fallback — injected into live sessions AND agent runs |
