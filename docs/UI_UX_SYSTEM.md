# UI/UX System

## Stack (same as PharmaCare)

HTML + CSS + vanilla JavaScript, Bootstrap 5 (grid and utilities only), Lucide icons, Chart library for charts. No build step. Files: `app.css`, `components.css`, `responsive.css`, `print.css`, plus one CSS and one JS file per module.

## Brand

| Token | Value | Source |
|---|---|---|
| `--brand-blue` | `#2E3192` | Sampled from the title and bars on the proforma and statement (about `#283090`) |
| `--brand-red` | `#E81820` | Sampled from the document numbers, dates and stripe |
| `--brand-blue-dark` | `#22256F` | Hover and active states |
| `--brand-blue-tint` | `#ECEDF8` | Selected rows, active menu background |

Keep brand red for small accents (document numbers, key highlights, the stripe). Use a separate error colour so red never means two things.

| Purpose | Colour |
|---|---|
| Success / paid / delivered | `#1E8E4E` |
| Warning / due soon / low stock | `#E8A300` |
| Error / overdue / void | `#C62828` |
| Info / in progress | `#2E7DD1` |
| Text | `#1F2430` |
| Muted text | `#667085` |
| Border | `#DDE0EA` |
| Page background | `#F5F6FA` |
| Surface | `#FFFFFF` |

## Typography

- Screen: Inter, with a system fallback (`-apple-system, "Segoe UI", Roboto, Arial, sans-serif`).
- Print documents: Arial or Helvetica, matching his letterhead.
- Sizes: page title 24px, section title 18px, body 14px, table 13px, helper text 12px.

## Layout

- Sidebar 260px, brand blue background with white text, collapsible to icons; becomes an off-canvas drawer on phones.
- Topbar 64px: desktop breadcrumb or mobile page name, location switcher, quick actions, alerts bell, user menu.
- Content max width about 1400px, with 24px padding (16px on phones).
- Footer small, static.

## Login and shell layout

- Desktop shell is a two-column grid: a 260px full-height sidebar with a fixed brand header and independently scrolling menu, and a main column. The main column stacks a sticky 64px topbar, full-width content with 24px padding, then its footer.
- The topbar is always one row. At 992px and wider its left side shows the shared breadcrumb; below 992px it shows the current page name beside the drawer button. The A-13 location placeholder, permission-aware quick actions, notifications and user menu stay right. Quick actions use icon and text at 1200px and wider, then icon only.
- Authentication uses a 55/45 split layout: brand-blue information panel on the left and a centred, raised sign-in card on the right. Under 992px it becomes a compact brand header above the card, while keeping controls usable at 360px.

## Placeholder logo assets

- `assets/images/logo.png` is the 244 by 167 transparent placeholder used at about 40px high in the sidebar and as the favicon. `assets/images/logo-large.png` is the 732 by 501 enlarged placeholder used at 200px wide above the login-panel tagline.
- Both logo files are placeholders and must be replaced when the owner provides the clearer final logo. The text wordmark remains as the missing-image fallback.

## Components (build once, reuse everywhere)

Data table (sortable, sticky header), filter bar, search box, status badge, stat card, form field with inline error, money input (auto-formats thousands), date picker, line-item editor (add and remove rows, auto totals), modal, confirm dialog, toast, empty state, tabs, timeline, stage board card, file/photo attach, print button, amount-in-words helper, role-aware button (hides when not permitted).

The implemented list, form and detail contracts, including copyable configuration examples, are documented in `PAGE_PATTERNS.md`.

## Toast notifications

- Toasts appear at the top right below the sticky topbar and stack downward, becoming full-width cards with 12px side margins below 576px.
- Success, warning, error, info and neutral notices use the matching token colour for their accent, icon tint and four- or six-second progress timer. Hovering or keyboard focus pauses dismissal; users can always close a toast immediately.
- Motion is a short right-to-left slide with a small downward drift and fade. Reduced-motion users receive the fade only. Toasts sit above the topbar, drawer and modal layers.

## Account menu

- The topbar account trigger uses a 36px brand-blue initials avatar followed by the active user's name, role and a chevron. Below 576px only the avatar remains visible.
- The fixed-position menu contains a larger avatar, name, role chip and email, then icon-aligned 44px actions for the prototype role switcher and Log out. Log out uses the error treatment on hover.
- The trigger and menu use the menu ARIA pattern. Enter, Space and Arrow Down open it; arrow keys move between items; Escape closes it and returns focus; clicking outside also closes it.

## Scrollbars

- Scroll containers use a 6px scrollbar with a transparent track and a soft grey thumb. The sidebar and mobile drawer keep the brand header fixed while the blue menu area scrolls with a translucent white thumb; it brightens on hover.
- Use `scrollbar-gutter: stable` to avoid content shifts. The optional `.scrollbar-hidden` sidebar class hides only the visual bar, never scrolling itself.

## Status colours

| Status | Colour |
|---|---|
| Draft | grey |
| Issued / Confirmed | blue |
| Part paid / In production | amber |
| Paid / Delivered | green |
| Overdue / Late / Void / Discrepancy | red |
| Rush | brand red badge |

## Behaviour patterns

- Sidebar items share a 44px row, 20px icon, 12px icon gap, 14.5px label and common horizontal padding, including Dashboard. The default label and icon use 85% white; hover uses an 8% white background and full white text; the one current item uses a 14% white background, 3px brand-red left bar, weight 600, full white icon and `aria-current="page"`. Active hover keeps the active appearance. Keyboard focus has a 2px white inset outline. Colour and group transitions last 150–180ms and stop for reduced motion.
- Group headings align with the icon column and are buttons with a rotating chevron, `aria-expanded` and `aria-controls`. Groups slide open and closed. The current route's group opens on load and navigation; saved choices in session storage apply to other groups. Without saved choices, only Sales and the current route's group open. Collapsed groups show the total of their item badges so alerts remain visible. The same states and controls appear in the phone drawer, which closes after choosing a route.
- The sidebar brand header has 16px padding, an approximately 40px logo, spaced wordmark and tagline, and a subtle divider. The header stays in place while the blue menu scrolls.

- Forms validate inline and keep entered values on error.
- Destructive actions use the confirm dialog; financial documents offer **Void**, never Delete.
- Every create, edit and approval shows a toast.
- Lists remember filters during a session.
- Approval requests show a visible pending state and notify the approver.
- Low stock, late orders and overdue debts show as badges in the sidebar and as dashboard cards.

## Responsive

- Phones are used away from the workshop, so every list works at 360px: tables become stacked cards, the main action sits in a bottom or top bar, touch targets at least 44px.
- Document forms: on phones the live preview becomes a "Preview" tab.

## Document and print design

See `DOCUMENT_TEMPLATES.md`. Preview matches print exactly. `print.css` controls A4, hides the shell and prints colours.

## Dashboard (by role)

- Owner and General Manager: takings today and this month, orders by stage, late orders, overdue debts, low stock, recent documents.
- Store Keeper: low stock, recent GRNs, pending material issues.
- Sales: my sales today and month against target, my open quotations.
- Workshop Supervisor: orders by stage, late orders, today's production against target.
- Accountant: debtors ageing, expenses this month, unpaid invoices.
- Marketing: campaigns running, leads this month, scheduled messages.

## Accessibility and language

English only. Minimum contrast 4.5:1. Every icon button has a label. Keyboard focus is always visible.
