/* Phase 4 Suppliers module, built entirely from the shared Phase 3 patterns. */
window.GT = window.GT || {};
window.GT.supplierModule = (function () {
  var table = null;
  var tracker = null;
  var categories = ['fabric', 'yarn', 'thread', 'accessory', 'packaging'];
  function can(action) { return window.GT.permissions.can('suppliers', action); }
  function title(value) { return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, function (letter) { return letter.toUpperCase(); }); }

  function grnTable(supplierId) {
    var notes = window.GT.store.where('goods_received_notes', function (row) { return Number(row.supplier_id) === Number(supplierId); }).sort(function (a,b) { return String(b.received_at).localeCompare(String(a.received_at)); });
    if (!notes.length) return '<div class="empty-state"><p>No goods received notes have been posted for this supplier.</p></div>';
    return '<div class="table-wrapper"><table class="shared-data-table supplier-grn-table"><thead><tr><th>Number</th><th>Date</th><th>Supplier document</th><th>Lines</th><th>Status</th></tr></thead><tbody>' + notes.map(function (grn) { return '<tr class="table-clickable-row"><td><a href="#/inventory/grns/' + grn.id + '">' + grn.number + '</a></td><td>' + window.GT.dates.formatDate(grn.received_at) + '</td><td>' + (grn.supplier_doc_missing ? 'None supplied' : grn.supplier_doc_no) + '</td><td>' + window.GT.grns.items(grn.id).length + '</td><td>' + window.GT.components.statusBadge(grn.status === 'ok' ? 'OK' : title(grn.status), grn.status === 'ok' ? 'success' : 'error') + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }

  function rows() {
    return window.GT.store.all('suppliers').map(function (supplier) {
      return Object.assign({}, supplier, { type_label: title(supplier.type), status_label: supplier.active ? 'Active' : 'Inactive' });
    });
  }

  function changeStatus(supplier, active, dataTable) {
    function save() {
      var before = window.GT.store.find('suppliers', supplier.id);
      var after = window.GT.store.update('suppliers', supplier.id, { active: active });
      window.GT.audit.log(active ? 'activate' : 'deactivate', 'suppliers', supplier.id, before, after);
      window.GT.components.showToast(supplier.name + ' is now ' + (active ? 'active.' : 'inactive.'), 'success');
      if (dataTable) dataTable.refresh(); else window.GT.app.renderPage();
    }
    if (active) { save(); return; }
    window.GT.components.confirmDialog({ title: 'Deactivate supplier?', message: 'The supplier remains in history but is hidden from future supplier pickers.', confirmText: 'Deactivate' }).then(function (confirmed) { if (confirmed) save(); });
  }

  function renderList() {
    table = window.GT.dataTable.create({
      id: 'suppliersTable', rows: rows, caption: 'Suppliers', searchPlaceholder: 'Search suppliers', searchFields: ['name', 'contact', 'phone', 'supplies', 'location'],
      filters: [
        { name: 'type', label: 'Type', field: 'type', options: [{ value: 'local', label: 'Local' }, { value: 'import', label: 'Import' }] },
        { name: 'status', label: 'Status', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }], test: function (row, value) { return value === 'active' ? row.active : !row.active; } }
      ],
      columns: [
        { label: 'Name', field: 'name', sortable: true, priority: 1 }, { label: 'Type', field: 'type_label', sortable: true, priority: 1 },
        { label: 'Contact person', field: 'contact', sortable: true, priority: 2 }, { label: 'Phone', field: 'phone', priority: 1 },
        { label: 'Location', field: 'location', sortable: true, priority: 2 }, { label: 'Supplies', field: 'supplies', priority: 2 },
        { label: 'Status', field: 'status_label', sortable: true, priority: 1, html: true, formatter: function (value, row) { return window.GT.components.statusBadge(value, row.active ? 'success' : 'neutral'); } }
      ],
      actions: [
        { label: 'View', icon: 'eye', primary: true, onClick: function (row) { window.location.hash = '#/inventory/suppliers/' + row.id; } },
        { label: 'Edit', icon: 'pencil', primary: true, show: function () { return can('E'); }, onClick: function (row) { window.location.hash = '#/inventory/suppliers/' + row.id + '/edit'; } },
        { label: 'Deactivate', icon: 'circle-off', show: function (row) { return can('E') && row.active; }, onClick: function (row, instance) { changeStatus(row, false, instance); } },
        { label: 'Activate', icon: 'circle-check', show: function (row) { return can('E') && !row.active; }, onClick: function (row, instance) { changeStatus(row, true, instance); } }
      ],
      emptyState: { message: 'No suppliers match the current search and filters.', action: { label: 'Add supplier', show: function () { return can('C'); }, onClick: function () { window.location.hash = '#/inventory/suppliers/new'; } } },
      exportName: 'genuine-textiles-suppliers.csv'
    });
    return '<section class="suppliers-page">' + window.GT.components.pageHeader({ title: 'Suppliers', description: 'Maintain local and import supplier contacts for later purchasing records.', breadcrumbs: [{ label: 'Inventory' }, { label: 'Suppliers' }], actions: [{ label: 'New supplier', route: '#/inventory/suppliers/new', icon: 'plus', permission: 'suppliers', permissionAction: 'C' }] }) + '<div id="supplierListMount"></div></section>';
  }

  function supplierSections() {
    return [
      { title: 'Basic details', fields: [
        { name: 'name', label: 'Supplier name', type: 'text', required: true },
        { name: 'type', label: 'Supplier type', type: 'select', required: true, options: [{ value: 'local', label: 'Local' }, { value: 'import', label: 'Import' }] },
        { name: 'contact', label: 'Contact person', type: 'text' }, { name: 'phone', label: 'Phone', type: 'phone', required: true },
        { name: 'email', label: 'Email', type: 'email' }, { name: 'location', label: 'Location', type: 'text' }
      ] },
      { title: 'Supplies', fields: [{ name: 'supplies', label: 'What they supply', type: 'textarea', rows: 3, fullWidth: true }].concat(categories.map(function (category) { return { name: 'category_' + category, label: title(category), checkboxLabel: title(category), type: 'checkbox' }; })) },
      { title: 'Notes', fields: [{ name: 'notes', label: 'Notes', type: 'textarea', rows: 4, fullWidth: true }] }
    ];
  }

  function values(supplier) {
    var result = supplier ? Object.assign({}, supplier) : { name: '', type: 'local', contact: '', phone: '', email: '', location: '', supplies: '', notes: '', active: true };
    categories.forEach(function (category) { result['category_' + category] = (result.categories_json || []).indexOf(category) !== -1; });
    return result;
  }

  function renderForm(params) {
    var supplier = params.id ? window.GT.store.find('suppliers', Number(params.id)) : null;
    if (params.id && !supplier) return '<section class="page-placeholder"><h1>Supplier not found</h1><a class="btn btn-primary" href="#/inventory/suppliers">Back to suppliers</a></section>';
    var editing = Boolean(supplier);
    return '<section class="suppliers-page supplier-form-page">' + window.GT.components.pageHeader({ title: editing ? 'Edit supplier' : 'New supplier', breadcrumbs: [{ label: 'Suppliers', route: '#/inventory/suppliers' }, { label: editing ? supplier.name : 'New supplier' }] }) + window.GT.forms.render({ id: 'supplierForm', sections: supplierSections(), values: values(supplier), submitLabel: editing ? 'Save changes' : 'Create supplier', cancelRoute: editing ? '#/inventory/suppliers/' + supplier.id : '#/inventory/suppliers' }) + '</section>';
  }

  function validate(values, id) {
    var errors = {};
    if (!window.GT.validate.required(values.name)) errors.name = 'Supplier name is required.';
    else if (!window.GT.validate.uniqueName('suppliers', values.name, id)) errors.name = 'A supplier with this name already exists.';
    if (!window.GT.validate.required(values.type)) errors.type = 'Choose local or import.';
    if (!window.GT.validate.required(values.phone)) errors.phone = 'Phone is required.';
    else if (values.type === 'local' && !window.GT.validate.ugandanPhone(values.phone)) errors.phone = 'Local suppliers use +2567XXXXXXXX or 07XXXXXXXX.';
    else if (values.type === 'import' && !window.GT.validate.internationalPhone(values.phone)) errors.phone = 'Import suppliers use + followed by 8 to 15 digits.';
    if (!window.GT.validate.email(values.email)) errors.email = 'Enter a valid email address.';
    return errors;
  }

  function record(values, existing) {
    return { name: values.name.trim(), type: values.type, contact: values.contact.trim(), phone: values.phone.trim(), email: values.email.trim(), location: values.location.trim(), supplies: values.supplies.trim(), categories_json: categories.filter(function (category) { return values['category_' + category]; }), notes: values.notes.trim(), active: existing ? existing.active : true };
  }

  function bindForm(params) {
    var form = document.getElementById('supplierForm'); if (!form) return;
    var id = params.id ? Number(params.id) : null;
    var existing = id ? window.GT.store.find('suppliers', id) : null;
    var sections = supplierSections(); tracker = window.GT.forms.trackDirty(form);
    form.addEventListener('submit', function (event) {
      event.preventDefault(); var formValues = window.GT.forms.read(form, sections); var errors = validate(formValues, id);
      if (!window.GT.forms.showErrors(form, errors)) return;
      var saved;
      if (existing) { saved = window.GT.store.update('suppliers', id, record(formValues, existing)); window.GT.audit.log('update', 'suppliers', id, existing, saved); }
      else { saved = window.GT.store.create('suppliers', record(formValues)); window.GT.audit.log('create', 'suppliers', saved.id, null, saved); }
      tracker.markSaved(); window.GT.components.showToast(saved.name + ' was saved.', 'success'); window.location.hash = '#/inventory/suppliers/' + saved.id;
    });
  }

  function renderDetail(params) {
    var supplier = window.GT.store.find('suppliers', Number(params.id));
    if (!supplier) return '<section class="page-placeholder"><h1>Supplier not found</h1><a class="btn btn-primary" href="#/inventory/suppliers">Back to suppliers</a></section>';
    var overview = '<dl class="detail-grid">' + window.GT.components.detailRow('Type', title(supplier.type)) + window.GT.components.detailRow('Contact person', supplier.contact) + window.GT.components.detailRow('Phone', supplier.phone) + window.GT.components.detailRow('Email', supplier.email) + window.GT.components.detailRow('Location', supplier.location) + window.GT.components.detailRow('What they supply', supplier.supplies) + window.GT.components.detailRow('Categories', (supplier.categories_json || []).map(title).join(', ')) + window.GT.components.detailRow('Notes', supplier.notes) + '</dl>';
    var actions = [{ label: 'Edit supplier', route: '#/inventory/suppliers/' + supplier.id + '/edit', icon: 'pencil', permission: 'suppliers', permissionAction: 'E' }, { label: supplier.active ? 'Deactivate' : 'Activate', name: 'toggle-status', className: 'btn-outline-secondary', permission: 'suppliers', permissionAction: 'E' }];
    return '<section class="suppliers-page supplier-detail-page" data-supplier-id="' + supplier.id + '">' + window.GT.components.pageHeader({ title: supplier.name, badge: window.GT.components.statusBadge(supplier.active ? 'Active' : 'Inactive', supplier.active ? 'success' : 'neutral'), breadcrumbs: [{ label: 'Suppliers', route: '#/inventory/suppliers' }, { label: supplier.name }], actions: actions }) + '<div class="detail-card">' + window.GT.components.tabs([{ id: 'supplier-overview', label: 'Overview' }, { id: 'supplier-purchases', label: 'Goods Received and Purchases' }], 'supplier-overview') + '<section class="detail-tab-panel" id="supplier-overview" role="tabpanel"><h2>Overview</h2>' + overview + '</section><section class="detail-tab-panel" id="supplier-purchases" role="tabpanel" hidden><h2>Goods Received and Purchases</h2>' + grnTable(supplier.id) + '</section></div></section>';
  }

  function bindDetail(params) {
    var supplier = window.GT.store.find('suppliers', Number(params.id)); if (!supplier) return;
    document.querySelectorAll('[data-tab-target]').forEach(function (tab) { tab.addEventListener('click', function () { document.querySelectorAll('[data-tab-target]').forEach(function (item) { item.classList.toggle('active', item === tab); item.setAttribute('aria-selected', item === tab); }); document.querySelectorAll('.detail-tab-panel').forEach(function (panel) { panel.hidden = panel.id !== tab.dataset.tabTarget; }); }); });
    var toggle = document.querySelector('[data-page-action="toggle-status"]'); if (toggle) toggle.addEventListener('click', function () { changeStatus(supplier, !supplier.active); });
  }

  function render(view, params) { if (view === 'list') return renderList(); if (view === 'new' || view === 'edit') return renderForm(params || {}); return renderDetail(params || {}); }
  function bind(view, params) { if (view === 'list') table.mount('#supplierListMount'); else if (view === 'new' || view === 'edit') bindForm(params || {}); else bindDetail(params || {}); }
  var api = { render: render, bind: bind };
  [['#/inventory/suppliers','list','Suppliers','V'],['#/inventory/suppliers/new','new','New Supplier','C'],['#/inventory/suppliers/:id/edit','edit','Edit Supplier','E'],['#/inventory/suppliers/:id','detail','Supplier Details','V']].forEach(function (route) { window.GT.router.register(route[0], { module: api, view: route[1], title: route[2], permission: 'suppliers', action: route[3], baseRoute: '#/inventory/suppliers' }); });
  return api;
}());
