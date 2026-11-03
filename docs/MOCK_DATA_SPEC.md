# Mock Data Spec

The prototype should look like a real business on day one. Data lives in `mock-data.js`, is loaded into browser storage through `store.js`, and can be reset from Administration. Shape follows `DATABASE_DESIGN.md`.

## The story the data must tell

A working week in late October 2026, with a peak of school-uniform orders, so every module has something to show.

| Entity | Quantity and notes |
|---|---|
| Locations | 2 (names are placeholders until A-13 is answered) |
| Users | One per role: Owner (Kibira Edward), General Manager, Store Keeper, two Sales, Workshop Supervisor, Accountant, Marketing Manager |
| Customer groups | Individual, School, Corporate, Reseller |
| Customers | About 25: mostly schools (use generic invented names), plus Pearl Dairy Farms and SR Afro Chick Breeders Ltd taken from his sample documents, some individuals and a reseller; roughly half on credit |
| Suppliers | 6: three local (one named Nytil), three importers |
| Materials | 40: cotton, drill, polyester, rain-coat, wax print and knit fabrics across 44, 58 and 60 inch widths; sweater yarns, threads, buttons, zips, lining, interfacing, elastic, labels and packaging. Eight active items are at or below 25%, including two out of stock; two materials are inactive. |
| Finished goods | Phase 14 seeds 12 variants across school, corporate, industrial, hospitality, medical and sweater categories, with low and out variants at both placeholder locations (A-73). |
| Quick sales | Seven issued counter sales from 19â€“27 Oct 2026 across Sales and General Manager users; receipts 2074â€“2080 share the paper receipt sequence, next 2081 (A-76). |
| Quotations / proformas | 10 each, including the Pearl Dairy Farms quotation and the SR Afro Chick Breeders proforma |
| Phase 7 numbered history and drafts | Ten numbered quotations (089â€“098) and ten numbered proformas (087â€“096), plus one unnumbered draft of each type (A-36); quotation 098 and proforma 096 match the supplied documents. Both next numbers remain 099 and 097. |
| Invoices | 30 numbered 615â€“644, plus 2 unnumbered drafts; 16 paid, 11 part paid, 2 unpaid, 1 void; next 645 |
| Receipts | 45 invoice-payment receipts numbered 2029â€“2073, including two voided corrections, followed by seven Quick Sale receipts 2074â€“2080; next 2081. Method references use plausible, unique Mobile Money, bank and cheque formats. |
| Orders | Phase 12 seeds 12 linked to existing quotations, proformas and invoices across all seven stage positions: two late, one urgent, one pending deposit approval, one cancelled, two completed through delivery notes and one unnumbered draft (A-57). A later fuller demo may reach 20 orders after the owner confirms the stages. |
| Delivery notes | Ten numbered notes 2046-2055 with delivered, issued and void states, one unnumbered future-dated draft, a partial dispatch and a returned quantity. Next number 2056. At least three issued invoices have nothing delivered; one cash invoice has a balance that needs release approval. |
| GRNs | 8 numbered 0001â€“0008 across three months, with 12 item lines; one discrepancy with rejected stock and a draft supplier notice, and one without a supplier document |
| Stock adjustments | 5: two pending, two approved with movements and approvals, one rejected with a decision note |
| Material issues | Phase 13: eight linked to seeded active orders; six issued, including one partly returned, one requested and one rejected. Numbers 1â€“6 are consumed; next 7. |
| Debtors | Exactly 13 customers owe money: 5/4/4 by oldest invoice age on 26 Oct 2026. Seven have historical contact; six have none, including one overdue account. |
| Statements | Three locked snapshots: Pearl Dairy Farms dated 25 May 2026 with one line for fiscal document 1253652875875, gross and due UGX 21,240,000, no advance, and signatory Kibira; two other debtor letters, one void. |
| Debt reminders | 25 mixed SMS, email and call rows, each electronic row matched by a simulated message. Pearl has all three channels. Two calls contain promises, one pending and one missed; two customers have a recent electronic reminder. October SMS usage is 20 segments. |
| Expenses | Phase 15 seeds 15 across August to October 2026: 11 approved, two pending, one rejected with a reason, and one cancelled with a reversal. Recurring rent and electricity appear as dated history; automatic draft generation awaits owner rules (A-86). |
| Phase 16 reports | Derive every report from the existing invoice, receipt, quick-sale, stock, debtor, expense and cash-book rows. No duplicate report totals are seeded. Cash and bank opening balances at 01/01/2027 remain pending (A-88); 2026 monthly movements remain inspectable (A-90). Invoice garment categories remain Unclassified unless a product link exists (A-89). |
| Employees | 26 across the eight BUSINESS_RULES section 11 roles, with fake PROTO-NIN identifiers and a mix of salary and per-piece pay (A-91). The previous two Store Keeper and Marketing user roles remain users, outside this employee register pending owner confirmation. |
| Attendance and production logs | Two October 2026 working weeks of daily attendance, six order-item production entries, one rework issue, ten task-section targets and a small ASSUMED garment/task rate table (A-92 to A-94). No payroll run or Salaries expense is pre-finalised. |
| Fabric calculator | Four school-uniform designs and three sizes each. The large sleeved shirt at 60 inches has 1.50 m base, zero width adjustment and 0.10 m wastage, totaling exactly 1.60 m (Owner example). Other base rows, 44/58-inch width changes, style add-ons, other wastage and 30% markup are ASSUMED illustrations (A-96 to A-98). Saved notes start empty (A-99). Existing fabric materials and material_stock provide width, cost and on-hand metres. |
| Campaigns | 4 (two a year, past and planned) |
| Phase 20 campaigns, leads and targets | Seed 20.0.1 has two fictional 2025 campaigns and two 2026 campaigns, with Finished, Running and Planned states. Budgets and results have no financial postings. Two October Sales user targets have initial history; customer signup dates run April to October 2026 and precede their earliest documents, with three customers having no lead source. Saved campaign message/poster links start empty. |
| Messages | 30 in the log |
| Phase 19 templates and posters | Six editable message templates use customer, order and business placeholders where relevant. Their manager approval defaults to approved until Marketing edits one. Posters start empty; users save them through Poster Studio (A-102, A-105). |

## Rules for seed data

- Phase 12 order links add no invoice, receipt or delivery quantities, so the 13 debtors and 5/4/4 ageing split remain unchanged (A-59).
- Phase 13 issues add negative `issue` movements and one positive `issue_return` at location 1. Matching `material_stock` balances stay nonnegative. Invoice, receipt and delivery rows and the 13-debtor 5/4/4 split remain unchanged (A-69).
- Totals must add up exactly; VAT is 18% of the subtotal; amount in words must match.
- Receipt totals per invoice never exceed the invoice total.
- Invoice 640 is Pearl Dairy Farms' 28 Apr 2026 raincoat debt: 400 pcs Ã— UGX 45,000, VAT UGX 3,240,000, total UGX 21,240,000, fiscal number 1253652875875. Invoice 641 converts proforma 096 and has a UGX 2,708,100 deposit against UGX 5,416,200 total.
- Exactly 13 customers owe money: 5 aged 0â€“30 days, 4 aged 31â€“60 days and 4 aged 61+ days by oldest unpaid invoice on 26 Oct 2026. Pearl Dairy Farms and Unity Gate College exceed their credit limits (A-40).
- The two voided receipts have reasons â€œWrong amount enteredâ€ and â€œWrong invoice selectedâ€. Their replacement payments keep every invoice paid total and the 13 customer balances and 5/4/4 ageing split unchanged (A-41).
- Stock quantities must agree with the sum of the stock movements.
- Each material has base-unit stock at both placeholder locations and an opening movement. Selected materials also have GRN-linked receipt and issue movements across July to October 2026; approved adjustment movements are included in the matching balances.
- The GRN sequence starts at 0009 after the eight seeded documents.
- Dates use the real calendar week around 22 October 2026 and earlier months.
- Use the Uganda shilling, no decimals, plausible prices (for example raincoats 45,000, trousers 30,000 to 40,000, T-shirts 25,000).
- Never include real people's phone numbers or NINs: generate fake ones.

