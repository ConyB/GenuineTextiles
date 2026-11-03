/* Phase 4 read-only audit register with filters and before/after comparison. */
window.GT = window.GT || {};
window.GT.auditLogModule = (function () {
  var table = null;
  function parse(value) { try { return value ? JSON.parse(value) : null; } catch (error) { return null; } }
  function userName(id) { var user = window.GT.store.find('users', id); return user ? user.name : 'System'; }
  function formatDate(value) { return new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Kampala', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  function label(value) { return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, function (letter) { return letter.toUpperCase(); }); }
  function summary(row) { return label(row.action) + ' ' + label(row.entity_type) + ' #' + row.entity_id; }
  function rows() { return window.GT.store.all('audit_logs').sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); }).map(function (row) { return Object.assign({}, row, { user_name: userName(row.user_id), action_label: label(row.action), entity_label: label(row.entity_type), summary: summary(row), date_display: formatDate(row.created_at) }); }); }
  function options(values) { return Array.from(new Set(values)).sort().map(function (value) { return { value: value, label: label(value) }; }); }
  function display(value) { if (value === null || value === undefined || value === '') return '—'; return typeof value === 'object' ? JSON.stringify(value) : String(value); }
  function showChanges(row) {
    var before = parse(row.before_json); var after = parse(row.after_json); var keys = Array.from(new Set(Object.keys(before || {}).concat(Object.keys(after || {}))));
    if (before && after) keys = keys.filter(function (key) { return JSON.stringify(before[key]) !== JSON.stringify(after[key]); });
    var body = keys.length ? keys.map(function (key) { return '<tr><th scope="row">' + window.GT.components.escapeHtml(label(key)) + '</th><td>' + window.GT.components.escapeHtml(display(before && before[key])) + '</td><td>' + window.GT.components.escapeHtml(display(after && after[key])) + '</td></tr>'; }).join('') : '<tr><td colspan="3">No field differences were recorded.</td></tr>';
    window.GT.components.openModal({ title: 'Changes: ' + summary(row), content: '<div class="audit-changes-modal"><table class="audit-change-table"><thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>' + body + '</tbody></table></div>' });
  }
  function render() {
    var auditRows = rows();
    table = window.GT.dataTable.create({ id: 'auditLogTable', rows: rows, caption: 'Audit log', searchFields: ['user_name', 'action_label', 'entity_label', 'summary'], searchPlaceholder: 'Search audit log',
      filters: [
        { name: 'user', label: 'User', field: 'user_id', options: window.GT.store.all('users').map(function (user) { return { value: user.id, label: user.name }; }) },
        { name: 'action', label: 'Action', field: 'action', options: options(auditRows.map(function (row) { return row.action; })) },
        { name: 'entity', label: 'Entity type', field: 'entity_type', options: options(auditRows.map(function (row) { return row.entity_type; })) },
        { name: 'date_from', label: 'From date', type: 'date', test: function (row, value) { return String(row.created_at).slice(0, 10) >= value; } },
        { name: 'date_to', label: 'To date', type: 'date', test: function (row, value) { return String(row.created_at).slice(0, 10) <= value; } }
      ],
      columns: [{ label: 'Date and time', field: 'created_at', sortable: true, priority: 1, minWidth: 150, formatter: function (value) { return formatDate(value); }, exportValue: function (row) { return row.created_at; } }, { label: 'User', field: 'user_name', sortable: true, priority: 1 }, { label: 'Action', field: 'action_label', sortable: true, priority: 1 }, { label: 'Entity type', field: 'entity_label', sortable: true, priority: 1 }, { label: 'Entity ID', field: 'entity_id', sortable: true, priority: 3, align: 'right', numeric: true, minWidth: 90 }, { label: 'Summary', field: 'summary', priority: 2 }],
      actions: [{ label: 'View changes', icon: 'eye', primary: true, onClick: showChanges }], emptyState: { message: 'No audit entries match the current filters.' }, exportName: 'genuine-textiles-audit-log.csv' });
    return '<section class="audit-log-page">' + window.GT.components.pageHeader({ title: 'Audit Log', description: 'Read-only history of changes made throughout the prototype.', breadcrumbs: [{ label: 'Administration' }, { label: 'Audit Log' }] }) + '<div id="auditLogMount"></div></section>';
  }
  function bind() { table.mount('#auditLogMount'); }
  var api = { render: render, bind: bind };
  window.GT.router.register('#/admin/audit-log', { module: api, view: 'list', title: 'Audit Log', permission: 'audit_log', action: 'V', baseRoute: '#/admin/audit-log' });
  return api;
}());
