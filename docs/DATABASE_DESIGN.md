# Database Design (draft)

Purpose: the prototype's mock data must be shaped like these tables so the Laravel conversion is mostly mechanical.

## Conventions

- Table names plural snake_case, columns snake_case, integer `id` primary keys, foreign keys named `<table>_id`.
- Money as integer UGX. Quantities as decimals (3 places) because fabric is in metres.
- Every table has `created_at`, `updated_at`. Financial and stock tables are never hard-deleted (void or reverse instead).
- Status fields use short fixed strings listed below.
- `location_id` appears wherever stock or sales could differ per location (A-13).

## Access and settings

| Table | Key columns |
|---|---|
| users | id, name, email, phone, password, password_is_prototype, role_id, location_id, active |
| roles | id, name (owner, general_manager, store_keeper, sales, workshop_supervisor, accountant, marketing_manager) |
| locations | id, name, type (shop, workshop, store), address |
| business_settings | key, value (name, trading name, tagline, slogan, address, P.O. Box, phones, emails, website, TIN, VAT rate, bank block, document defaults, logo paths) |
| document_sequences | document_type, next_number, padding |
| audit_logs | id, user_id, action, entity_type, entity_id, before_json, after_json, created_at |
| approvals | id, type (discount, credit_limit, delivery_release, order_stage, void, stock_adjustment, expense, material_issue), entity_type, entity_id, requested_by, approved_by, status, reason, target_stage (order_stage only) |

## People and partners

| Table | Key columns |
|---|---|
| customer_groups | id, name (individual, school, corporate, reseller) |
| customers | id, name, contact_person, phone, email, address, customer_group_id, is_credit, credit_limit, credit_days, lead_source_id, notes, active (default true) |
| suppliers | id, name, contact, phone, email, location, supplies, categories_json, notes, type (local, import), active (default true) |
| employees | id, name, phone, nin, address, next_of_kin_name, next_of_kin_phone, date_of_birth, date_joined, date_left (nullable, A-91), role, pay_type (salary, piece), monthly_salary, user_id (nullable), active |

## Inventory

| Table | Key columns |
|---|---|
| materials | id, name, category (fabric, yarn, thread, accessory, packaging), subtype (nullable: buttons, zips, lining, interfacing, elastic, labels), unit (metre, cone, packet, piece), colour, fabric_type, width_inches, supplier_id, cost_per_unit, full_stock_level, roll_length_m (nullable), notes, active (default true) |
| material_stock | id, material_id, location_id, quantity (in the material's base unit) |
| products | id, name, garment_type, category (school, corporate, industrial, hospitality, medical, sweater), price, active |
| product_variants | id, product_id, size, colour, quantity, location_id, full_stock_level |
| finished_good_adjustments | id, product_variant_id, direction, quantity, reason, status (pending, approved, rejected), requested_by, requested_at, decided_by, decided_at, decision_note, movement_id |
| stock_movements | id, item_type (material, product_variant), item_id, location_id, movement_type (opening, grn, issue, issue_return, sale, return, adjustment, received_from_production, transfer_out, transfer_in), quantity (signed), before_qty, after_qty, reference_type, reference_id, user_id, note |
| goods_received_notes | id, number, supplier_id, supplier_doc_no, supplier_doc_missing, location_id, received_by, received_at, quantity_ok, quality_ok, damage_ok, colour_ok, status (ok, discrepancy, void), supplier_notified, supplier_notified_at, notes, photo_data, void_reason, voided_by, voided_at, created_by |
| grn_items | id, grn_id, material_id, quantity_received, quantity_rejected (default 0), unit_cost (nullable) |
| stock_adjustments | id, material_id, location_id, direction (increase, decrease), quantity, reason (stock_count_correction, damaged, lost, found, other), note, status (pending, approved, rejected), requested_by, requested_at, decided_by, decided_at, decision_note, movement_id |
| material_issues | id, number (nullable until issued), order_id, location_id, status (requested, issued, rejected, cancelled, void), requested_by, requested_at, issued_by, issued_at, decision_note, notes |
| material_issue_items | id, material_issue_id, material_id, quantity (base unit), note, returned_quantity (derived from return movements), active (superseded request lines are inactive) |

## Sales and documents

| Table | Key columns |
|---|---|
| sales_documents | id, type (quotation, proforma, invoice), number (nullable until issue), customer_id, customer_name, customer_address, customer_phone (issue snapshots), order_id (nullable until Orders), order_reference (optional free text, A-37), source_document_id (nullable), issue_date, valid_until, due_date, subtotal, discount_amount, discount_reason, discount_status (none, requested, approved, rejected), discount_requested_by, discount_approved_by, credit_override_approved_by (nullable, A-38), vat_rate, vat_amount, total, amount_in_words, fiscal_document_no (nullable, A-01), status (draft, issued, void, discarded), issued_at, issued_by, voided_reason, voided_at, voided_by, discarded_at, discarded_by, notes (internal), terms_text (printed), created_by, location_id |
| sales_document_items | id, sales_document_id, description, size, quantity, unit, unit_price, amount, active (removed draft lines remain inactive for history) |
| receipts | id, number, customer_id (nullable for quick sale), customer_name (save snapshot), invoice_id (nullable for quick sale, otherwise required), amount (integer UGX), payment_method (cash, mtn, airtel, bank, cheque), reference, description (Being payment of), balance_after (save snapshot), received_by, received_at, status (issued, void), void_reason, voided_by, voided_at |

Receipt rows are issued and numbered when saved, then locked (A-41). Invoice payment status remains derived from non-void invoice-linked receipts rather than stored. An invoice payment receipt references exactly one invoice; a quick sale receipt has no invoice (A-76). Multi-invoice allocation and cheque clearing remain open (A-43, A-44).
| quick_sales | id, receipt_id (nullable before completion), location_id, cashier_id, sale_date, status (pending_discount, ready, issued, void_pending, void, rejected), subtotal, discount_amount, discount_reason, discount_status, vat_rate, vat_amount, total, payment_method, reference, amount_received, change_due, void_reason, voided_by, voided_at |
| quick_sale_items | id, quick_sale_id, product_variant_id, description, size, colour, quantity, unit_price, amount |
| delivery_notes | id, number (nullable draft), customer_id, invoice_id, delivery_date, delivery_method (delivered_by_us, collected_by_customer, courier), carrier_or_collector_name, phone, delivery_address, contact_person, contact_phone, notes, dispatched_by, created_by, status (draft, issued, delivered, void), release_approved_by, issued_at, received_by, received_date, confirmed_by, confirmed_at, void_reason, voided_by, voided_at, discarded_at |
| delivery_note_items | id, delivery_note_id, sales_document_item_id, description, size, quantity_ordered, qty_dispatched, qty_received, qty_returned, return_reason |
| statements | id, customer_id, statement_date, addressee_title, addressee_name, intro_text, signatory_name, lines_json (invoice_id, document_ref, particulars, delivery_date, gross_amount, advance, amount_due), total_gross, total_advance, total_due, created_by, created_at, status (issued, void), void_reason |
| debt_reminders | id, customer_id, invoice_ids_json, channel (sms, email, call), message_id (nullable), message_text, outcome (sent, no_answer, promised, refused, other), promise_date (nullable), promise_amount (nullable), balance_at_reminder, override_reason (nullable), sent_by, sent_at |

Phase 10 (A-45 to A-48): debtor balances and ageing are never columns. They derive from issued invoices and non-void receipts. `statements` and `debt_reminders` are protected against hard deletion. Statement lines and signatory are issue-time snapshots; statements have no number pending A-48. SMS and email create matching `messages` rows with status `sent (simulated)`. The reminder-time balance snapshot is historical only; promise evaluation sums later non-void receipts, so new invoices cannot affect it.

## Orders and production

| Table | Key columns |
|---|---|
| order_stages | id, name, sort_order, active |
| orders | id, number (nullable draft), customer_id (nullable for stock order), source_document_id (quotation/proforma, nullable), invoice_id (nullable), order_date, due_date (promised date), priority (normal, urgent), description, notes, created_by, location_id, status (draft, active, cancelled, completed), current_stage, stage_id, cancellation_reason, is_for_stock (default false), product_variant_id (stock order only) |
| order_items | id, order_id, description, size, quantity, unit, unit_price; later garment_type, size_breakdown_json, measurements_json, fabric_material_id |
| order_stage_history | id, order_id, stage_id, stage, changed_by, changed_at, note |
| order_changes | id, order_id, field, old_value, new_value, changed_by, changed_at |
| order_attachments | id, order_id, file_path, caption |
| designs | id, name, garment_type |
| fabric_rules | id, design_id, size, reference_width_inches, base_metres, source (Owner example, ASSUMED illustration) |
| fabric_width_adjustments | id, reference_width_inches, width_inches, adjustment_metres, source |
| fabric_rule_adjustments | id, design_id, option_name (long sleeves, pleats, lining, extra panel), extra_metres, source |
| fabric_wastage_rules | id, design_id, wastage_metres, source |
| fabric_markup_rules | id, markup_percent, source (one editable row) |
| fabric_calculations | id, design_id, size, fabric_id (nullable), width_inches, option_ids, quantity, metres_per_piece, total_metres, material_cost (nullable), suggested_price (nullable), note, created_by |
| production_logs | id, work_date, employee_id, order_item_id, garment_type, task, quantity, piece_rate, amount |
| quality_issues | id, order_item_id, employee_id, description, rework_needed, logged_by, logged_at |
| production_targets | id, section, period (daily, weekly), target_quantity |
| attendance | id, employee_id, work_date, status (present, absent, late, leave) |
| piece_rates | id, garment_type, task, rate (integer UGX), assumed (A-92) |
| payroll_runs | id, month, status (finalised, reopened), expense_id, finalised_by, finalised_at, reopened_by (nullable), reopened_at (nullable); payroll_lines: id, payroll_run_id, employee_id, basic_pay, piece_pay, allowances, gross_pay |

## Finance

| Table | Key columns |
|---|---|
| expense_categories | id, name |
| expenses | id, expense_date, category_id, amount, payee, payment_method (cash, bank), description, receipt_photo_path, status (draft, pending, approved, rejected, cancelled, discarded), voucher_number (nullable), recorded_by, approved_by, approved_at, rejection_reason, cancelled_by, cancelled_at, cancellation_reason, is_recurring (A-83, A-84) |
| petty_cash_entries | id, entry_date, type (top_up, spend), amount, description, closing_balance |
| budgets | id, month, category_id, amount |
| accounts | id, code, name, type (asset, liability, equity, income, expense) |
| ledger_entries | id, entry_date, account_id, debit, credit, reference_type, reference_id, narration |
| opening_balances | id, account_id, amount, as_at |
| sales_targets | id, user_id, month (YYYY-MM), target_amount (positive integer UGX; unique user_id and month) |
| sales_target_history | id, sales_target_id, user_id, month, previous_amount, target_amount, changed_by, changed_at |

## Communication and marketing

| Table | Key columns |
|---|---|
| message_templates | id, name, channel, body |
| messages | id, channel (sms, email, whatsapp), recipient_name, recipient_contact, template_id, body, status, sent_by, sent_at, reference_type, reference_id |
| posters | id, title, template, size_preset, content_json, created_by |
| campaigns | id, name, type, channel, start_date, end_date, budget, target_audience, status, notes, leads_gained, orders_won, sales_value, result_notes, message_ids, poster_ids, created_by |
| lead_sources | id, name (social media, WhatsApp, referral, exhibition, other) |

## Statuses to standardise

- Sales documents: draft, issued, part_paid, paid, expired, void.
- Orders: draft, active, cancelled, completed; seven `order_stages` rows in `sort_order` (A-57). Stage and completion are synchronised from delivery; is_late, paid, deposit_percent, balance and delivery status are calculated, never stored (A-59 to A-61).
- Delivery notes: draft, issued, delivered, void. `part_delivered` is a derived invoice delivery state, not a delivery note state (A-49).
- GRN: ok, discrepancy, void.
- Stock adjustments: pending, approved, rejected.
- Expenses: draft, pending, approved, rejected, cancelled, discarded (A-84). Approval represents the recorded payment until the owner defines a separate payment step.

## Phase 5 inventory model decisions (ASSUMED)

- Stock is stored as one decimal `quantity` in the material's base unit. Fabric uses metres; other materials use cones, packets, pieces or metres as appropriate (A-25).
- `roll_length_m` is optional display metadata. Rolls plus loose metres are derived from the metre quantity and are never stored as a second balance (A-26).
- Material categories and accessory subtypes use fixed, extendable constants; opening balances use the `opening` movement type (A-27 and A-28).
- Cost fields are stored on materials but visible only to Owner, General Manager and Accountant, and editable only by Owner in this phase (A-29, extending A-09).

## Phase 6 receiving and adjustment model decisions (ASSUMED)

- GRN quantities are persisted in the material's base unit. `quantity_received - quantity_rejected` is the accepted quantity posted to stock; fabric entered as rolls is converted with `roll_length_m` before storage (A-30).
- Saving a GRN posts it immediately. Its material and quantity fields are immutable; corrections use an Owner void with reversing adjustment movements, and void is refused if the reversal would make stock negative (A-31).
- GRN unit cost is optional. Owner and General Manager may enter it while creating; only Owner may edit it later; Accountant may view it; operational roles never receive cost fields or exports (A-32).
- Stock adjustments are protected request records tied to an `approvals` row. Only Owner approval creates the stock movement; an Owner-created request is approved in the same operation (A-33).
- Delivery photos are compressed data URLs in `photo_data` for this prototype only; the production system should replace this with managed file storage (A-34).
- A requester cancellation is represented by the terminal `rejected` status with decision note “Cancelled by requester” (A-35).

## Phase 13 material issue model decisions (ASSUMED)

- An issue belongs to one active order and one stock location. `number` remains null while requested and is assigned by the `material_issue` sequence only after a successful atomic issue. The current seeded sequence starts at 1 because the paper series is unknown (A-68, A-69).
- Active issue lines store requested base-unit quantity and optional note. Editing a request marks superseded protected lines inactive. Issuing writes one negative `issue` movement per active line. `returned_quantity` is derived from positive `issue_return` movements referenced to the line; it is not independently editable (A-69, A-70).
- Rejected and cancelled requests retain their records but never change stock. A void retains its number and writes positive `adjustment` movements referenced as `material_issue_void`; it is unavailable after any return. Issuing does not change order stage or gate Cutting (A-70, A-71).
