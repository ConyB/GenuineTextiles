/* BUSINESS_RULES.md section 7: GRN validation, posting, notice, void and print rules. */
window.GT = window.GT || {};
window.GT.grns = (function () {
  function number(value) { return Number(value) || 0; }
  function roundQuantity(value) { return Math.round(number(value) * 1000) / 1000; }
  function currentUser() { return window.GT.session.currentUser(); }
  function role() { var user = currentUser(); return user ? user.role : ''; }
  function canSeeCost() { return ['owner', 'general_manager', 'accountant'].indexOf(role()) !== -1; }
  function canEnterCost() { return ['owner', 'general_manager'].indexOf(role()) !== -1; }
  function canEditCost() { return role() === 'owner'; }
  function accepted(item) { return roundQuantity(number(item.quantity_received) - number(item.quantity_rejected)); }

  // A-30: persisted quantities always use the material base unit.
  function toBaseQuantity(material, quantity, entryUnit) {
    var amount = number(quantity);
    if (entryUnit === 'roll') {
      if (!number(material.roll_length_m)) throw new Error('This material has no roll length.');
      return roundQuantity(amount * number(material.roll_length_m));
    }
    return roundQuantity(amount);
  }

  function lineToBase(line) {
    var material = window.GT.store.find('materials', line.material_id);
    if (!material) throw new Error('Choose a valid material.');
    return {
      material_id: material.id,
      quantity_received: toBaseQuantity(material, line.quantity_received, line.entry_unit),
      quantity_rejected: toBaseQuantity(material, line.quantity_rejected, line.entry_unit),
      unit_cost: line.unit_cost === '' || line.unit_cost === null || line.unit_cost === undefined ? null : Number(line.unit_cost)
    };
  }

  function validateDraft(draft) {
    var errors = {};
    if (!draft.supplier_id || !window.GT.store.find('suppliers', draft.supplier_id)) errors.supplier_id = 'Choose a supplier.';
    if (!draft.received_at) errors.received_at = 'Choose the received date.';
    else if (draft.received_at > new Date().toISOString().slice(0, 10)) errors.received_at = 'The received date cannot be in the future.';
    if (!draft.location_id || !window.GT.store.find('locations', draft.location_id)) errors.location_id = 'Choose a location.';
    if (!draft.received_by || !window.GT.store.find('users', draft.received_by)) errors.received_by = 'Choose who received the delivery.';
    if (!draft.supplier_doc_missing && !String(draft.supplier_doc_no || '').trim()) errors.supplier_doc_no = 'Enter the supplier document number or tick No supplier document.';
    var lines = draft.items || [];
    if (!lines.length) errors.items = 'Add at least one material line.';
    var seen = {};
    var acceptedTotal = 0;
    lines.forEach(function (line, index) {
      var prefix = 'Line ' + (index + 1) + ': ';
      if (!line.material_id || !window.GT.store.find('materials', line.material_id)) errors.items = prefix + 'choose a material.';
      if (line.material_id && seen[line.material_id]) errors.items = 'A material appears more than once. Merge the duplicate lines before saving.';
      seen[line.material_id] = true;
      if (!(number(line.quantity_received) > 0)) errors.items = prefix + 'quantity received must be greater than zero.';
      if (number(line.quantity_rejected) < 0 || number(line.quantity_rejected) > number(line.quantity_received)) errors.items = prefix + 'rejected quantity must be between zero and received quantity.';
      if (line.unit_cost !== null && line.unit_cost !== '' && line.unit_cost !== undefined && (!Number.isInteger(Number(line.unit_cost)) || Number(line.unit_cost) <= 0)) errors.items = prefix + 'unit cost must be a positive whole UGX amount.';
      acceptedTotal += Math.max(0, number(line.quantity_received) - number(line.quantity_rejected));
    });
    var hasIssue = ['quantity_ok','quality_ok','damage_ok','colour_ok'].some(function (key) { return draft[key] === false; });
    if (hasIssue && String(draft.notes || '').trim().length < 10) errors.notes = 'Describe the discrepancy in at least 10 characters.';
    if (!(acceptedTotal > 0)) errors.items = 'At least one line must have an accepted quantity above zero.';
    return errors;
  }

  function ensureSequence() {
    var sequence = window.GT.store.where('document_sequences', { document_type:'grn' })[0];
    if (!sequence) sequence = window.GT.store.create('document_sequences', { document_type:'grn', next_number:1, padding:4 });
    return sequence;
  }

  function post(draft) {
    var baseItems = (draft.items || []).map(lineToBase);
    var safeDraft = Object.assign({}, draft, { items:baseItems });
    var errors = validateDraft(safeDraft);
    if (Object.keys(errors).length) { var invalid = new Error('The goods received note has validation errors.'); invalid.validationErrors = errors; throw invalid; }
    return window.GT.store.transaction(function () {
      ensureSequence();
      var numberValue = window.GT.numbering.next('grn');
      var hasIssue = ['quantity_ok','quality_ok','damage_ok','colour_ok'].some(function (key) { return safeDraft[key] === false; });
      var grn = window.GT.store.create('goods_received_notes', {
        number:numberValue, supplier_id:Number(safeDraft.supplier_id), supplier_doc_no:safeDraft.supplier_doc_missing ? '' : String(safeDraft.supplier_doc_no || '').trim(),
        supplier_doc_missing:Boolean(safeDraft.supplier_doc_missing), location_id:Number(safeDraft.location_id), received_by:Number(safeDraft.received_by), received_at:safeDraft.received_at,
        quantity_ok:safeDraft.quantity_ok !== false, quality_ok:safeDraft.quality_ok !== false, damage_ok:safeDraft.damage_ok !== false, colour_ok:safeDraft.colour_ok !== false,
        status:hasIssue ? 'discrepancy' : 'ok', supplier_notified:false, notes:String(safeDraft.notes || '').trim(), photo_data:safeDraft.photo_data || '',
        void_reason:'', voided_by:null, voided_at:null, created_by:currentUser().id
      });
      baseItems.forEach(function (item) {
        var savedItem = window.GT.store.create('grn_items', Object.assign({ grn_id:grn.id }, item));
        var quantity = accepted(savedItem);
        if (quantity > 0) window.GT.inventory.recordMovement({ materialId:savedItem.material_id, locationId:grn.location_id, type:'grn', quantity:quantity, referenceType:'goods_received_note', referenceId:grn.id, note:'GRN ' + grn.number });
      });
      window.GT.audit.log('create', 'goods_received_notes', grn.id, null, grn);
      return grn;
    });
  }

  function updateEditable(id, changes) {
    var before = window.GT.store.find('goods_received_notes', id);
    if (!before || before.status === 'void') throw new Error('This goods received note cannot be edited.');
    var allowed = { notes:String(changes.notes || '').trim(), supplier_doc_missing:Boolean(changes.supplier_doc_missing), supplier_doc_no:changes.supplier_doc_missing ? '' : String(changes.supplier_doc_no || '').trim(), photo_data:changes.photo_data || '', supplier_notified:Boolean(changes.supplier_notified) };
    if (!allowed.supplier_doc_missing && !allowed.supplier_doc_no) throw new Error('Enter the supplier document number or tick No supplier document.');
    var after = window.GT.store.update('goods_received_notes', id, allowed);
    if (canEditCost() && Array.isArray(changes.items)) {
      changes.items.forEach(function (change) {
        var item = window.GT.store.find('grn_items', change.id);
        if (!item || Number(item.grn_id) !== Number(id)) return;
        var cost = change.unit_cost === '' || change.unit_cost === null ? null : Number(change.unit_cost);
        if (cost !== null && (!Number.isInteger(cost) || cost <= 0)) throw new Error('Unit cost must be a positive whole UGX amount.');
        window.GT.store.update('grn_items', item.id, { unit_cost:cost });
      });
    }
    window.GT.audit.log('update', 'goods_received_notes', id, before, after);
    return after;
  }

  function voidNote(id, reason) {
    var grn = window.GT.store.find('goods_received_notes', id);
    if (!grn || grn.status === 'void') throw new Error('This goods received note is already void or missing.');
    if (!String(reason || '').trim()) throw new Error('A void reason is required.');
    var movements = window.GT.store.where('stock_movements', function (row) { return row.reference_type === 'goods_received_note' && Number(row.reference_id) === Number(id) && row.movement_type === 'grn'; });
    movements.forEach(function (movement) {
      if (window.GT.inventory.getStock(movement.item_id, movement.location_id) < number(movement.quantity)) throw new Error('This GRN cannot be voided because some received stock has already been used.');
    });
    return window.GT.store.transaction(function () {
      movements.forEach(function (movement) { window.GT.inventory.recordMovement({ materialId:movement.item_id, locationId:movement.location_id, type:'adjustment', quantity:-number(movement.quantity), referenceType:'goods_received_note', referenceId:grn.id, note:'GRN void' }); });
      var after = window.GT.store.update('goods_received_notes', id, { status:'void', void_reason:String(reason).trim(), voided_by:currentUser().id, voided_at:new Date().toISOString() });
      window.GT.audit.log('void', 'goods_received_notes', id, grn, after);
      return after;
    });
  }

  function failedChecks(grn) {
    return [['quantity_ok','Quantity'],['quality_ok','Quality'],['damage_ok','Damage'],['colour_ok','Colour']].filter(function (item) { return grn[item[0]] === false; }).map(function (item) { return item[1]; });
  }

  function noticeBody(grn) {
    var supplier = window.GT.store.find('suppliers', grn.supplier_id);
    var template = window.GT.store.where('message_templates', function (row) { return String(row.name).toLowerCase() === 'supplier discrepancy notice'; })[0];
    var body = template ? template.body : 'Dear {{supplier_name}},\n\n{{business_name}} recorded a discrepancy on goods received note {{grn_number}} dated {{grn_date}}.\nFailed checks: {{failed_checks}}.\nDetails: {{notes}}\n\nPlease review and contact us.';
    var values = { supplier_name:supplier ? supplier.name : 'Supplier', business_name:window.GT.settings.businessName, grn_number:grn.number, grn_date:grn.received_at, failed_checks:failedChecks(grn).join(', '), notes:grn.notes };
    Object.keys(values).forEach(function (key) { body = body.split('{{' + key + '}}').join(values[key]); });
    return body;
  }

  function createNotice(id) {
    var grn = window.GT.store.find('goods_received_notes', id);
    var supplier = grn && window.GT.store.find('suppliers', grn.supplier_id);
    if (!grn || grn.status !== 'discrepancy') throw new Error('A supplier notice is available only for a discrepancy GRN.');
    var existing = window.GT.store.where('messages', function (row) { return row.reference_type === 'goods_received_note' && Number(row.reference_id) === Number(id) && row.status === 'draft'; })[0];
    if (existing) return existing;
    var template = window.GT.store.where('message_templates', function (row) { return String(row.name).toLowerCase() === 'supplier discrepancy notice'; })[0];
    var message = window.GT.store.create('messages', { channel:'email', recipient_name:supplier ? supplier.name : '', recipient_contact:supplier ? supplier.email : '', template_id:template ? template.id : null, body:noticeBody(grn), status:'draft', sent_by:null, sent_at:null, reference_type:'goods_received_note', reference_id:grn.id });
    window.GT.audit.log('create', 'messages', message.id, null, message);
    return message;
  }

  function markNotified(id) {
    var before = window.GT.store.find('goods_received_notes', id);
    if (!before) throw new Error('Goods received note not found.');
    var after = window.GT.store.update('goods_received_notes', id, { supplier_notified:true, supplier_notified_at:new Date().toISOString() });
    window.GT.audit.log('update', 'goods_received_notes', id, before, after);
    return after;
  }

  function items(id) { return window.GT.store.where('grn_items', function (item) { return Number(item.grn_id) === Number(id); }); }
  function totalCost(id) { return items(id).reduce(function (total, item) { return total + accepted(item) * number(item.unit_cost); }, 0); }

  function printMarkup(id) {
    var grn = window.GT.store.find('goods_received_notes', id);
    if (!grn) throw new Error('Goods received note not found.');
    var supplier = window.GT.store.find('suppliers', grn.supplier_id);
    var receiver = window.GT.store.find('users', grn.received_by);
    var showCost = canSeeCost();
    var head = '<th>Material</th><th>Colour</th><th>Width</th><th>Received</th><th>Rejected</th><th>Accepted</th><th>Unit</th>' + (showCost ? '<th>Unit cost</th>' : '');
    var body = items(id).map(function (item) { var material = window.GT.store.find('materials', item.material_id); return '<tr><td>' + window.GT.components.escapeHtml(material.name) + '</td><td>' + window.GT.components.escapeHtml(material.colour || '—') + '</td><td>' + window.GT.components.escapeHtml(material.width_inches ? material.width_inches + ' in' : '—') + '</td><td>' + item.quantity_received + '</td><td>' + item.quantity_rejected + '</td><td>' + accepted(item) + '</td><td>' + window.GT.components.escapeHtml(material.unit) + '</td>' + (showCost ? '<td>' + (item.unit_cost ? window.GT.format.formatMoneyPrint(item.unit_cost) : '—') + '</td>' : '') + '</tr>'; }).join('');
    var checks = [['Quantity',grn.quantity_ok],['Quality',grn.quality_ok],['Damage',grn.damage_ok],['Colour',grn.colour_ok]].map(function (entry) { return '<span class="print-check"><strong>' + entry[0] + ':</strong> ' + (entry[1] ? 'OK' : 'Issue') + '</span>'; }).join('');
    return (grn.status === 'void' ? window.GT.print.watermark('VOID') : '') + window.GT.print.letterhead() + '<h1 class="print-document-title">GOODS RECEIVED NOTE</h1><div class="print-document-facts"><p><strong>No:</strong> ' + grn.number + '</p><p><strong>Date:</strong> ' + grn.received_at + '</p><p><strong>Supplier:</strong> ' + window.GT.components.escapeHtml(supplier ? supplier.name : '') + '</p><p><strong>Supplier document:</strong> ' + window.GT.components.escapeHtml(grn.supplier_doc_missing ? 'No supplier document' : grn.supplier_doc_no) + '</p></div><table><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table><section class="print-keep-together"><div class="print-checks">' + checks + '</div><p><strong>Notes:</strong> ' + window.GT.components.escapeHtml(grn.notes || '—') + '</p>' + window.GT.print.signatureBlock(['Received by: ' + (receiver ? receiver.name : '')]) + '</section>';
  }

  return { accepted:accepted, toBaseQuantity:toBaseQuantity, validateDraft:validateDraft, post:post, updateEditable:updateEditable, voidNote:voidNote, failedChecks:failedChecks, noticeBody:noticeBody, createNotice:createNotice, markNotified:markNotified, items:items, totalCost:totalCost, printMarkup:printMarkup, canSeeCost:canSeeCost, canEnterCost:canEnterCost, canEditCost:canEditCost };
}());
