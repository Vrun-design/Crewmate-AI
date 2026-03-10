# Production Readiness Plan

## Change-set roadmap

### PR-001: Session and Dashboard Isolation Foundation

- Scope live-session shutdown to the current user instead of all users.
- Scope dashboard task/activity/session reads to the authenticated user.
- Scope session history reads to the authenticated user.
- Add focused tests for isolation-sensitive session and dashboard behavior.

### PR-002: Session Identity Hardening

- Replace collision-prone session IDs with UUID-based identifiers.
- Tighten session ownership tests.

### PR-003: Memory Ownership and Isolation

- Add workspace or user ownership to memory nodes.
- Scope memory reads, writes, and toggles.

### PR-004: Custom Skill Ownership and Secret Handling

- Scope custom skill registry to the owning user.
- Encrypt custom skill auth headers.
- Add authorization tests.

### PR-005: Webhook Security Policy

- Validate outbound webhook URLs.
- Block localhost and private-network targets in hosted production.

### PR-006: Truthful Settings and Runtime Preferences

- Align onboarding voice choices with Gemini Live voices.
- Apply real saved voice preferences at runtime.
- Remove or relabel settings that are not runtime-backed.

### PR-007: API Surface Cleanup

- Remove duplicate memory routes and duplicate toggle behavior.
- Remove or implement dead UI controls.

### PR-008: Modular Refactor Pass

- Split oversized backend and frontend files after behavior is stable.
- Apply targeted code simplification to touched surfaces only.

### PR-009: Production Hardening

- Add smoke coverage for critical user journeys.
- Tighten deploy and readiness checks.

### PR-010: Off-Shift Workflow Foundation

- Add feature-flagged off-shift inbox and workflow-read model without breaking current pages.
- Add additive job metadata for origin, delivery channels, artifacts, approvals, and handoff history.
- Rename the async-work surface from `Delegations` to `Off-Shift` while keeping route compatibility.
- Separate async workflow runs from concrete created tasks in the product IA.

### PR-011: Workflow Templates

- Add reusable workflow templates on top of the generic off-shift workflow-run engine.
- Let users save, list, apply, and delete reusable off-shift instructions.
- Keep templates generic and user-defined rather than hardcoding specialized product workflows.

### PR-012: Approval, Scheduling, and Delivery Hardening

- Add explicit approval gates for sensitive external actions.
- Add scheduled workflow runs and recurring off-shift execution.
- Strengthen delivery observability and retries for Slack, Notion, and future channels.
