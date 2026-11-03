# AGENTS.md: Rules for AI Coding Agents

You are an AI coding agent (Codex or Claude Code) building the Genuine Textiles workshop system prototype. Read this file first in every session. The project docs are in the `docs/` folder at the project root.

## Before you write any code

1. Read `docs/README.md` and then every doc that applies to the phase task.
2. Do not invent business rules. If a rule is missing, check `ASSUMPTIONS_AND_OPEN_QUESTIONS.md`; if it is not there, add it as OPEN and use the simplest safe default.
3. Work on **one phase only**. Do not touch modules outside the phase unless a shared component needs a fix.

## Architecture rules

- Plain HTML, CSS and vanilla JavaScript with Bootstrap 5 utilities and Lucide icons. No build step, no framework, no TypeScript.
- One shell page. Sidebar and topbar are generated from a shared navigation config filtered by role.
- File layout: `assets/css`, `assets/js/core` (mock-data, store, navigation, app, components), `assets/js/modules/<module>.js`, `assets/images`.
- Each module file exposes the same simple functions (`render`, `bind`) and is registered with the router in `app.js`.
- **All data access goes through `store.js`.** Modules never call `localStorage` directly.
- Mock data uses the table and column names in `DATABASE_DESIGN.md` (snake_case, integer ids, foreign keys).
- Business calculations (totals, VAT, ageing, stock movement, fabric calculator, wages) live in separate functions in a `services` file, not inside render code.
- Money is integer UGX. Use one helper for formatting and one for amount in words.
- Respect `ROLE_PERMISSION_MATRIX.md` in navigation and in buttons; hide what a role cannot do.

## Code quality (the developer is a lecturer who must understand and maintain this)

- Write simple, readable code. Short functions, clear names, no clever tricks.
- Comment the "why" of every business rule, and name the doc and rule number it comes from.
- Keep one responsibility per file and avoid duplicated code; reuse shared components.
- No dependencies that are not already listed in this repo's docs.
- Explain in the reply what each new file does and how it connects to the others.

## UI rules

- Follow `UI_UX_SYSTEM.md` for colours, components and responsiveness; every screen must work at 360px.
- Documents must match `DOCUMENT_TEMPLATES.md` and print cleanly on A4.
- Financial documents are voided, never deleted. Stock only changes through controlled actions.

## UI consistency (every phase)

- Read `docs/UI_CHECKLIST.md` before building or changing any screen.
- Use shared components; never create a custom toolbar, table, stat card, breadcrumb or menu inside a module.
- Run the Playwright UI audit and fix every failure before finishing.
- The final report must include a UI checklist PASS or FAIL line and name any unmet rule with its reason.

## Testing and finishing a phase

- Add Playwright tests for the main flows of the phase under `tests/e2e/`.
- Finish with a short audit: roles, empty states, mobile width, print preview, consistency with the docs.
- List any assumption you made and any item that needs the owner's confirmation.
