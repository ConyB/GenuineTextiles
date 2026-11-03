# Information Architecture

## Shell

Same pattern as PharmaCare: one HTML page with an empty sidebar, topbar and content area. JavaScript fills them from a shared navigation config filtered by role. Shared confirm modal, form modal and toast stack. Page title format: `[Page] | Genuine Textiles`.

Topbar: page title, location switcher (if A-13 confirms two operating locations), quick actions (New Invoice, New Receipt, Quick Sale), notifications (low stock, late orders, overdue debts), user menu.

## Sidebar (full tree)

1. **Dashboard**
2. **Sales**
   - Quotations
   - Proformas
   - Invoices
   - Receipts
   - Delivery Notes
   - Dispatch Log
   - Orders
   - Production Board
   - Quick Sale (POS)
   - Quick Sales register
   - Sales Reports
3. **Customers**
   - Customer List
   - Customer Groups
4. **Orders and Production** (future workshop modules)
   - Production Tracker
   - Fabric Calculator
   - Workshop Performance
5. **Inventory**
   - Materials
   - Finished Goods
   - Stock Movements
   - Stock Adjustments
   - Material Issues
   - Goods Received Notes
   - Suppliers
   - Stock Alerts

Material Issues uses `#/material-issues` under Inventory. Its badge counts requested issues for Store Keeper, Owner and General Manager; collapsed Inventory includes the badge. `#/material-issues/new` creates a request, with `?order=id` from an active order. `#/material-issues/:id` shows quantities and actions; active order detail shows issued material only (A-69 to A-72).
6. **Debtors**
   - Debtors List
   - Ageing Report
   - Statements of Account
   - Reminders
6a. **Reports** (Phase 16)
   - Sales Report (money roles only)
   - Stock Report (quantity-only for operational roles)
   - Debtors Report (money roles only)
7. **Finance**
   - Expenses
   - Petty Cash
   - Budgets
   - Cash Book
   - Financial Statements
8. **People**
   - Employees
   - Attendance
   - Daily Production Log
   - Production Targets
   - Wages
9. **Communication**
    - Messages
    - Templates
    - Message Log
    - Poster Studio
10. **Marketing**
    - Campaigns
    - Lead Sources
11. **Administration**
    - Users and Roles
    - Business Settings
    - Document Numbering
    - Audit Log
    - Data Browser (prototype only)
    - Reset Demo Data (prototype only)

## Page patterns

The reusable implementation contract and copyable configuration examples live in `PAGE_PATTERNS.md`.

| Pattern | Used for | Contents |
|---|---|---|
| List page | Every register | Search, filters, status chips, table, row actions, pagination, export |
| Form page or modal | Create and edit | Grouped fields, inline validation, save, save and print |
| Document page | Quotation, proforma, invoice, receipt and delivery note | Shared full-page editor beside live A4 preview where space allows; separate locked detail and print preview |
| Detail page | Customer, order, material, employee | Summary header, tabs, activity timeline |
| Board | Orders by stage | Columns per stage, cards with due date and rush badge |
| Report page | Sales, ageing, statements | Period filter, summary cards, table, charts, print |

## Page inventory (key screens)

| Page | Key content |
|---|---|
| Dashboard | Today's takings, month sales, orders by stage, late orders, overdue debts, low-stock items, recent documents |
| Customer List | Search, group/account/status filters, sortable and paginated customer cards/table, CSV export, role-aware actions |
| Customer form | Grouped contact, credit, marketing and notes fields with inline validation and dirty-form warning |
| Customer detail | Overview, Credit and Balance, Documents, Orders and Reminders tabs; inactive customers remain visible in history |
| Customer Groups | Add and rename groups; delete only when no customer uses the group |
| Suppliers | Searchable local/import supplier list, full-page forms, details and deactivate/activate actions |
| Business Settings | Single-record grouped form beside a live letterhead preview; read-only mode for General Manager |
| Document Numbering | Every sequence, printed next number, padding, last issued number and guarded Owner edit |
| Audit Log | Read-only searchable/filterable change history with before/after comparison |
| Quotation / Proforma form | Customer, date, validity, lines (description, size, qty, unit price), VAT, totals, words, terms, bank block |
| Invoice form | Shared sales document editor with computed due date, free-text order reference until Orders exists, customer balance/credit panel, discount and credit-limit approvals, optional fiscal document number |
| Invoice list and detail | Payment and document statuses, balances, overdue chips, filters and stat cards; read-only receipt history, conversion links, fiscal edit for allowed roles |
| Receipt list, form and detail | Searchable register and collection cards; open-invoice payment form and live preview; locked detail with invoice position, receipt history, timeline, void and print |
| Quick Sale | Product and size search, multi-line cart, VAT, discount approval, payment, change, instant A4 receipt |
| Quick Sales register and detail | Shared filters, stat cards and table; locked lines, receipt print, Owner-approved void |
| Finished Goods list and detail | Variants by size, colour and location, stock status, movement ledger, pending adjustments, stock production orders and transfers |
| Orders list, form and detail | Search and filter orders, create from quotation/proforma, assign number on confirmation, stage tracker, deposit position, lines, linked invoice/delivery notes, stage history, simulated messages, A4 job card |
| Production Board | Read-only seven-stage board with priority and late filters; cards open Orders and stack vertically at 360px |
| Fabric Calculator | Owner-only design, size, optional stock fabric, width, style options and quantity give metres, read-only stock check, material cost and suggested price; five editable rule tables and standalone calculation notes (Phase 18, A-96 to A-99) |
| Delivery Notes list | Sales register with delivery status, search, method/status/customer/date filters, stat cards, CSV, role-aware actions and 360px cards |
| Delivery Note form and detail | From one issued invoice: fixed invoice lines, quantity to dispatch, destination, method, release panel, draft or issue; locked detail with timeline, confirmation, void and A4 original/duplicate print |
| Dispatch Log | Read-only issued and delivered note register with dispatch date, method, status and over-three-days confirmation filter; CSV and print |
| Materials | Fabric attributes (colour, type, width, supplier, cost per metre), stock by location, full stock level |
| Stock Movements | Read-only, searchable and exportable material ledger with material, location, type and date filters |
| Stock Alerts | Low/out summary cards and reorder list with percentage remaining, supplier and role-aware Receive Stock action |
| Goods Received Notes | Searchable receipt register; full-page posting form, immutable posted quantities, discrepancy notice, print and Owner void |
| Stock Adjustments | Request register and form; current-stock helper, Owner approval/rejection, requester cancellation and movement link |
| Debtors List | Derived customer balance, overdue amount, ageing bucket, credit position, last reminder and promise; links to debtor detail and payment. |
| Debtor detail | Open invoices, payments, statements and reminder tabs with invoice selection and contact actions. |
| Ageing Report | Shared bucket cards, CSS proportion bar, customer balances, CSV and landscape A4 print. |
| Statement of Account | Register, live issue form, locked letter view, A4 preview and reasoned void. |
| Reminders | Simulated SMS/email and logged calls; spacing gate, promises, bulk action and history. |
| Financial Statements | Month picker, Income Statement, Balance Sheet, Cash Flow, Debtors Report |
| Employees | List, detail, add, edit and deactivate; record name, phone, NIN, address, next of kin, date of birth, date joined, role, pay type and pay rate (A-91). |
| Attendance | Daily employee status register and monthly status summary (A-94). |
| Daily Production Log | Existing customer and stock order items, completed pieces, responsible employee, quality issues and rework (A-92, A-93). |
| Production Targets | Daily and weekly section goals against logged quantity (A-93). |
| Wages | Gross monthly summary, unnumbered A4 report and one pending Salaries expense after finalisation (A-95). |
| Poster Studio | Template, size (WhatsApp status, Instagram, Facebook), text, image, logo, download |
| Campaigns | Date, channel, budget, audience, result, leads gained |
