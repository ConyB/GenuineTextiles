# Role and Permission Matrix

## Roles

| Role | Who | Notes |
|---|---|---|
| Owner | Kibira Edward | Sees everything; final approver |
| General Manager | Manager of the business (A-07) | Runs daily operations; receives goods; approves discounts and material issues |
| Store Keeper | Store | Store modules only |
| Sales | Salespeople | Own sales only; counter sales |
| Workshop Supervisor | Production supervisor | Moves orders between stages; workshop performance only |
| Accountant | Not hired yet; role built now | Store, sales, debtors, finance |
| Marketing Manager | Marketing | Communication and marketing |

Cutters, tailors, finishers, knitters and cleaners do **not** use the system.

## Codes

V = view, C = create, E = edit, A = approve, X = no access.
"Own" means only records the user created.

## Matrix

Receipts lock on save in Phase 9. In the Receipts row, `E` means a reasoned void action only; Owner and General Manager may void, while Sales can view only receipts they issued and cannot void (A-41).

| Module | Owner | Gen. Manager | Store Keeper | Sales | Workshop Sup. | Accountant | Marketing Mgr |
|---|---|---|---|---|---|---|---|
| Dashboard (full) | V | V | X | X | X | V | X |
| Dashboard (role summary) | V | V | V | V (own) | V | V | V |
| Customers | VCEA | VCE | X | VC | V | V | V |
| Quotations, proformas | VCEA | VCE | X | VC (own) | X | V | X |
| Invoices | VCEA | VCEA | X | VC (own) | X | V | X |
| Discounts on documents | A | A | X | request | X | X | X |
| Void or correct invoice | A | A | X | X | X | X | X |
| Receipts | VCEA | VCE | X | VC (own) | X | V | X |

| Quick sale (POS) | V | VC | X | VC (own) | X | V | X |

Phase 14 (A-77): Owner may approve quick-sale discounts and void requests from Quick Sales detail despite view-only sale permission. General Manager may approve discounts. Only General Manager and Sales create counter sales; Sales sees only sales they created. Finished Goods uses Materials and stock view permissions; Owner, General Manager and Store Keeper may request its adjustments and receive stock production, while only Owner decides adjustments. Workshop Supervisor may move stock production stages but sees no selling price on Finished Goods screens.
| Orders and Production Board (A-64) | VCEA | VCE + stage approval | V | VC (own) | V + move stages | V | X |
| Production and workshop performance | V | V | X | X | VCE | X | X |
| Fabric calculator | VCE | X | X | X | X | X | X |

Phase 18 keeps the calculator and every rule-edit and saved-note route Owner only. This is narrower than the general cost visibility rule (A-09): General Manager and Accountant may see material cost in their permitted inventory screens but cannot access calculator estimates or suggested prices. No calculator values are exposed in navigation, page content, print or CSV for other roles.
| Materials and stock | VCEA | V | VCE | X | V (no cost) | V | X |
| Stock adjustments | VCA | VC (request) | VC (own requests) | X | X | X | X |
| Material issues (A-72) | VCEA + issue/return/void | VCE + issue/return/void | VC + issue/return | X | VC (own requests) | V | X |
| Goods received notes | VCEA | VC | VC | X | X | V | X |
| Suppliers | VCE | VCE | VC | X | X | V | X |
| Delivery notes and dispatch log (Phase 11, A-52) | VCEA | VCE + release approval | VC + confirm | VC (own) + confirm own | V | V | X |

Store Keeper and Workshop Supervisor see no amounts on any delivery screen, preview, print or CSV. The Dispatch Log is read-only for every permitted role. Owner and General Manager alone approve release and void unconfirmed notes (A-50, A-51).

Phase 12 (A-64): Production Board is read-only for every role that can view Orders. Only Owner, General Manager and Workshop Supervisor move stages; Sales cannot approve. Only Owner and General Manager cancel before Cutting or decide a deposit override. Store Keeper and Workshop Supervisor see no order price, total or payment figure on list, detail, board, CSV or A4 job card. Their deposit display is limited to Deposit met/not met and Approval needed/Cleared.

Phase 13 (A-72): Owner and General Manager create requests, issue, reject, return and void. Store Keeper creates, issues, rejects and returns, but cannot void. Workshop Supervisor creates and views only own requests, and may cancel one while requested. Accountant views material issues. Sales and Marketing Manager have no access. Every role sees quantities only; no issue screen, print or CSV includes money.
| Debtors, ageing, statements | VCEA | VCE | X | X | X | VC | X |
| Payment reminders (send and log calls) | VC | VC | X | X | X | VC | X |
| Expenses and petty cash | VCEA | VC | X | X | X | VC | X |
| Payments / expenditures approval | A | X | X | X | X | X | X |
| Budgets | VCEA | V | X | X | X | VC | X |
| Financial statements | V | V | X | X | X | V | X |
| Sales reports | V | V | X | X | X | V | X |
Phase 16 narrows Sales Reports to Owner, General Manager and Accountant because the combined report contains invoices and payments. The Stock Report is quantity-only for Store Keeper and Workshop Supervisor, including print and CSV. No money report is visible to Sales.
| Employees, attendance, piece log | VCEA | VCE | X | X | VC (log, attendance) | V | X |
| Wages and payroll | VCEA | VC (finalise) | X | X | X | VC (finalise) | X |

Phase 17 (A-91 to A-95): Owner and General Manager create and edit employees, including personal details and pay terms. Accountant views pay types, rates and gross summaries and may finalise; only Owner and General Manager see NIN, phone and next of kin. Workshop Supervisor views names and work roles, takes attendance and logs production or quality without rates, pay or money in any screen, CSV or print. Owner and General Manager also enter attendance and production; only they change targets. Sales, Store Keeper and Marketing Manager cannot open People routes. A finalised month can create one pending Salaries expense; only Owner decides it through Expenses.
| Messages (single) | V | VC | X | VC | X | VC | VC |
| Bulk messages | V | VC | X | X | X | X | request |
| Poster studio | V | V | X | X | X | X | VCE |
| Marketing campaigns | V | V | X | X | X | X | VCE |

Phase 20 (A-110): the requested stricter rule preserves the Marketing campaigns row above. Marketing Manager creates and edits campaigns; Owner and General Manager view only; Sales and Accountant have no campaign access pending owner confirmation. Lead Sources is read-only for Owner, General Manager, Accountant and Marketing Manager. Owner and General Manager set sales targets; Accountant reads the team summary; Sales reads only their own target and progress. Store Keeper and Workshop Supervisor have no Phase 20 routes. Campaign message links exclude payment reminders and supplier notices (A-114).
| Users and roles | VCEA | X | X | X | X | X | X |
| Settings and numbering | VCEA | V | X | X | X | X | X |
| Audit log | V | V | X | X | X | V | X |

Phase 10 (A-47): Owner may send and log reminders and use the bulk **Remind all overdue** action. The seven-day spacing override still requires a General Manager with a reason (A-46).

## Hard rules (CONFIRMED by owner)

1. Staff other than Owner, General Manager and Accountant never see profit or material cost (A-09).
2. The Store Keeper cannot open sales modules.
3. A salesperson sees only their own sales and totals.
4. The Workshop Supervisor sees workshop performance but never revenue.
5. Deleting records, stock adjustments and payments/expenditures need the Owner's approval (A-08). In practice financial documents are voided, never deleted.
6. The UI hides what a role cannot do, and the future Laravel policies must enforce it again on the server.
