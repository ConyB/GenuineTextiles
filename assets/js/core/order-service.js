/* Order lifecycle and calculations. BUSINESS_RULES.md section 8 (A-57 to A-61). */
window.GT = window.GT || {};
window.GT.orders = (function () {
  var GT = window.GT;
  function actor() { return GT.session.currentUser(); }
  function manager() { return actor() && ['owner', 'general_manager'].indexOf(actor().role) !== -1; }
  function required(value, label) { var text = String(value || '').trim(); if (!text) throw new Error(label + ' is required.'); return text; }
  function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !isNaN(Date.parse(value + 'T12:00:00Z')) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value; }
  function stages() { return GT.store.where('order_stages', { active:true }).sort(function (a, b) { return a.sort_order - b.sort_order; }); }
  function stage(name) { return stages().find(function (row) { return row.name === name; }); }
  function row(id) { var found = GT.store.find('orders', id); if (!found) throw new Error('Order was not found.'); return found; }
  function lines(id) { return GT.store.where('order_items', { order_id:Number(id) }); }
  function canView(order) { return GT.permissions.can('orders', 'V') && (actor().role !== 'sales' || Number(order.created_by) === actor().id); }
  function canCreate() { return GT.permissions.can('orders', 'C'); }
  function canMove(order) { return canView(order) && ['owner', 'general_manager', 'workshop_supervisor'].indexOf(actor().role) !== -1; }
  function hasEnteredCutting(order) { var cutting = stage('Cutting').sort_order;
    return stage(order.current_stage).sort_order >= cutting || GT.store.where('order_stage_history', {order_id:order.id}).some(function (entry) {
      var reached = stage(entry.stage) || stages().find(function (item) { return item.id === entry.stage_id; });
      return reached && reached.sort_order >= cutting;
    }); }
  function canCancel(order) { return !!order && manager() && canView(order) && ['draft','active'].indexOf(order.status) !== -1 && !hasEnteredCutting(order); }
  function approvalFor(id, status) { return GT.store.where('approvals', function (item) { return item.type === 'order_stage' && item.entity_type === 'orders' && Number(item.entity_id) === Number(id) && (!status || item.status === status); }).slice(-1)[0] || null; }
  function valueLines(input) {
    if (!Array.isArray(input) || !input.length) throw new Error('Add at least one order line.');
    return input.map(function (line, index) {
      var quantity = Number(line.quantity), price = Number(GT.format.parseMoney(line.unit_price));
      if (!String(line.description || '').trim() || !Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(price) || price <= 0) throw new Error('Line ' + (index + 1) + ' needs a description, positive quantity and whole UGX unit price.');
      return { description:String(line.description).trim(), size:String(line.size || 'All').trim() || 'All', quantity:quantity,
        unit:String(line.unit || 'pcs'), unit_price:price };
    });
  }
  function draftValues(values) {
    var customer = GT.store.find('customers', values.customer_id);
    if (!customer || !customer.active) throw new Error('Choose an active customer.');
    var due = required(values.due_date, 'Due date');
    // BUSINESS_RULES.md section 8 (A-57): a new promise cannot be before today.
    if (!validDate(due) || due < GT.dates.today()) throw new Error('Due date cannot be before today.');
    if (['normal', 'urgent'].indexOf(values.priority || 'normal') === -1) throw new Error('Choose a priority.');
    return { customer_id:customer.id, due_date:due, priority:values.priority || 'normal',
      description:required(values.description, 'Description'), notes:String(values.notes || '').trim(),
      items:valueLines(values.items) };
  }
  function saveLines(id, items) {
    // DATABASE_DESIGN.md Orders: draft lines may be replaced; confirmed lines stay locked in this phase (A-61).
    lines(id).forEach(function (item) { GT.store.remove('order_items', item.id); });
    items.forEach(function (item) { GT.store.create('order_items', Object.assign({ order_id:id }, item)); });
  }
  function createDraft(values) {
    if (!canCreate()) throw new Error('You cannot create orders.');
    var built = draftValues(values);
    return GT.store.transaction(function () {
      var items = built.items; delete built.items;
      var received = stage('Received');
      var saved = GT.store.create('orders', Object.assign(built, { number:null, source_document_id:null, invoice_id:null,
        order_date:GT.dates.today(), status:'draft', current_stage:received.name, stage_id:received.id,
        created_by:actor().id, location_id:actor().location_id }));
      saveLines(saved.id, items);
      GT.audit.log('create_draft', 'orders', saved.id, null, saved);
      return saved;
    });
  }
  function createFromDocument(documentId) {
    var source = GT.store.find('sales_documents', documentId);
    if (!canCreate() || !source || ['quotation', 'proforma'].indexOf(source.type) === -1 || source.status !== 'issued' || !GT.salesDocs.mayView(source)) throw new Error('Choose an issued quotation or proforma you may view.');
    var existing = GT.store.where('orders', function (item) { return Number(item.source_document_id) === Number(documentId) && item.status !== 'cancelled'; })[0];
    if (existing) throw new Error('This document already has an active order.');
    return GT.store.transaction(function () {
      var sourceLines = GT.salesDocs.items(source.id);
      var created = createDraft({ customer_id:source.customer_id, due_date:GT.dates.today(), priority:'normal',
        description:sourceLines.map(function (line) { return line.description; }).join(', '), notes:source.notes || '', items:sourceLines });
      var invoice = GT.store.where('sales_documents', function (doc) { return doc.type === 'invoice' && Number(doc.source_document_id) === source.id && doc.status !== 'void' && doc.status !== 'discarded'; })[0];
      var linked = GT.store.update('orders', created.id, { source_document_id:source.id });
      if (invoice && Number(invoice.customer_id) === Number(source.customer_id)) linked = linkInvoice(created.id, invoice.id);
      GT.audit.log('convert_to_order', 'orders', created.id, created, linked);
      return linked;
    });
  }
  function saveDraft(id, values) {
    var before = row(id);
    if (!canView(before) || !canCreate() || before.status !== 'draft') throw new Error('Only an editable draft can be saved.');
    var built = draftValues(values), items = built.items; delete built.items;
    if (before.source_document_id && Number(built.customer_id) !== Number(before.customer_id)) throw new Error('A converted order must keep its source customer.');
    return GT.store.transaction(function () {
      saveLines(before.id, items);
      var after = GT.store.update('orders', id, built);
      GT.audit.log('save_draft', 'orders', id, before, after);
      return after;
    });
  }
  function confirm(id) {
    var before = row(id);
    if (!canView(before) || !canCreate() || before.status !== 'draft') throw new Error('Only an editable draft can be confirmed.');
    if (!lines(id).length) throw new Error('Add order lines before confirming.');
    return GT.store.transaction(function () {
      // BUSINESS_RULES.md section 1 (A-58): consume a number only when confirmation succeeds.
      var after = GT.store.update('orders', id, { number:GT.numbering.next('order'), status:'active' });
      GT.store.create('order_stage_history', { order_id:after.id, stage_id:stage('Received').id, stage:'Received',
        changed_by:actor().id, changed_at:new Date().toISOString(), note:'Order confirmed.' });
      GT.audit.log('confirm', 'orders', id, before, after);
      return after;
    });
  }
  function linkInvoice(id, invoiceId) {
    var before = row(id), invoice = GT.store.find('sales_documents', invoiceId);
    if (!canView(before) || !canCreate() || before.status === 'cancelled' || !invoice || invoice.type !== 'invoice' || ['void', 'discarded'].indexOf(invoice.status) !== -1 || Number(invoice.customer_id) !== Number(before.customer_id)) throw new Error('Choose an invoice for this order customer.');
    if (before.invoice_id && Number(before.invoice_id) !== invoice.id) throw new Error('This order already has an invoice.');
    if (invoice.order_id && Number(invoice.order_id) !== before.id) throw new Error('Invoice belongs to another order.');
    return GT.store.transaction(function () {
      var after = GT.store.update('orders', id, { invoice_id:invoice.id });
      GT.store.update('sales_documents', invoice.id, { order_id:before.id });
      GT.audit.log('link_invoice', 'orders', id, before, after);
      return after;
    });
  }
  function createInvoice(id) {
    var order = row(id);
    if (!canView(order) || !GT.permissions.can('invoices', 'C') || order.status !== 'active' || order.invoice_id) throw new Error('Only an active uninvoiced order can create an invoice.');
    return GT.store.transaction(function () {
      // BUSINESS_RULES.md section 3: reuse the Phase 8 invoice engine and its VAT/discount rules.
      var source = order.source_document_id ? GT.store.find('sales_documents', order.source_document_id) : null;
      var draft = GT.salesDocs.saveDraft('invoice', { customer_id:order.customer_id, issue_date:GT.dates.today(),
        items:lines(id), notes:order.notes, discount_amount:source ? source.discount_amount : 0,
        discount_reason:source ? source.discount_reason : '' });
      if (source) GT.store.update('sales_documents', draft.id, { source_document_id:source.id });
      linkInvoice(id, draft.id);
      return GT.store.find('sales_documents', draft.id);
    });
  }
  function summary(id) {
    var order = row(id), invoice = order.invoice_id && GT.store.find('sales_documents', order.invoice_id);
    var source = order.source_document_id && GT.store.find('sales_documents', order.source_document_id);
    var total = invoice && invoice.status !== 'void' ? Number(invoice.total || 0) : source ? Number(source.total || 0) :
      GT.calc.calcTotals(lines(id).map(function (item) { return { amount:Math.round(Number(item.quantity) * Number(item.unit_price)) }; }), 0, GT.settings.vatRate).total;
    // BUSINESS_RULES.md section 4 (A-57): only non-void receipts on the linked invoice count.
    var paid = invoice && invoice.status !== 'void' ? GT.store.where('receipts', function (item) { return Number(item.invoice_id) === invoice.id && item.status !== 'void'; }).reduce(function (sum, item) { return sum + Number(item.amount || 0); }, 0) : 0;
    var deliveryStatus = invoice && invoice.status === 'issued' ? GT.deliveries.summary(invoice.id).status : 'not_delivered';
    var completed = order.status !== 'cancelled' && order.status !== 'draft' && deliveryStatus === 'delivered';
    var days = GT.dates.daysBetween(GT.dates.today(), order.due_date);
    return { total:total, paid:paid, depositPercent:total > 0 ? Math.round(paid * 10000 / total) / 100 : 0,
      depositMet:total > 0 && paid * 2 >= total, balance:Math.max(0, total - paid), deliveryStatus:deliveryStatus,
      isLate:order.status === 'active' && !completed && days < 0, daysToDue:days,
      status:completed ? 'completed' : order.status, currentStage:completed ? 'Delivered' : order.current_stage };
  }
  function requestStageApproval(id, target, reason) {
    var order = row(id), next = stage(target);
    if (!canMove(order) || order.status !== 'active' || !next || next.name === 'Delivered' || next.sort_order <= stage('Received').sort_order || summary(id).depositMet) throw new Error('This stage does not need a deposit approval.');
    required(reason, 'Approval reason');
    var pending = approvalFor(id, 'requested');
    if (pending) return pending;
    return GT.store.transaction(function () {
      var created = GT.store.create('approvals', { type:'order_stage', entity_type:'orders', entity_id:order.id,
        requested_by:actor().id, approved_by:null, status:'requested', reason:String(reason).trim(), target_stage:target });
      GT.audit.log('request_stage_approval', 'orders', id, null, created);
      return created;
    });
  }
  function approveStage(id, reason) {
    var order = row(id), pending = approvalFor(id, 'requested');
    if (!manager() || !pending || order.status !== 'active') throw new Error('No stage approval is pending.');
    required(reason, 'Approval reason');
    return GT.store.transaction(function () {
      var decision = GT.store.update('approvals', pending.id, { status:'approved', approved_by:actor().id, reason:String(reason).trim() });
      GT.audit.log('approve_stage', 'orders', id, pending, decision);
      return moveStage(id, pending.target_stage, String(reason).trim());
    });
  }
  function rejectStage(id, reason) {
    var pending = approvalFor(id, 'requested');
    if (!manager() || !pending) throw new Error('No stage approval is pending.');
    required(reason, 'Rejection reason');
    return GT.store.transaction(function () {
      var decision = GT.store.update('approvals', pending.id, { status:'rejected', approved_by:actor().id, reason:String(reason).trim() });
      GT.audit.log('reject_stage', 'orders', id, pending, decision);
      return decision;
    });
  }
  function moveStage(id, target, note) {
    var before = row(id), current = stage(before.current_stage), next = stage(target);
    if (!canMove(before) || before.status !== 'active') throw new Error('This order cannot move stages.');
    if (!next || next.name === 'Delivered' || next.id === current.id) throw new Error('Choose a different production stage.');
    if ((next.sort_order < current.sort_order || next.sort_order > current.sort_order + 1) && !String(note || '').trim()) throw new Error('A note is required for a backward or skipped stage.');
    // BUSINESS_RULES.md section 4 (A-57): work beyond Received needs half paid or manager approval.
    var approved = approvalFor(id, 'approved');
    if (next.sort_order > 1 && !summary(id).depositMet && (!approved || approved.target_stage !== target)) throw new Error('Deposit approval is required before production.');
    return GT.store.transaction(function () {
      var after = GT.store.update('orders', id, { current_stage:next.name, stage_id:next.id });
      GT.store.create('order_stage_history', { order_id:id, stage_id:next.id, stage:next.name,
        changed_by:actor().id, changed_at:new Date().toISOString(), note:String(note || '').trim() });
      if (approved && approved.target_stage === target) GT.store.update('approvals', approved.id, { status:'used' });
      var pending = approvalFor(id, 'requested');
      if (pending && pending.target_stage === target) GT.store.update('approvals', pending.id, { status:'superseded' });
      GT.audit.log('move_stage', 'orders', id, before, after);
      return after;
    });
  }
  function cancel(id, reason) {
    var before = row(id);
    if (!manager() || !canView(before) || before.status === 'cancelled' || before.status === 'completed') throw new Error('Only Owner or General Manager may cancel an open order.');
    // BUSINESS_RULES.md section 8 (A-62): moving backward never erases that Cutting was entered.
    if (hasEnteredCutting(before)) throw new Error('Cancellation after Cutting needs owner direction.');
    required(reason, 'Cancellation reason');
    return GT.store.transaction(function () {
      var after = GT.store.update('orders', id, { status:'cancelled', cancellation_reason:String(reason).trim() });
      GT.audit.log('cancel', 'orders', id, before, after);
      return after;
    });
  }
  function syncDelivery(invoiceId) {
    var order = GT.store.where('orders', { invoice_id:Number(invoiceId) })[0];
    if (!order || ['draft', 'cancelled'].indexOf(order.status) !== -1) return null;
    var complete = GT.deliveries.summary(invoiceId).status === 'delivered';
    if (complete && order.status !== 'completed') {
      return GT.store.transaction(function () {
        var delivered = stage('Delivered');
        var after = GT.store.update('orders', order.id, { status:'completed', current_stage:delivered.name, stage_id:delivered.id });
        GT.store.create('order_stage_history', { order_id:order.id, stage_id:delivered.id, stage:delivered.name,
          changed_by:actor() ? actor().id : null, changed_at:new Date().toISOString(), note:'All invoice lines delivered.' });
        GT.audit.log('complete_from_delivery', 'orders', order.id, order, after);
        return after;
      });
    }
    if (!complete && order.status === 'completed') {
      var ready = stage('Ready for delivery');
      return GT.store.transaction(function () {
        var reopened = GT.store.update('orders', order.id, { status:'active', current_stage:ready.name, stage_id:ready.id });
        GT.store.create('order_stage_history', { order_id:order.id, stage_id:ready.id, stage:ready.name,
          changed_by:actor() ? actor().id : null, changed_at:new Date().toISOString(), note:'Delivery quantities reopened.' });
        GT.audit.log('reopen_from_delivery', 'orders', order.id, order, reopened);
        return reopened;
      });
    }
    return order;
  }
  function sendReadyMessage(id) {
    var order = row(id), customer = GT.store.find('customers', order.customer_id);
    if (!canMove(order) || order.current_stage !== 'Ready for delivery' || !customer || !customer.phone) return null;
    var template = GT.store.where('message_templates', { name:'Order ready' })[0];
    if (!template) return null;
    return GT.store.transaction(function () {
      var sent = GT.store.create('messages', { channel:'sms', recipient_name:customer.name, recipient_contact:customer.phone,
        template_id:template.id, body:template.body, status:'sent (simulated)', sent_by:actor().id,
        sent_at:new Date().toISOString(), reference_type:'order', reference_id:order.id });
      GT.audit.log('send_ready_sms', 'orders', order.id, null, sent);
      return sent;
    });
  }
  function list(filters) {
    var chosen = filters || {};
    if (!GT.permissions.can('orders', 'V')) return [];
    return GT.store.all('orders').filter(function (order) {
      var info = summary(order.id), customer = GT.store.find('customers', order.customer_id);
      return !order.is_for_stock && canView(order) && (!chosen.stage || info.currentStage === chosen.stage) && (!chosen.status || info.status === chosen.status) &&
        (!chosen.priority || order.priority === chosen.priority) && (!chosen.late_only || info.isLate) &&
        (!chosen.customer_id || Number(order.customer_id) === Number(chosen.customer_id)) &&
        (!chosen.date_from || order.order_date >= chosen.date_from) && (!chosen.date_to || order.order_date <= chosen.date_to) &&
        (!chosen.search || [order.number, customer && customer.name, order.description].join(' ').toLowerCase().indexOf(String(chosen.search).toLowerCase()) !== -1);
    });
  }
  function lateCount() { return list().filter(function (order) { return summary(order.id).isLate; }).length; }
  function awaitingDepositCount() { return list({ status:'active' }).filter(function (order) { return !summary(order.id).depositMet; }).length; }
  function awaitingApprovalCount() { return list().filter(function (order) { return !!approvalFor(order.id, 'requested'); }).length; }
  return { stages:stages, lines:lines, canView:canView, canMove:canMove, canCancel:canCancel, approvalFor:approvalFor, summary:summary,
    createDraft:createDraft, createFromDocument:createFromDocument, saveDraft:saveDraft, confirm:confirm,
    linkInvoice:linkInvoice, createInvoice:createInvoice, moveStage:moveStage, requestStageApproval:requestStageApproval,
    approveStage:approveStage, rejectStage:rejectStage, cancel:cancel, syncDelivery:syncDelivery,
    sendReadyMessage:sendReadyMessage, list:list, lateCount:lateCount,
    awaitingDepositCount:awaitingDepositCount, awaitingApprovalCount:awaitingApprovalCount };
}());
