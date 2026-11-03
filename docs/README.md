# Genuine Textiles Workshop System: Project Docs

## Run the prototype

Serve this folder from its root so browser paths work correctly. For example, after installing Node.js, run `npx http-server . -p 4173 -c-1`, then open `http://127.0.0.1:4173/login.html`.

The prototype uses Bootstrap 5.3 CSS and Lucide icons from local copies centralized in `assets/vendor/`, so screens render without a CDN connection. Install test dependencies with `npm install`, install the browser once with `npx playwright install`, then run `npm run test:e2e`. This runs both the browser unit page in `tests/unit.html` and the end-to-end flows.

**Client:** Genuine Textiles ("Your Quality Uniforms Factory"), Nasser Road, Mirembe Arcade, Kampala
**Project:** Workshop management system for the owner, Kibira Edward
**Approach:** Build a complete clickable UI/UX prototype first (HTML + CSS + JavaScript with realistic mock data), prove it with the owner, freeze it, then convert it to Laravel + Blade, the same route taken with PharmaCare.
**Source of truth for requirements:** the owner's filled questionnaire (23/10/26) and his existing documents (quotation, proforma, invoice, receipt, delivery note, statement of account).

## How to use these docs

Every build phase must start by reading the files below that apply to it. If a rule is not written here, do not invent it: mark it as an open question in `ASSUMPTIONS_AND_OPEN_QUESTIONS.md`.

| File | What it answers |
|---|---|
| `PRODUCT_VISION.md` | Who the business is, the problems we solve, success measures |
| `MVP_SCOPE.md` | What is built first, what is mocked, what is deferred |
| `ASSUMPTIONS_AND_OPEN_QUESTIONS.md` | Everything we assumed and what the owner must still confirm |
| `ROLE_PERMISSION_MATRIX.md` | Who may see and do what |
| `INFORMATION_ARCHITECTURE.md` | Sidebar, every page, and what each page contains |
| `BUSINESS_RULES.md` | Numbering, VAT, deposits, credit, stock, orders, calculator, wages |
| `DATABASE_DESIGN.md` | Draft tables, so mock data is shaped like the future database |
| `DOCUMENT_TEMPLATES.md` | Field-by-field layout of every printable document |
| `UI_UX_SYSTEM.md` | Colours, components, layouts, print rules |
| `MOCK_DATA_SPEC.md` | The demo story the seed data must tell |
| `AGENTS.md` (project root, not in docs/) | Rules for the AI coding agent (Codex or Claude Code) |

## Status labels used in these docs

- **CONFIRMED**: the owner said so in the questionnaire or a sample document.
- **ASSUMED**: a sensible default chosen so work can continue; the owner must confirm it (see the assumptions file).
- **OPEN**: no answer yet.
