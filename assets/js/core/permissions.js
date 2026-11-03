/* Permission matrix copied from ROLE_PERMISSION_MATRIX.md; own is metadata only. */
window.GT = window.GT || {};
window.GT.permissions = (function () {
  var R = { owner: 'Owner', general_manager: 'Gen. Manager', store_keeper: 'Store Keeper', sales: 'Sales', workshop_supervisor: 'Workshop Sup.', accountant: 'Accountant', marketing_manager: 'Marketing Mgr' };
  function row(owner, generalManager, storeKeeper, sales, workshop, accountant, marketing) { return { owner: owner, general_manager: generalManager, store_keeper: storeKeeper, sales: sales, workshop_supervisor: workshop, accountant: accountant, marketing_manager: marketing }; }
  var matrix = {
    dashboard_full: row('V','V','X','X','X','V','X'), dashboard_role: row('V','V','V','V own','V','V','V'), customers: row('VCEA','VCE','X','VC','V','V','V'), quotations_proformas: row('VCEA','VCE','X','VC own','X','V','X'), invoices: row('VCEA','VCEA','X','VC own','X','V','X'), discounts: row('A','A','X','request','X','X','X'), void_invoice: row('A','A','X','X','X','X','X'), receipts: row('VCEA','VCE','X','VC own','X','V','X'), quick_sale: row('V','VC','X','VC own','X','V','X'), orders: row('VCEA','VCE','V','VC own','VE stage','V','X'), production: row('V','V','X','X','VCE','X','X'), fabric_calculator: row('VCE','X','X','X','X','X','X'), materials_stock: row('VCEA','V','VCE','X','V no cost','V','X'), stock_adjustment: row('VCA','VC','VC','X','X','X','X'), material_issue: row('VCEA','VCE','VC','X','VC own','V','X'), goods_received_notes: row('VCEA','VC','VC','X','X','V','X'), suppliers: row('VCE','VCE','VC','X','X','V','X'), dispatch: row('V','VCEA','VC','VC own','VC','V','X'), delivery_notes: row('VCEA','VCE','VC','VC own','V','V','X'), debtors: row('VCEA','VCE','X','X','X','VC','X'), payment_reminders: row('VC','VC','X','X','X','VC','X'), expenses: row('VCEA','VC','X','X','X','VC','X'), payment_approval: row('A','X','X','X','X','X','X'), budgets: row('VCEA','V','X','X','X','VC','X'), financial_statements: row('V','V','X','X','X','V','X'), sales_reports: row('V','V','X','X','X','V','X'), employees: row('VCEA','VCE','X','X','VC log attendance','V','X'), wages: row('VCEA','VC','X','X','X','VC','X'), messages: row('V','VC','X','VC','X','VC','VC'), bulk_messages: row('V','VC','X','X','X','X','request'), poster_studio: row('V','V','X','X','X','X','VCE'), marketing_campaigns: row('V','V','X','X','X','X','VCE'), users_roles: row('VCEA','X','X','X','X','X','X'), settings_numbering: row('VCEA','V','X','X','X','X','X'), audit_log: row('V','V','X','X','X','V','X')
  };
  // Phase 17: only Owner and General Manager edit employee identity and pay terms.
  matrix.people_admin = row('VCE','VCE','X','X','X','X','X');
  // Phase 19, A-104: navigation separates compose, template review and the log.
  matrix.messages_compose = row('VC','VC','X','VC','X','X','VC');
  matrix.messages_templates = row('VCE','VCE','X','V','X','VE','VCE');
  matrix.messages_log = row('V','V','X','V own','X','V','V');
  matrix.poster_studio = row('VCE','VCE','X','X','X','X','VCE');
  // Phase 20, A-110: apply the stricter existing campaign matrix until the owner resolves the conflict.
  matrix.campaign_details = row('V','V','X','X','X','X','V');
  matrix.lead_source_report = row('V','V','X','X','X','V','V');
  matrix.sales_targets = row('VCE','VCE','X','V own','X','V','X');
  function value(moduleKey, role) { return (matrix[moduleKey] || {})[role] || 'X'; }
  return { matrix: matrix, roles: R, can: function (moduleKey, action, user) { var current = user || GT.session.currentUser(); var grant = current ? value(moduleKey, current.role) : 'X'; return grant.indexOf(action) !== -1; }, ownOnly: function (moduleKey, user) { var current = user || GT.session.currentUser(); return current ? value(moduleKey, current.role).indexOf('own') !== -1 : false; } };
}());


