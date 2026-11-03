# UI Checklist

Read this before changing any screen. Detailed component contracts and examples live in [PAGE_PATTERNS.md](PAGE_PATTERNS.md).

## Shell

1. Keep the 260px desktop sidebar and sticky 64px topbar defined in the [page-header contract](PAGE_PATTERNS.md#page-header-and-shell-breadcrumb).
2. Show the route breadcrumb in the desktop topbar and only the current page name below 992px.
3. Use shared navigation, account-menu and breadcrumb renderers rather than module markup.
3a. Give every sidebar item the same 44px row, 20px icon, 12px icon gap and 14.5px label. Hover and active must look different; exactly one sidebar item has `aria-current="page"`.
3b. Make visible group headings keyboard-operable buttons with `aria-expanded` and `aria-controls`. Keep the active item's group open, remember group choices for the session, and show badge totals on collapsed headings.

## Page header

4. Render exactly one H1 through the shared [page header](PAGE_PATTERNS.md#page-header-and-shell-breadcrumb).
5. Keep one short description and permission-aware primary actions beside the H1 without a second breadcrumb.

## Toolbar and filters

6. Use the shared [table toolbar](PAGE_PATTERNS.md#table-toolbar-and-alignment) with equal 40px controls in one wrapping flex row.
7. Keep filter tracks equal, let partial final rows stretch and ellipsize long selects with their full value in `title`.
8. Use `GT.dateRangeFilter` for every date range and keep its fixed popover or phone bottom sheet unclipped.

## Tables

9. Use `GT.dataTable` and its [alignment and priority rules](PAGE_PATTERNS.md#table-toolbar-and-alignment) for every list.
10. Wrap long text while keeping numbers right-aligned and compact values on one line only when configured.
11. Apply column priorities, keep CSV complete and reset horizontal scrolling to the left after every render.
12. Keep Actions at 96px with two adjacent slots and use the shared More menu for remaining actions.
13. Let the page own vertical scrolling and never add an inner vertical table scrollbar.
14. Make permitted View rows clickable and keyboard-openable without action clicks triggering the row.

## Cards

15. Render every KPI through [GT.statCards](PAGE_PATTERNS.md#kpi-and-stat-cards) with an icon tile, label and value.
16. Use `aria-pressed` and the shared table filter state for clickable KPI cards.

## Forms

17. Put each label above its shared form field and each validation error immediately below it.
18. Keep entered values after validation errors and warn before abandoning unsaved changes.

## Feedback

19. Use shared toasts, honest empty states and confirmation dialogs for feedback and destructive decisions.

## Roles

20. Hide restricted costs and actions according to permissions rather than exposing unusable controls.

## Mobile

21. Make every screen usable at 360px with card tables, 44px targets and no page-level horizontal overflow.

## Data

22. Keep business-facing seed data free of the word “Demo”; reserve prototype wording for explicit prototype controls.
23. Format all money through the shared UGX formatter and all visible dates through `GT.dates`.

## Automatic audit

24. Run `npx playwright test tests/e2e/ui-audit.spec.js --workers=1` and fix every failure before finishing.
25. On every audited page, assert exactly one `#appSidebar [aria-current="page"]` and that item's group is open.

## Phase 11 delivery audit

26. Delivery Notes and Dispatch Log use the shared Sales navigation, table and stat card components; the log has no mutation controls.
27. A delivery draft keeps its invoice lines fixed, displays release state, and offers Set to today when planned date is in the future (A-56).
28. Delivery print and restricted Store Keeper or Workshop Supervisor screens contain no monetary figures. Review the list, form, release panel, detail, A4 print, log and 360px list.

## Phase 12 order audit

29. Orders and Production Board appear under Sales only for roles with Orders View. The Orders badge counts late plus pending approvals for Owner/General Manager, and active orders for Workshop Supervisor; collapsed Sales totals include it.
30. Orders list uses shared cards and table. Form uses shared fields and line editor. Detail reads seven settings stages and shows exactly one current step. The board has no price and no page-level horizontal overflow at 360px.
31. Store Keeper and Workshop Supervisor see no prices, totals or paid values on list, detail, board, CSV or the Original A4 job card. Review list, form, detail stepper, deposit panel in Owner and Workshop Supervisor roles, job card print preview, board, 360px list and board.

## Phase 13 material issue audit

32. Material Issues uses the shared header, stat cards, table, forms, line editor and A4 print foundation. Navigation badge counts pending requests for Store Keeper and managers; collapsed Inventory includes it.
33. Review list, form and detail as Store Keeper and Workshop Supervisor, order detail Materials issued, issue slip print preview, and 360px list. All these, including CSV, omit money for every role. Workshop Supervisor sees only own requests and no issue/return/void actions; Sales and Marketing Manager have no access.

The audit allowlist is documented at the top of `tests/e2e/ui-audit.spec.js`. Add an exception only when prototype wording is intentional, name the exact route or element, and explain the reason in the comment and final report.

## Phase 14 finished goods and quick sale audit

34. Finished Goods list and detail use shared header, cards, table and status badges. Verify stock movements and pending adjustments at 360px and desktop, including role visibility with no price, cost or profit for Store Keeper and Workshop Supervisor.
35. Quick Sales list and detail use shared header, filter row, cards, table and actions. Counter selection and cart remain usable at 360px. The Quick Sale receipt uses the existing A4 preview and print component, including VOID watermark after an approved reversal.

## Phase 15 expense and dashboard audit

36. Expenses and Cash Book use the shared header, KPI cards, date filter, table and forms. Confirm pending requests have no voucher or ledger row; approval numbers and posts; cancellation reverses; the voucher is one A4 page with a VOID watermark after cancellation.
37. Each Dashboard KPI opens its source page. Check Owner, General Manager, Accountant, Workshop Supervisor, Store Keeper and Sales at 360px. Store Keeper and Workshop Supervisor see no money on Dashboard or Expenses routes, and Owner alone sees pending-expense decision controls.
38. Every card and panel has visible padding between its border and its first and last child. Check computed padding on main pages at desktop and 360px widths.

## Phase 16 report audit

39. Reports navigation contains Sales, Stock and Debtors reports. Money reports and Financial Statements are limited to Owner, General Manager and Accountant. Store Keeper and Workshop Supervisor see Stock Report quantities only on screen, CSV and A4 print.
40. All four reports use shared headers, tables, date-range controls and print foundation. Sales groups by day, week, month, customer and garment category; every source row opens its owning page. Date filters, empty states and 360px layout must pass.
41. Monthly statement displays the cash-book reconciliation as PASS or FAIL, pending opening balances, and year-to-date beginning 01/01/2027. Printed values match the selected month and date range.

## Phase 17 people and pay audit

42. Employees, Attendance, Daily Production Log, Production Targets and Wages use the shared page header, form, table, cards and A4 print foundation. Review list, detail, add/edit, daily register, order-item log, quality issue, targets, summary and print at desktop and 360px.
43. Workshop Supervisor sees no phone, NIN, next of kin, rate, pay or money on any People screen or CSV. Store Keeper, Sales and Marketing Manager have no People route access. Owner and General Manager see personal details; Accountant sees gross pay but no personal details.
44. Finalising a monthly gross summary creates one pending Salaries expense with no voucher or cash-book entry until Owner approval; the finalised pay summary is a report without a document number.

## Phase 18 fabric calculator audit

45. Fabric Calculator and rule-edit routes are Owner only. Check all other roles' hidden navigation and blocked direct routes; no calculator cost, markup or suggested price appears on their pages, CSV or print.
46. The large sleeved shirt at 60 inches shows 1.50 m base plus 0.10 m wastage, giving 1.60 m per piece. Width and style changes use visible editable table rows; quantity multiplies the completed per-piece amount. On-hand metres read material stock without a movement or reservation.
47. Rule tables and saved notes use shared tables, source labels and honest empty states. Verify 360px card layout, no horizontal overflow, shared A4 letterhead, illustration notice on screen and print, and no document number.

## Phase 20 marketing and target audit

48. Campaign list, form, detail and linked communication use shared headers, fields, stat cards and tables. Verify inline errors, dirty-form warnings, status/channel/start-date filtering, empty states and 360px layout. Budgets and manually entered results never post expenses, vouchers or cash-book rows.
49. Apply the stricter campaign matrix under A-110. Marketing Manager cannot open individual targets or financial routes. Sales target cards, table, CSV and A4 print contain only their own user. Store Keeper and Workshop Supervisor have no Phase 20 routes or amounts.
50. Lead-source period totals and monthly signup rows include No source and exclude void invoices. Target actual reconciles to the same salesperson/month in the Sales Report, with a forced mismatch displaying FAIL. Check single-line UGX amounts, shared progress bars with plain-text statuses, and all three unnumbered A4 reports.
