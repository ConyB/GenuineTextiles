/* Invoice calculations and guarded metadata changes: BUSINESS_RULES.md sections 3 and 4. */
window.GT = window.GT || {};
window.GT.invoices = (function () {
  var GT = window.GT;
  function actor() { return GT.session.currentUser(); }
  function manager() { return actor() && ['owner','general_manager'].indexOf(actor().role) !== -1; }
  function invoice(id) { var row = GT.store.find('sales_documents', id); return row && row.type === 'invoice' ? row : null; }
  function receipts(id) { return GT.store.where('receipts', function (row) { return Number(row.invoice_id) === Number(id) && row.status !== 'void'; }); }
  function dueDate(date, customer) {
    // BUSINESS_RULES.md section 4: the customer's days override the default setting.
    var days = customer && customer.is_credit ? Number(customer.credit_days || GT.settings.defaultCreditDays) : 0;
    return GT.dates.addDays(date, days);
  }
  function isOverdue(date, balance, today) { return Number(balance) > 0 && !!date && (today || GT.dates.today()) > date; }
  function summary(id, today) {
    // BUSINESS_RULES.md section 3: payment state is derived from non-void receipts, never stored.
    var doc = invoice(id);
    if (!doc) throw new Error('Invoice was not found.');
    var paid = receipts(id).reduce(function (sum, row) { return sum + Number(row.amount || 0); }, 0);
    var balance = doc.status === 'void' ? 0 : Number(doc.total || 0) - paid;
    var due = doc.due_date || dueDate(doc.issue_date, GT.store.find('customers', doc.customer_id));
    var date = today || GT.dates.today();
    var active = doc.status === 'issued';
    return { paid:paid, balance:balance, paymentStatus:active ? (balance <= 0 ? 'paid' : paid > 0 ? 'part_paid' : 'unpaid') : null,
      dueDate:due, isOverdue:active && isOverdue(due, balance, date), daysOverdue:active && isOverdue(due, balance, date) ? GT.dates.daysBetween(due, date) : 0,
      ageDays:Math.max(0, GT.dates.daysBetween(doc.issue_date, date)) };
  }
  function ageBucket(days) { return days <= 30 ? '0–30' : days <= 60 ? '31–60' : '61+'; }
  function creditCheck(customerId, newTotal) {
    // BUSINESS_RULES.md section 4: compare existing receivables plus the proposed invoice with the limit.
    var customer = GT.store.find('customers', customerId);
    if (!customer) throw new Error('Customer was not found.');
    var balance = GT.customers.balance(customerId), limit = Number(customer.credit_limit || 0);
    return { customerId:Number(customerId), isCredit:!!customer.is_credit, balance:balance, creditLimit:limit,
      availableCredit:customer.is_credit ? limit - balance : null, proposedTotal:Number(newTotal || 0),
      exceedsLimit:!!customer.is_credit && balance + Number(newTotal || 0) > limit };
  }
  function assertCreditApproval(doc, reason) {
    var check = creditCheck(doc.customer_id, doc.total);
    if (!check.exceedsLimit || doc.credit_override_approved_by) return check;
    if (!manager()) throw new Error('Credit limit approval is required before this invoice can be issued.');
    if (!String(reason || '').trim()) throw new Error('A credit override reason is required.');
    return check;
  }
  function requestCreditApproval(id) {
    // BUSINESS_RULES.md section 4: Sales keeps the invoice in draft until a manager decides.
    var doc = invoice(id);
    if (!doc || !GT.salesDocs.canEdit(doc)) throw new Error('Only an editable invoice can request approval.');
    var check = creditCheck(doc.customer_id, doc.total);
    if (!check.exceedsLimit) throw new Error('This invoice is within the credit limit.');
    var existing = GT.store.where('approvals', function (row) { return row.type === 'credit_limit' && Number(row.entity_id) === Number(id) && row.status === 'requested'; })[0];
    if (existing) return existing;
    return GT.store.transaction(function () {
      var request = GT.store.create('approvals', { type:'credit_limit', entity_type:'sales_documents', entity_id:doc.id,
        requested_by:actor().id, approved_by:null, status:'requested', reason:'Invoice exceeds credit limit.' });
      GT.audit.log('request_credit_limit', 'sales_documents', doc.id, null, request);
      return request;
    });
  }
  function approveCredit(id) {
    // ROLE_PERMISSION_MATRIX.md Invoices: only Owner and General Manager decide credit overrides.
    var doc = invoice(id);
    if (!manager() || !doc || doc.status !== 'draft') throw new Error('Only Owner or General Manager can approve this draft.');
    var pending = GT.store.where('approvals', function (row) { return row.type === 'credit_limit' && Number(row.entity_id) === Number(id) && row.status === 'requested'; })[0];
    if (!pending) throw new Error('No credit approval request is pending.');
    return GT.store.transaction(function () {
      GT.store.update('approvals', pending.id, { status:'approved', approved_by:actor().id });
      var after = GT.store.update('sales_documents', id, { credit_override_approved_by:actor().id });
      GT.audit.log('approve_credit_limit', 'sales_documents', id, doc, after);
      return after;
    });
  }
  function recordManagerOverride(id, reason) {
    var doc = invoice(id);
    if (!manager() || !doc || !String(reason || '').trim()) throw new Error('A manager and a reason are required.');
    return GT.store.transaction(function () {
      var pending = GT.store.where('approvals', function (row) { return row.type === 'credit_limit' && Number(row.entity_id) === Number(id) && row.status === 'requested'; })[0];
      var approval = pending ? GT.store.update('approvals', pending.id, { approved_by:actor().id, status:'approved', reason:String(reason).trim() }) :
        GT.store.create('approvals', { type:'credit_limit', entity_type:'sales_documents', entity_id:id,
          requested_by:actor().id, approved_by:actor().id, status:'approved', reason:String(reason).trim() });
      var after = GT.store.update('sales_documents', id, { credit_override_approved_by:actor().id });
      GT.audit.log('approve_credit_limit', 'sales_documents', id, doc, Object.assign({ approval_id:approval.id }, after));
      return after;
    });
  }
  function terms(customer, due) {
    return customer && customer.is_credit ? GT.settings.creditInvoiceTerms + ' — Due ' + GT.dates.formatDate(due) : GT.settings.cashInvoiceTerms;
  }
  function convertFrom(sourceId) {
    // BUSINESS_RULES.md section 3: conversion copies content and leaves the issued source untouched.
    var source = GT.store.find('sales_documents', sourceId);
    if (!source || ['quotation','proforma'].indexOf(source.type) === -1 || source.status !== 'issued' || !GT.salesDocs.mayView(source) || !GT.salesDocs.canCreate('invoice')) throw new Error('This source cannot be converted.');
    var existing = GT.store.where('sales_documents', function (row) { return row.type === 'invoice' && Number(row.source_document_id) === Number(sourceId) && row.status !== 'void'; })[0];
    if (existing) throw new Error('This document already has an active invoice.');
    return GT.store.transaction(function () {
      var values = Object.assign({}, source, { issue_date:GT.dates.today(), items:GT.salesDocs.items(source.id), order_reference:'', fiscal_document_no:'' });
      var draft = GT.salesDocs.saveDraft('invoice', values);
      var changes = { source_document_id:source.id, discount_status:source.discount_status,
        discount_requested_by:source.discount_requested_by, discount_approved_by:source.discount_approved_by };
      var after = GT.store.update('sales_documents', draft.id, changes);
      // BUSINESS_RULES.md section 8 (A-57): keep source, order and invoice links in both directions.
      if (GT.orders) {
        var order = GT.store.where('orders', function (item) { return Number(item.source_document_id) === source.id && item.status !== 'cancelled' && !item.invoice_id; })[0];
        if (order) { GT.orders.linkInvoice(order.id, after.id); after = GT.store.find('sales_documents', after.id); }
      }
      GT.audit.log('convert_to_invoice', 'sales_documents', after.id, null, after);
      return after;
    });
  }
  function setFiscalNo(id, value) {
    // BUSINESS_RULES.md section 3 (A-01): this is the sole editable issued-invoice field.
    var doc = invoice(id), role = actor() && actor().role;
    if (!doc || doc.status !== 'issued' || ['owner','general_manager','accountant'].indexOf(role) === -1 || !GT.salesDocs.mayView(doc)) throw new Error('Fiscal Document No. cannot be edited.');
    return GT.store.transaction(function () {
      var after = GT.store.update('sales_documents', id, { fiscal_document_no:String(value || '').trim() || null });
      GT.audit.log('update_fiscal_document_no', 'sales_documents', id, doc, after);
      return after;
    });
  }
  return { summary:summary, dueDate:dueDate, isOverdue:isOverdue, ageBucket:ageBucket, creditCheck:creditCheck,
    assertCreditApproval:assertCreditApproval, requestCreditApproval:requestCreditApproval, approveCredit:approveCredit,
    recordManagerOverride:recordManagerOverride, convertFrom:convertFrom, setFiscalNo:setFiscalNo, receipts:receipts, terms:terms };
}());
