/* Receipt lifecycle and calculations: BUSINESS_RULES.md sections 1, 3 and 4. */
window.GT = window.GT || {};
window.GT.receipts = (function () {
  var GT = window.GT;
  var methods = ['cash', 'mtn', 'airtel', 'bank', 'cheque'];
  function actor() { return GT.session.currentUser(); }
  function invoice(id) {
    var row = GT.store.find('sales_documents', id);
    return row && row.type === 'invoice' ? row : null;
  }
  function listForInvoice(id) {
    return GT.store.where('receipts', function (row) { return Number(row.invoice_id) === Number(id); });
  }
  function listForCustomer(id) {
    return GT.store.where('receipts', function (row) { return Number(row.customer_id) === Number(id); });
  }
  function openInvoicesFor(customerId) {
    // BUSINESS_RULES.md section 3: only issued invoices with money still due can receive payment.
    return GT.store.where('sales_documents', function (row) {
      return row.type === 'invoice' && row.status === 'issued' && GT.salesDocs.mayView(row) &&
        (!customerId || Number(row.customer_id) === Number(customerId)) && GT.invoices.summary(row.id).balance > 0;
    }).sort(function (a, b) { return a.issue_date.localeCompare(b.issue_date) || a.id - b.id; });
  }
  function defaultDescription(doc, amount) {
    if (!doc) return '';
    var summary = GT.invoices.summary(doc.id);
    if (Number(amount) === summary.balance) return 'Balance of invoice ' + doc.number;
    var count = listForInvoice(doc.id).filter(function (row) { return row.status !== 'void'; }).length;
    return (count ? 'Part payment on invoice ' : 'Deposit on invoice ') + doc.number;
  }
  function validate(values) {
    // BUSINESS_RULES.md section 3 (A-41): no draft, future date, or overpayment.
    var errors = {}, doc = invoice(values.invoice_id), amount = Number(values.amount);
    var date = String(values.received_at || '').slice(0, 10), method = values.payment_method;
    var reference = String(values.reference || '').trim();
    if (!doc || doc.status !== 'issued' || !GT.salesDocs.mayView(doc) || GT.invoices.summary(doc.id).balance <= 0) errors.invoice_id = 'Choose an issued invoice with a balance.';
    if (doc && values.customer_id && Number(values.customer_id) !== Number(doc.customer_id)) errors.customer_id = 'Customer does not match the invoice.';
    if (!Number.isSafeInteger(amount) || amount <= 0) errors.amount = 'Enter an amount above zero in whole shillings.';
    else if (doc && !errors.invoice_id && amount > GT.invoices.summary(doc.id).balance) errors.amount = 'Amount cannot exceed the invoice balance.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date+'T12:00:00Z').getTime()) || GT.dates.addDays(date,0)!==date || date > GT.dates.today() || (doc && date < doc.issue_date)) errors.received_at = 'Date must be from the invoice date through today.';
    if (methods.indexOf(method) === -1) errors.payment_method = 'Choose a payment method.';
    if ((method === 'mtn' || method === 'airtel') && !/^[A-Za-z0-9][A-Za-z0-9.\/-]{5,}$/.test(reference)) errors.reference = 'Enter a transaction ID of at least six letters or digits.';
    if (method === 'bank' && !reference) errors.reference = 'Enter the bank reference.';
    if (method === 'cheque' && !/^\d{4,12}$/.test(reference)) errors.reference = 'Enter a cheque number of 4 to 12 digits.';
    if (method !== 'cash' && reference && GT.store.where('receipts', function (row) {
      return row.status !== 'void' && row.payment_method === method && String(row.reference || '').toLowerCase() === reference.toLowerCase();
    }).length) errors.reference = 'This reference is already used for this method.';
    return errors;
  }
  function save(values) {
    if (!GT.permissions.can('receipts', 'C')) throw new Error('You cannot record receipts.');
    var errors = validate(values);
    if (Object.keys(errors).length) { var error = new Error('Correct the receipt fields.'); error.fields = errors; throw error; }
    return GT.store.transaction(function () {
      // Recheck the balance inside the transaction before consuming a number.
      var doc = invoice(values.invoice_id), balance = GT.invoices.summary(doc.id).balance;
      if (Number(values.amount) > balance) throw new Error('Amount cannot exceed the invoice balance.');
      var customer = GT.store.find('customers', doc.customer_id);
      var day = String(values.received_at).slice(0, 10);
      var row = GT.store.create('receipts', {
        number:GT.numbering.next('receipt'), customer_id:doc.customer_id, customer_name:customer.name,
        invoice_id:doc.id, amount:Number(values.amount), payment_method:values.payment_method,
        reference:values.payment_method === 'cash' ? '' : String(values.reference || '').trim(),
        description:String(values.description || '').trim() || defaultDescription(doc, values.amount),
        balance_after:balance - Number(values.amount), received_by:actor().id,
        received_at:day + 'T12:00:00+03:00', status:'issued', void_reason:null, voided_by:null, voided_at:null
      });
      GT.audit.log('issue', 'receipts', row.id, null, row);
      GT.cashBook.receipt(row, false);
      window.dispatchEvent(new Event('gt:receipt-changed'));
      return row;
    });
  }
  function canVoid(user) { return !!user && ['owner', 'general_manager'].indexOf(user.role) !== -1; }
  function voidReceipt(id, reason) {
    // BUSINESS_RULES.md section 3 (A-41): retain the issued row and its historic balance.
    var row = GT.store.find('receipts', id);
    if (GT.store.where('quick_sales',{receipt_id:Number(id)}).length) throw new Error('Request a Quick Sale void so its stock is reversed on Owner approval.');
    if (!canVoid(actor())) throw new Error('Only Owner or General Manager may void a receipt.');
    if (!row || row.status !== 'issued') throw new Error('Only an issued receipt can be voided.');
    if (!String(reason || '').trim()) throw new Error('A void reason is required.');
    return GT.store.transaction(function () {
      var after = GT.store.update('receipts', id, { status:'void', void_reason:String(reason).trim(),
        voided_by:actor().id, voided_at:new Date().toISOString() });
      GT.audit.log('void', 'receipts', id, row, after);
      GT.cashBook.receipt(after, true);
      window.dispatchEvent(new Event('gt:receipt-changed'));
      return after;
    });
  }
  function datedRows(dateRange) {
    var from = dateRange && (dateRange.from || dateRange.date_from) || '';
    var to = dateRange && (dateRange.to || dateRange.date_to) || '';
    return GT.store.where('receipts', function (row) {
      var day = String(row.received_at).slice(0, 10);
      return row.status !== 'void' && (!from || day >= from) && (!to || day <= to) && (!dateRange || !dateRange.received_by || Number(row.received_by)===Number(dateRange.received_by));
    });
  }
  function totalsByMethod(dateRange) {
    return datedRows(dateRange).reduce(function (totals, row) { totals[row.payment_method] += Number(row.amount); return totals; }, {cash:0,mtn:0,airtel:0,bank:0,cheque:0});
  }
  function collectedOn(date, receivedBy) { return datedRows({from:date,to:date,received_by:receivedBy}).reduce(function (sum,row) { return sum + Number(row.amount); }, 0); }
  function collectedInMonth(date, receivedBy) { return datedRows({from:String(date).slice(0,7)+'-01',to:GT.dates.endOfMonth(date),received_by:receivedBy}).reduce(function (sum,row) { return sum + Number(row.amount); }, 0); }
  return {validate:validate,openInvoicesFor:openInvoicesFor,defaultDescription:defaultDescription,save:save,voidReceipt:voidReceipt,
    canVoid:canVoid,listForInvoice:listForInvoice,listForCustomer:listForCustomer,totalsByMethod:totalsByMethod,collectedOn:collectedOn,collectedInMonth:collectedInMonth};
}());
