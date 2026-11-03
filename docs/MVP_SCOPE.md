# MVP Scope

The owner's five first priorities (CONFIRMED): **invoicing, receipting, inventory tracking, debtor tracking, delivery notes.**
These must feel complete and polished in the prototype. Everything else is built after them, or shown with fake output.

## Tier 1: build first and build fully

| Area | Includes |
|---|---|
| Shell and access | Login, role-based sidebar, branding, settings |
| Customers and suppliers | Customer groups (individual, school, corporate, reseller), credit terms |
| Inventory | Materials (fabric, yarn, accessories, packaging), finished goods by size and colour, stock movements, low-stock alerts |
| Goods Received Notes | Receiving, checks (quantity, quality, damage, colour), discrepancy notice to supplier |
| Quotations, proformas, invoices | Numbering, VAT, discounts with approval, amount in words, print |
| Receipts | Deposits and part payments, balance, print |
| Delivery notes | From an invoice or order, partial deliveries, signature block, print |
| Debtors | Debtor list, ageing (0 to 30, 31 to 60, 61+), statement of account, reminder log |

## Tier 2: build next

| Area | Includes |
|---|---|
| Orders and production | Order board by stage, deposit rule, late alerts, rush orders, design photos |
| Material issue | Store to cutter, with manager approval |
| Fabric calculator | Owner only; metres, material cost, suggested price |
| Dispatch | Method, rider or vehicle, destination, proof of delivery |
| Quick sale (POS) | Counter sales of finished goods or fabric |
| Sales tracking | Daily takings, monthly totals, best sellers, best customers, by employee, targets |
| Expenses | Categories, petty cash, receipt photos, recurring items, budgets |

## Tier 3: build last (screens real, output simulated)

| Area | How it is shown in the prototype |
|---|---|
| Employees and production | Records, attendance, piece-rate log, wage calculation (statutory deductions OPEN) |
| Financial statements | Income statement, balance sheet, cash flow, debtors report generated from mock data |
| Communication | SMS and email composer that writes to a message log; no real sending |
| Poster studio | Template-based poster builder for WhatsApp status, Instagram and Facebook |
| Marketing tracker | Campaigns, channels, budgets, results, "how did you hear about us" |

## Deferred to the Laravel stage

Real SMS gateway, real email sending, WhatsApp Business, EFRIS integration (if confirmed), mobile app packaging, data import from his phone contacts and paper records.

## Out of scope for now

Online shop, customer login portal, supplier portal, payroll statutory filing (NSSF and PAYE returns), multi-currency.
