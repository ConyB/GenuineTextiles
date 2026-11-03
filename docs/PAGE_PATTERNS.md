# Reusable Page Patterns

Phase 3 establishes the list, form and detail patterns used by later modules. They are classic scripts on `window.GT`, use the shared design tokens, and access records only through `GT.store`.

## Fabric calculator (Phase 18)

The Owner-only `#/production/fabric-calculator` uses `GT.forms.render` for the inputs, `GT.dataTable` for five editable rule tables and saved notes, `GT.components.pageHeader` for the single heading and print action, and `GT.print.letterhead`/`GT.print.open` for an unnumbered A4 report. Editing a row opens `#/production/fabric-calculator/rules/:table/:id` with a shared form and returns to the calculator. The visible width table supplies explicit metre adjustments; selecting a stock fabric sets the recorded width and shows a read-only total on-hand check. A saved note is a standalone snapshot (A-96 to A-99).

## Parameter routes

Register routes after a module creates its `{ render, bind }` API. A `:name` segment is passed to both functions in the params object.

```js
GT.router.register('#/customers/:id', {
  module: GT.customerModule,
  view: 'detail',
  title: 'Customer Details',
  permission: 'customers',
  action: 'V',
  baseRoute: '#/customers'
});
```

`app.js` checks the configured permission before it calls `module.render(view, params)` and `module.bind(view, params)`.

## List page

Create one `GT.dataTable` instance during the module's `render` call and mount it during `bind`. Keep filtering, sorting, pagination, CSV export and mobile-card behaviour in the shared helper. A module supplies records, columns, filters and permitted row actions.

```js
var table = GT.dataTable.create({
  id: 'customersTable',
  rows: function () { return GT.store.all('customers'); },
  searchFields: ['name', 'phone'],
  filters: [{
    name: 'status', label: 'Status',
    options: [{ value: 'active', label: 'Active' }],
    test: function (row, value) { return value !== 'active' || row.active; }
  }],
  columns: [
    { label: 'Name', field: 'name', sortable: true },
    { label: 'Phone', field: 'phone' },
    { label: 'Balance', field: 'balance', align: 'right', numeric: true,
      minWidth: 120, formatter: GT.format.formatMoney }
  ],
  actions: [{
    label: 'View', icon: 'eye', primary: true,
    onClick: function (row) { location.hash = '#/customers/' + row.id; }
  }, {
    label: 'Edit', icon: 'pencil', primary: true,
    show: function () { return GT.permissions.can('customers', 'E'); },
    onClick: function (row) { location.hash = '#/customers/' + row.id + '/edit'; }
  }, {
    label: 'Delete', icon: 'trash-2', destructive: true,
    show: function () { return GT.permissions.can('customers', 'A'); },
    onClick: deleteCustomer
  }],
  emptyState: { message: 'No records found.' },
  exportName: 'customers.csv'
});

table.mount('#listMount');
```

Column formatters return display content. Set `html: true` only for markup produced by a trusted shared component such as `GT.components.statusBadge`; normal values are escaped. `exportValue(row)` can provide a plain CSV value when the display formatter is not suitable.

### Page header and shell breadcrumb

Every content page has exactly one `h1`, rendered by `GT.components.pageHeader`. The page header contains only that heading, an optional one-line description, status badge and permission-aware primary actions. Modules do not render breadcrumbs: `app.js` derives the desktop topbar breadcrumb from the shared navigation and route configuration. Below 992px the same topbar position shows only the current page name beside the menu button.

### KPI and stat cards

Use `GT.statCards.render(cards)` for every page-level statistic. Each configuration supplies `label`, `value`, `icon`, `tone` and optional `helper`, `filterKey`, `active` and `onClick`. Interactive cards render as accessible toggle buttons with `aria-pressed`; their handler should call the shared table's `setFilter` or `toggleFilter` method so the toolbar and Clear filters retain one state.

```js
GT.statCards.render([
  { label: 'Out of stock', value: 2, helper: 'At zero stock',
    icon: 'package-x', tone: 'danger', filterKey: 'status', active: true,
    onClick: function () { table.toggleFilter('status', 'out'); } }
]);
```

Tone meanings are: `danger` for urgent failures, `warning` for attention, `success` for healthy outcomes, `info` for informational progress, `brand` for totals or primary emphasis, and `neutral` for unclassified context. Every card has an icon tile, label and value; helpers remain one short supporting line.

The shared card layout wraps to fit the available width and stretches a short final row. Money values use the shared UGX formatter and stay on one line.

### Table toolbar and alignment

The shared toolbar has two deliberate rows. Search and Export CSV share row one at 40px high. Filters use one wrapping flex row: every control is `flex: 1 1 200px`, with a 180px minimum and a 12px gap. A partial final row stretches evenly instead of leaving one narrow orphan control. Result count and page size share the line below the toolbar. `Clear filters` is rendered only while search or a filter is active. Below 768px filters use two equal controls per row and the date control takes a full row.

Every pair of `type: 'date'` filters is rendered through `GT.dateRangeFilter`. Its 40px trigger shows **Any date**, a preset name, or an app-formatted range. Presets use Kampala-safe helpers in `GT.dates`; Custom range provides full-width native date inputs inside a fixed popover. Modules keep their existing `date_from` and `date_to` testsâ€”the shared table maps the component back to those state values, so pagination, CSV export, and Clear filters continue to use the same filter contract.

```js
filters: [
  { name: 'date_from', label: 'From date', type: 'date',
    test: function (row, value) { return row.created_at.slice(0, 10) >= value; } },
  { name: 'date_to', label: 'To date', type: 'date',
    test: function (row, value) { return row.created_at.slice(0, 10) <= value; } }
]
```

Selects never span more than one filter track. Long selected values ellipsize without reducing the font size; the native option list keeps the full option text and the select's `title` always contains the complete selected value.

Columns accept `align: 'left' | 'right' | 'center'`, `numeric: true`, `minWidth`, `wrap: false`, and `priority`. Alignment applies identically to the header and its cells; `numeric` also enables tabular numerals. Text wraps by default, while `wrap: false` is reserved for genuinely compact values. Numbers, money, and quantities must be right-aligned.

`priority: 1` is always visible and is the default. Priority 2 columns hide at the 1280px breakpoint and below; priority 3 columns hide at the 1024px breakpoint and below. Hiding is visual only, so detail pages and CSV exports keep the complete record. At 1024px and below the first visible column and Actions remain sticky when horizontal scrolling is necessary, and every shared-table render resets its wrapper to the left edge.

```js
columns: [
  { label: 'Material', field: 'name', sortable: true, priority: 1, minWidth: 160 },
  { label: 'Total stock', field: 'stock_display', sortable: true,
    priority: 1, align: 'right', numeric: true, minWidth: 120 },
  { label: 'Supplier', field: 'supplier_name', priority: 2 }
]
```

The Actions column is 96px wide: two 32px button slots, an 8px gap and 12px cell padding on both sides. A row uses either two primary icon actions, or one primary icon beside More; remaining actions move into the menu. A single action keeps the empty second slot so its x-position remains aligned. The table wrapper never gets a maximum height or its own vertical scrolling; the table grows with the selected page size and the page owns vertical scrolling.

### Compact row actions

Each action may define `icon`, `label`, `primary`, `destructive`, `showLabel`, `show()` and `disabledReason`, plus its `onClick` handler. Existing `className`, `disabled()` and `title` options remain supported. `disabledReason` may be text or a function returning text; when present it disables the action and supplies its tooltip.

The shared table shows at most two primary actions inline as 32px icon buttons. Remaining actions appear in one portal-based **More actions** menu, with destructive actions last after a divider. A lone visible action stays inline. Phone cards show text labels and use 44px touch targets. Modules must configure actions only; dropdown rendering, positioning, focus handling and closing behaviour belong to `data-table.js`.

When a permitted View action exists, the shared table makes the row clickable and keyboard-focusable; Enter opens the same detail view. Buttons and menu items stop the row action, so Edit and lifecycle actions never open the detail page accidentally. Read-only ledgers may instead provide `onRowClick` without rendering an Actions column.

```js
actions: [
  { label: 'View', icon: 'eye', primary: true, onClick: openDetail },
  { label: 'Edit', icon: 'pencil', primary: true, show: canEdit, onClick: openEdit },
  { label: 'Deactivate', icon: 'circle-off', show: canEdit, onClick: deactivate },
  { label: 'Delete', icon: 'trash-2', destructive: true, show: canDelete, onClick: remove }
]
```

## Form page

Describe fields once in grouped sections. `GT.forms.render` supports `text`, `textarea`, `select`, `number`, `money`, `checkbox` and `phone`. `GT.forms.read` returns the current values without re-rendering, so entered values remain in place when validation fails.

```js
var sections = [{
  title: 'Basic details',
  fields: [
    { name: 'name', label: 'Customer name', type: 'text', required: true },
    { name: 'phone', label: 'Phone', type: 'phone', required: true },
    { name: 'group_id', label: 'Group', type: 'select', valueType: 'number', options: groupOptions }
  ]
}];

page.innerHTML = GT.forms.render({
  id: 'recordForm', sections: sections, values: record,
  submitLabel: 'Save', cancelRoute: '#/customers'
});

var form = document.getElementById('recordForm');
var dirty = GT.forms.trackDirty(form);
form.addEventListener('submit', function (event) {
  event.preventDefault();
  var values = GT.forms.read(form, sections);
  if (!GT.forms.showErrors(form, validate(values))) return;
  // Save through GT.store, write GT.audit.log, then:
  dirty.markSaved();
});
```

Validation errors use a `{ field_name: 'Message' }` object. The helper adds an error summary, inline messages and `aria-invalid`. `app.js` warns before a hash-route change while the tracked form is dirty, and the helper also covers full-page unloads.

## Detail page

A detail page combines `GT.components.pageHeader`, `statusBadge`, `tabs` and `detailRow`. The shell owns breadcrumbs while the page header owns the H1 and permission-aware actions. Tabs are buttons with matching panel IDs; the module binds their selected and hidden states. Related features that are not built yet use an honest empty state rather than placeholder data.

Use `.detail-card` for bordered content panels. Its padding and direct `h2` heading style come from `components.css`; modules do not duplicate them. For short linked activity or shortcut lists inside a card, use `GT.components.linkedList(items)` with each item's `route`, `label`, optional `meta` and optional formatted `amount`.

## Settings form

A settings page edits one logical record even when its values are stored as key/value rows. Render grouped fields with `GT.forms`, add a live preview beside the form, and call `GT.forms.trackDirty(form)` so navigation warns before discarding edits. On phones, expose Form and Preview as tabs instead of squeezing both panels side by side.

Save one before snapshot and one after snapshot to the audit log, even when several key/value rows are updated. Reload the shared settings service and refresh the shell chrome after saving so business identity changes appear without a browser reload.

For a view-only role, render the same content but disable all fields, omit add/remove controls, hide Save and discard actions, and show a Read only badge. Route permissions still prevent every role without View access from opening the page.

## Permissions and audit

Routes check view/create/edit access before rendering. Header and row actions also call `GT.permissions.can(module, action)` so disallowed controls are absent, not merely disabled. Every module create, update, state change and permitted delete calls:

```js
GT.audit.log('update', 'customers', saved.id, before, saved);
```

The helper records the current user and JSON snapshots in `audit_logs`. Financial and stock records remain protected by `GT.store.remove` and must be voided or reversed instead.

## Read-only ledger

A ledger uses the shared data table for search, filters, sorting, pagination and CSV export, but defines no edit or delete actions. Rows may be keyboard-focusable links to the related detail page. Newest entries appear first, and signed quantities use success colour for stock in and error colour for stock out. Stock mutations must happen in the responsible service before the ledger refreshes; the ledger never changes data.

## Hide cost by role

Build cost columns and form sections only when the active role may see cost. Do not render hidden cost cells or include cost in CSV configuration for unauthorised roles. For Materials, Owner, General Manager and Accountant may view cost; only Owner may edit it during Phase 5. Store Keeper and Workshop Supervisor receive the same operational material and ledger data with every cost field omitted.

## Line-item editor

Use `GT.lineEditor.create(config)` for document rows. Columns declare a `key`, `label` and one of `select`, `search-select`, `text`, `number`, `money`, `computed` or `readonly`. A column may supply `options`, `compute`, `format` and a side-effect-free `validate(value, row, rows, index)` function that returns an error message or an empty string. The shared editor owns add/remove controls, cell feedback, totals footer rendering, Tab order, Enter-to-add on the last field, and stacked cards below 768px.

```js
var editor = GT.lineEditor.create({
  id: 'documentLines',
  rows: [{ item_id: '', quantity: 1, unit_price: null }],
  columns: [
    { key: 'item_id', label: 'Item', type: 'search-select', options: itemOptions },
    { key: 'quantity', label: 'Quantity', type: 'number', validate: positiveQuantity },
    { key: 'unit_price', label: 'Unit price', type: 'money' },
    { key: 'amount', label: 'Amount', type: 'computed', compute: lineAmount, format: GT.format.formatMoney }
  ],
  footer: function (rows) { return '<strong>Total: ' + GT.format.formatMoney(total(rows)) + '</strong>'; },
  onChange: updateSummary
});
editor.mount('#lineEditorMount');
```

Modules read lines with `getRows()`, restore them with `setRows(rows)`, and call `validate()` before saving. Business calculations and posting remain in the module service, never in the editor.

Set `fixedRows: true` for invoice-backed delivery and confirmation lines. This keeps the shared cell validation and mobile cards while omitting add/remove controls and Enter-to-add; the invoice defines the row set (A-49).

## Print foundation

`GT.print.letterhead()` is the single settings-driven renderer for the logo, business identity, address, P.O. Box and phones. `GT.print.signatureBlock(labels)` builds a non-breaking sign-off area, `GT.print.watermark('VOID')` adds the document watermark, and `GT.print.open(html, title)` opens the shared A4 preview with Back and Print controls. Tables repeat their headers across pages; totals and signatures use `.print-keep-together` so they do not split.

Phase 10: `GT.print.open(html, title, {orientation:'landscape'})` selects landscape A4 for the ageing report. The ageing strip uses three shared stat cards and one CSS stacked bar. Reminder and call forms use `GT.components.openModal`; the seven-day override uses `GT.components.confirmDialog`. No module builds its own toolbar or list table.

## Delivery note and dispatch register (Phase 11)

`delivery-notes.js` uses the shared page header, stat cards, data table, forms, fixed-row line editor and A4 print foundation. The invoice lines cannot be added or removed; each dispatch quantity is bounded by `GT.deliveries.summary`. Save keeps a draft unnumbered. Issue rechecks date, quantities and release in `delivery-service.js`; a future draft offers Set to today (A-56). Locked detail carries confirmation, release and void actions only for permitted roles. Delivery print has no money. `dispatch-log.js` is a read-only shared table with CSV and print. Both routes live under Sales and use the same sidebar permission filter.

The Store Keeper and Workshop Supervisor views omit financial amounts in release panels, print previews, exports and log views (A-52). At 360px, the shared table renders cards and the form stacks its panels.

## Orders and production board (Phase 12)

`orders.js` uses the shared page header, stat cards, data table, forms, line-item editor and print foundation. The list's four cards toggle shared table filters. Stage, status, priority, late-only, customer and date filters plus search and CSV live in the shared table. The form copies source quotation/proforma lines and uses the shared line editor. Detail shows the settings-driven stage tracker, role-aware deposit panel, linked documents, stage history and simulated messages. The A4 Original job card uses `GT.print.letterhead` and contains no prices. `production-board.js` is a read-only stage board; at 360px the seven columns become a vertical stage list. Production cards carry no money (A-57, A-64).

## Material issues (Phase 13)

`material-issues.js` uses the shared page header, four clickable stat cards, data table with search/filter/CSV and More actions, form fields, line editor and A4 print foundation. The order detail uses another shared table for issued quantities. The form shows stock at the selected location; Workshop Supervisor can request above stock with a warning, while issuer roles must correct an over-stock line before saving. Issue rechecks balance in the service. Detail shows quantities and audit timeline. All surfaces omit money (A-69 to A-72).

## Finished goods and quick sales (Phase 14)

`finished-goods.js` uses shared header, cards and data tables for variants, adjustment requests and movement history. `finished-goods-service.js` alone changes variant balances and records the signed ledger. `quick-sales.js` uses the same list components; its counter cart is a focused form with live totals from `GT.quickSales.totals`. `quick-sale-service.js` owns payment, approvals, receipt numbering and stock posting. The receipt module renders the existing A4 receipt for both invoice collections and quick sales (A-73 to A-79).

## Receipt payment form and cards (Phase 9)

The full-page payment form uses `GT.forms` fields beside a live receipt preview. On phones, Form and Preview are tabs. Customer selection narrows the issued, unpaid invoice picker; the invoice panel shows total, paid, balance, due date and overdue days. Amount shortcuts fill the remaining balance or half on an invoice's first receipt. The current user is read-only. `GT.receipts.validate` owns amount, date and reference errors; the module displays them with `GT.forms.showErrors` and tracks unsaved changes. Receipt list collection cards use `GT.statCards`; method cards change the shared table filter, and total cards clear it.

## Sales document engine (Phases 7 and 8)

`GT.salesDocs.types` supplies each type's label, route, numbering series, validity, terms, print title and permission. The invoice config also declares due date, payment status, credit check, fiscal number and quotation/proforma conversion. `GT.salesDocs` validates and performs transactions; `sales-documents.js` renders the shared list, form, detail and A4 views for all three types. `GT.invoices` owns invoice calculations and guarded changes. The list uses `GT.dataTable` and `GT.statCards`; the form uses `GT.forms`, `GT.lineEditor` and `GT.print.letterhead`. Both long and short routes resolve to the same module. The date override `?today=YYYY-MM-DD` makes expiry and ageing checks deterministic.

Locked document-edit screens render posted fields as ordinary read-only text, not disabled inputs, and explain why they are locked. Only the explicitly editable metadata is submitted.

## Reports and monthly statements (Phase 16)

`reports.js` uses shared headers, cards, data tables, date-range controls and print previews for Sales, Stock and Debtors. The Sales page has a grouped table and a source table; every source row opens its owner page. Stock never includes price or cost columns, even for money roles, so its CSV and A4 copy are safe for Store Keeper and Workshop Supervisor. `financial-statements.js` uses a shared cash-book source table plus a month filter and date range. Its reconciliation reads independent source amounts and shows PASS or FAIL. All calculations remain in `reports-service.js` (A-88 to A-90).

## Employees, production and wages (Phase 17)

`people.js` renders the five People routes through shared headers, cards, tables, forms, detail rows and print preview. Employee personal details appear only for Owner and General Manager; the Supervisor's table, detail and CSV have names and work roles only. Attendance uses one employee/date status and a shared monthly summary table. Production entries select an existing customer or stock order item, garment and task; the shared table and CSV contain quantities only. Quality issues are linked to employee and item. Targets compare logged task quantities with a daily or Monday-to-Sunday weekly goal. `people-service.js` performs all calculations and persistence. Wages also lists the ASSUMED garment/task rates through a shared table. The gross pay summary prints as an unnumbered A4 report; finalisation calls the existing expense service for one pending Salaries request (A-91 to A-95).

`GT.forms.trackDirty` tracks each form on a page, so the Production Log's work and quality forms both warn on unsaved changes (UI_CHECKLIST rule 18).

## Marketing and sales targets (Phase 20)

`marketing.js` renders campaign list, form and detail routes through shared tables, stat cards and form sections. Its saved-message/poster picker uses the reusable `multiselect` field; a separate shared table lists the selected references. Validation errors appear beneath fields and dirty forms retain the navigation warning.

`lead-sources.js` uses the shared date-range filter, an optional month shortcut and two shared tables for period totals and monthly signup cohorts. `sales-targets.js` uses shared month fields, cards, progress bars, tables and target history. Sales receives only their own rows and print/CSV; managers alone receive the set-target form. The service owns all calculations and reconciliation.

`GT.print.reportTable` provides escaped, unnumbered report tables with repeated headers, empty states and numeric alignment. Campaign, lead-source and target reports use it with `GT.print.letterhead` and `GT.print.open`. The existing Sales Report gains date-filtered customer/item rankings and invoice-issuer filtering; item rankings can sort quantity or value. No new report route duplicates the Phase 16 Sales Report.

