# Dev Changelog

## 2026-03-09

### Repo analysis and implementation report
- audited the repo and confirmed it was a frontend-first prototype with mocked agent behavior
- wrote [HACKATHON_IMPLEMENTATION_REPORT.md](/Users/varun/Desktop/Dev_projects/crewmate-dashboard/HACKATHON_IMPLEMENTATION_REPORT.md) to lock product strategy, architecture, and execution plan
- updated the report to include one explicit `MCP` example and one explicit `A2A` example

### Local runtime foundation
- installed project dependencies and fixed local native package issues required to typecheck and build on Apple Silicon
- added a local Express + SQLite backend for dashboard state, sessions, and memory
- wired the dashboard and live session UI to real API-backed state without changing the design system
- documented the local developer flow in [README.md](/Users/varun/Desktop/Dev_projects/crewmate-dashboard/README.md)

### Real Gemini path
- replaced the primary fake live-session path with a real Gemini Live-backed server runtime
- added live message sending from the existing overlay UI
- added the first real action path through GitHub issue creation
- kept local SQLite persistence for transcript/task/activity history

### Simplification and test hardening
- extracted reusable helpers for activity/task writes and email-to-display-name formatting
- simplified the recent session/UI code paths without changing behavior
- added a Vitest-based test harness and coverage for core session, mapping, and hook behavior

### Frontend architecture cleanup
- ran a focused frontend simplification pass using the same design system and existing components
- split the dashboard page into modular dashboard components to reduce page-level complexity
- kept dashboard behavior and visuals intact while moving rendering concerns out of the route file
- added a dashboard component test to cover the refactored frontend orchestration path

### Frontend-first route cleanup
- decomposed `MemoryBase` into modular memory components for the view toggle, mind map, list items, actions menu, add-context menu, and drawer content
- decomposed `Integrations` into reusable grid and drawer content components
- decomposed `Tasks` into reusable list, drawer content, and task status utility modules
- added route-level tests for `MemoryBase`, `Integrations`, and `Tasks`
- fixed ID generation in backend activity/task inserts to avoid test collisions during fast local runs

### Frontend bundle and smaller-route cleanup
- decomposed `Sessions` into a reusable session-history grid component
- decomposed `ActivityLog` into reusable activity list, drawer content, and activity utility modules
- lazy-loaded route pages in `App.tsx` with a shared route loader to reduce initial bundle size
- eliminated the Vite large-chunk warning by splitting major route bundles out of the main entry chunk
- added route-level tests for `Sessions` and `ActivityLog`

### Multimodal runtime: live screen context
- added a realtime Gemini frame-ingestion path on the backend via `/api/sessions/:sessionId/frame`
- extended the live Gemini runtime to accept shared-screen frames and log when visual context becomes available
- added a modular `useScreenShareCapture` hook that requests `getDisplayMedia`, captures frames locally, and streams them to the backend while a live session is active
- updated the live overlay with lightweight screen-share status and controls without changing the core UI language
- added targeted tests for the new screen-share hook and kept full repo verification green

### Multimodal runtime: live microphone context
- added realtime audio ingestion routes on the backend via `/api/sessions/:sessionId/audio` and `/api/sessions/:sessionId/audio/end`
- extended the Gemini live session config to accept microphone input and signal audio stream shutdown cleanly
- added a modular `useMicrophoneCapture` hook that requests `getUserMedia`, streams `MediaRecorder` chunks to the backend, and turns mute/unmute into real transport control
- updated the live overlay to present microphone and screen status together using the existing control language instead of adding a new panel
- added targeted microphone tests and re-ran full repo verification after a simplification pass on the touched UI state logic

### Agentic runtime and integration hardening
- replaced the integrations page mock state with a real backend integration catalog driven by local configuration readiness
- added setup metadata for GitHub, Slack, Notion, and ClickUp so the UI can show capabilities, missing env vars, and official-doc links
- extended the live Gemini tool surface beyond GitHub to include Slack posting, Notion page creation, and ClickUp task creation
- started capturing live input transcription and checkpointing completed live turns into the local memory store
- updated local docs and `.env.example` so integration setup matches the current runtime instead of the old mock-only workflow

### Real data and empty-state cleanup
- replaced the remaining route-level task, activity, memory, and session mock dependencies with real API-backed collections
- added consistent empty states so pages render cleanly when the workspace has no live data yet instead of relying on seeded placeholders
- added a lightweight onboarding integration-setup step with explicit skip behavior so integrations no longer feel detached from first-run setup
- kept the design system intact while removing several of the most obvious prototype-only frontend paths

### Auth, notifications, and operator-stack realism pass
- replaced the remaining fake login verification flow with real local request-code and verify-code API calls, including resend support in the verify screen
- removed stale local auth-flag writes from onboarding so the app now relies on the actual auth session token instead of diverging frontend state
- converted the account page from a fixed demo profile into a real auth-backed identity/settings view with logout wired to the backend session API
- upgraded the shared empty-state component to support actionable recovery paths for real empty or signed-out states
- updated the command palette and navigation language to reflect the real `Operator Stack` capability concept instead of the old placeholder skills framing
- added route tests for `Notifications`, `Skills`, and `Account` so the newly-realized pages are covered by the repo test suite

### Demo seed cleanup for real local testing
- changed backend startup so demo seed data is no longer inserted by default on every local run
- added `npm run db:reset` to wipe old SQLite records so local testing can start from true empty state
- updated the local run docs to explain why older runs may still show seeded dashboard and memory data

### Production-style connection and preference persistence
- removed the remaining product-level demo seed files and mock-data artifacts from the active app path
- added authenticated backend APIs for integration connection state and persisted user preferences
- added encrypted storage support for frontend-saved integration credentials via `CREWMATE_ENCRYPTION_KEY`
- switched GitHub, Slack, Notion, and ClickUp runtime execution to use the saved workspace connection state instead of env-only configuration
- updated the integrations drawer so users can connect tools directly from the frontend and remove saved connections without editing files
- persisted account/runtime preferences to the backend and wired the account page to load and save real preference state
- tightened the docs and local env contract so the current product flow reflects real frontend-managed integrations instead of the old mock/env-only approach

### Submission-readiness pass
- added a real async delegation lane with queued background research briefs and a worker-backed orchestrator -> researcher -> editor flow
- added a real creative studio lane that requests mixed text + image output from the Google GenAI SDK and surfaces the artifact in-product
- added new `Delegations` and `Creative Studio` routes plus dashboard hero actions to make the strongest demo paths explicit in the UI
- tightened the main dashboard around a judge-friendly hero journey instead of leaving the capability surface scattered across the app
- removed more prototype leakage from the shell, including fake sidebar counters and outdated tool labels
- added Cloud Run packaging and deployment automation scaffolding via `Dockerfile`, `cloudbuild.yaml`, and `scripts/deploy-cloud-run.sh`
- added judge-facing repo assets for the architecture diagram and submission checklist in `docs/ARCHITECTURE.md` and `docs/JUDGE_ASSETS.md`
- expanded test coverage to include the new async delegation and creative studio pages
