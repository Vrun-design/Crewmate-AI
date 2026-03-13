# Agent Architecture

This document explains how the current Crewmate runtime works after the runtime simplification:

- `Gemini Live` is the realtime conversation controller
- `skills` are the single execution primitive
- `agents` are delegated workflow runners for longer multi-step work
- `memory` is a shared supporting subsystem

## Runtime Overview

There are 3 main layers:

1. `Live controller`
- Handles live conversation, turn-taking, interruption, voice, and screen context
- Can run only quick inline skills during the live turn
- Delegates slow or high-impact work into background tasks

2. `Execution layer`
- All real actions run through skills
- Skills define execution policy metadata:
  - `executionMode`
  - `latencyClass`
  - `sideEffectLevel`

3. `Workflow layer`
- Specialist agents run delegated background workflows
- Agents use skills and model calls internally
- Progress streams into the task UI

## High-Level System Diagram

```mermaid
flowchart TD
    U[User] --> FE[Frontend App]
    FE --> API[Express API]

    subgraph Frontend
        DASH[Dashboard]
        TASKS[Tasks Page]
        SKILLSUI[Skills Page]
        LIVEHOOK[useLiveSession]
        SSE[SSE Client]
        LIVESVC[liveSessionService]
    end

    FE --> DASH
    FE --> TASKS
    FE --> SKILLSUI
    DASH --> LIVEHOOK
    LIVEHOOK --> LIVESVC
    TASKS --> SSE

    subgraph Server
        ROUTES[Route Modules]
        LIVE_ROUTES[liveSessionRoutes]
        AGENT_ROUTES[agentRoutes]
        MEMORY_ROUTES[memoryRoutes]

        LIVE_GW[liveGateway]
        LIVE_PROMPT[liveGatewayPromptBuilder]
        LIVE_MSG[liveGatewayMessageProcessor]
        LIVE_TOOL[liveGatewayToolRunner]

        ORCH[orchestrator]
        POLICY[executionPolicy]
        SKREG[skill registry]
        SKLOAD[skills loader]

        AGENTS[Specialist agents]
        MEMORY[memoryService]
        MEM_INGEST[memoryIngestor]
        EVENTS[eventService]
        DB[(SQLite)]
    end

    API --> ROUTES
    ROUTES --> LIVE_ROUTES
    ROUTES --> AGENT_ROUTES
    ROUTES --> MEMORY_ROUTES

    SKLOAD --> SKREG

    LIVE_ROUTES --> LIVE_GW
    LIVE_GW --> LIVE_PROMPT
    LIVE_GW --> LIVE_MSG
    LIVE_MSG --> LIVE_TOOL
    LIVE_PROMPT --> MEMORY
    LIVE_TOOL --> POLICY
    LIVE_TOOL --> SKREG
    LIVE_TOOL --> ORCH
    LIVE_MSG --> MEM_INGEST

    AGENT_ROUTES --> ORCH
    ORCH --> POLICY
    ORCH --> SKREG
    ORCH --> AGENTS
    AGENTS --> SKREG
    ORCH --> MEM_INGEST

    MEM_INGEST --> MEMORY
    MEMORY --> DB
    ORCH --> DB
    LIVE_MSG --> DB
    EVENTS --> SSE
```

## Core Decision Model

Every request is reduced to one of these route types:

- `inline_answer`
- `inline_skill`
- `delegated_skill`
- `delegated_agent`

The main decision rule is:

- if it is cheap and safe, do it inline
- if it is slow, external, browser-heavy, or high-impact, delegate it

## Request Routing Diagram

```mermaid
flowchart TD
    Q[User request] --> ENTRY{Entry path}

    ENTRY -->|Live session| LIVE[Gemini Live session]
    ENTRY -->|Async/API request| ORCH[Orchestrator]

    LIVE --> LIVE_POLICY[Execution policy check]
    LIVE_POLICY --> LIVE_DECIDE{Skill route type}

    LIVE_DECIDE -->|inline_skill| INLINE[Run skill immediately]
    LIVE_DECIDE -->|delegated_skill| DELEGATE_SKILL[Create background task for skill]
    LIVE_DECIDE -->|no skill needed| ANSWER[Speak normal response]

    ORCH --> ORCH_ROUTE[LLM intent routing]
    ORCH_ROUTE --> ORCH_DECIDE{Chosen route}

    ORCH_DECIDE -->|delegated_skill| ASYNC_SKILL[Run delegated skill task]
    ORCH_DECIDE -->|delegated_agent| AGENT[Run specialist agent]

    AGENT --> AGENT_SKILLS[Call one or more skills]
    ASYNC_SKILL --> TASK_TRACE[Emit task step trace]
    AGENT --> TASK_TRACE
    DELEGATE_SKILL --> TASK_TRACE

    INLINE --> MEMORY[Memory ingestion]
    ANSWER --> MEMORY
    TASK_TRACE --> MEMORY
```

## Live Session Flow

Live mode is intentionally not the heavy execution engine anymore.

- Builds system instruction from:
  - core Crewmate identity
  - connected integrations
  - retrieved memory
- Exposes only skill declarations to Gemini Live
- Runs quick inline skills only
- Delegates slow or risky work into a task

## Live Session Sequence

```mermaid
sequenceDiagram
    participant User
    participant UI as Dashboard/Live UI
    participant API as liveSessionRoutes
    participant Live as liveGateway
    participant Gemini as Gemini Live
    participant Runner as liveGatewayToolRunner
    participant Policy as executionPolicy
    participant Skills as skill registry
    participant Orch as orchestrator
    participant Tasks as agent_tasks

    User->>UI: Speak / type request
    UI->>API: POST /api/sessions/:id/messages
    API->>Live: sendLiveMessage(...)
    Live->>Gemini: user turn + screen/audio context
    Gemini-->>Live: streamed response or function call

    alt normal response
        Live-->>UI: transcript/audio updates
    else skill call
        Live->>Runner: handleToolCall(...)
        Runner->>Skills: lookup skill
        Runner->>Policy: decide inline vs delegated

        alt inline skill
            Runner->>Skills: runSkill(...)
            Skills-->>Runner: result
            Runner-->>Gemini: tool response with inlineSkillResult
            Gemini-->>Live: continue speaking
        else delegated skill
            Runner->>Orch: delegateSkillExecution(...)
            Orch->>Tasks: create background task
            Runner-->>Gemini: tool response with delegatedTaskId
            Gemini-->>Live: short spoken acknowledgement
        end
    end
```

## Async Orchestration Flow

The orchestrator is used for explicit async work and background workflows.

- Routes an intent to either:
  - delegated skill
  - delegated agent
- Creates an `agent_tasks` record
- Emits realtime step events
- Stores results into memory

## Orchestrator Sequence

```mermaid
sequenceDiagram
    participant User
    participant UI as Tasks/API caller
    participant Routes as agentRoutes
    participant Orch as orchestrator
    participant Router as routeIntent
    participant Skills as skill registry
    participant Agent as specialist agent
    participant SSE as task event stream
    participant Memory as memoryIngestor

    User->>UI: Submit async intent
    UI->>Routes: POST /api/orchestrate
    Routes->>Orch: orchestrate(intent, ctx)
    Orch->>Router: classify route
    Router-->>Orch: delegated_skill or delegated_agent
    Orch->>SSE: status=running
    Orch->>SSE: routing step

    alt delegated skill
        Orch->>Skills: runSkill(...)
        Skills-->>Orch: result
        Orch->>SSE: skill_call / skill_result / done
    else delegated agent
        Orch->>Agent: run specialist workflow
        Agent->>Skills: call one or more skills
        Skills-->>Agent: results
        Agent-->>Orch: final workflow result
        Orch->>SSE: streamed thought / skill / done steps
    end

    Orch->>Memory: ingest final result
    Orch->>SSE: completed
```

## Skills

Skills are the only execution primitive in the runtime.

A skill provides:

- ID and description
- input schema
- category
- model preference
- execution policy
- live exposure setting
- actual handler

Important runtime metadata:

- `executionMode`
  - `inline`
  - `delegated`
  - `either`
- `latencyClass`
  - `quick`
  - `slow`
- `sideEffectLevel`
  - `none`
  - `low`
  - `high`

Examples:

- `memory.retrieve` -> inline, quick, no side effects
- `notion.create-page` -> delegated, slow, high side effects
- `browser.ui-navigate` -> delegated, slow, high complexity
- `slack.post-message` -> either, quick, high side effects

## Skill-Centric Architecture Diagram

```mermaid
flowchart LR
    REQUEST[Request] --> POLICY[Execution policy]
    POLICY -->|inline| RUN[runSkill]
    POLICY -->|delegated| TASK[delegateSkillExecution]

    RUN --> HANDLER[Skill handler]
    TASK --> HANDLER

    HANDLER --> RESULT[Skill result]
    RESULT --> AUDIT[skill_runs + audit log]
    RESULT --> MEMORY[memory ingestion]
```

## Agents

Agents still exist, but only for delegated workflows.

They are no longer the default live execution path.

Their job is to:

- handle multi-step work
- plan and sequence model + skill calls
- emit progress steps
- produce one final result

Common delegated agent categories:

- research
- product
- sales / marketing
- data
- UI navigation

## Where Memory Fits

Memory is not the router. It is supporting context.

It contributes in 2 directions:

1. `Read path`
- live prompt builder retrieves relevant memories
- the assistant starts with context from prior sessions and artifacts

2. `Write path`
- live turns are stored as `session` memories
- skill results are stored as `knowledge`
- created artifacts and links are stored as `artifact`

## Memory Flow Diagram

```mermaid
flowchart TD
    LIVE[Live turn] --> M1[ingestLiveTurnMemory]
    SKILL[Skill result] --> M2[ingestSkillResult]
    AGENT[Agent result] --> M3[ingestAgentResult]
    ART[Artifact creation] --> M4[ingestArtifactMemory]

    M1 --> STORE[memory_records]
    M2 --> STORE
    M3 --> STORE
    M4 --> STORE

    STORE --> RETRIEVE[retrieveRelevantMemories]
    RETRIEVE --> PROMPT[Live system prompt]
```

## UI Surfaces

### Dashboard
- live session control
- recent tasks
- recent activity
- integrations status

### Tasks
- active delegated tasks
- task history
- streamed execution trace
- live-origin badge for tasks created from live sessions

### Skills
- list of available skills
- skill metadata, including execution policy fields exposed by API

## What Changed from the Older Architecture

Old shape:

- live mode used both skills and MCP tools
- long work could block the live turn
- agents, skills, and MCP tools overlapped in unclear ways

Current shape:

- live mode uses skills only
- slow work is delegated into async tasks
- agents are background workflow runners
- skills are the single execution primitive

## Practical Mental Model

Use this model when reasoning about the app:

- `Gemini Live` = conversational controller
- `skills` = verbs / actions
- `agents` = planners for longer workflows
- `tasks` = durable long-running execution state
- `memory` = shared context and recall

That is the current architecture baseline.
