# Crewmate Architecture

```mermaid
flowchart LR
  User[User]
  Frontend[React + Vite Frontend]
  Live[Gemini Live Runtime]
  API[Express API]
  DB[(SQLite / Firestore later)]
  Vault[Encrypted Integration Vault]
  Jobs[Async Delegation Worker]
  Creative[Creative Studio]
  GitHub[GitHub]
  Slack[Slack]
  Notion[Notion]
  ClickUp[ClickUp]

  User --> Frontend
  Frontend --> API
  Frontend --> Live
  Live --> API
  API --> DB
  API --> Vault
  API --> GitHub
  API --> Slack
  API --> Notion
  API --> ClickUp
  API --> Jobs
  Jobs --> DB
  Jobs --> Notion
  Jobs --> Slack
  API --> Creative
  Creative --> API
  Live --> DB
```

## Runtime Lanes

- `Live Agent`: screen + mic -> Gemini Live -> tool calls -> transcript, tasks, notifications, memory
- `Delegations`: queued brief -> orchestrator -> researcher -> editor -> Notion/Slack handoff
- `Creative Studio`: prompt -> multimodal generation -> narrative + image artifact

## Google Tech

- `@google/genai` SDK
- Gemini Live for realtime screen/audio sessions
- Gemini text generation for delegated jobs
- Gemini multimodal generation for creative artifact output
- intended deployment target: `Google Cloud Run`
