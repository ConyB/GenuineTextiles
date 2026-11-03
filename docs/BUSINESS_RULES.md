# Business Rules

Rules are CONFIRMED unless marked with an assumption ID (see `ASSUMPTIONS_AND_OPEN_QUESTIONS.md`).
All money is **UGX, whole shillings, stored as integers**. Dates are in Africa/Kampala time.

## 1. Document numbering

- Separate series per type: quotation, proforma, invoice, receipt, delivery note, GRN, material issue, order (A-58).
- Plain sequential numbers (no prefix), continuing from the last paper number (A-16): invoice from 645, receipt from 2074, delivery note from 2056, quotation from 099, proforma from 097. Quotation and proforma display as three digits (099).
- The next numbers are editable in Settings so they can match the paper pads exactly.
- A number is never reused. A voided document keeps its number and shows "VOID".
- Quotations, proformas and invoices receive their number only on issue. Drafts show "Draft"; issue uses the configured series padding (A-36, A-37).

## 2. Money, VAT and words

- VAT is 18% and is added on top of the subtotal.
- Subtotal minus discount, then VAT, then total. Round to the nearest shilling.
- Every quotation, proforma and invoice shows the total in words (for example "Ten million six hundred twenty thousand shillings only").
- On print, amounts follow his style: `9,000,000/=`. On screen: `UGX 9,000,000`.

## 3. Quotation, proforma, invoice, receipt

- **Quotation**: price offer. Valid 14 days. Terms line: "Price Validity: 14 days from date of the Quotation, subject to change basing on the prevailing exchange rate." Expired quotations show "Expired" (A-15).
- **Proforma**: same fields, no validity line (A-15). Either can be converted into an order and an invoice with one click.
- Phase 7 quotations and proformas store `draft`, `issued`, `void` or `discarded`. Quotation "Expired" is computed when today is after `valid_until`; it is never stored. Issued documents lock. To correct one, duplicate it as a new draft and void the original with a reason. Discarded drafts stay stored but leave normal lists (A-36). Conversion becomes available with Invoices in Phase 8.
- An issued quotation/proforma stores a snapshot of the customer's name, address and phone. Quotation validity defaults to issue date plus the configured 14 days and can be edited; proformas have neither validity nor printed terms (A-15, A-36).
- **Invoice**: issued before work starts, for the full order value (A-14). The invoice series is plain numbered; the next issue uses 645. Draft, issue, lock, duplicate, discard and discount approval follow the quotation lifecycle (A-37).
- Invoice payment status is calculated, never stored: unpaid when no non-void receipts exist, part paid when some of the total is paid, and paid when the full total is paid. Draft and void invoices have no payment status. Paid is the sum of non-void receipts; balance is total minus paid (A-37).
- The invoice due date is its date plus the customer's credit days, or the business default when a credit customer has none. Cash invoices are due on demand. Overdue begins the day after the due date if balance remains; age is days since invoice date. Ageing buckets are 0–30, 31–60 and 61+ days (A-37).
- A customer balance is the sum of issued non-void invoice totals less non-void receipts linked to those invoices. Available credit is the customer's limit less that balance (A-37).
- Fiscal Document No. is optional and may be changed after issue only by Owner, General Manager or Accountant; every change is audited. EFRIS integration remains OPEN (A-01, A-39).
- A quotation or proforma converts into a new draft invoice with its customer, lines, discount status and notes. Dates reset to today. The source stays unchanged and may only be converted again after the earlier invoice is void. Expired quotations require a price warning before conversion (A-39).
- **Receipt**: issued for every payment, including deposits and part payments. Always linked to an invoice. Shows amount paid, method, reference (cheque no. or Mobile Money ID), and balance remaining.
- A receipt has no draft. Saving assigns the next receipt number, snapshots the customer name and immediate invoice balance, and locks the row. Corrections void the numbered row with a reason and issue a new one; no receipt is deleted (A-41).
- Only an issued invoice with a positive balance accepts a receipt. The amount must be a positive whole shilling amount no greater than its balance. The receipt date defaults to today and must be between the invoice date and today. A void recalculates the invoice and customer balances immediately. Other receipts retain their historical `balance_after` values (A-41, A-42).
- Cash needs no reference. MTN and Airtel require a transaction ID of at least six characters, bank requires a bank reference, and cheque requires a 4–12 digit number. A non-void receipt cannot reuse a reference with the same method (A-41).
- Description defaults to “Deposit on invoice N” for the first part payment, “Balance of invoice N” when payment clears the invoice, and “Part payment on invoice N” otherwise; the user may edit it (A-41).
- Owner and General Manager may void a receipt after entering a reason. Voiding all active receipts allows the invoice to be voided under the existing invoice rule (A-41). One receipt covers one invoice; allocations across invoices and bounced or uncleared cheques await owner direction (A-43, A-44).
- Payment methods: cash, Mobile Money (MTN, Airtel), bank transfer, cheque.
- Printed cash terms use the setting "All accounts are due on demand"; credit terms use the credit setting and show the due date (A-37).
- Owner or General Manager may void an issued invoice with a reason. An invoice with non-void receipts must have its receipts handled first. Voided invoices remain visible with VOID and leave customer balances; cash-book reversal awaits the Finance phase (A-39).

## 4. Deposits and credit

- Standard terms: **50% before work starts, 50% on delivery**.
- An order cannot move from *Confirmed* to *Cutting* until receipts total at least 50% of the invoice. The General Manager may override with a recorded reason.
- Credit customers (decided by the General Manager) get **30 days by default** (A-14). Each has a credit limit. An invoice that takes balance plus its total over the limit shows the amounts. Owner or General Manager may override with an audited reason; Sales requests approval and cannot issue until it is approved (A-38).
- A debt becomes overdue after its computed invoice due date, while a positive balance remains (A-37).
- Ageing buckets: 0 to 30, 31 to 60, 61 and above.
- Reminders go out by SMS (and optionally email) after the debt is overdue; calls are logged by hand. Every reminder is stored in the reminder log.
- Phase 10 (A-45): a debtor has a derived positive `GT.customers.balance`. The report as at `GT.dates.today()` allocates each open invoice balance by its invoice age: 0–30, 31–60 or 61+ days. Overdue continues to mean today is after the due date. A statement snapshots selected open invoice figures when issued and is voided, never deleted.
- Phase 10 (A-46): only customers with an overdue balance may be reminded. A second SMS or email within seven days needs a General Manager override with a reason; Accountant is blocked. The Owner may use the bulk action under A-47. SMS and email are simulated and write both `messages` and `debt_reminders`; calls are logged by hand.
- Phase 10 (A-45): a dated promise is kept when non-void receipts for that customer dated after the reminder total at least the promised amount. Otherwise it is pending through its due date, then missed. New invoices never affect the promise.

## 5. Discounts

- Any discount needs approval before the document can be issued: the General Manager approves (A-08).
- The discount amount, reason and approver are stored with the document.
- A Sales discount is a request and blocks issue until Owner or General Manager approves it. An Owner or General Manager discount is approved immediately. A rejected request must be removed or changed before issue (A-36).
- Invoice discounts use the same approval gate. Conversion preserves an approved discount or a pending request; a pending request still blocks issue (A-39).

## 6. Inventory

- **Units**: stock is stored as one quantity in the material's base unit: metres for fabric, and metres, cones, packets or pieces for other materials (A-25). Offcuts are not tracked.
- A fabric may have an optional roll length. Whole rolls and loose metres are derived for display only; they are not separate stock balances (A-26).
- **Fabric attributes**: colour, fabric type (cotton, silk, wax print and so on), width in inches (A-03), supplier, cost per metre.
- **Other materials**: thread, buttons, zips, lining, interfacing, elastic, labels, packaging, sweater yarns.
- **Finished goods**: tracked by size and colour.
- Stock changes only through controlled actions, never by editing a number:
  1. Goods Received Note adds stock.
  2. Material issue to the cutter reduces material stock.
  3. Sale or dispatch reduces finished goods.
  4. Returns add stock back.
  5. Stock adjustment: needs Owner approval (A-08), with a reason.
- Every change writes a stock movement row (who, when, why, before and after).
- Phase 14 (A-73 to A-75): finished goods are whole pieces by product, size, colour and location. A stock production order has no customer; after reaching Ready for delivery, Store Keeper or managers may receive no more than its remaining ordered quantity. Transfers post one outgoing and one incoming movement atomically. Finished-good adjustments wait for Owner approval before stock changes.
- Phase 14 (A-78): customer-order delivery stock movement remains OPEN under A-55 until a delivery line can identify its exact variant. Existing delivery notes do not deduct finished goods.
- General Manager and Store Keeper may request an adjustment. Only the Owner may approve or reject it; approval rechecks the current balance and is refused if a decrease would make stock negative. An Owner may create and approve in one step (A-33).
- Pending requests do not change stock. The requester may cancel their own pending request; the audit and approval histories retain the decision (A-35).
- **Low stock**: total stock across locations is *Out* at zero and *Low* when it is above zero but at or below 25% of the item's full stock level (A-04). Items without a full stock level are treated as OK.
- Material costs are visible only to Owner, General Manager and Accountant. During this phase only Owner may edit them (A-29, extending A-09).
- **Material issues (Phase 13, A-65, A-69 to A-72 ASSUMED)**: Workshop Supervisor, Owner, General Manager or Store Keeper requests material for one active order. A request has no number or stock effect. Store Keeper, Owner or General Manager issues it, assigning the next number and posting one negative `issue` movement per line atomically. An issue cannot make stock negative. The issuer may reject a request with a reason; its requester may cancel it while requested. Issuing does not move the order stage or gate Cutting.
- Store Keeper, Owner or General Manager may return unused material against an issued issue. Each positive `issue_return` movement is bounded by issued minus prior returns. Only Owner or General Manager may void an issued issue with a reason, and only before any return; the void retains its number and writes positive reversing adjustment movements. Quantities are entered manually in material base units while A-06 is OPEN. No cost or price appears on issue screens, CSV or slips for any role.

## 7. Purchasing and Goods Received Notes

- Buying is done first and recorded later (no purchase orders). Suppliers are paid in cash.
- The General Manager (or the person they appoint) receives goods and checks four things: **quantity, quality, damage, colour**.
- Any failed check marks the GRN *Discrepancy*, and the system produces a supplier notice message to send.
- Capture the supplier's own delivery note or receipt number, and attach a photo.
- A line records quantity received and quantity rejected. Only the accepted quantity (`received - rejected`) raises stock. Quantities are stored in the material base unit; fabric entered as rolls is converted to metres using its configured roll length (A-30).
- Saving posts the GRN and its stock movements atomically. Materials and quantities are then locked; notes, supplier document details, photo and notification status remain editable, while only Owner may revise unit cost (A-31, A-32).
- A discrepancy requires explanatory notes of at least 10 characters. The supplier notice is saved as a draft message; “Mark as notified” records the event but sends nothing in this phase.
- Only Owner may void a posted GRN, with a reason. Void keeps the original number and writes reversing adjustment movements marked “GRN void”. It is refused when any reversal would make current stock negative because the goods have already been used (A-31).
- Supplier documents are required unless the receiver explicitly records that no supplier document was supplied. Prototype photos are compressed to at most 800 px and 300 KB (A-34).

## 8. Orders and production

- Phase 12 uses these seven ordered business-settings stages while the owner resolves the conflict with A-02: Received, Deposit confirmed, Cutting, Sewing, Finishing and quality check, Ready for delivery, Delivered (A-57 OPEN). Screens read `order_stages`; Delivered cannot be selected by hand.
- An order begins as an unnumbered draft. Confirmation assigns the next `order` number and records the Received stage. The seed starts at order 1 because the last paper order number is unknown (A-58 OPEN). Cancellation keeps its number.
- Each order stores customer, nullable source quotation/proforma and invoice links, order and promised delivery dates, normal/urgent priority, description, notes, creator, draft/active/cancelled/completed status and current stage. Lines copy description, size, quantity, unit and unit price. No payment field is stored on the order (A-59 ASSUMED).
- Total comes from the linked non-void invoice, otherwise its source document, otherwise order lines with VAT. Paid sums non-void receipts on the linked invoice only; balance, deposit percentage, late state and days to due are derived. The deposit is met at **at least 50%** of total (A-59 ASSUMED).
- Only Workshop Supervisor, Owner or General Manager can move stages. Moving beyond Received before the deposit is met needs an Owner or General Manager approval with a reason; rejection leaves the stage in place. Every move records stage, actor, time and note. Backward moves and skipped stages need a note (A-60 ASSUMED).
- Delivered and completed derive when `GT.deliveries.summary` reports all invoice lines delivered. Ready for delivery is set by hand. Partial delivery, returns or voids update the derived position. A linked invoice is created with the Phase 8 invoice engine, and delivery notes use Phase 11 (A-61 ASSUMED).
- Only Owner or General Manager may cancel with a reason before Cutting. Cancellation at or after Cutting awaits owner direction (A-62 OPEN). Receipts on a cancelled order require handling on its invoice.
- At Ready for delivery, offer the seeded SMS template when the customer has a phone. Acceptance writes a `messages` row with status `sent (simulated)`; no external message is sent (A-63 ASSUMED).
- Orders past their due date and not delivered are **Late**. Urgent orders are flagged and sorted first, with no surcharge (A-23). Sales may see only own orders; Store Keeper and Workshop Supervisor see no prices, totals or payment figures (A-64 ASSUMED).
- Orders themselves cause no stock movement. Phase 13 Material Issues post controlled material movements for active orders (A-65 ASSUMED); finished-goods movements remain OPEN under A-55. Confirmed order line changes and their reconciliation with invoices require owner direction, so this phase locks confirmed order lines (A-66 OPEN).
- Bulk orders carry a **size breakdown** (for example 40 pieces of size 28, 60 of size 30). Single custom orders carry body measurements (bust, waist, hips, shoulder, sleeve length, inseam and others). These are saved on the order, not on the customer (A-05).
- Design photos or sketches can be attached to an order.
- Changes after confirmation: the original order is edited, and every edit is kept in a change log (what, who, when).
- Customers are told by **SMS** when an order is Ready and when it is Dispatched.

## 9. Delivery and dispatch

- Phase 11 (A-49): delivery notes are draft, issued (dispatched), delivered (confirmed), or void. They belong to one issued, non-void invoice; a number from the `delivery_note` series is assigned only on issue. Drafts can be edited or discarded. Issued and confirmed notes are locked. Each copied invoice line records quantity ordered and quantity dispatched, which may not exceed the line's remaining undelivered quantity.
- Phase 11 (A-49): invoice delivery status is derived, never stored. Per-line remaining = ordered minus dispatched plus returned across non-void notes. The overall state is `not_delivered`, `part_delivered`, or `delivered`.
- Phase 11 (A-50): dispatch is cleared when the invoice is paid, or the customer is on credit, within the credit limit, and not overdue. Otherwise Owner or General Manager release approval with a reason is required. Rejection returns the note to draft.
- Phase 11 (A-51): Owner, General Manager, Store Keeper, and Sales for their own note may confirm an issued note. A receiver name, date between delivery date and today, and received quantity on each line are required. The difference is returned quantity, with damaged, wrong size, refused, or other as reason. Only Owner or General Manager may void a draft or issued note with a reason; void releases its dispatched quantities. A confirmed note cannot be voided (A-54).
- Phase 11 (A-52, A-53): delivery notes contain no money, and Store Keeper and Workshop Supervisor see no financial amounts on delivery screens. Dispatch does not move stock in this phase (A-55).
- Phase 11 (A-56): drafts may use a future planned delivery date. Before issue, set it to a date from the invoice issue date through today. The form offers Set to today for a future draft.

- Phase 11 notes are created from one issued invoice. The print copy shows dispatched and remaining quantities, date, invoice number, contact and receiver signature fields (A-49, A-53). Order-linked notes await the Orders phase.
- Phase 11 delivery methods are delivered by us, collected by customer, or courier. Outside Kampala is allowed; record the destination and carrier or collector (A-53).
- Delivery is **not** charged to the customer.
- Partial deliveries are allowed: the system tracks quantity delivered against quantity ordered.
- Returns: record reason and quantity, then redeliver; compensation is a note (A-19).
- Proof of delivery: signature on the note, or a phone call logged by hand.

## 10. Fabric calculator (Owner only)

Table-driven (A-06). For a design, size, fabric width and style options:

1. Look up base metres for the design and size at a reference width.
2. Adjust for the chosen fabric width (wider fabric usually needs fewer metres).
3. Add the style add-ons (long sleeves, pleats, lining, extra panels).
4. Add the wastage allowance for that design.
5. Metres needed = result, times quantity.
6. Material cost = metres times the fabric's cost per metre.
7. Suggested price = material cost plus the owner's markup rule.

Seed example from the owner: sleeved shirt, large, 60 inch fabric, 1.5 m, wastage 0.10 m, giving 1.6 m.

Phase 18 uses editable rows for each step. The 60-inch width adjustment is zero; 44- and 58-inch rows are ASSUMED illustrations (A-96). Style add-ons are metres per piece; only the large sleeved shirt base and shirt wastage are Owner examples (A-97). With a stock fabric, the width matches its recorded inches, stock is read as total on-hand metres across locations (A-100), and cost uses its `cost_per_unit` (per metre). The single 30% markup is an ASSUMED illustration; both monetary results round to whole UGX (A-98). Calculations never post or reserve stock. Saving stores an unnumbered, unrelated calculation note only (A-99).

## 11. Employees and production

- Record: name, phone, NIN, address, next of kin, date of birth, date joined, role, pay type, pay rate.
- Roles: tailor, cutter, finisher, sales, cleaner, supervisor, knitter, embroidery.
- Pay types: monthly salary, or **per piece**. The system calculates both (A-12). Piece wage = pieces completed times the rate for that garment and task.
- Attendance is recorded daily.
- A daily production log records who did what on which order item and how many.
- Daily and weekly production targets are set per section. Quality problems and rework are logged against the responsible employee.
- Phase 17 working model (A-91 to A-95): the eight listed roles populate the employee register. Daily attendance and quality records do not alter gross pay. Production entries reference existing customer or stock order items, record an operator-selected garment and task, and snapshot an ASSUMED piece rate. A daily or Monday-to-Sunday weekly target sums pieces by task section. Monthly salary is fixed for each joined month; per-piece gross is the sum of task quantities times snapshotted rates. Finalisation freezes that month's lines and creates one pending Salaries expense using the Phase 15 approval path. NSSF and PAYE remain OPEN under A-12.
- A-101 OPEN: if the Owner rejects a pending Salaries expense, the pay month reopens for corrections while the rejected expense and original pay snapshot remain in history. A later finalisation creates a new pending Salaries expense. Owner confirmation is still needed for this workflow.

## 12. Expenses and petty cash

- Categories: rent, electricity, transport, salaries, materials, repairs, airtime, marketing, lunch, drinking water, allowances.
- Payments and expenditures need the Owner's approval (A-08).
- Petty cash is reconciled daily.
- Recurring monthly expenses (rent, electricity) are generated automatically as drafts.
- Receipt photos can be attached.
- Budget against actual is shown per category per month.
- Phase 15 working model (A-83 to A-86): expense requests are pending until Owner approval. Approval assigns a plain payment-voucher number and posts a cash or bank movement; rejection requires a reason and posts nothing. An Owner cancellation keeps the number and adds a reversing movement. Unnumbered drafts may be discarded.

## 13. Financial statements

- Monthly: Income Statement, Balance Sheet, Cash Flow, Debtors Report. Users: owner, accountant, URA.
- Fed by a simple ledger (A-10) built from invoices, receipts, expenses, stock and payroll.
- Financial year 1 July to 30 June; go-live is 01/01/2027, so opening balances (cash, bank, stock value, money owed to him, money he owes) are entered at go-live (A-11).
- Financial documents are never deleted.

### Phase 16 reporting scope (A-10, A-11, A-85, A-88 to A-90)

- The prototype monthly statement is a cash-book style income and expenditure summary plus cash movement. Invoice billing is a separate memo figure, never added to collected receipts. A full accrual income statement, valued balance sheet and tax return require verified opening balances and additional posting rules.
- Cash-book `debit` is money in and `credit` is money out. Receipt and approved-expense source amounts, including dated void/cancellation reversals, must reconcile to each monthly statement. A mismatch is shown as FAIL, never silently corrected.
- Opening cash and bank positions begin on 01/01/2027 and remain visibly pending until the owner supplies verified amounts (A-88). Year-to-date movement begins on that date. Pre-go-live 2026 months remain available as historical prototype movements (A-90).
- Sales reports separate issued invoice billing from non-void receipt collections, including quick sales once. Invoice garment category is Unclassified without a verified product link (A-89).
- Stock reports show on-hand quantities per material or product variant and location, with signed movement over the selected date range. Material alert status reuses the existing across-location 25% check; finished goods use variant status. They never expose costs or prices. Debtors reports use the existing receipt-derived debtors service; the date range selects invoice issue dates within the current outstanding balance.

## 14. Sales tracking

- Phase 14 (A-76, A-77): a completed quick sale uses the same receipt number series and `receipts` table as invoice payments, so daily and monthly receipt totals include it. Discount requests do not collect or move stock until approved and completed. Owner-approved voids mark the receipt void and restore stock; receipt totals then exclude it.

- Reports: daily takings, monthly totals, best-selling items, best customers, sales by employee.
- Sales targets are set per salesperson per month.
- Phase 20 (A-109, A-112): targets use active Sales user IDs, positive integer UGX and a unique person/month row. Every save appends who, when, previous and new amounts. Actual is issued, non-void invoice total by `issued_by` and invoice date, using the Phase 16 report. Reconciliation shows PASS or FAIL against its source rows; receipts and counter sales do not contribute to targets. Missing targets remain visibly unset, current incomplete targets show Not started or In progress, and incomplete past months show Missed.
- Phase 20 rankings extend the existing Sales Report. Best customers use invoice totals including VAT. Item quantities and line values include non-void invoices and completed counter sales; line values precede document discount and VAT. Free-text invoice categories remain Unclassified (A-89, A-113).
- Visibility: Owner, General Manager and Accountant see all; each salesperson sees their own volume.

## 15. Communication and marketing

- Templates: order ready, payment reminder, promotion, thank-you, new designs, supplier discrepancy notice.
- Volume is small (about 120 SMS a month). The General Manager sends bulk messages.
- Phase 10 counts SMS segments as one through 160 characters and then 153 characters per segment. Bulk reminders show eligible overdue customers and the estimated segment total. They are simulated in this prototype (A-46, A-47).
- Email goes out from genuinetextiles1@gmail.com until a custom address is created.
- Poster sizes: WhatsApp status, Instagram, Facebook. Types: promotions, price lists, event announcements.
- Campaigns run about twice a year. Record date, channel, budget, target audience and results.
- Every new customer can be tagged with "how did you hear about us".
- Phase 20 campaign budgets and manually entered results are informational. Only Phase 15 Expenses records actual spending; no campaign or target action changes a financial, wage or stock record (A-108).
- Lead-source reports count signup dates and same-period invoice values, with a monthly signup breakdown and a No source group. Seeded historical signup dates are fictional and no later than the customer's earliest document (A-111).
- Campaign links select existing nonfinancial customer messages and posters. Payment reminders and supplier notices are excluded. Campaign access follows the stricter matrix pending confirmation of A-110; lead-source and target access follows the Phase 20 role rules (A-114).
