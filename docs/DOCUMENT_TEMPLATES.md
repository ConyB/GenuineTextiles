# Document Templates

All documents print on **A4**. Use the newer letterhead (as on the quotation, proforma and statement of account) for every system-generated document (A-17).

## Common letterhead

- Left: logo (diamond with uniformed people). File: `assets/images/logo.png` (to be replaced by the clearer version).
- Business name "GENUINE TEXTILES" in bold brand blue, tagline "Your Quality Uniforms Factory" in red italic, address "Located at Nasser Road, Mirembe Arcade, Last Floor Room K07-8-9, P.O. Box 26198 Kampala Uganda".
- Right: phone numbers (+256 704 653 045 / +256 782 653 045 / +256 700 685 476 / +256 704 332 806).
- Thin brand blue rule under the header; the statement of account also uses a red and blue stripe and a blue footer bar with the phone numbers.
- All header values come from Business Settings, never hard-coded.
- **CONFIRMED by owner (Phase 4):** invoices and receipts include the logo, TIN, bank details, terms, signature and a clearly marked stamp area.

## 1. Quotation

| Area | Fields |
|---|---|
| Top | Number (red, e.g. NO: 099), title box "QUOTATION", date (22 OCT 2026 style) |
| Client | CLIENT: customer name |
| Table | SL, Description, Size, Qty (with unit, for example 200 pcs), Unit Price (45,000/=), Amount |
| Totals | Sub-Total, VAT 18%, TOTAL |
| Words | Amount in words |
| Bank block | Bank Account, Account Name, Bank (from settings) |
| Terms | "Price Validity: 14 Days from date of the Quotation, subject to change basing on the prevailing exchange rate." |
| Sign-off | Authorised Signatory (name and signature) |

Quotation and proforma tables show at least eight body rows using blank filler rows. Longer item lists grow and repeat the header across A4 pages. Draft and void copies carry matching watermarks; the preview alone warns when bank account or TIN settings still contain placeholders (A-36).

## 2. Proforma

Same layout as the quotation, title box "PROFORMA", no validity terms line (A-15). Quantity units can be "pairs" or "pcs".

## 3. Invoice

Based on his pad invoice (No. 644) and the newer table style.

| Area | Fields |
|---|---|
| Top | Title "INVOICE", Number, Date |
| Tax identity | Business TIN from Business Settings |
| Customer | M/S: customer name and address |
| Reference | Optional free-text order reference (A-37), optional Fiscal Document No. (A-01) |
| Table | Qty with unit, Particulars (description and size unless All), Rate, Amount; at least 12 rows including blank filler rows, with repeating header on later pages |
| Totals | Sub-total, discount (if any), VAT 18%, TOTAL, "E&OE" |
| Terms line | Cash setting "All accounts are due on demand", or credit terms setting with the computed due date (A-37) |
| Words | Amount in words |
| Bank block | As on quotation |
| Sign-off | Signature, "For: Genuine Textiles", and a clearly marked stamp area; the dashed stamp guide appears in preview but its border does not print (CONFIRMED by owner) |

Invoice totals, words, bank details and sign-off stay together on A4. Draft and void copies carry watermarks. A preview warning outside the page flags placeholder bank account or TIN details (A-37).

## 4. Receipt

Based on pad receipt No. 2073.

| Area | Fields |
|---|---|
| Top | Number, title "RECEIPT", Date |
| Tax identity | Business TIN from Business Settings |
| Body | Received with thanks from (customer), The sum of shillings (in words), Being payment of (invoice reference and description) |
| Payment | Cash / Cheque no. (method and reference), Balance, Shs. box with the amount in figures |
| Sign-off | Authorised Sign, "For: Genuine Textiles", "With thanks", and a clearly marked stamp area (CONFIRMED by owner) |

The pad-style A4 layout uses the shared letterhead; boxed RECEIPT title; red “No. 2074”; date; “Received with thanks from”; “The sum of shillings” with the exact amount in words; “Being payment of”; “Cash / Cheque No.” with method and reference; historical “Balance”; a boxed “Shs.” figure; TIN; Authorised Sign; “For: Genuine Textiles”; “With thanks”; and the same dashed company stamp guide as the invoice. Preview offers one receipt per page or two labelled Customer and Office copies on one page, separated by a dashed cut line. Void copies carry the VOID watermark. Placeholder warning appears in preview only (A-41).

Phase 14 quick sales use this same A4 receipt component and receipt series. Their "Being payment of" identifies the quick sale; the invoice line is omitted because there is no invoice (A-76).

## 5. Delivery Note

Based on pad delivery note No. 2055.

| Area | Fields |
|---|---|
| Top | Number, title "DELIVERY NOTE" |
| Left block | To (customer), Address |
| Right block | Your Order No., Date Sent, Per Invoice No., Our Contact Person, Telephone |
| Table | Quantity delivered, Description (blank rows allowed) |
| System additions | Delivery method, rider or vehicle, destination, quantity ordered and balance remaining |
| Receiving block | "Goods Received In Good Order": Name, Signature, Date |

Phase 11 (A-49, A-51, A-52, A-53): the A4 system copy uses the shared letterhead, a red note number, customer and invoice references, delivery date, destination, delivery method and carrier/collector details. The item table has description, size, ordered quantity, dispatched now and balance still to deliver. Delivered-by and received-by signature lines and the company stamp area follow. The preview offers Original and an Original + Duplicate pair separated by a cut line. A void copy has a VOID watermark. No price, payment or invoice balance appears on a delivery note, including print and CSV. The Dispatch Log prints as a register, not as a delivery note.

## 6. Statement of Account (demand letter)

Based on his letter dated 25.05.2026.

| Area | Fields |
|---|---|
| Header | Letterhead with red and blue stripe |
| Date | dd.mm.yyyy |
| Addressee | The Finance Manager (or named contact), customer name |
| Salutation | "Dear Sir / Madam" |
| Subject | "REF: STATEMENT OF ACCOUNT" |
| Intro | Polite request for payment of goods already supplied, referring to the fiscal document numbers below |
| Table | Fiscal Document Number (or invoice no.), Particulars, Delivery Date, Gross Amount, Advance, Gross Amount Due |
| Total | TOTAL GROSS AMOUNT DUE |
| Sign-off | Yours faithfully, name, Authorised Signature |
| Footer | Blue bar with all phone numbers |

Phase 10 (A-45, A-48): the stored statement includes date, addressee title/name, editable intro, signatory snapshot and selected invoice line snapshots. Delivery date and particulars may be edited before issue. The fiscal document reference falls back to the invoice number. The issue copy is locked; a void copy carries a VOID watermark. Statements remain unnumbered pending owner confirmation. A settings placeholder warning appears beside the preview, never on the printed page.

## 7. Goods Received Note (new)

| Area | Fields |
|---|---|
| Header | Shared letterhead, title “GOODS RECEIVED NOTE”, number, date, supplier, supplier delivery note or receipt no. |
| Table | Material, colour, width, quantity received, quantity rejected, quantity accepted, unit, and unit cost only for cost-authorised roles |
| Checks | Quantity, quality, damage, colour: OK or Issue for each |
| Notes | Discrepancy details, "supplier notified" tick |
| Sign-off | Received by, signature line |

Voided GRNs retain the same content and show the diagonal VOID watermark. Cost columns are omitted entirely for Store Keeper and every other role without cost visibility.

## 8. Material Issue Note (new)

Phase 13 A4 slip: common letterhead, number, issue date, order number, customer, table of material with issued and returned quantity in its base unit, and sign-off boxes for Issued by, Received by and Returned. No cost, price or money (A-69 to A-72).

## 9. Order job card (Phase 12, A-57)

The A4 Original uses the shared settings-driven letterhead, title JOB CARD, order number, customer, promised delivery date and priority. Its line table contains description, size and quantity only. Below it are a handwriting notes area and sign-off boxes for Received, Deposit confirmed, Cutting, Sewing, Finishing and quality check, and Ready for delivery. It has no prices, totals, payment amounts or duplicate copy. Delivered remains derived from delivery notes.

## Payment voucher (Phase 15, A-83)

The A4 voucher uses the shared settings-driven letterhead, plain number assigned on Owner approval, payment date, payee, category, description, cash or bank source, UGX amount and amount in words. It has Recorded by, Approved by and Received by signature lines. A cancelled voucher retains its number and prints a VOID watermark and cancellation reason. No paper sample or last number was supplied.

## Print rules

Phase 20 reports are unnumbered A4 portrait copies on the shared letterhead. Campaign Summary includes name, type, channel, dates, status, audience, planned budget, manually entered results, notes and linked message/poster labels; it states that actual spending uses Expenses. Lead Source Report prints the selected period, cohort basis, source counts and invoice values, followed by monthly signup rows. Monthly Sales Targets prints month, salesperson, target, actual, shortfall/surplus, percentage/status and reconciliation PASS or FAIL. Sales copies contain only their own target. All access checks follow A-110, and no document sequence is consumed.

Phase 18 fabric calculations print as unnumbered A4 portrait reports with the shared settings-driven letterhead. The report lists design, size, fabric, width, quantity, each metre step, per-piece and total metres, optional on-hand stock check, material cost and suggested price. It repeats the visible A-06 illustration notice and states that stock was not posted or reserved. There is no document number or signature block (A-99).

Phase 17 (A-12, A-94, A-95): the A4 monthly gross pay summary is an unnumbered report on the shared letterhead. It shows month, employee, pay type, salary, piece pay, gross pay, total gross and the open NSSF/PAYE note. The expense voucher, if later approved, remains the separate Phase 15 document.

- Phase 16 report copies use the shared settings-driven letterhead on A4 portrait, a report title and selected period. Sales, Stock and Debtors reports print their filtered aggregate or quantity rows; the monthly cash-book statement prints income, expenditure, movement, pending opening position and reconciliation followed by source movements. These are reports, not numbered financial documents (A-88 to A-90).

- A4 portrait, margins about 12 mm, `@media print` hides sidebar, topbar and buttons.
- Row count adapts: long documents continue on a second page with repeated table header.
- Totals stay together with the signature block; never split across pages.
- Voided documents show a diagonal VOID watermark.
