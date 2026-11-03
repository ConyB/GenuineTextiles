/* Phase 3 Customers module: list, forms, details and group maintenance. */
window.GT = window.GT || {};
window.GT.customerModule = (function () {
  var listTable = null;
  var groupsTable = null;
  var formTracker = null;
  var recentPaymentsTable = null;

  function can(action) { return window.GT.permissions.can('customers', action); }
  function byId(rows, id) { return rows.find(function (row) { return Number(row.id) === Number(id); }) || null; }
  function optionRows(table) { return window.GT.store.all(table).sort(function (left, right) { return left.name.localeCompare(right.name); }).map(function (row) { return { value: row.id, label: row.name }; }); }
  function groupName(id) { var group = window.GT.store.find('customer_groups', id); return group ? group.name : 'Unassigned'; }
  function leadName(id) { var lead = window.GT.store.find('lead_sources', id); return lead ? lead.name : 'Not recorded'; }

  function customerRows() {
    return window.GT.store.all('customers').map(function (customer) {
      return Object.assign({}, customer, {
        group_name: groupName(customer.customer_group_id),
        credit_label: customer.is_credit ? 'Credit — ' + window.GT.format.formatMoney(customer.credit_limit) : 'Cash',
        balance: window.GT.customers.balance(customer.id),
        over_limit: customer.is_credit && window.GT.customers.balance(customer.id) > customer.credit_limit,
        status_label: customer.active ? 'Active' : 'Inactive'
      });
    });
  }

  function pageHeader(options) { return window.GT.components.pageHeader(options); }

  function relatedCustomerRecords(customerId) {
    return ['sales_documents', 'receipts', 'orders', 'delivery_notes'].reduce(function (result, table) {
      result[table] = window.GT.store.where(table, function (row) { return Number(row.customer_id) === Number(customerId); }).length;
      return result;
    }, {});
  }

  function hasRelatedRecords(counts) {
    return Object.keys(counts).some(function (table) { return counts[table] > 0; });
  }

  function changeCustomerStatus(customer, active, table) {
    function save() {
      var before = window.GT.store.find('customers', customer.id);
      var after = window.GT.store.update('customers', customer.id, { active: active });
      window.GT.audit.log(active ? 'activate' : 'deactivate', 'customers', customer.id, before, after);
      window.GT.components.showToast(customer.name + ' is now ' + (active ? 'active.' : 'inactive.'), 'success');
      if (table) table.refresh(); else window.GT.app.renderPage();
    }
    if (active) { save(); return; }
    window.GT.components.confirmDialog({ title: 'Deactivate customer?', message: 'The customer stays in history but will be hidden from new-document pickers.', confirmText: 'Deactivate' }).then(function (confirmed) { if (confirmed) save(); });
  }

  function deleteCustomer(customer, table) {
    var counts = relatedCustomerRecords(customer.id);
    if (hasRelatedRecords(counts)) {
      window.GT.components.showToast('This customer has related documents or orders. Deactivate the customer instead.', 'error', 'Customer cannot be deleted');
      return;
    }
    window.GT.components.confirmDialog({ title: 'Delete unused customer?', message: 'This permanently removes ' + customer.name + '. This cannot be undone.', confirmText: 'Delete customer' }).then(function (confirmed) {
      if (!confirmed) return;
      var before = window.GT.store.find('customers', customer.id);
      window.GT.store.remove('customers', customer.id);
      window.GT.audit.log('delete', 'customers', customer.id, before, null);
      window.GT.components.showToast(customer.name + ' was deleted.', 'success');
      if (table) table.refresh();
      else window.location.hash = '#/customers';
    });
  }

  function customerActions() {
    return [
      { label: 'View', icon: 'eye', primary: true, onClick: function (row) { window.location.hash = '#/customers/' + row.id; } },
      { label: 'Edit', icon: 'pencil', primary: true, show: function () { return can('E'); }, onClick: function (row) { window.location.hash = '#/customers/' + row.id + '/edit'; } },
      { label: 'Deactivate', icon: 'circle-off', show: function (row) { return can('E') && row.active; }, onClick: function (row, table) { changeCustomerStatus(row, false, table); } },
      { label: 'Activate', icon: 'circle-check', show: function (row) { return can('E') && !row.active; }, onClick: function (row, table) { changeCustomerStatus(row, true, table); } },
      { label: 'Delete', icon: 'trash-2', destructive: true, show: function () { return can('A'); }, onClick: deleteCustomer }
    ];
  }

  function renderList() {
    var groups = optionRows('customer_groups');
    listTable = window.GT.dataTable.create({
      id: 'customersTable',
      rows: customerRows,
      caption: 'Customers',
      searchPlaceholder: 'Search customers',
      searchFields: ['name', 'phone', 'contact_person'],
      filters: [
        { name: 'group', label: 'Group', field: 'customer_group_id', options: groups },
        { name: 'credit', label: 'Credit type', options: [{ value: 'cash', label: 'Cash' }, { value: 'credit', label: 'Credit' }], test: function (row, value) { return value === 'credit' ? row.is_credit : !row.is_credit; } },
        { name: 'status', label: 'Status', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }], test: function (row, value) { return value === 'active' ? row.active : !row.active; } }
      ],
      columns: [
        { label: 'Name', field: 'name', sortable: true, priority: 1, html:true, formatter:function (value,row) { return window.GT.components.escapeHtml(value)+(row.balance>0&&window.GT.permissions.can('debtors','V')?' <a href="#/debtors/'+row.id+'">View debtor</a>':''); }, exportValue:function (row) { return row.name; } },
        { label: 'Group', field: 'group_name', sortable: true, priority: 1 },
        { label: 'Contact person', field: 'contact_person', sortable: true, priority: 2 },
        { label: 'Phone', field: 'phone', priority: 1 },
        { label: 'Credit', field: 'credit_label', sortable: true, priority: 2, html: true, formatter: function (value,row) { return window.GT.components.escapeHtml(value)+(row.over_limit?' '+window.GT.components.statusBadge('Over limit','danger'):''); }, exportValue: function (row) { return row.credit_label+(row.over_limit?' Over limit':''); } },
        { label: 'Balance', field: 'balance', sortable: true, priority: 1, align: 'right', numeric: true, minWidth: 120, formatter: function (value) { return window.GT.format.formatMoney(value); }, exportValue: function (row) { return row.balance; } },
        { label: 'Status', field: 'status_label', sortable: true, priority: 1, html: true, formatter: function (value, row) { return window.GT.components.statusBadge(value, row.active ? 'success' : 'neutral'); } }
      ],
      actions: customerActions(),
      emptyState: { message: 'No customers match the current search and filters.', action: { label: 'Add customer', show: function () { return can('C'); }, onClick: function () { window.location.hash = '#/customers/new'; } } },
      exportName: 'genuine-textiles-customers.csv'
    });
    return '<section class="customers-page">' + pageHeader({ title: 'Customer List', description: 'Manage customer contacts, terms and account status.', breadcrumbs: [{ label: 'Customers' }], actions: [{ label: 'New customer', route: '#/customers/new', icon: 'plus', permission: 'customers', permissionAction: 'C' }] }) + '<div id="customerListMount"></div></section>';
  }

  function bindList() { listTable.mount('#customerListMount'); }

  function customerSections() {
    return [
      { title: 'Basic details', fields: [
        { name: 'name', label: 'Customer name', type: 'text', required: true },
        { name: 'customer_group_id', label: 'Customer group', type: 'select', required: true, valueType: 'number', options: optionRows('customer_groups') },
        { name: 'contact_person', label: 'Contact person', type: 'text' },
        { name: 'phone', label: 'Phone', type: 'phone', required: true, placeholder: '+256 7XX XXX XXX or 07XX XXX XXX' },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'address', label: 'Address', type: 'textarea', rows: 2, fullWidth: true }
      ] },
      { title: 'Credit terms', description: 'BUSINESS_RULES.md section 4 uses 30-day terms for approved credit customers.', fields: [
        { name: 'is_credit', label: 'Credit customer', checkboxLabel: 'Allow this customer to buy on credit', type: 'checkbox', fullWidth: true },
        { name: 'credit_limit', label: 'Credit limit (UGX)', type: 'money', className: 'credit-dependent' },
        { name: 'credit_days', label: 'Credit days', type: 'number', defaultValue: 30, className: 'credit-dependent' }
      ] },
      { title: 'Marketing', fields: [{ name: 'lead_source_id', label: 'How did you hear about us?', type: 'select', valueType: 'number', options: optionRows('lead_sources'), fullWidth: true }] },
      { title: 'Notes', fields: [{ name: 'notes', label: 'Notes', type: 'textarea', rows: 4, fullWidth: true }] }
    ];
  }

  function initialCustomerValues(customer) {
    return customer || { name: '', customer_group_id: '', contact_person: '', phone: '', email: '', address: '', is_credit: false, credit_limit: '', credit_days: 30, lead_source_id: '', notes: '', active: true };
  }

  function renderForm(params) {
    var id = params.id ? Number(params.id) : null;
    var customer = id ? window.GT.store.find('customers', id) : null;
    if (id && !customer) return '<section class="page-placeholder customer-not-found"><h1>Customer not found</h1><p>The requested customer does not exist.</p><a class="btn btn-primary" href="#/customers">Back to customers</a></section>';
    var editing = Boolean(customer);
    return '<section class="customers-page customer-form-page">' + pageHeader({ title: editing ? 'Edit customer' : 'New customer', breadcrumbs: [{ label: 'Customers', route: '#/customers' }, { label: editing ? customer.name : 'New customer' }], description: editing ? 'Update contact details and account terms.' : 'Add a customer for future orders and documents.' }) + window.GT.forms.render({ id: 'customerForm', sections: customerSections(), values: initialCustomerValues(customer), submitLabel: editing ? 'Save changes' : 'Create customer', cancelRoute: editing ? '#/customers/' + customer.id : '#/customers' }) + '</section>';
  }

  function setCreditVisibility(form) {
    var visible = form.elements.is_credit.checked;
    form.querySelectorAll('.credit-dependent').forEach(function (field) { field.hidden = !visible; });
  }

  function validateCustomer(values, customerId) {
    var errors = {};
    var name = String(values.name || '').trim();
    if (!window.GT.validate.required(name)) errors.name = 'Customer name is required.';
    if (!window.GT.validate.uniqueName('customers', name, customerId)) errors.name = 'A customer with this name already exists.';
    if (!window.GT.validate.required(values.phone)) errors.phone = 'Phone is required.';
    else if (!window.GT.validate.ugandanPhone(values.phone)) errors.phone = 'Use +2567XXXXXXXX or 07XXXXXXXX. Spaces are allowed.';
    if (!window.GT.validate.email(values.email)) errors.email = 'Enter a valid email address.';
    if (!window.GT.validate.required(values.customer_group_id)) errors.customer_group_id = 'Choose a customer group.';
    if (values.is_credit && Number(values.credit_limit) <= 0) errors.credit_limit = 'Enter a credit limit greater than 0.';
    if (values.is_credit && Number(values.credit_days) <= 0) errors.credit_days = 'Enter credit days greater than 0.';
    return errors;
  }

  function customerRecord(values, existing) {
    return {
      name: String(values.name || '').trim(),
      contact_person: String(values.contact_person || '').trim(),
      phone: String(values.phone || '').trim(),
      email: String(values.email || '').trim(),
      address: String(values.address || '').trim(),
      customer_group_id: Number(values.customer_group_id),
      is_credit: Boolean(values.is_credit),
      credit_limit: values.is_credit ? Number(values.credit_limit) : 0,
      credit_days: values.is_credit ? Number(values.credit_days || 30) : 0,
      lead_source_id: values.lead_source_id ? Number(values.lead_source_id) : null,
      notes: String(values.notes || '').trim(),
      active: existing ? existing.active : true
    };
  }

  function bindForm(params) {
    var form = document.getElementById('customerForm');
    if (!form) return;
    var customerId = params.id ? Number(params.id) : null;
    var existing = customerId ? window.GT.store.find('customers', customerId) : null;
    var sections = customerSections();
    setCreditVisibility(form);
    form.elements.is_credit.addEventListener('change', function () { setCreditVisibility(form); });
    formTracker = window.GT.forms.trackDirty(form);
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var values = window.GT.forms.read(form, sections);
      var errors = validateCustomer(values, customerId);
      if (!window.GT.forms.showErrors(form, errors)) return;
      var record = customerRecord(values, existing);
      var saved;
      if (existing) {
        saved = window.GT.store.update('customers', customerId, record);
        window.GT.audit.log('update', 'customers', customerId, existing, saved);
        window.GT.components.showToast(saved.name + ' was updated.', 'success');
      } else {
        saved = window.GT.store.create('customers', record);
        window.GT.audit.log('create', 'customers', saved.id, null, saved);
        window.GT.components.showToast(saved.name + ' was created.', 'success');
      }
      formTracker.markSaved();
      window.location.hash = '#/customers/' + saved.id;
    });
  }

  function detailPanel(id, title, body, active) {
    return '<section class="detail-tab-panel" id="' + id + '" role="tabpanel"' + (active ? '' : ' hidden') + '><h2>' + title + '</h2>' + body + '</section>';
  }

  function laterPhaseEmpty(message) { return '<div class="empty-state detail-empty"><i data-lucide="clock-3" aria-hidden="true"></i><p>' + message + '</p></div>'; }
  function customerDocuments(customerId) {
    var docs=window.GT.store.where('sales_documents',function (row) { return Number(row.customer_id)===Number(customerId) && row.status!=='discarded'; });
    if (!docs.length) return '<p>No quotations, proformas or invoices yet.</p>';
    return '<ul class="customer-document-list">'+docs.map(function (doc) {
      var type=doc.type==='quotation'?'quotations':doc.type==='proforma'?'proformas':'invoices';
      return '<li><a href="#/sales/'+type+'/'+doc.id+'">'+window.GT.components.escapeHtml(doc.type+' '+(doc.number||'Draft'))+'</a><span>'+window.GT.dates.formatDate(doc.issue_date)+'</span><span>'+window.GT.format.formatMoney(doc.total)+'</span>'+window.GT.components.statusBadge(doc.status,doc.status==='void'?'danger':doc.status==='issued'?'info':'neutral')+'</li>';
    }).join('')+'</ul>';
  }

  function renderDetail(params) {
    var customer = window.GT.store.find('customers', Number(params.id));
    if (!customer) return '<section class="page-placeholder customer-not-found"><h1>Customer not found</h1><p>The requested customer does not exist.</p><a class="btn btn-primary" href="#/customers">Back to customers</a></section>';
    var balance = window.GT.customers.balance(customer.id);
    var available = customer.is_credit ? customer.credit_limit - balance : 0;
    var overview = '<dl class="detail-grid">' + window.GT.components.detailRow('Customer group', groupName(customer.customer_group_id)) + window.GT.components.detailRow('Contact person', customer.contact_person) + window.GT.components.detailRow('Phone', customer.phone) + window.GT.components.detailRow('Email', customer.email) + window.GT.components.detailRow('Address', customer.address) + window.GT.components.detailRow('Account type', customer.is_credit ? 'Credit' : 'Cash') + window.GT.components.detailRow('Credit terms', customer.is_credit ? customer.credit_days + ' days' : 'Not applicable') + window.GT.components.detailRow('Lead source', leadName(customer.lead_source_id)) + window.GT.components.detailRow('Notes', customer.notes) + '</dl>';
    var credit = (customer.is_credit && available<0?window.GT.components.statusBadge('Over limit','danger'):'')+'<dl class="detail-grid">' + window.GT.components.detailRow('Credit limit', customer.is_credit ? window.GT.format.formatMoney(customer.credit_limit) : 'Not applicable') + window.GT.components.detailRow('Credit days', customer.is_credit ? customer.credit_days + ' days' : 'Not applicable') + window.GT.components.detailRow('Outstanding balance', window.GT.format.formatMoney(balance)) + window.GT.components.detailRow('Available credit', customer.is_credit ? window.GT.format.formatMoney(available) : 'Not applicable') + '</dl>'+(balance>0&&window.GT.permissions.can('debtors','V')?'<p><a class="btn btn-outline-primary" href="#/debtors/'+customer.id+'">View debtor details</a></p>':'');
    if (window.GT.permissions.can('receipts','V')) {
      recentPaymentsTable=window.GT.dataTable.create({id:'recentPayments',rows:function () { return window.GT.receipts.listForCustomer(customer.id).filter(function (row) { return window.GT.session.currentUser().role!=='sales'||row.received_by===window.GT.session.currentUser().id; }).sort(function (a,b) { return b.received_at.localeCompare(a.received_at); }).slice(0,10); },searchFields:['number','reference'],columns:[{label:'Number',field:'number',priority:1},{label:'Date',field:'received_at',priority:1,formatter:window.GT.dates.formatDate},{label:'Amount',field:'amount',priority:1,align:'right',numeric:true,formatter:window.GT.format.formatMoney},{label:'Status',field:'status',priority:2}],actions:[{label:'View',icon:'eye',primary:true,onClick:function (row) { location.hash='#/receipts/'+row.id; }}],emptyState:{message:'No recent payments.'},exportName:'recent-payments.csv'});
      credit+='<h3>Recent payments</h3><div id="customerRecentPayments"></div><p><a href="#/receipts?customer='+customer.id+'">View all receipts</a></p>';
    }
    var actions = [
      { label: 'Edit customer', route: '#/customers/' + customer.id + '/edit', icon: 'pencil', permission: 'customers', permissionAction: 'E' },
      { label: customer.active ? 'Deactivate' : 'Activate', name: 'toggle-status', className: 'btn-outline-secondary', permission: 'customers', permissionAction: 'E' },
      { label: 'Delete', name: 'delete', className: 'btn-outline-danger', permission: 'customers', permissionAction: 'A' }
    ];
    return '<section class="customers-page customer-detail-page" data-customer-id="' + customer.id + '">' + pageHeader({ title: customer.name, badge: window.GT.components.statusBadge(customer.active ? 'Active' : 'Inactive', customer.active ? 'success' : 'neutral'), breadcrumbs: [{ label: 'Customers', route: '#/customers' }, { label: customer.name }], actions: actions }) + '<div class="detail-card">' + window.GT.components.tabs([{ id: 'overview', label: 'Overview' }, { id: 'credit', label: 'Credit and Balance' }, { id: 'documents', label: 'Documents' }, { id: 'orders', label: 'Orders' }, { id: 'reminders', label: 'Reminders' }], 'overview') + detailPanel('overview', 'Overview', overview, true) + detailPanel('credit', 'Credit and Balance', credit, false) + detailPanel('documents', 'Documents', customerDocuments(customer.id), false) + detailPanel('orders', 'Orders', laterPhaseEmpty('Customer orders arrive in a later phase.'), false) + detailPanel('reminders', 'Reminders', laterPhaseEmpty('Payment reminders arrive in a later phase.'), false) + '</div></section>';
  }

  function bindDetail(params) {
    var customer = window.GT.store.find('customers', Number(params.id));
    if (!customer) return;
    if (recentPaymentsTable && document.getElementById('customerRecentPayments')) recentPaymentsTable.mount('#customerRecentPayments');
    document.querySelectorAll('[data-tab-target]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('[data-tab-target]').forEach(function (item) { item.classList.toggle('active', item === tab); item.setAttribute('aria-selected', item === tab); });
        document.querySelectorAll('.detail-tab-panel').forEach(function (panel) { panel.hidden = panel.id !== tab.dataset.tabTarget; });
      });
    });
    var toggle = document.querySelector('[data-page-action="toggle-status"]');
    if (toggle) toggle.addEventListener('click', function () { changeCustomerStatus(customer, !customer.active); });
    var remove = document.querySelector('[data-page-action="delete"]');
    if (remove) remove.addEventListener('click', function () { deleteCustomer(customer); });
  }

  function groupRows() {
    return window.GT.store.all('customer_groups').map(function (group) {
      return Object.assign({}, group, { customer_count: window.GT.store.where('customers', { customer_group_id: group.id }).length });
    });
  }

  function showGroupModal(group) {
    var editing = Boolean(group);
    window.GT.components.openModal({ title: editing ? 'Rename customer group' : 'Add customer group', content: '<form id="customerGroupForm" novalidate><label class="form-label" for="groupName">Group name</label><input class="form-control" id="groupName" name="name" value="' + window.GT.components.escapeHtml(editing ? group.name : '') + '" required><p class="field-error" id="groupNameError"></p><div class="gt-modal-actions"><button class="btn btn-primary" type="submit">' + (editing ? 'Save name' : 'Add group') + '</button></div></form>' });
    var form = document.getElementById('customerGroupForm');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var name = form.elements.name.value.trim();
      var duplicate = window.GT.store.all('customer_groups').some(function (item) { return (!editing || item.id !== group.id) && item.name.toLowerCase() === name.toLowerCase(); });
      var error = !name ? 'Group name is required.' : (duplicate ? 'This group already exists.' : '');
      document.getElementById('groupNameError').textContent = error;
      if (error) return;
      var saved;
      if (editing) {
        var before = window.GT.store.find('customer_groups', group.id);
        saved = window.GT.store.update('customer_groups', group.id, { name: name });
        window.GT.audit.log('update', 'customer_groups', group.id, before, saved);
      } else {
        saved = window.GT.store.create('customer_groups', { name: name });
        window.GT.audit.log('create', 'customer_groups', saved.id, null, saved);
      }
      window.GT.components.closeModal();
      window.GT.components.showToast('Customer group saved.', 'success');
      groupsTable.refresh();
    });
    form.elements.name.focus();
  }

  function deleteGroup(group, table) {
    var count = window.GT.store.where('customers', { customer_group_id: group.id }).length;
    if (count) {
      window.GT.components.showToast('Move the ' + count + ' customer' + (count === 1 ? '' : 's') + ' in this group before deleting it.', 'error', 'Group is in use');
      return;
    }
    window.GT.components.confirmDialog({ title: 'Delete customer group?', message: 'This permanently removes ' + group.name + '.', confirmText: 'Delete group' }).then(function (confirmed) {
      if (!confirmed) return;
      var before = window.GT.store.find('customer_groups', group.id);
      window.GT.store.remove('customer_groups', group.id);
      window.GT.audit.log('delete', 'customer_groups', group.id, before, null);
      window.GT.components.showToast('Customer group deleted.', 'success');
      table.refresh();
    });
  }

  function renderGroups() {
    groupsTable = window.GT.dataTable.create({
      id: 'customerGroupsTable', rows: groupRows, caption: 'Customer groups', searchPlaceholder: 'Search groups', searchFields: ['name'],
      columns: [{ label: 'Group name', field: 'name', sortable: true, priority: 1 }, { label: 'Customers', field: 'customer_count', sortable: true, priority: 1, align: 'right', numeric: true, minWidth: 100 }],
      actions: [
        { label: 'Rename', icon: 'pencil', primary: true, show: function () { return can('E'); }, onClick: function (row) { showGroupModal(row); } },
        { label: 'Delete', icon: 'trash-2', destructive: true, show: function () { return can('A'); }, onClick: deleteGroup }
      ],
      emptyState: { message: 'No customer groups have been added.', action: { label: 'Add group', show: function () { return can('C'); }, onClick: function () { showGroupModal(); } } },
      exportName: 'genuine-textiles-customer-groups.csv'
    });
    return '<section class="customers-page customer-groups-page">' + pageHeader({ title: 'Customer Groups', description: 'Organise customers for searching and reporting.', breadcrumbs: [{ label: 'Customers', route: '#/customers' }, { label: 'Customer Groups' }], actions: [{ label: 'Add group', name: 'add-group', icon: 'plus', permission: 'customers', permissionAction: 'C' }] }) + '<div id="customerGroupsMount"></div></section>';
  }

  function bindGroups() {
    groupsTable.mount('#customerGroupsMount');
    var add = document.querySelector('[data-page-action="add-group"]');
    if (add) add.addEventListener('click', function () { showGroupModal(); });
  }

  function render(view, params) {
    if (view === 'list') return renderList();
    if (view === 'new' || view === 'edit') return renderForm(params || {});
    if (view === 'detail') return renderDetail(params || {});
    if (view === 'groups') return renderGroups();
    return '';
  }

  function bind(view, params) {
    if (view === 'list') bindList();
    else if (view === 'new' || view === 'edit') bindForm(params || {});
    else if (view === 'detail') bindDetail(params || {});
    else if (view === 'groups') bindGroups();
  }

  var api = { render: render, bind: bind };
  [
    ['#/customers', 'list', 'Customer List', 'V'],
    ['#/customers/groups', 'groups', 'Customer Groups', 'V'],
    ['#/customers/new', 'new', 'New Customer', 'C'],
    ['#/customers/:id/edit', 'edit', 'Edit Customer', 'E'],
    ['#/customers/:id', 'detail', 'Customer Details', 'V']
  ].forEach(function (definition) {
    // app.js receives both this view name and any :id params from the shared router.
    window.GT.router.register(definition[0], { module: api, view: definition[1], title: definition[2], permission: 'customers', action: definition[3], baseRoute: '#/customers' });
  });
  return api;
}());
