/* Customer calculations and active-picker options kept outside rendering code. */
window.GT = window.GT || {};
window.GT.customers = (function () {
  function balance(customerId) {
    // BUSINESS_RULES.md section 3: balances come from issued invoices less their receipts.
    var invoices = window.GT.store.where('sales_documents', function (document) {
      return Number(document.customer_id) === Number(customerId) && document.type === 'invoice' && document.status === 'issued';
    });
    var invoiceTotal = invoices.reduce(function (total, invoice) { return total + Number(invoice.total || 0); }, 0);
    var issuedIds = invoices.map(function (invoice) { return Number(invoice.id); });
    var receiptTotal = window.GT.store.where('receipts', function (receipt) { return Number(receipt.customer_id) === Number(customerId) && receipt.status !== 'void' && issuedIds.indexOf(Number(receipt.invoice_id)) !== -1; }).reduce(function (total, receipt) { return total + Number(receipt.amount || 0); }, 0);
    return invoiceTotal - receiptTotal;
  }

  function options() {
    // Inactive customers stay in history but cannot be selected for new work.
    return window.GT.store.where('customers', { active: true }).sort(function (left, right) { return left.name.localeCompare(right.name); }).map(function (customer) {
      return { value: customer.id, label: customer.name };
    });
  }

  function quickAdd(values) {
    // A-15: the document picker needs only the three identity fields; the customer remains a normal audited record.
    var errors = {};
    var name = String(values.name || '').trim();
    if (!window.GT.validate.required(name)) errors.name = 'Customer name is required.';
    else if (!window.GT.validate.uniqueName('customers', name)) errors.name = 'A customer with this name already exists.';
    if (!window.GT.validate.ugandanPhone(values.phone)) errors.phone = 'Use +2567XXXXXXXX or 07XXXXXXXX.';
    var group = window.GT.store.find('customer_groups', values.customer_group_id);
    if (!group) errors.customer_group_id = 'Choose a customer group.';
    if (Object.keys(errors).length) { var error = new Error('Correct the customer fields.'); error.validationErrors = errors; throw error; }
    return window.GT.store.transaction(function () {
      var saved = window.GT.store.create('customers', { name:name, contact_person:'', phone:String(values.phone).trim(), email:'', address:'', customer_group_id:group.id, is_credit:false, credit_limit:0, credit_days:0, lead_source_id:null, notes:'', active:true });
      window.GT.audit.log('create', 'customers', saved.id, null, saved);
      return saved;
    });
  }

  return { balance: balance, options: options, quickAdd:quickAdd };
}());
