# Repository Guidelines

## Project Structure & Module Organization

Source lives in `src/`, primarily TypeScript modules compiled by webpack alongside a few legacy `.js` inputs and CSS patches. Device-facing assets such as logos and app metadata reside in `assets/`. Build artifacts are emitted to `dist/`, while `tools/` holds Node utilities for manifest sync, packaging, and deploy flows. Reference docs (for example the MQTT migration guide) live under `docs/`, and `screenshots/` captures UI states for release notes and store listings.

## Build, Test & Development Commands

Run `npm run build` for the production bundle and `npm run build:dev` when iterating locally; both require Node 22+. `npm run package` wraps the compiled app into an installable `.ipk`. Use `npm run deploy` to push the package to a configured webOS target and `npm run launch` to start it remotely (accepts `-- -p '{...}'` payloads for deep links). Static checks are covered by `npm run lint`, `npm run type-check`, and `npm run prettier-check`. For interactive validation, `npm run mcp:playwright` spins up the Playwright MCP workflows defined in `playwright-mcp.config.json`.

## Coding Style & Naming Conventions

Use 2-space indentation, single quotes for strings, and module-scoped constants in `SCREAMING_SNAKE_CASE` only when exported configuration demands it. Prefer `camelCase` for functions and variables, `PascalCase` for classes and type aliases. Keep imports ordered by local/relative proximity, and colocate feature-specific stylesheets with their TypeScript counterpart. Linting (ESLint with Stylistic + RegExp rules) and Prettier must pass before submitting.

## Testing Guidelines

Automated unit coverage is minimal; rely on the static analysis commands above plus device smoke tests. Add Playwright flows inside `docs/` or `tools/` when automation is practical, naming specs after the feature under test (e.g., `ui-config-panel.spec.ts`). Document manual test steps in PR descriptions, especially for MQTT interactions that require a Home Assistant broker.

## Commit & Pull Request Guidelines

Follow the existing history’s concise, present-tense messages (e.g., "Fix SponsorBlock recap skip"). Reference issue or PR numbers when porting upstream changes. Each PR should summarize the motivation, outline test evidence, and include relevant screenshots or recordings for UI tweaks. Link corresponding Home Assistant or webOS configuration notes when they influence QA.

## Deployment Notes

Ensure webOS CLI tooling (`ares-*`) is installed and the target TV is registered via `ares-setup-device`. The `tools/deploy.js` script expects a named device profile; keep sensitive keys outside the repo and confirm MQTT credentials via `src/config.js` before packaging.
