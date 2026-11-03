/* Material issue lifecycle. BUSINESS_RULES.md section 6 (A-69 to A-72). */
window.GT.materialIssues = (function () {
  var GT = window.GT;
  function actor() { return GT.session.currentUser(); }
  function roleIn(roles) { return !!actor() && roles.indexOf(actor().role) !== -1; }
  function requester() { return roleIn(['owner', 'general_manager', 'store_keeper', 'workshop_supervisor']); }
  function issuer() { return roleIn(['owner', 'general_manager', 'store_keeper']); }
  function manager() { return roleIn(['owner', 'general_manager']); }
  function row(id) { var found = GT.store.find('material_issues', id); if (!found) throw new Error('Material issue was not found.'); return found; }
  function lines(id) { return GT.store.where('material_issue_items', function (item) { return Number(item.material_issue_id) === Number(id) && item.active !== false; }); }
  function canView(issue) { return GT.permissions.can('material_issue', 'V') && (actor().role !== 'workshop_supervisor' || Number(issue.requested_by) === actor().id); }
  function requireView(issue) { if (!canView(issue)) throw new Error('You cannot view this material issue.'); }
  function requiredReason(value) { var reason = String(value || '').trim(); if (!reason) throw new Error('Enter a reason.'); return reason; }
  function quantity(value) { var result = Number(value); if (!Number.isFinite(result) || result <= 0 || Math.abs(Math.round(result * 1000) - result * 1000) > 0.000001) throw new Error('Enter a positive quantity with at most three decimal places.'); return result; }
  function validated(values) {
    var order = GT.store.find('orders', values.order_id);
    // A-71: only active orders can receive new requests; issue does not move an order stage.
    if (!order || GT.orders.summary(order.id).status !== 'active') throw new Error('Choose an active order.');
    var location = GT.store.find('locations', values.location_id);
    if (!location) throw new Error('Choose a location.');
    if (!Array.isArray(values.lines) || !values.lines.length) throw new Error('Add at least one material line.');
    var seen = {};
    var checked = values.lines.map(function (line) {
      var material = GT.store.find('materials', line.material_id);
      if (!material || !material.active) throw new Error('Choose an active material.');
      if (seen[material.id]) throw new Error('List each material once.');
      seen[material.id] = true;
      var amount = quantity(line.quantity);
      return {material_id:material.id, quantity:amount, note:String(line.note || '').trim(), returned_quantity:0};
    });
    return {order_id:order.id, location_id:location.id, notes:String(values.notes || '').trim(), lines:checked};
  }
  function notify() { window.dispatchEvent(new CustomEvent('gt:material-issue-changed')); }
  function createRequest(values) {
    if (!requester()) throw new Error('You cannot request material.');
    var checked = validated(values);
    var saved = GT.store.transaction(function () {
      var issue = GT.store.create('material_issues', {number:null, order_id:checked.order_id, location_id:checked.location_id,
        status:'requested', requested_by:actor().id, requested_at:new Date().toISOString(), issued_by:null,
        issued_at:null, decision_note:'', notes:checked.notes});
      checked.lines.forEach(function (line) { GT.store.create('material_issue_items', Object.assign({material_issue_id:issue.id}, line)); });
      GT.audit.log('request', 'material_issues', issue.id, null, issue);
      return issue;
    });
    notify(); return saved;
  }
  function updateRequest(id, values) {
    var before = row(id); requireView(before);
    if (before.status !== 'requested' || (Number(before.requested_by) !== actor().id && !manager())) throw new Error('Only an editable request may be changed.');
    var checked = validated(values);
    var saved = GT.store.transaction(function () {
      var updated = GT.store.update('material_issues', id, {order_id:checked.order_id, location_id:checked.location_id, notes:checked.notes});
      // Protected line history is retained; superseded request lines are inactive until issue.
      lines(id).forEach(function (old) { GT.store.update('material_issue_items', old.id, {active:false}); });
      checked.lines.forEach(function (line) { GT.store.create('material_issue_items', Object.assign({material_issue_id:Number(id)}, line)); });
      GT.audit.log('update_request', 'material_issues', id, before, updated);
      return updated;
    });
    notify(); return saved;
  }
  function decide(id, status, note) {
    var before = row(id); requireView(before);
    if (before.status !== 'requested') throw new Error('Only a requested issue can be changed.');
    if (status === 'cancelled' ? Number(before.requested_by) !== actor().id : !issuer()) throw new Error('You cannot make this decision.');
    var saved = GT.store.update('material_issues', id, {status:status, decision_note:status === 'rejected' ? requiredReason(note) : 'Cancelled by requester'});
    GT.audit.log(status, 'material_issues', id, before, saved); notify(); return saved;
  }
  function cancelRequest(id) { return decide(id, 'cancelled', ''); }
  function reject(id, reason) { return decide(id, 'rejected', reason); }
  function issue(id) {
    var before = row(id); requireView(before);
    if (!issuer() || before.status !== 'requested') throw new Error('Only an issuer can issue a pending request.');
    // A-69: recheck all balances at issue time; the transaction rolls back every line and the number on failure.
    var saved = GT.store.transaction(function () {
      if (GT.orders.summary(before.order_id).status !== 'active') throw new Error('The order is no longer active.');
      var number = GT.numbering.next('material_issue');
      lines(id).forEach(function (line) { GT.inventory.recordMovement({materialId:line.material_id, locationId:before.location_id,
        type:'issue', quantity:-Number(line.quantity), referenceType:'material_issue', referenceId:before.id, note:'Material issue ' + number}); });
      var updated = GT.store.update('material_issues', id, {number:number, status:'issued', issued_by:actor().id, issued_at:new Date().toISOString()});
      GT.audit.log('issue', 'material_issues', id, before, updated);
      return updated;
    });
    notify(); return saved;
  }
  function returned(line) {
    // A-70: derive returns from movements so the ledger remains the source of truth.
    return GT.store.where('stock_movements', function (movement) { return movement.reference_type === 'material_issue_return' &&
      Number(movement.reference_id) === Number(line.id); }).reduce(function (sum, movement) { return sum + Number(movement.quantity); }, 0);
  }
  function issueLines(id) { return lines(id).map(function (line) { return Object.assign({}, line, {returned_quantity:returned(line)}); }); }
  function recordReturn(id, entries) {
    var before = row(id); requireView(before);
    if (!issuer() || before.status !== 'issued') throw new Error('Only an issued issue can receive a return.');
    if (!Array.isArray(entries) || !entries.length) throw new Error('Enter a return quantity.');
    var available = issueLines(id), seen = {}, checked = entries.map(function (entry) {
      var line = available.find(function (item) { return Number(item.id) === Number(entry.item_id); });
      if (!line || seen[line.id]) throw new Error('Choose each issued line once.');
      seen[line.id] = true;
      var amount = quantity(entry.quantity);
      if (amount > Number(line.quantity) - line.returned_quantity + 0.000001) throw new Error('Return exceeds the unreturned issued quantity.');
      return {line:line, quantity:amount};
    });
    GT.store.transaction(function () { checked.forEach(function (entry) {
      GT.inventory.recordMovement({materialId:entry.line.material_id, locationId:before.location_id, type:'issue_return',
        quantity:entry.quantity, referenceType:'material_issue_return', referenceId:entry.line.id, note:'Return for material issue ' + before.number});
      GT.audit.log('return', 'material_issues', id, null, {item_id:entry.line.id, quantity:entry.quantity});
    }); });
    notify(); return issueLines(id);
  }
  function voidIssue(id, reason) {
    var before = row(id); requireView(before);
    if (!manager() || before.status !== 'issued') throw new Error('Only a manager can void an issued issue.');
    var note = requiredReason(reason);
    if (issueLines(id).some(function (line) { return line.returned_quantity > 0; })) throw new Error('An issue with a return cannot be voided.');
    // A-70: a void retains the number and posts reversing movements like a GRN void.
    var saved = GT.store.transaction(function () {
      lines(id).forEach(function (line) { GT.inventory.recordMovement({materialId:line.material_id, locationId:before.location_id,
        type:'adjustment', quantity:Number(line.quantity), referenceType:'material_issue_void', referenceId:id, note:'Material issue void: ' + note}); });
      var updated = GT.store.update('material_issues', id, {status:'void', decision_note:note});
      GT.audit.log('void', 'material_issues', id, before, updated); return updated;
    });
    notify(); return saved;
  }
  function list(filters) {
    filters = filters || {};
    return GT.store.all('material_issues').filter(function (issue) { return canView(issue) && (!filters.status || issue.status === filters.status) &&
      (!filters.order_id || Number(issue.order_id) === Number(filters.order_id)); });
  }
  function forOrder(orderId) { return list({order_id:orderId}).filter(function (issue) { return issue.status === 'issued'; }); }
  function pendingCount() { return list({status:'requested'}).length; }
  return {createRequest:createRequest, updateRequest:updateRequest, cancelRequest:cancelRequest, issue:issue,
    reject:reject, recordReturn:recordReturn, void:voidIssue, forOrder:forOrder, list:list, pendingCount:pendingCount,
    lines:issueLines, canView:canView, canRequest:requester, canIssue:issuer, canVoid:manager};
}());
