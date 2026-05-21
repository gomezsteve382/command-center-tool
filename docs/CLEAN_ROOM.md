# Goatmez Clean-Room Policy

## Purpose
This repository must implement Goatmez capabilities as original work inside the Code Engine primary architecture.

## Non-Allowed Inputs
- Unlicensed or leaked source code.
- Third-party prompt packs copied verbatim.
- Imported file layouts designed to clone another product.
- Directly copied API schemas or UI copy from quarantined archives.

## Allowed Inputs
- Public protocol specifications (for example, MCP docs).
- Goatmez-owned requirements and build notes.
- Generic software design patterns that are widely known.
- Existing modules already present in this repository.

## Engineering Rules
- Keep Goatmez under namespaced paths to avoid collision during merge passes.
- Preserve existing primary app routes and behavior unless explicitly migrating them.
- Use explicit adapters for config mapping, session mapping, and permission mapping.
- Validate every Goatmez merge increment with runtime smoke checks.

## Verification
Before each release increment:
1. Run `npm run typecheck -- --pretty false` and record baseline failures if unrelated.
2. Run Goatmez CLI smoke with memory-safe settings.
3. Run Goatmez API validation (`npm run validate:goatmez-merge`) with local endpoints.
4. Confirm no quarantined source assets were extracted or referenced in implementation files.
