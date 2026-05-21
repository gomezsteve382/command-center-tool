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
   - Includes adapter-boundary coverage for legacy import mapping and env/config translation.

## Diagnostics endpoint

- `GET /api/goatmez/diagnostics`
  - Returns MCP config diagnostics, connector readiness snapshot, and observability summary.
- `GET /api/goatmez/permissions/diagnostics`
  - Returns wildcard/duplicate/overlap diagnostics for permission rules.
- `POST /api/goatmez/permissions/simulate`
  - Evaluates multiple tool names against current permission rules in one call.

## API startup for validation

```powershell
$env:GOATMEZ_DB_DRIVER='memory'
$env:GOATMEZ_PLANNER_PROVIDER='rule'
$env:AUTH_PROVIDER='none'
$env:API_PORT='3101'
node --import tsx/esm src/server/api/index.ts
```

## Web startup for Goatmez UI

```powershell
$env:NEXT_PUBLIC_API_URL='http://127.0.0.1:3101'
cd web
npx next dev --port 8796
```
