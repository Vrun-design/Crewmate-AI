# Crewmate Architecture

## System Map

```mermaid
graph TD
    classDef client fill:#0f766e,color:white,stroke:#0b3b36,stroke-width:1px;
    classDef server fill:#1d4ed8,color:white,stroke:#122d67,stroke-width:1px;
    classDef store fill:#92400e,color:white,stroke:#5b2508,stroke-width:1px;
    classDef ext fill:#6d28d9,color:white,stroke:#3b136f,stroke-width:1px;

    subgraph Client["React + Electron / Browser Client"]
        App["App Router + Layout"]:::client
        Pages["Dashboard / Memory / Delegations / Studio / Integrations / Account"]:::client
        LiveUI["Live Session Overlay"]:::client
        Capture["Screen + Mic Capture Hooks"]:::client
        SSE["Live Event Stream Client"]:::client
        App --> Pages
        Pages --> LiveUI
        LiveUI --> Capture
        Pages --> SSE
    end

    subgraph API["Express Backend"]
        Routes["REST Routes"]:::server
        LiveGateway["Gemini Live Gateway"]:::server
        Delegation["Delegation Service"]:::server
        Memory["Memory Service"]:::server
        Integrations["Integration Catalog + Config"]:::server
        Events["SSE Event Service"]:::server
        Routes --> LiveGateway
        Routes --> Delegation
        Routes --> Memory
        Routes --> Integrations
        Routes --> Events
    end

    subgraph Storage["Local Persistence"]
        SQLite["SQLite Workspace DB"]:::store
        Vault["Encrypted Secret Vault"]:::store
        Worker["Memory Summary Worker"]:::store
        SQLite --> Worker
    end

    subgraph External["External Providers"]
        Gemini["Gemini Live / Text / Creative Models"]:::ext
        GitHub["GitHub API"]:::ext
        Slack["Slack API"]:::ext
        Notion["Notion API"]:::ext
        ClickUp["ClickUp API"]:::ext
    end

    App <-->|REST| Routes
    SSE <-->|SSE| Events
    Capture -->|Frames + PCM| LiveGateway
    LiveUI -->|Turns| LiveGateway

    Routes <--> SQLite
    Integrations <--> Vault
    LiveGateway <--> SQLite
    Delegation <--> SQLite
    Memory <--> SQLite

    LiveGateway <--> Gemini
    Delegation --> Gemini
    Integrations --> GitHub
    Integrations --> Slack
    Integrations --> Notion
    Integrations --> ClickUp
```

## Runtime Flow

### 1. App startup

- `src/main.tsx` initializes theme before React mounts.
- `src/App.tsx` mounts the router and preloads route chunks in the background.
- `src/components/layout/MainLayout.tsx` applies authenticated app chrome and persistent theme state.

### 2. Live session flow

```mermaid
sequenceDiagram
    participant User
    participant UI as Live Overlay
    participant Capture as Capture Hooks
    participant API as Express API
    participant Gateway as Live Gateway
    participant Gemini as Gemini Live
    participant Tools as MCP Tools
    participant DB as SQLite

    User->>UI: Start live session
    UI->>API: POST /api/sessions/live
    API->>Gateway: Start runtime session
    Gateway->>Gemini: Open live session
    Gateway->>DB: Persist session record
    UI->>Capture: User opts into screen share / mic
    Capture->>API: POST frame / audio chunks
    API->>Gateway: Forward multimodal inputs
    Gateway->>Gemini: Stream context
    Gemini-->>Gateway: Transcript / tool calls / audio
    Gateway->>Tools: Execute approved tool action
    Gateway->>DB: Persist transcript, activity, memory
    Gateway-->>UI: Session updates via SSE + polling
```

## Memory Architecture

The memory system is not a single page feature. It spans ingestion, retrieval, live-turn capture, and background summarization.

### Memory data sources

- manual context entered from the UI
- live-turn conversation checkpoints
- background summarization output
- integration-derived context over time

### Memory pipeline

```mermaid
graph LR
    Ingest["Manual Ingest / Live Turn Ingest"] --> Store["SQLite memory_nodes"]
    Store --> Retrieve["Semantic retrieval + list/search APIs"]
    Store --> Summarize["Background summary worker"]
    Summarize --> Store
    Retrieve --> UI["Memory Base page / live context retrieval"]
```

## Delegation Architecture

Delegated jobs are queued separately from the live operator loop so async work does not block a session.

### Job stages

1. UI queues a research brief
2. backend writes job to SQLite
3. background worker picks it up
4. model-driven execution runs
5. results are written back to SQLite and optionally delivered to tools
6. notifications and SSE updates are emitted

## Integration Architecture

Each integration is modeled in three layers:

### Catalog

- display metadata
- readiness state
- capability descriptions
- setup requirements

### Config

- environment-variable fallback
- encrypted vault-backed user-saved config
- API endpoints for create, update, delete, and inspect

### Execution

- MCP tool registration
- live-tool execution from Gemini calls
- activity logging and failure handling

## Frontend Structure

### Presentation

- `src/pages/*`
- `src/components/ui/*`
- `src/components/layout/*`
- `src/components/*`

### Application hooks and services

- `src/hooks/*`
- `src/services/*`

### Important frontend runtime helpers

- `src/services/themeService.ts`
- `src/services/onboardingService.ts`
- `src/lib/api.ts`

## Backend Structure

### Routes and API surface

- `server/routes.ts`
- `server/index.ts`

### Service layer

- `server/services/liveGateway.ts`
- `server/services/memoryService.ts`
- `server/services/delegationService.ts`
- `server/services/integrationConfigService.ts`
- `server/services/notificationService.ts`
- `server/services/preferencesService.ts`

### Repository layer

- `server/repositories/*`

### MCP and tool layer

- `server/mcp/*`
- tool services in `server/services/*`

## Reliability and UX Hardening Already Applied

- route chunks are preloaded after startup to reduce suspense flashes
- theme is initialized before first paint
- screen and microphone capture are explicit user actions, not automatic prompts
- memory graph visualization degrades gracefully when browser APIs are unavailable
- API errors surface backend messages instead of only status codes
- test suite and typecheck are green

## Remaining Production Work

- hosted auth provider
- signed desktop release pipeline
- richer end-to-end smoke coverage
- production secrets management outside local `.env`
- observability and tracing for live session failures
