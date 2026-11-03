/* Table catalogue from DATABASE_DESIGN.md; protected tables are never hard-deleted. */
window.GT.schema = (function () {
  function table(name, label, protectedTable) {
    return { name: name, label: label, protected: Boolean(protectedTable) };
  }

  var tables = [
    table('users', 'Users'), table('roles', 'Roles'), table('locations', 'Locations'),
    table('business_settings', 'Business Settings'), table('document_sequences', 'Document Sequences'),
    table('audit_logs', 'Audit Logs', true), table('approvals', 'Approvals', true),

    table('customer_groups', 'Customer Groups'), table('customers', 'Customers'),
    table('suppliers', 'Suppliers'), table('employees', 'Employees'),

    table('materials', 'Materials', true), table('material_stock', 'Material Stock', true),
    table('products', 'Products', true), table('product_variants', 'Product Variants', true),
    table('finished_good_adjustments', 'Finished Good Adjustments', true),
    table('stock_movements', 'Stock Movements', true),
    table('stock_adjustments', 'Stock Adjustments', true),
    table('goods_received_notes', 'Goods Received Notes', true), table('grn_items', 'GRN Items', true),
    table('material_issues', 'Material Issues', true), table('material_issue_items', 'Material Issue Items', true),

    table('sales_documents', 'Sales Documents', true), table('sales_document_items', 'Sales Document Items', true),
    table('receipts', 'Receipts', true), table('quick_sales', 'Quick Sales', true), table('quick_sale_items', 'Quick Sale Items', true),
    table('delivery_notes', 'Delivery Notes', true), table('delivery_note_items', 'Delivery Note Items', true),
    table('statements', 'Statements', true), table('debt_reminders', 'Debt Reminders', true),

    table('order_stages', 'Order Stages'), table('orders', 'Orders', true), table('order_items', 'Order Items'),
    table('order_stage_history', 'Order Stage History', true), table('order_changes', 'Order Changes', true),
    table('order_attachments', 'Order Attachments'), table('designs', 'Designs'),
    table('fabric_rules', 'Fabric Rules'), table('fabric_rule_adjustments', 'Fabric Rule Adjustments'),
    table('fabric_width_adjustments', 'Fabric Width Adjustments'), table('fabric_wastage_rules', 'Fabric Wastage Rules'),
    table('fabric_markup_rules', 'Fabric Markup Rules'), table('fabric_calculations', 'Fabric Calculation Notes'),
    table('production_logs', 'Production Logs'), table('quality_issues', 'Quality Issues'),
    table('production_targets', 'Production Targets'), table('attendance', 'Attendance'),
    table('piece_rates', 'Piece Rates'),
    table('payroll_runs', 'Payroll Runs', true), table('payroll_lines', 'Payroll Lines', true),

    table('expense_categories', 'Expense Categories'), table('expenses', 'Expenses', true),
    table('petty_cash_entries', 'Petty Cash Entries', true), table('budgets', 'Budgets', true),
    table('accounts', 'Accounts'), table('ledger_entries', 'Ledger Entries', true),
    table('opening_balances', 'Opening Balances', true), table('sales_targets', 'Sales Targets', true), table('sales_target_history', 'Sales Target History', true),

    table('message_templates', 'Message Templates'), table('messages', 'Messages'),
    table('posters', 'Posters'), table('campaigns', 'Campaigns'), table('lead_sources', 'Lead Sources')
  ];

  function find(name) {
    return tables.find(function (item) { return item.name === name; }) || null;
  }

  return { tables: tables, find: find };
}());
