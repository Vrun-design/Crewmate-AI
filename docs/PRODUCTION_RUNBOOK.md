# Production Runbook

## Release Gates

Run these before any production deploy:

1. `npm run lint`
2. `npm test`
3. `npm run test:smoke`

The smoke suite verifies:
- API health
- auth code request and verification
- authenticated preferences read/write
- session creation and history visibility
- memory ingestion and user-scoped listing
- custom skill creation and listing

## Manual Checks

After automated gates pass, use [CHECKLIST.md](/Users/varun/Desktop/Dev_projects/crewmate-dashboard/CHECKLIST.md) for:
- live session and device-permission flows
- integration OAuth flows
- deployment checks
- judge/demo-specific validation

## Deployment Expectations

- `/api/health` must return `ok: true`
- hosted environment must use production webhook policy
- `CREWMATE_ENCRYPTION_KEY` must be set before deploy
- `GEMINI_*` environment variables must match intended runtime defaults

## Rollback Trigger

Rollback the deployment if any of these occur:

- smoke suite fails on the release candidate
- one user can see another user’s sessions, tasks, memory, or custom skills
- live session startup fails for authenticated users
- custom skill creation or listing regresses
