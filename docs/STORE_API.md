# Store API

The prototype uses a small browser database so records resemble the future Laravel tables. `assets/js/core/store.js` is the only file that reads or writes `localStorage`; application code uses `window.GT.store`.

## Load order

Load classic scripts in this order: vendor, namespace, schema, format, dates, calculations, mock data, store, numbering, settings, session, permissions, navigation, router, components, data table, forms, audit, validators, business services, modules, app. Format, dates and calculations load before mock data so the seed uses the same functions as runtime documents; the store initializes after `schema.js` and `mock-data.js`.

## Seed version

The current seed version is `20.0.1`. Each table is stored under a versioned `gt.store.20.0.1.*` key. Earlier history remains seeded; Phase 20 adds four fictional campaigns, fictional customer signup dates and two October sales targets with history. On first load, or when `mock-data.js` changes the version, every documented table is created and seeded.

## Functions

Phase 20: `GT.marketing` validates campaign plans/results and restricts communication links; `leadReport(from, to, monthly)` counts signup cohorts with same-period invoice values. `GT.salesTargets` enforces monthly target uniqueness and history, scopes Sales to their own user, derives actual through `GT.reports.salesByEmployee`, and independently reconciles against `GT.reports.sales()` source rows. `GT.reports.bestCustomers` and `bestItems` add rankings to the existing Sales Report. Every write uses the store; campaign budgets and target changes never post finance, pay or stock records (A-108 to A-114).

| Function | Purpose |
|---|---|
| `init()` | Creates every schema table and applies the seed when needed. Called automatically by `store.js`. |
| `all(table)` | Returns a copy of every row in a table. |
| `find(table, id)` | Returns one row by integer ID, or `null`. |
| `where(table, filter)` | Returns rows matching an object such as `{ active: true }`, or a predicate function. |
| `create(table, record)` | Assigns the next integer ID plus `created_at` and `updated_at`, then returns the new row. |
| `update(table, id, changes)` | Preserves the ID, applies changes, refreshes `updated_at`, and returns the row or `null`. |
| `remove(table, id)` | Removes an unprotected row. Protected financial and stock tables throw an error instructing the caller to void it instead. |
| `count(table)` | Returns the table's row count. |
| `transaction(work)` | Snapshots every table, runs `work`, and restores all snapshots if any step throws; used for atomic multi-table stock workflows. |
| `reset()` | Removes prototype store keys and restores the current seed. |
| `version` | The active seed-version string. |

All returned records are copies. Changing them directly does not change storage; call `update()`.

## Tables

The 65 tables mirror `DATABASE_DESIGN.md`:

- Access and settings: `users`, `roles`, `locations`, `business_settings`, `document_sequences`, `audit_logs`, `approvals`.
- People and partners: `customer_groups`, `customers`, `suppliers`, `employees`.
- Inventory: `materials`, `material_stock`, `products`, `product_variants`, `finished_good_adjustments`, `stock_movements`, `goods_received_notes`, `grn_items`, `stock_adjustments`, `material_issues`, `material_issue_items`.
- Sales and documents: `sales_documents`, `sales_document_items`, `receipts`, `quick_sales`, `quick_sale_items`, `delivery_notes`, `delivery_note_items`, `statements`, `debt_reminders`.
- Orders and production: `order_stages`, `orders`, `order_items`, `order_stage_history`, `order_changes`, `order_attachments`, `designs`, `fabric_rules`, `fabric_width_adjustments`, `fabric_rule_adjustments`, `fabric_wastage_rules`, `fabric_markup_rules`, `fabric_calculations`, `production_logs`, `quality_issues`, `production_targets`, `attendance`, `piece_rates`, `payroll_runs`, `payroll_lines`.
- Finance: `expense_categories`, `expenses`, `petty_cash_entries`, `budgets`, `accounts`, `ledger_entries`, `opening_balances`, `sales_targets`, `sales_target_history`.
- Communication and marketing: `message_templates`, `messages`, `posters`, `campaigns`, `lead_sources`.

Every table exists from the first load. Seed version `17.0.2` retains 30 numbered invoices, 2 invoice drafts and 45 invoice-payment receipts, plus 3 statements, 25 debt reminders, ten numbered delivery notes (2046-2055) and one unnumbered delivery draft. It retains 12 orders: 11 numbered and one draft, with the next order number 12. Eight material issues include six issued (one partly returned), one requested and one rejected; next issue number is 7. Phase 14 adds 12 finished-good variants, seven quick sales with receipts 2074â€“2080, and one pending finished-good adjustment. Phase 15 adds 15 expenses, 12 numbered vouchers, and their cash-book rows. Next invoice, receipt, delivery-note and payment-voucher numbers are 645, 2081, 2056 and 13. The 13 debtors and 5/4/4 ageing split are unchanged. Phase 17 adds 26 employees, two weeks of attendance, six production logs, one quality issue, ten targets and ASSUMED piece rates; payroll starts unfinalised.

## Fabric calculator (Phase 18)

`GT.fabricCalculator` reads and writes only through `GT.store`. `calculate` performs section 10's base, width, style, wastage, quantity, material-cost and markup steps with small named functions. `rules` and `saveRule` expose Owner-only editable rows with source labels; `saveNote` snapshots an unnumbered note in `fabric_calculations`. On-hand metres come from `GT.inventory.totalStock` and are never changed by the calculator. The module uses shared form, data table, page header and print helpers. Seed version `18.0.0` adds these rules while retaining existing material records (A-96 to A-99).

`GT.communication` provides template edit and approval, placeholder preview, SMS segment counts, bulk eligibility, simulated single and bulk sends, a role-scoped message log, and poster persistence. Payment reminders call the Phase 10 debtor service so the seven-day gate and reminder ledger remain authoritative. `GT.communicationModule` renders the Communication routes through shared page headers, tables and A4 print preview (A-102 to A-105).

## People and wages (Phase 17)

`GT.people` uses `GT.store` for all reads and writes. `employeeRows` returns role-filtered employee fields; `saveEmployee` and `setActive` permit only Owner and General Manager. `takeAttendance` stores one status per employee/date; `attendanceSummary` counts monthly statuses. `orderItems` reads existing customer and stock production items. `logProduction` snapshots the assumed garment/task rate and `logQuality` records a responsible employee. `targetRows` derives actual quantities from logs. `paySummary` computes gross salary and piece earnings, or reads finalised snapshots. `finalise` atomically creates one pending Salaries expense with `GT.expenses.save`, then a payroll run and lines. Expense approval and cash-book posting remain in the Phase 15 service (A-91 to A-95).
`productionQuantityWarning` compares cumulative pieces for one order item and task with the ordered quantity without capping the entry (A-93). When the Owner rejects a linked Salaries expense, `reopenRejectedExpense` changes the run to `reopened` inside the expense decision transaction; the original lines remain stored and a later finalisation may create a new run (A-101).

## Expenses, cash book and dashboard (Phase 15)

Phase 16 read-only reports use `GT.reports`: `sales()` separates issued invoice billing from non-void receipt collection; `stock()` and `stockActivity()` show quantities and dated movements; `debtorRows()` reuses `GT.debtors.list()`; `financial(month, from, to)` derives cash-book movement, net receipts and expenses, cash/bank movement and a source-amount reconciliation. Report totals are never persisted, and unverified opening balances remain pending (A-88 to A-90).

`GT.expenses` validates, saves drafts or pending requests, records Owner decisions and posts approved payments through `GT.cashBook` inside store transactions. Voucher numbers are assigned on approval. Cancellation adds a reversal. `GT.cashBook` also receives posted receipts from invoice payments and quick sales; `monthly(day)` keeps ledger rows for the cash book and derives the summary from non-void receipts and approved expenses. `GT.dashboard` derives role-facing counts and money totals from these services and existing order, debtor, inventory and stock services (A-83 to A-87).

## Finished goods and quick sales (Phase 14)

`GT.finishedGoods` calculates per-variant stock status and owns product-variant movement writes, stock production orders, Owner-approved adjustments and atomic transfers (A-73 to A-75). `GT.quickSales` validates cart quantity and payment, computes discount then VAT with `GT.calc`, creates approved or pending sales, issues a receipt from the shared `receipt` sequence, and posts one negative variant movement per line atomically. Owner-approved voids restore those lines and void the receipt. The existing `GT.receipts` daily and monthly totals include the new receipts and exclude voids (A-76, A-77). Customer-order dispatch remains open under A-55 and A-78.

## Material issue service (Phase 13)

`GT.materialIssues.createRequest`, `updateRequest`, `cancelRequest`, `issue`, `reject`, `recordReturn` and `void` enforce role, order, status and quantity rules. Issue, returns and void run in `GT.store.transaction` and call `GT.inventory.recordMovement`; every decision writes `audit_logs`. `forOrder` returns only issued records; `list` and `pendingCount` support the shared table and navigation badge. `lines` derives returned quantity from the movement ledger. The number is consumed only on successful issue (A-69 to A-72).

## Order service (Phase 12)

`GT.orders.stages()` reads the ordered `order_stages` table. `summary(orderId)` derives total, paid, depositPercent, depositMet, balance, deliveryStatus, isLate, daysToDue, status and currentStage from sales documents, receipts and delivery notes. `createDraft`, `createFromDocument`, `saveDraft` and `confirm` manage an unnumbered draft; confirmation consumes the `order` series in a transaction. `linkInvoice` and `createInvoice` use the Phase 8 sales document engine and keep order/invoice foreign keys in both directions. `moveStage`, `requestStageApproval`, `approveStage` and `rejectStage` enforce deposit and stage history rules. `cancel` retains the record and number. `sendReadyMessage` logs a simulated SMS when a phone exists. `syncDelivery` is called by the delivery service after issue, confirmation or void; completion remains quantity-derived. `list`, `lateCount`, `awaitingDepositCount` and `awaitingApprovalCount` support the list and navigation badges. Orders and stage history are protected from hard deletion.

## Debtors and statements

`GT.debtors.list(asOf)`, `ageingTotals(asOf)` and `openInvoices(customerId)` derive balances and ageing from `GT.invoices.summary` and `GT.customers.balance`. `buildStatement` previews open invoice snapshots; `saveStatement` issues a protected statement in a transaction and audits it; `voidStatement` retains the row with a reason. `reminderText` fills the payment template. `sendReminder` writes a simulated `messages` row and a `debt_reminders` row atomically; `logCall` writes an audited call row. `smsSegments`, `smsCountThisMonth`, `overdueDebtorCount`, `recentElectronic` and `promiseStatus` support the UI and badge. `?today=YYYY-MM-DD` drives the as-at date and reminder spacing in tests.

## Sales document transactions

`GT.salesDocs.saveDraft`, `issue`, `duplicate`, `discard`, `voidDoc` and discount decisions use `GT.store.transaction` for multi-table writes. Removed draft lines are marked inactive and remain stored. Issue consumes the configured document sequence and snapshots the customer only after validation succeeds. `?today=YYYY-MM-DD` overrides `GT.dates.today()` for deterministic expiry tests; it does not change stored creation timestamps.

`GT.invoices.summary(id)` derives paid, balance, payment status, due date, overdue days and age from non-void receipts. `dueDate`, `isOverdue`, `ageBucket`, `creditCheck`, `convertFrom`, `requestCreditApproval`, `approveCredit`, `recordManagerOverride` and `setFiscalNo` keep invoice rules outside DOM code. `GT.customers.balance(id)` sums issued invoice totals less non-void receipts. Invoice issue, approval, conversion, fiscal edit and void are audited; multi-record changes use store transactions.

`GT.receipts` validates, issues, numbers, audits and voids receipts inside `GT.store.transaction`. It supplies open invoices, descriptions, related history and date/method collection totals. It stores the immediate `balance_after` snapshot; invoice and customer balances remain derived.

## Delivery service (Phase 11)

`GT.deliveries.summary(invoiceId)` derives per-line ordered, dispatched, returned and remaining quantities and the invoice's delivery state. `remainingAfter(note, itemId, plannedQuantity)` computes the balance on a print copy after that dispatch, preserving numbered note order. `releaseCheck(invoiceId)` uses receipt-derived payment status and current credit standing. `createDraft(invoiceId, lines)` copies invoice lines, customer and address without consuming a number. `saveDraft(id, values)` edits the unlocked draft. `issue(id, approvalReason)` rechecks quantities and release, requests approval for non-manager users when needed, and otherwise numbers and audits the note atomically. `rejectRelease(id, reason)` records a manager's rejection and leaves the note in draft. `confirm(id, values)` stores receiver and per-line returns. `void(id, reason)` releases dispatched quantities; `discardDraft(id)` archives an unnumbered draft. `list(filters)`, `awaitingConfirmationCount()` and `pendingReleaseCount()` support views and badges. `noteLines`, `approvalFor`, `canView` and `canEdit` expose protected read helpers to the module.

## Controlled material stock

`GT.inventory.recordMovement(...)` is the only runtime function allowed to create or update `material_stock`. It validates the signed quantity, prevents negative balances, writes the movement with before/after quantities and user, updates the location balance and audits the change. GRN posting/void and approved stock adjustments call this service inside `GT.store.transaction(...)`, so a failure rolls back the whole operation.

## Add a table

1. Add the table and its columns to `DATABASE_DESIGN.md`.
2. Add its name, readable label, and protected flag to `schema.js`.
3. Add seed rows to `mock-data.js` only when the phase requires them.
4. Increment the seed version so existing browsers receive the new schema.
5. Add or update browser tests for its expected count and protection rule.

## Change the seed

Edit only `mock-data.js`, keep snake_case columns and integer foreign keys, then increment its `version`. Reloading the app will rebuild the versioned store. The Owner can also use **Administration â†’ Reset Demo Data** to restore the current seed without changing the version.






