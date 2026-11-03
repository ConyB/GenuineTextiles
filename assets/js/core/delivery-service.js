/* Delivery quantities, release approvals and lifecycle: BUSINESS_RULES.md section 9 (A-49 to A-56). */
window.GT = window.GT || {};
window.GT.deliveries = (function () {
  var GT = window.GT;
  var methods = ['delivered_by_us', 'collected_by_customer', 'courier'];
  var returnReasons = ['damaged', 'wrong_size', 'refused', 'other'];

  function actor() { return GT.session.currentUser(); }
  function manager() { return actor() && ['owner', 'general_manager'].indexOf(actor().role) !== -1; }
  function day(value) { return String(value || '').slice(0, 10); }
  function required(value, message) { if (!String(value || '').trim()) throw new Error(message); return String(value).trim(); }
  function quantity(value, label) {
    var number = Number(value);
    if (!Number.isFinite(number) || number < 0) throw new Error(label + ' must be zero or greater.');
    return number;
  }
  function validDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) &&
      !isNaN(Date.parse(value + 'T12:00:00Z')) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
  }
  function invoice(id) {
    var row = GT.store.find('sales_documents', id);
    if (!row || row.type !== 'invoice' || row.status !== 'issued') throw new Error('Choose an issued, non-void invoice.');
    return row;
  }
  function note(id) {
    var row = GT.store.find('delivery_notes', id);
    if (!row || row.discarded_at) throw new Error('Delivery note was not found.');
    return row;
  }
  function invoiceLines(id) {
    return GT.store.where('sales_document_items', function (row) {
      return Number(row.sales_document_id) === Number(id) && row.active !== false;
    });
  }
  function noteLines(id) { return GT.store.where('delivery_note_items', { delivery_note_id:Number(id) }); }
  function canView(row) {
    return GT.permissions.can('delivery_notes', 'V') &&
      (actor().role !== 'sales' || Number(row.created_by) === Number(actor().id));
  }
  function canCreateFrom(doc) {
    return GT.permissions.can('delivery_notes', 'C') &&
      (actor().role !== 'sales' || Number(doc.created_by) === Number(actor().id));
  }
  function canEdit(row) { return canView(row) && GT.permissions.can('delivery_notes', 'C') && row.status === 'draft'; }
  function approvalFor(id, status) {
    return GT.store.where('approvals', function (row) {
      return row.type === 'delivery_release' && row.entity_type === 'delivery_notes' &&
        Number(row.entity_id) === Number(id) && (!status || row.status === status);
    }).slice(-1)[0] || null;
  }

  function summary(invoiceId) {
    var doc = invoice(invoiceId);
    // BUSINESS_RULES.md section 9 (A-49): draft and void rows never consume quantity.
    var active = GT.store.where('delivery_notes', function (row) {
      return Number(row.invoice_id) === doc.id && ['issued', 'delivered'].indexOf(row.status) !== -1;
    });
    var ids = active.map(function (row) { return row.id; });
    var lines = invoiceLines(doc.id).map(function (source) {
      var used = GT.store.where('delivery_note_items', function (row) {
        return ids.indexOf(Number(row.delivery_note_id)) !== -1 && Number(row.sales_document_item_id) === source.id;
      });
      var dispatched = used.reduce(function (sum, row) { return sum + Number(row.qty_dispatched || 0); }, 0);
      var returned = used.reduce(function (sum, row) { return sum + Number(row.qty_returned || 0); }, 0);
      return { sales_document_item_id:source.id, description:source.description, size:source.size,
        unit:source.unit, ordered:Number(source.quantity), dispatched:dispatched,
        returned:returned, remaining:Number(source.quantity) - dispatched + returned };
    });
    var delivered = lines.length > 0 && lines.every(function (row) { return row.remaining <= 0; });
    var any = lines.some(function (row) { return row.dispatched - row.returned > 0; });
    return { invoice_id:doc.id, lines:lines, status:delivered ? 'delivered' : any ? 'part_delivered' : 'not_delivered' };
  }

  function remainingAfter(noteRow, itemId, proposedQuantity) {
    // BUSINESS_RULES.md section 9 (A-49): show the quantity position after this dispatch.
    // Number order keeps historical notes stable when a later note is issued.
    var source = invoiceLines(noteRow.invoice_id).find(function (row) { return Number(row.id) === Number(itemId); });
    if (!source) return 0;
    var earlier = GT.store.where('delivery_notes', function (row) {
      return Number(row.invoice_id) === Number(noteRow.invoice_id) &&
        ['issued', 'delivered'].indexOf(row.status) !== -1 &&
        (!noteRow.number || Number(row.number) <= Number(noteRow.number));
    });
    var ids = earlier.map(function (row) { return row.id; });
    var net = GT.store.where('delivery_note_items', function (row) {
      return ids.indexOf(Number(row.delivery_note_id)) !== -1 && Number(row.sales_document_item_id) === Number(itemId);
    }).reduce(function (sum, row) { return sum + Number(row.qty_dispatched || 0) - Number(row.qty_returned || 0); }, 0);
    if (!noteRow.number) net += Number(proposedQuantity || 0);
    return Math.max(0, Number(source.quantity) - net);
  }

  function releaseCheck(invoiceId) {
    var doc = invoice(invoiceId), payment = GT.invoices.summary(doc.id);
    if (payment.paymentStatus === 'paid') return { status:'cleared', reason:'Invoice is paid.' };
    var customer = GT.store.find('customers', doc.customer_id);
    if (!customer.is_credit) return { status:'needs_approval', reason:'Cash customer has an unpaid balance.' };
    if (GT.customers.balance(customer.id) > Number(customer.credit_limit || 0))
      return { status:'needs_approval', reason:'Customer is over the credit limit.' };
    var overdue = GT.store.where('sales_documents', function (row) {
      return row.type === 'invoice' && row.status === 'issued' && Number(row.customer_id) === customer.id &&
        GT.invoices.summary(row.id).isOverdue;
    });
    if (overdue.length) return { status:'needs_approval', reason:'Customer has an overdue invoice.' };
    return { status:'cleared', reason:'Credit account is within its limit and not overdue.' };
  }

  function selectedLines(invoiceId, values) {
    var sources = invoiceLines(invoiceId), requested = Array.isArray(values) ? values : [];
    if (requested.length !== sources.length) throw new Error('Include every invoice line, including any zero quantities.');
    return sources.map(function (source) {
      var selected = requested.find(function (row) { return Number(row.sales_document_item_id || row.invoice_line_id) === source.id; });
      if (!selected) throw new Error('A delivery line does not match the invoice.');
      return { source:source, qty:quantity(selected.qty_dispatched, 'Dispatched quantity') };
    });
  }
  function checkRemaining(invoiceId, lines) {
    var remaining = summary(invoiceId).lines;
    lines.forEach(function (line) {
      var current = remaining.find(function (row) { return row.sales_document_item_id === line.source.id; });
      if (line.qty > current.remaining + 0.000001) throw new Error('Dispatched quantity exceeds the remaining invoice quantity.');
    });
  }
  function createDraft(invoiceId, lines) {
    var doc = invoice(invoiceId);
    if (!canCreateFrom(doc)) throw new Error('You cannot create a delivery note for this invoice.');
    var proposed = selectedLines(doc.id, lines || summary(doc.id).lines.map(function (row) {
      return { sales_document_item_id:row.sales_document_item_id, qty_dispatched:row.remaining };
    }));
    checkRemaining(doc.id, proposed);
    return GT.store.transaction(function () {
      var customer = GT.store.find('customers', doc.customer_id);
      var row = GT.store.create('delivery_notes', { number:null, customer_id:doc.customer_id, invoice_id:doc.id,
        delivery_date:GT.dates.today(), delivery_method:'', carrier_or_collector_name:'', phone:'',
        delivery_address:customer.address || '', contact_person:customer.contact_person || '',
        contact_phone:customer.phone || '', notes:'', dispatched_by:null, created_by:actor().id,
        status:'draft', release_approved_by:null, issued_at:null, received_by:null, received_date:null,
        confirmed_by:null, confirmed_at:null, void_reason:null, voided_by:null, voided_at:null, discarded_at:null });
      proposed.forEach(function (line) {
        GT.store.create('delivery_note_items', { delivery_note_id:row.id, sales_document_item_id:line.source.id,
          description:line.source.description, size:line.source.size, quantity_ordered:Number(line.source.quantity),
          qty_dispatched:line.qty, qty_received:null, qty_returned:0, return_reason:null });
      });
      GT.audit.log('create_draft', 'delivery_notes', row.id, null, row);
      return row;
    });
  }
  function saveDraft(id, values) {
    var before = note(id);
    if (!canEdit(before)) throw new Error('Only an editable draft can be saved.');
    var proposed = values.lines ? selectedLines(before.invoice_id, values.lines) : null;
    if (proposed) checkRemaining(before.invoice_id, proposed);
    var fields = ['delivery_date', 'delivery_method', 'carrier_or_collector_name', 'phone',
      'delivery_address', 'contact_person', 'contact_phone', 'notes'];
    var changes = {};
    fields.forEach(function (key) { if (values[key] !== undefined) changes[key] = String(values[key]).trim(); });
    if (changes.delivery_date && !validDate(changes.delivery_date)) throw new Error('Enter a valid delivery date.');
    if (changes.delivery_method && methods.indexOf(changes.delivery_method) === -1) throw new Error('Choose a delivery method.');
    return GT.store.transaction(function () {
      if (proposed) proposed.forEach(function (line) {
        var stored = noteLines(id).find(function (row) { return Number(row.sales_document_item_id) === line.source.id; });
        GT.store.update('delivery_note_items', stored.id, { qty_dispatched:line.qty });
      });
      var after = GT.store.update('delivery_notes', id, changes);
      GT.audit.log('save_draft', 'delivery_notes', id, before, after);
      return after;
    });
  }
  function requestRelease(row, check) {
    var pending = approvalFor(row.id, 'requested');
    if (pending) return pending;
    var request = GT.store.create('approvals', { type:'delivery_release', entity_type:'delivery_notes',
      entity_id:row.id, requested_by:actor().id, approved_by:null, status:'requested', reason:check.reason });
    GT.audit.log('request_delivery_release', 'delivery_notes', row.id, null, request);
    return request;
  }
  function issue(id, approvalReason) {
    var row = note(id);
    if (!canEdit(row)) throw new Error('Only an editable draft can be issued.');
    return GT.store.transaction(function () {
      var doc = invoice(row.invoice_id), lines = selectedLines(doc.id, noteLines(id));
      checkRemaining(doc.id, lines);
      if (!lines.some(function (line) { return line.qty > 0; })) throw new Error('Dispatch at least one item.');
      if (!validDate(row.delivery_date) || row.delivery_date < doc.issue_date || row.delivery_date > GT.dates.today())
        throw new Error('Delivery date must be from invoice issue date through today.');
      if (methods.indexOf(row.delivery_method) === -1) throw new Error('Choose a delivery method.');
      required(row.delivery_address, 'Enter the delivery address.');
      var check = releaseCheck(doc.id), approved = approvalFor(id, 'approved');
      if (check.status === 'needs_approval' && !approved) {
        if (!manager()) { requestRelease(row, check); return { status:'approval_requested', note:row }; }
        required(approvalReason, 'A release approval reason is required.');
        var pending = approvalFor(id, 'requested');
        var decision = pending ? GT.store.update('approvals', pending.id, { status:'approved', approved_by:actor().id,
          reason:String(approvalReason).trim() }) : GT.store.create('approvals', { type:'delivery_release',
          entity_type:'delivery_notes', entity_id:id, requested_by:row.created_by, approved_by:actor().id,
          status:'approved', reason:String(approvalReason).trim() });
        GT.audit.log('approve_delivery_release', 'delivery_notes', id, pending, decision);
        approved = decision;
      }
      var after = GT.store.update('delivery_notes', id, { number:GT.numbering.next('delivery_note'),
        status:'issued', issued_at:new Date().toISOString(), dispatched_by:actor().id,
        release_approved_by:approved ? approved.approved_by : null });
      GT.audit.log('issue', 'delivery_notes', id, row, after);
      // BUSINESS_RULES.md section 8 (A-57): an order completes when delivery quantities cover every line.
      if (GT.orders) GT.orders.syncDelivery(after.invoice_id);
      return after;
    });
  }
  function rejectRelease(id, reason) {
    var row = note(id), pending = approvalFor(id, 'requested');
    if (!manager() || !pending || row.status !== 'draft') throw new Error('No draft release request can be rejected.');
    required(reason, 'A rejection reason is required.');
    return GT.store.transaction(function () {
      var decision = GT.store.update('approvals', pending.id, { status:'rejected', approved_by:actor().id,
        reason:String(reason).trim() });
      GT.audit.log('reject_delivery_release', 'delivery_notes', id, pending, decision);
      return row;
    });
  }
  function confirm(id, values) {
    var row = note(id), role = actor() && actor().role;
    if (row.status !== 'issued' || !canView(row) || ['owner','general_manager','store_keeper','sales'].indexOf(role) === -1)
      throw new Error('You cannot confirm this delivery note.');
    var receivedBy = required(values.received_by, 'Enter the receiver name.');
    var date = values.received_date;
    if (!validDate(date) || date < row.delivery_date || date > GT.dates.today())
      throw new Error('Received date must be between delivery date and today.');
    var stored = noteLines(id), submitted = values.lines || [];
    if (submitted.length !== stored.length) throw new Error('Confirm every delivery line.');
    var confirmed = stored.map(function (line) {
      var input = submitted.find(function (item) { return Number(item.delivery_note_item_id || item.id) === line.id; });
      if (!input) throw new Error('Confirm every delivery line.');
      var received = quantity(input.qty_received, 'Received quantity');
      if (received > Number(line.qty_dispatched)) throw new Error('Received quantity exceeds dispatched quantity.');
      var returned = Number(line.qty_dispatched) - received;
      if (returned && returnReasons.indexOf(input.return_reason) === -1) throw new Error('Choose a reason for each returned quantity.');
      return { id:line.id, qty_received:received, qty_returned:returned,
        return_reason:returned ? input.return_reason : null };
    });
    return GT.store.transaction(function () {
      confirmed.forEach(function (line) { GT.store.update('delivery_note_items', line.id, line); });
      var after = GT.store.update('delivery_notes', id, { status:'delivered', received_by:receivedBy,
        received_date:date, confirmed_by:actor().id, confirmed_at:new Date().toISOString() });
      GT.audit.log('confirm', 'delivery_notes', id, row, after);
      if (GT.orders) GT.orders.syncDelivery(after.invoice_id);
      return after;
    });
  }
  function voidNote(id, reason) {
    var row = note(id);
    if (!manager() || ['draft','issued'].indexOf(row.status) === -1) throw new Error('Only Owner or General Manager may void an unconfirmed note.');
    required(reason, 'A void reason is required.');
    return GT.store.transaction(function () {
      var after = GT.store.update('delivery_notes', id, { status:'void', void_reason:String(reason).trim(),
        voided_by:actor().id, voided_at:new Date().toISOString() });
      GT.audit.log('void', 'delivery_notes', id, row, after);
      if (GT.orders) GT.orders.syncDelivery(after.invoice_id);
      return after;
    });
  }
  function discardDraft(id) {
    var row = note(id);
    if (!canEdit(row)) throw new Error('Only an editable draft can be discarded.');
    return GT.store.transaction(function () {
      var after = GT.store.update('delivery_notes', id, { discarded_at:new Date().toISOString() });
      GT.audit.log('discard_draft', 'delivery_notes', id, row, after);
      return after;
    });
  }
  function list(filters) {
    var chosen = filters || {};
    if (!GT.permissions.can('delivery_notes', 'V')) return [];
    return GT.store.all('delivery_notes').filter(function (row) {
      return !row.discarded_at && canView(row) && (!chosen.status || row.status === chosen.status) &&
        (!chosen.method || row.delivery_method === chosen.method) &&
        (!chosen.customer_id || Number(row.customer_id) === Number(chosen.customer_id)) &&
        (!chosen.date_from || row.delivery_date >= chosen.date_from) &&
        (!chosen.date_to || row.delivery_date <= chosen.date_to);
    });
  }
  function awaitingConfirmationCount() { return list({ status:'issued' }).length; }
  function pendingReleaseCount() {
    return list({ status:'draft' }).filter(function (row) { return !!approvalFor(row.id, 'requested'); }).length;
  }
  return { summary:summary, remainingAfter:remainingAfter, releaseCheck:releaseCheck, createDraft:createDraft, saveDraft:saveDraft,
    issue:issue, rejectRelease:rejectRelease, confirm:confirm, void:voidNote, discardDraft:discardDraft,
    list:list, noteLines:noteLines, approvalFor:approvalFor, canView:canView, canEdit:canEdit,
    awaitingConfirmationCount:awaitingConfirmationCount, pendingReleaseCount:pendingReleaseCount };
}());
