# Production Readiness Changelog

## 2026-03-10

### Planned

- Initialized the production-readiness program and sequenced work into reversible change-sets.
- Started `PR-001: Session and Dashboard Isolation Foundation`.

### Completed

- Shipped `PR-001: Session and Dashboard Isolation Foundation`.
- Scoped live-session shutdown to the current user instead of ending every active session globally.
- Scoped dashboard task, activity, and current-session reads to the authenticated user.
- Scoped session history reads to the authenticated user.
- Scoped memory storage, retrieval, timeline reads, and toggle operations to the owning user.
- Scoped agent-task persistence, listing, and direct reads to the owning user.
- Scoped memory summarization passes to process each user's records separately.
- Added focused isolation tests covering:
  - user-scoped session shutdown
  - user-scoped dashboard payloads
  - user-scoped session history
  - user-scoped memory reads and retrieval
  - user-scoped agent-task reads

### Files Changed

- `server/repositories/sessionRepository.ts`
- `server/services/sessionService.ts`
- `server/repositories/dashboardRepository.ts`
- `server/repositories/workspaceRepository.ts`
- `server/services/memoryService.ts`
- `server/services/memoryIngestor.ts`
- `server/services/memorySummaryWorker.ts`
- `server/services/liveGateway.ts`
- `server/services/orchestrator.ts`
- `server/db.ts`
- `server/routes.ts`
- `server/services/sessionService.test.ts`
- `docs/PRODUCTION_READINESS_PLAN.md`
- `docs/PRODUCTION_READY_CHANGELOG.md`

### Validation

- `npm test -- server/services/sessionService.test.ts` ✅
- `npm run lint` ✅
- `npm test` ✅

### Remaining Known Risks

- Webhook egress policy is now restricted for hosted production.
- Live voice settings are now truthful and active, but deeper per-user model routing is still environment-managed.
- Oversized backend and frontend files still need a modular refactor pass.
- The full test suite still emits an existing React `act(...)` warning in the dashboard test path.

### Completed

- Shipped `PR-002: Session Identity Hardening`.
- Replaced collision-prone short session IDs with UUID-based IDs while preserving the `SES-` prefix for readability.
- Added focused tests to verify UUID-format session IDs and uniqueness across repeated session creation.

### Files Changed

- `server/services/sessionService.ts`
- `server/services/sessionService.test.ts`

### Validation

- `npm test -- server/services/sessionService.test.ts` ✅
- `npm run lint` ✅
- `npm test` ✅

### Completed

- Shipped `PR-003: Custom Skill Ownership and Secret Hardening`.
- Removed the global in-memory loading path for user-created custom skills.
- Scoped custom skill discovery to the owning user in API and orchestrator routing paths.
- Scoped direct custom skill execution authorization to the owning user at runtime.
- Encrypted custom skill auth headers at rest with backward-compatible plaintext read fallback.
- Updated Skill Builder copy so it no longer claims custom skills are available to every user’s crew.

### Files Changed

- `server/skills/registry.ts`
- `server/services/orchestrator.ts`
- `server/routes.ts`
- `server/index.ts`
- `src/pages/SkillBuilder.tsx`
- `server/skills/registry.test.ts`

### Validation

- `npm test -- server/skills/registry.test.ts` ✅
- `npm run lint` ✅
- `npm test` ✅

### Completed

- Shipped `PR-004: Hosted Production Webhook Policy`.
- Added webhook URL validation at create time and execution time.
- Blocked localhost and private-network webhook targets in hosted production.
- Required HTTPS webhook targets in hosted production.
- Kept local development flexible so current local workflows continue to work.
- Updated custom skill UI copy to stay aligned with the safer execution model.

### Files Changed

- `server/services/customSkillRunner.ts`
- `server/services/customSkillRunner.test.ts`
- `server/routes.ts`
- `server/config.ts`
- `src/pages/SkillBuilder.tsx`

### Validation

- `npm test -- server/services/customSkillRunner.test.ts server/skills/registry.test.ts` ✅
- `npm run lint` ✅
- `npm test` ✅

### Completed

- Shipped `PR-005: Settings and Runtime Truthfulness`.
- Aligned onboarding voice choices with the actual Gemini Live voice set.
- Changed default saved voice preference from legacy placeholder values to real Gemini Live voices.
- Wired saved `voiceModel` preferences into live session startup so new live sessions use the selected voice.
- Demoted non-functional per-user model selectors into environment-managed runtime information instead of misleading controls.

### Files Changed

- `src/constants/liveVoices.ts`
- `src/pages/auth/Onboarding.tsx`
- `src/pages/Account.tsx`
- `src/pages/Account.test.tsx`
- `server/services/preferencesService.ts`
- `server/services/liveGateway.ts`

### Validation

- `npm test -- src/pages/Account.test.tsx server/services/sessionService.test.ts` ✅
- `npm run lint` ✅
- `npm test` ✅

### Completed

- Shipped `PR-006: API Cleanup and Dead-Surface Removal`.
- Removed the duplicate `GET /api/memory/nodes` route registration so the memory API surface has one canonical read handler instead of two overlapping definitions.
- Removed the dead Sessions page filter button rather than leaving a non-functional control in the UI.

### Files Changed

- `server/routes.ts`
- `src/pages/Sessions.tsx`

### Validation

- `npm test -- src/pages/Sessions.test.tsx` ✅
- `npm run lint` ✅
- `npm test` ✅

### Completed

- Shipped `PR-007: Modular Route Extraction`.
- Extracted memory routes out of the monolithic backend router into [server/routeModules/memoryRoutes.ts](/Users/varun/Desktop/Dev_projects/crewmate-dashboard/server/routeModules/memoryRoutes.ts).
- Extracted agent, orchestrator, and skill-run routes into [server/routeModules/agentRoutes.ts](/Users/varun/Desktop/Dev_projects/crewmate-dashboard/server/routeModules/agentRoutes.ts).
- Extracted custom skill CRUD and test routes into [server/routeModules/customSkillRoutes.ts](/Users/varun/Desktop/Dev_projects/crewmate-dashboard/server/routeModules/customSkillRoutes.ts).
- Kept `requireAuth` and public route behavior unchanged in the main router while reducing `server/routes.ts` coupling and responsibility.
- Added a shared route-module auth type in `server/routeModules/types.ts` to avoid repeating auth contract signatures across extracted modules.

### Files Changed

- `server/routes.ts`
- `server/routeModules/types.ts`
- `server/routeModules/memoryRoutes.ts`
- `server/routeModules/agentRoutes.ts`
- `server/routeModules/customSkillRoutes.ts`

### Validation

- `npm run lint` ✅
- `npm test -- server/services/sessionService.test.ts server/skills/registry.test.ts src/pages/Sessions.test.tsx` ✅
- `npm test` ✅

### Completed

- Continued `PR-007: Modular Route and UI Extraction`.
- Reduced [SkillBuilder.tsx](/Users/varun/Desktop/Dev_projects/crewmate-dashboard/src/pages/SkillBuilder.tsx) to a thin page container and moved its form, card, list, intro banner, examples, and shared types into focused `src/components/skills/*` modules.
- Preserved existing create, test, and delete behavior while improving separation between page composition and skill-specific UI state.
- Centralized custom-skill UI types and recipe example data to reduce duplication and make future UI changes safer.

### Files Changed

- `src/pages/SkillBuilder.tsx`
- `src/components/skills/types.ts`
- `src/components/skills/recipeExamples.ts`
- `src/components/skills/SkillBuilderIntro.tsx`
- `src/components/skills/CreateSkillForm.tsx`
- `src/components/skills/SkillCard.tsx`
- `src/components/skills/SkillList.tsx`

### Validation

- `npm run lint` ✅
- `npm test` ✅

### Completed

- Shipped `PR-010: Off-Shift Workflow Foundation`.
- Added feature flags for staged rollout of the off-shift inbox, job-type expansion, inbound Slack work, and approval gates.
- Added additive async-job metadata for:
  - work origin
  - delivery channels
  - artifact references
  - approval state
  - handoff history
- Added a feature-flagged off-shift inbox API and UI control-plane view so async work can be tracked end to end.
- Clarified the product IA:
  - `Off-Shift` is now the user-facing queue/create surface for async work
  - `Off-Shift Inbox` is the async workflow tracking surface
  - `Tasks` is the concrete created-work/output surface
- Kept the legacy `/delegations` route working as a backward-compatible alias while moving the primary route to `/off-shift`.
- Added a generic `workflow_run` path for user-defined off-shift execution through the orchestrator so new async work is no longer modeled only as specialized product features.

### Files Changed

- `server/config.ts`
- `server/db.ts`
- `server/types.ts`
- `server/services/featureFlagService.ts`
- `server/services/delegationService.ts`
- `server/services/offshiftInboxService.ts`
- `server/routeModules/workspaceRoutes.ts`
- `src/App.tsx`
- `src/types/index.ts`
- `src/services/featureFlagsService.ts`
- `src/services/offshiftInboxService.ts`
- `src/hooks/useFeatureFlags.ts`
- `src/hooks/useOffshiftInbox.ts`
- `src/components/offshift/offshiftUtils.ts`
- `src/components/offshift/OffshiftSummaryStrip.tsx`
- `src/components/offshift/OffshiftWorkItemCard.tsx`
- `src/pages/OffshiftInbox.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/ui/CommandPalette.tsx`
- `src/pages/Tasks.tsx`
- `src/pages/Delegations.tsx`
- `server/services/featureFlagService.test.ts`
- `server/services/offshiftInboxService.test.ts`
- `server/services/delegationService.test.ts`
- `src/pages/OffshiftInbox.test.tsx`
- `src/pages/Delegations.test.tsx`

### Validation

- `npm run lint` ✅
- `npm test` ✅

### Completed

- Shipped `PR-011: Workflow Templates`.
- Added a reusable workflow-template layer on top of the generic `workflow_run` engine instead of hardcoding product-specific async workflows into the product model.
- Added user-scoped workflow template CRUD for:
  - create
  - list
  - delete
- Wired the `Off-Shift` page so users can:
  - draft a generic async workflow
  - save it as a reusable template
  - re-apply saved templates into the off-shift form
- Kept workflow templates generic and user-defined so they act as reusable intent scaffolds rather than specialized fixed features.

### Files Changed

- `server/db.ts`
- `server/services/workflowTemplateService.ts`
- `server/routeModules/workspaceRoutes.ts`
- `src/types/index.ts`
- `src/services/workflowTemplateService.ts`
- `src/hooks/useWorkflowTemplates.ts`
- `src/components/offshift/WorkflowTemplatePanel.tsx`
- `src/pages/Delegations.tsx`
- `server/services/workflowTemplateService.test.ts`
- `src/pages/Delegations.test.tsx`

### Validation

- `npm run lint` ✅
- `npm test` ✅

### Completed

- Completed the final oversized backend router cleanup using `$roadmap-safety-execution` and `$code-simplifier`.
- Split [routes.ts](/Users/varun/Desktop/Dev_projects/crewmate-dashboard/server/routes.ts) into focused route modules for auth/OAuth, workspace surfaces, and live-session APIs:
  - [authRoutes.ts](/Users/varun/Desktop/Dev_projects/crewmate-dashboard/server/routeModules/authRoutes.ts)
  - [workspaceRoutes.ts](/Users/varun/Desktop/Dev_projects/crewmate-dashboard/server/routeModules/workspaceRoutes.ts)
  - [liveSessionRoutes.ts](/Users/varun/Desktop/Dev_projects/crewmate-dashboard/server/routeModules/liveSessionRoutes.ts)
- Kept `requireAuth` centralized in the top-level router while delegating route registration to focused modules.
- Reduced [routes.ts](/Users/varun/Desktop/Dev_projects/crewmate-dashboard/server/routes.ts) from 604 lines to 34 lines.
- Re-ran the oversized-file sweep after the split; there are no remaining obvious product-surface monoliths in the previously flagged areas.

### Files Changed

- `server/routes.ts`
- `server/routeModules/authRoutes.ts`
- `server/routeModules/workspaceRoutes.ts`
- `server/routeModules/liveSessionRoutes.ts`

### Validation

- `npm run lint` ✅
- `npm test` ✅

### Completed

- Continued `PR-007: Modular Route and UI Extraction`.
- Removed the residual React `act(...)` warning from [Dashboard.test.tsx](/Users/varun/Desktop/Dev_projects/crewmate-dashboard/src/pages/Dashboard.test.tsx) by isolating the Gmail inbox hook in the dashboard test environment.
- Split [Account.tsx](/Users/varun/Desktop/Dev_projects/crewmate-dashboard/src/pages/Account.tsx) into focused account modules for sidebar navigation and each settings panel under `src/components/account/*`.
- Split [Onboarding.tsx](/Users/varun/Desktop/Dev_projects/crewmate-dashboard/src/pages/auth/Onboarding.tsx) into dedicated onboarding step components under `src/components/onboarding/*`, leaving the page responsible only for step flow and persistence decisions.
- Preserved existing account logout behavior, live voice preference handling, and onboarding setup paths while reducing page-level complexity.

### Files Changed

- `src/pages/Dashboard.test.tsx`
- `src/pages/Account.tsx`
- `src/pages/auth/Onboarding.tsx`
- `src/components/account/accountTypes.ts`
- `src/components/account/AccountSidebar.tsx`
- `src/components/account/ProfilePanel.tsx`
- `src/components/account/RuntimeConfigPanel.tsx`
- `src/components/account/PreferencesPanel.tsx`
- `src/components/account/ShortcutsPanel.tsx`
- `src/components/onboarding/types.ts`
- `src/components/onboarding/StepShell.tsx`
- `src/components/onboarding/StepOne.tsx`
- `src/components/onboarding/StepTwo.tsx`
- `src/components/onboarding/StepThree.tsx`
- `src/components/onboarding/ManualSetupStep.tsx`

### Validation

- `npm test -- src/pages/Dashboard.test.tsx src/pages/Account.test.tsx` ✅
- `npm run lint` ✅
- `npm test` ✅

### Completed

- Shipped `PR-008: Production Hardening and Release Gates`.
- Added [server/app.ts](/Users/varun/Desktop/Dev_projects/crewmate-dashboard/server/app.ts) so the backend app can be instantiated independently of the production boot process.
- Added a dedicated smoke gate in [server/smoke/productionReadiness.test.ts](/Users/varun/Desktop/Dev_projects/crewmate-dashboard/server/smoke/productionReadiness.test.ts) covering auth, preferences, session lifecycle, memory ingestion, dashboard payloads, and custom skill CRUD.
- Added the `npm run test:smoke` script as a release check.
- Added [PRODUCTION_RUNBOOK.md](/Users/varun/Desktop/Dev_projects/crewmate-dashboard/docs/PRODUCTION_RUNBOOK.md) to define the automated release gates and the manual checklist handoff.
- Kept the smoke suite service-level instead of socket-bound so it remains deterministic in restricted environments while still validating production-critical behavior.

### Files Changed

- `server/app.ts`
- `server/index.ts`
- `server/smoke/productionReadiness.test.ts`
- `package.json`
- `docs/PRODUCTION_RUNBOOK.md`

### Validation

- `npm run test:smoke` ✅
- `npm run lint` ✅
- `npm test` ✅

### Completed

- Continued `PR-007: Modular Route and UI Extraction` with a dedicated monolith pass.
- Split [liveGateway.ts](/Users/varun/Desktop/Dev_projects/crewmate-dashboard/server/services/liveGateway.ts) into focused modules for runtime session state, pending-turn handling, prompt building, tool execution, and server-message processing while keeping the public live-session API stable.
- Split [Agents.tsx](/Users/varun/Desktop/Dev_projects/crewmate-dashboard/src/pages/Agents.tsx) into focused `src/components/agents/*` modules for task cards, step rows, card UI metadata, and shared agent types.
- Reduced `liveGateway.ts` from 615 lines to 289 lines.
- Reduced `Agents.tsx` from 463 lines to 228 lines.
- Re-ran the file-size sweep after the split; the only remaining oversized hotspot is `server/routes.ts`, which is already partially modularized and is now the next clear backend extraction target if additional cleanup is wanted.

### Files Changed

- `server/services/liveGateway.ts`
- `server/services/liveGatewayTypes.ts`
- `server/services/liveGatewayRuntimeStore.ts`
- `server/services/liveGatewayPendingTurn.ts`
- `server/services/liveGatewayPromptBuilder.ts`
- `server/services/liveGatewayToolRunner.ts`
- `server/services/liveGatewayMessageProcessor.ts`
- `src/pages/Agents.tsx`
- `src/components/agents/types.ts`
- `src/components/agents/agentUi.tsx`
- `src/components/agents/AgentStepRow.tsx`
- `src/components/agents/AgentTaskCard.tsx`
- `src/components/agents/AgentCard.tsx`

### Validation

- `npm run lint` ✅
- `npm test` ✅
