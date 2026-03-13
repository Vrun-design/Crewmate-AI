# Cleanup Inventory

## Verified Unused
- `public/Github.svg`
- `public/Gmail.svg`
- `public/crewmate.png`
- Legacy runtime surfaces already removed from codebase:
  - GitHub skills and services
  - custom skill runner, routes, and storage
  - offshift inbox and workflow template modules
  - persona pages, hooks, and panels
  - legacy jobs route, service, and hooks
  - creative studio modules

## Needs Manual Check
- `public/Clikcup.svg`
  - Referenced in repo, but filename may be a typo of `ClickUp`.
- `data/test-artifacts/*`
  - Present as test fixtures; keep until fixture ownership is documented or relocated.
- Standalone docs:
  - `AGENT_ARCHITECTURE.md`
- `README.md`
  - Keep trimming stale product claims as legacy removals settle.

## Removed In Cleanup
- `code-simplifier.md`
  - Historical repo note unrelated to the shipped product/runtime.
- `v2_ui_updates_log.md`
  - Historical design changelog, not an active operator or developer doc.
- `server/mcp/*`
  - Removed after dropping the external MCP server surface from the product.
- `server/services/telegramService.ts`
- `server/routeModules/telegramRoutes.ts`
- `server/skills/communication/telegram-post-message.skill.ts`
  - Removed after dropping Telegram support from the product scope.
- `cloud-deploy.sh`
- `cloudbuild.yaml`
- `Dockerfile`
- `GCP_LIVE_DEPLOYMENT.md`
- `LOCAL_TUNNEL_SETUP.md`
- `claude_desktop_config.json.example`
  - Removed after dropping Cloud/GCP deployment notes and local tunnel support.

## Retain
- `SOUL.md`
  - Referenced in the app flow.
- `public/Crewmate.svg`
  - Active app branding asset.
