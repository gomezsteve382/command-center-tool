# Goatmez Merge Validation

This project has a broad upstream TypeScript baseline with existing failures outside the Goatmez integration scope.

Use these scripts to validate the Goatmez hard-merge slice without waiting on a full-repo cleanup.

## Commands

1. Goatmez scoped typecheck:
   - `npm run typecheck:goatmez`

2. Goatmez API/runtime validation (API must be running):
   - `npm run validate:goatmez-merge`

3. Combined stack check:
   - `npm run validate:goatmez-stack`
   - Includes clean-room string scanning, adapter-boundary coverage for legacy import mapping, and env/config translation.

4. Clean-room scan only:
   - `npm run scan:goatmez-clean-room`
   - Scans Goatmez-owned code paths for quarantined third-party ZIP/source references.

## Diagnostics endpoint

- `GET /api/goatmez/diagnostics`
  - Returns MCP config diagnostics, connector readiness snapshot, and observability summary.
- `GET /api/goatmez/mcp/explorer`
  - Returns config-only MCP explorer details with redacted env values and launch readiness.
- `GET /api/goatmez/metrics`
  - Returns queue/activity/session/approval/connector metrics for operator monitoring.
- `GET /api/goatmez/permissions/diagnostics`
  - Returns wildcard/duplicate/overlap diagnostics for permission rules.
- `POST /api/goatmez/permissions/simulate`
  - Evaluates multiple tool names against current permission rules in one call.
- `POST /api/goatmez/permissions/rules/:id/enable`
  - Enables a permission rule without deleting or recreating it.
- `POST /api/goatmez/permissions/rules/:id/disable`
  - Disables a permission rule while preserving it for later reactivation.
- `GET /api/goatmez/plugins`
  - Lists Goatmez-native plugin, skill, and adapter registry records.
- `GET /api/goatmez/plugins/registry`
  - Returns plugin registry totals, kind breakdowns, and registered tool hooks.
- `GET /api/goatmez/plugins/hooks`
  - Returns enabled and disabled tool hooks declared by the plugin registry.
- `POST /api/goatmez/plugins/hooks/check`
  - Dry-runs whether a specific Goatmez tool hook is currently active.
- `POST /api/goatmez/plugins/:id/enable`
  - Enables a local Goatmez plugin registry record.
- `POST /api/goatmez/plugins/:id/disable`
  - Disables a local Goatmez plugin registry record.
- `GET /api/goatmez/models`
  - Lists local, hosted, and custom Goatmez model profiles.
- `GET /api/goatmez/models/registry`
  - Returns model registry totals, provider breakdown, and capabilities.
- `POST /api/goatmez/models/:id/verify-dry-run`
  - Checks model profile readiness without calling a model provider.
- `GET /api/goatmez/agents`
  - Lists Goatmez autonomous agent profiles and allowlists.
- `GET /api/goatmez/agents/matrix`
  - Returns per-agent connector, plugin, and model capability visibility.
- `POST /api/goatmez/operator/run-summary`
  - Runs a mission and returns compact operator-facing summary metadata.
- `POST /api/goatmez/operator/command-preview`
  - Classifies a command preview before an operator runs it.
- `POST /api/goatmez/sessions/:id/replay-summary`
  - Returns replay-safe mission/session summary payload for operator review.
- `GET /api/goatmez/connectors/diagnostics?agentId=operator`
  - Returns per-agent connector diagnostics and failure reasons.
- `POST /api/goatmez/connectors/:id/verify-dry-run`
  - Runs a non-destructive connector verification verdict for the selected agent.
- `POST /api/goatmez/mcp/reload`
  - Refreshes MCP diagnostics from `.mcp.json` without executing connector actions.
- `GET /api/goatmez/activity/recent?limit=10`
  - Returns unified mission/session/approval activity rows for operator timeline views.
- `GET /api/goatmez/approvals?status=pending`
  - Lists approval queue items with optional status filter.
- `POST /api/goatmez/approvals/:id/approve`
  - Marks an approval item as approved.
- `POST /api/goatmez/approvals/:id/reject`
  - Marks an approval item as rejected.
- `GET /api/goatmez/connectors/matrix?agents=operator,developer`
  - Returns connector readiness/allowlist matrix for multiple agents.

## API startup for validation

```powershell
$env:GOATMEZ_DB_DRIVER='memory'
$env:GOATMEZ_PLANNER_PROVIDER='rule'
$env:AUTH_PROVIDER='none'
$env:API_PORT='3101'
node --import tsx/esm src/server/api/index.ts
```

When `GOATMEZ_DB_DRIVER=memory` is set and no explicit `GOATMEZ_DB_PATH` or `GOATMEZ_VAULT_PATH` is provided, Goatmez uses temp runtime files outside the tracked workspace state directory.

## Web startup for Goatmez UI

```powershell
$env:NEXT_PUBLIC_API_URL='http://127.0.0.1:3101'
cd web
npx next dev --port 8796
```
