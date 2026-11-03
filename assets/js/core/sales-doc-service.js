/* Phase 7 sales document rules: BUSINESS_RULES.md sections 1, 2, 3 and 5. No DOM work lives here. */
window.GT = window.GT || {};
window.GT.salesDocs = (function () {
  var GT = window.GT;
  var types = {
    quotation: { key:'quotation', label:'Quotation', plural:'Quotations', series:'quotation', route:'#/sales/quotations', shortRoute:'#/quotations', hasValidity:true, hasTerms:true, printTitle:'QUOTATION', permission:'quotations_proformas', actions:['view','create','edit','issue','duplicate','discard','void'] },
    proforma: { key:'proforma', label:'Proforma', plural:'Proformas', series:'proforma', route:'#/sales/proformas', shortRoute:'#/proformas', hasValidity:false, hasTerms:false, printTitle:'PROFORMA', permission:'quotations_proformas', actions:['view','create','edit','issue','duplicate','discard','void'] },
    invoice: { key:'invoice', label:'Invoice', plural:'Invoices', series:'invoice', route:'#/sales/invoices', shortRoute:'#/invoices', hasValidity:false, hasTerms:false, hasDueDate:true, hasPaymentStatus:true, hasCreditCheck:true, hasFiscalNo:true, convertFrom:['quotation','proforma'], printTitle:'INVOICE', permission:'invoices', actions:['view','create','edit','issue','duplicate','discard','void'] }
  };
  function typeFor(key) { if (!types[key]) throw new Error('Unknown sales document type.'); return types[key]; }
  function user() { return GT.session.currentUser(); }
  function role() { return user() ? user().role : ''; }
  function customer(id) { return GT.store.find('customers', id); }
  function items(id) { return GT.store.where('sales_document_items', function (row) { return Number(row.sales_document_id) === Number(id) && row.active !== false; }); }
  function mayView(doc) { return !!doc && GT.permissions.can(typeFor(doc.type).permission, 'V') && (role() !== 'sales' || Number(doc.created_by) === Number(user().id)); }
  function canCreate(type) { return !!types[type] && GT.permissions.can(types[type].permission, 'C'); }
  function canEdit(doc) { return mayView(doc) && doc.status === 'draft' && GT.permissions.can(types[doc.type].permission, 'C') && (role() !== 'sales' || Number(doc.created_by) === Number(user().id)); }
  function canIssue(doc) { return canEdit(doc) && (!doc.discount_amount || doc.discount_status === 'approved'); }
  // ROLE_PERMISSION_MATRIX.md Quotations/proformas: only Owner and General Manager void.
  function canVoid(doc) { return mayView(doc) && doc.status === 'issued' && ['owner','general_manager'].indexOf(role()) !== -1; }
  function assertAllowed(allowed, message) { if (!allowed) throw new Error(message || 'Access denied.'); }
  function invalid(errors) { var failure = new Error('Correct the document fields.'); failure.validationErrors = errors; throw failure; }
  function amount(value) { return Number(GT.format.parseMoney(value)); }
  function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !isNaN(Date.parse(value + 'T12:00:00Z')) && new Date(value + 'T12:00:00Z').toISOString().slice(0,10) === value; }
  function totalsFor(doc) { return GT.calc.calcTotals(doc.items || items(doc.id), doc.discount_amount || 0, doc.vat_rate === undefined ? GT.settings.vatRate : doc.vat_rate); }
  function build(type, formValues) {
    var config = typeFor(type), values = formValues || {}, errors = {};
    var selected = customer(values.customer_id);
    if (!selected || !selected.active) errors.customer_id = 'Choose an active customer.';
    var date = values.issue_date || GT.dates.today();
    if (!validDate(date)) errors.issue_date = 'Enter a valid date.';
    else if (date > GT.dates.today()) errors.issue_date = 'The date cannot be in the future.';
    var validUntil = config.hasValidity ? (values.valid_until || GT.dates.addDays(date, GT.settings.quotationValidityDays)) : null;
    if (config.hasValidity && (!validDate(validUntil) || validUntil < date)) errors.valid_until = 'Valid until must be on or after the document date.';
    var lines = (values.items || []).map(function (row, index) {
      var quantity = Number(row.quantity), price = amount(row.unit_price);
      var lineError = '';
      if (!String(row.description || '').trim()) lineError = 'enter a description.';
      else if (!(quantity > 0) || !Number.isFinite(quantity)) lineError = 'quantity must be above zero.';
      else if (!Number.isInteger(Number(String(row.unit_price).replace(/,/g,''))) || price <= 0) lineError = 'unit price must be a positive whole UGX amount.';
      else if (['pcs','pairs','sets','metres','yards'].indexOf(row.unit) === -1) lineError = 'choose a unit.';
      var lineAmount = Math.round(quantity * price);
      if (!lineError && (!Number.isInteger(lineAmount) || lineAmount <= 0)) lineError = 'amount must be above zero.';
      if (lineError && !errors.items) errors.items = 'Line ' + (index + 1) + ': ' + lineError;
      return { description:String(row.description || '').trim(), size:String(row.size || 'All').trim() || 'All', quantity:quantity, unit:row.unit, unit_price:price, amount:lineAmount };
    });
    if (!lines.length) errors.items = 'Add at least one item.';
    var discount = amount(values.discount_amount || 0), totals = GT.calc.calcTotals(lines, discount, GT.settings.vatRate);
    if (!Number.isInteger(Number(String(values.discount_amount || 0).replace(/,/g,''))) || discount < 0 || discount > totals.subtotal) errors.discount_amount = 'Discount must be whole UGX and cannot exceed the subtotal.';
    if (discount && !String(values.discount_reason || '').trim()) errors.discount_reason = 'Give a reason for the discount.';
    if (Object.keys(errors).length) invalid(errors);
    return { type:type, number:null, status:'draft', customer_id:Number(values.customer_id), issue_date:date, valid_until:validUntil,
      subtotal:totals.subtotal, discount_amount:discount, discount_reason:discount ? String(values.discount_reason).trim() : '',
      discount_status:discount ? (['owner','general_manager'].indexOf(role()) !== -1 ? 'approved' : 'requested') : 'none',
      discount_requested_by:discount ? user().id : null, discount_approved_by:discount && ['owner','general_manager'].indexOf(role()) !== -1 ? user().id : null,
      vat_rate:Number(GT.settings.vatRate), vat_amount:totals.vat, total:totals.total, amount_in_words:GT.format.amountInWords(totals.total),
      terms_text:config.hasTerms ? String(values.terms_text === undefined ? (type === 'invoice' ? '' : GT.settings.quotationTerms) : values.terms_text) : '',
      due_date:type === 'invoice' ? GT.invoices.dueDate(date, selected) : null,
      order_id:null, order_reference:type === 'invoice' ? String(values.order_reference || '').trim() : '',
      fiscal_document_no:type === 'invoice' ? String(values.fiscal_document_no || '').trim() || null : null,
      notes:String(values.notes || '').trim(), items:lines };
  }
  function saveItems(id, lines) {
    // DATABASE_DESIGN.md financial history: deactivated draft lines remain stored, even after editing.
    items(id).forEach(function (row) { GT.store.update('sales_document_items', row.id, { active:false }); });
    lines.forEach(function (row) { GT.store.create('sales_document_items', Object.assign({ sales_document_id:id, active:true }, row)); });
  }
  function approval(doc, status, approver) {
    return GT.store.create('approvals', { type:'discount', entity_type:'sales_documents', entity_id:doc.id, requested_by:doc.discount_requested_by, approved_by:approver || null, status:status, reason:doc.discount_reason });
  }
  function saveDraft(type, values, id) {
    assertAllowed(canCreate(type), 'You cannot create this document.');
    var before = id ? GT.store.find('sales_documents', id) : null;
    if (id) assertAllowed(canEdit(before) && before.type === type, 'This document is locked or unavailable.');
    var built = build(type, values), lines = built.items;
    delete built.items;
    return GT.store.transaction(function () {
      var previousDiscount = before ? before.discount_amount : 0;
      if (before && before.discount_amount === built.discount_amount && before.discount_reason === built.discount_reason) {
        built.discount_status = before.discount_status;
        built.discount_requested_by = before.discount_requested_by;
        built.discount_approved_by = before.discount_approved_by;
      }
      // BUSINESS_RULES.md section 4: changed customer or amount needs a fresh credit decision.
      if (type === 'invoice') built.credit_override_approved_by = before && before.customer_id === built.customer_id && before.total === built.total ? before.credit_override_approved_by || null : null;
      // BUSINESS_RULES.md section 8 (A-57): editing an invoice draft keeps its order link.
      if (type === 'invoice' && before) built.order_id = before.order_id || null;
      if (type === 'invoice' && before && (before.customer_id !== built.customer_id || before.total !== built.total)) {
        GT.store.where('approvals', function (row) { return row.type === 'credit_limit' && Number(row.entity_id) === Number(id) && row.status === 'requested'; }).forEach(function (row) {
          GT.store.update('approvals', row.id, { status:'rejected', decision_note:'Invoice customer or total changed.' });
        });
      }
      var doc = before ? GT.store.update('sales_documents', id, built) : GT.store.create('sales_documents', Object.assign(built, { created_by:user().id, location_id:user().location_id, source_document_id:null, issued_at:null, issued_by:null, voided_at:null, voided_by:null, voided_reason:'' }));
      saveItems(doc.id, lines);
      if (built.discount_amount && (!before || previousDiscount !== built.discount_amount || before.discount_reason !== built.discount_reason)) approval(doc, built.discount_status, built.discount_approved_by);
      GT.audit.log(before ? 'update' : 'create', 'sales_documents', doc.id, before, doc);
      return doc;
    });
  }
  function issue(id, creditReason) {
    var doc = GT.store.find('sales_documents', id);
    assertAllowed(canIssue(doc), 'The discount needs approval or this draft cannot be issued.');
    var lines = items(id), totals = totalsFor(Object.assign({}, doc, { items:lines }));
    if (!lines.length || totals.total <= 0) throw new Error('Add valid items with a total above zero before issuing.');
    if (doc.discount_amount > totals.subtotal) throw new Error('Discount cannot exceed the subtotal.');
    var selected = customer(doc.customer_id);
    if (!selected) throw new Error('Customer was not found.');
    if (doc.type === 'invoice') GT.invoices.assertCreditApproval(doc, creditReason);
    return GT.store.transaction(function () {
      // BUSINESS_RULES.md section 4: an Owner/GM override and its approval are atomic with issue.
      if (doc.type === 'invoice' && GT.invoices.creditCheck(doc.customer_id, doc.total).exceedsLimit && !doc.credit_override_approved_by) GT.invoices.recordManagerOverride(id, creditReason);
      // BUSINESS_RULES.md section 1: consume the next number only when issue succeeds.
      var number = GT.numbering.next(typeFor(doc.type).series);
      var after = GT.store.update('sales_documents', id, { number:number, status:'issued', customer_name:selected.name, customer_address:selected.address || '', customer_phone:selected.phone || '', issued_at:new Date().toISOString(), issued_by:user().id,
        due_date:doc.type === 'invoice' ? GT.invoices.dueDate(doc.issue_date, selected) : null,
        terms_text:doc.type === 'invoice' ? GT.invoices.terms(selected, doc.due_date || GT.invoices.dueDate(doc.issue_date, selected)) : doc.terms_text,
        subtotal:totals.subtotal, vat_amount:totals.vat, total:totals.total, amount_in_words:GT.format.amountInWords(totals.total) });
      GT.audit.log('issue', 'sales_documents', id, doc, after);
      return after;
    });
  }
  function duplicate(id) {
    var original = GT.store.find('sales_documents', id);
    assertAllowed(mayView(original) && canCreate(original.type), 'This document cannot be duplicated.');
    var values = Object.assign({}, original, { items:items(id), discount_status:'none', discount_approved_by:null });
    if (original.type === 'quotation') values.valid_until = GT.dates.addDays(GT.dates.today(), GT.settings.quotationValidityDays);
    values.issue_date = GT.dates.today();
    return GT.store.transaction(function () {
      var fresh = saveDraft(original.type, values);
      GT.store.update('sales_documents', fresh.id, { source_document_id:original.id });
      return GT.store.find('sales_documents', fresh.id);
    });
  }
  function discard(id) {
    var doc = GT.store.find('sales_documents', id);
    assertAllowed(canEdit(doc), 'Only an editable draft may be discarded.');
    return GT.store.transaction(function () { var after = GT.store.update('sales_documents', id, { status:'discarded', discarded_at:new Date().toISOString(), discarded_by:user().id }); GT.audit.log('discard', 'sales_documents', id, doc, after); return after; });
  }
  function voidDoc(id, reason) {
    var doc = GT.store.find('sales_documents', id);
    assertAllowed(canVoid(doc), 'Only Owner or General Manager may void an issued document.');
    if (!String(reason || '').trim()) throw new Error('A void reason is required.');
    if (doc.type === 'invoice' && GT.invoices.receipts(id).length) throw new Error('Handle its receipts first (available with Receipts).');
    // BUSINESS_RULES.md section 9 (A-49): a live delivery note cannot point at a void invoice.
    if (doc.type === 'invoice' && GT.store.where('delivery_notes', function (row) {
      return Number(row.invoice_id)===Number(id) && !row.discarded_at && row.status!=='void';
    }).length) throw new Error('Handle its delivery notes before voiding this invoice.');
    return GT.store.transaction(function () { var after = GT.store.update('sales_documents', id, { status:'void', voided_reason:String(reason).trim(), voided_at:new Date().toISOString(), voided_by:user().id }); GT.audit.log('void', 'sales_documents', id, doc, after); return after; });
  }
  function decideDiscount(id, decision) {
    var doc = GT.store.find('sales_documents', id);
    assertAllowed(doc && mayView(doc) && doc.status === 'draft' && doc.discount_status === 'requested' && ['owner','general_manager'].indexOf(role()) !== -1, 'This discount request cannot be decided.');
    return GT.store.transaction(function () {
      var after = GT.store.update('sales_documents', id, { discount_status:decision, discount_approved_by:decision === 'approved' ? user().id : null });
      var pending = GT.store.where('approvals', function (row) { return row.type === 'discount' && row.entity_type === 'sales_documents' && Number(row.entity_id) === Number(id) && row.status === 'requested'; }).slice(-1)[0];
      if (pending) GT.store.update('approvals', pending.id, { status:decision, approved_by:user().id });
      GT.audit.log(decision === 'approved' ? 'approve_discount' : 'reject_discount', 'sales_documents', id, doc, after);
      return after;
    });
  }
  function requestDiscount(id) {
    var doc = GT.store.find('sales_documents', id);
    assertAllowed(canEdit(doc) && doc.discount_amount > 0, 'Save a discounted draft first.');
    if (doc.discount_status === 'requested') return doc;
    return GT.store.transaction(function () { var after = GT.store.update('sales_documents', id, { discount_status:'requested', discount_requested_by:user().id, discount_approved_by:null }); approval(after, 'requested', null); GT.audit.log('request_discount', 'sales_documents', id, doc, after); return after; });
  }
  function effectiveStatus(doc, today) { return doc.status === 'issued' && doc.type === 'quotation' && doc.valid_until && doc.valid_until < (today || GT.dates.today()) ? 'expired' : doc.status; }
  function list(type, includeDiscarded) { typeFor(type); return GT.store.where('sales_documents', function (doc) { return doc.type === type && (includeDiscarded || doc.status !== 'discarded') && (role() !== 'sales' || Number(doc.created_by) === Number(user().id)); }); }
  return { types:types, build:build, saveDraft:saveDraft, issue:issue, duplicate:duplicate, discard:discard, voidDoc:voidDoc, requestDiscount:requestDiscount, approveDiscount:function (id) { return decideDiscount(id,'approved'); }, rejectDiscount:function (id) { return decideDiscount(id,'rejected'); }, effectiveStatus:effectiveStatus, canEdit:canEdit, canIssue:canIssue, canVoid:canVoid, canCreate:canCreate, mayView:mayView, totalsFor:totalsFor, items:items, list:list };
}());
