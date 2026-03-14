# Crewmate — Architecture

> **Gemini Live Agent Challenge** · Category: Live Agents 🗣️ + UI Navigator ☸️

---

## System Overview

Crewmate is a multimodal AI operator. It connects a real-time Gemini Live session (voice + screen) to a full backend orchestration layer, enabling natural spoken commands to trigger complex multi-step work across any connected tool or browser — all while reporting progress back in real-time.

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
│  │  (Memory + Integrations injected into every prompt)      │   │
│  │       │                                                  │   │
│  │  messageProcessor ── toolRunner                          │   │
│  │                           │                             │   │
│  │               ┌───────────┴────────────┐                │   │
│  │               │  executionPolicy       │                │   │
│  │               │  inline? delegated?    │                │   │
│  │               └───────────┬────────────┘                │   │
│  └───────────────────────────┼──────────────────────────────┘   │
│                              │                                   │
│          ┌───────────────────┼──────────────────┐               │
│          │                   │                  │               │
│          ▼                   ▼                  ▼               │
│   ┌─────────────┐   ┌─────────────────┐  ┌──────────────────┐  │
│   │   INLINE    │   │  ORCHESTRATOR   │  │  MEMORY LAYER    │  │
│   │   SKILLS    │   │  Intent Router  │  │                  │  │
│   │  (< 2s,     │   │  (gemini-pro)   │  │  memoryService   │  │
│   │   safe)     │   │       │         │  │  embeddingService│  │
│   └─────────────┘   │  14 Specialist  │  │  SQLite          │  │
│                      │  Agents         │  │  (vector search) │  │
│                      │       │         │  └──────────────────┘  │
│                      │  52 Skills      │                        │
│                      └────────┬────────┘                        │
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
            POLICY[Execution Policy\nInline · Delegated · Either]
            REG[Skill Registry\n52 Skills]
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
    LTR -->|delegated| ORCH
    ORCH --> AgentLayer
    AgentLayer --> REG
    REG -->|Notion, Slack, ClickUp\nGmail, Docs, Sheets\nBrowser, Terminal| ExtServices["🔌 External Services"]
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

    subgraph ReadPath["Read Path — injected into every Live prompt"]
        RETRIEVE["retrieveRelevantMemories\ntopK=5"]
        VEC --> RETRIEVE
        RETRIEVE -->|"vector similarity + lexical fallback"| INJECT["Inject into System Prompt"]
    end

    INJECT --> LIVE["Gemini Live Session\nContext-aware from turn 1"]
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

## Tech Stack Summary

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, Framer Motion |
| Backend | Node.js, Express, TypeScript |
| AI | Google Gemini Live API, Gemini Pro (routing/agents), Google GenAI SDK |
| Database | SQLite (16 tables, vector embeddings column) |
| Auth | Firebase Authentication (JWT) |
| Browser Automation | Stagehand + Playwright + Chromium |
| Hosting | Google Cloud Run (backend) · Firebase Hosting (frontend) |
| Integrations | Google Workspace, Notion, Slack, ClickUp, GitHub |
| Real-time | Server-Sent Events (SSE) for task streaming |
| Memory | Vector similarity search (cosine) with lexical fallback |
