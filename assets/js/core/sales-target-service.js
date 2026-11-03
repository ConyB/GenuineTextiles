/* Monthly invoice targets: BUSINESS_RULES.md section 14 and A-109/A-112. */
window.GT.salesTargets = (function () {
  var GT = window.GT;
  function canManage() { return GT.permissions.can('sales_targets', 'E'); }
  function salespeople() { return GT.session.users().filter(function (user) { return user.role === 'sales'; }); }
  function visiblePeople() {
    if (!GT.permissions.can('sales_targets', 'V')) return [];
    var actor = GT.session.currentUser();
    return salespeople().filter(function (person) { return actor.role !== 'sales' || person.id === actor.id; });
  }
  function validMonth(month) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || '')); }
  function save(userId, month, amount) {
    if (!canManage()) throw new Error('Only Owner or General Manager may set targets.');
    var fields = {};
    if (!salespeople().some(function (person) { return person.id === Number(userId); })) fields.user_id = 'Choose a salesperson.';
    if (!validMonth(month)) fields.month = 'Choose a valid month.';
    if (!Number.isSafeInteger(Number(amount)) || Number(amount) <= 0) fields.target_amount = 'Enter a positive whole UGX target.';
    if (Object.keys(fields).length) { var error = new Error('Please correct the target fields.'); error.fields = fields; throw error; }
    // A-112: one current row per person/month; every save retains the previous value and actor.
    return GT.store.transaction(function () {
      var before = GT.store.where('sales_targets', { user_id:Number(userId), month:month })[0];
      var saved = before ? GT.store.update('sales_targets', before.id, { target_amount:Number(amount) }) :
        GT.store.create('sales_targets', { user_id:Number(userId), month:month, target_amount:Number(amount) });
      GT.store.create('sales_target_history', {
        sales_target_id:saved.id, user_id:Number(userId), month:month, previous_amount:before ? before.target_amount : null,
        target_amount:Number(amount), changed_by:GT.session.currentUser().id, changed_at:new Date().toISOString()
      });
      GT.audit.log(before ? 'update' : 'create', 'sales_targets', saved.id, before, saved);
      return saved;
    });
  }
  function history(month) {
    if (!canManage()) return [];
    return GT.store.where('sales_target_history', { month:month }).map(function (row) {
      return Object.assign({}, row, {
        name:(GT.store.find('users', row.user_id) || {}).name || 'Unknown salesperson',
        changed_by_name:(GT.store.find('users', row.changed_by) || {}).name || 'Unknown user'
      });
    }).sort(function (a,b) { return b.changed_at.localeCompare(a.changed_at) || b.id - a.id; });
  }
  function progress(target, actual, month) {
    if (!target) return { target:0, actual:actual, percent:0, difference:0, status:'Not started', has_target:false };
    var amount = Number(target.target_amount);
    // A-109: Missed applies only after the month ends. Missing targets are visibly unset.
    var status = actual >= amount ? 'Target met' : GT.dates.endOfMonth(month + '-01') < GT.dates.today() ?
      'Missed' : actual > 0 ? 'In progress' : 'Not started';
    return { target:amount, actual:actual, percent:amount ? Math.floor(actual / amount * 100) : 0,
      difference:actual - amount, status:status, has_target:true };
  }
  function rows(month) {
    if (!validMonth(month)) throw new Error('Choose a valid month.');
    var people = visiblePeople();
    if (!people.length) return [];
    var actual = GT.reports.salesByEmployee(month + '-01', GT.dates.endOfMonth(month + '-01'));
    return people.map(function (person) {
      var target = GT.store.where('sales_targets', { user_id:person.id, month:month })[0];
      return Object.assign({ id:person.id, name:person.name, month:month }, progress(target, actual[person.id] || 0, month));
    });
  }
  function reconcile(month, targetRows) {
    // Phase 20: independently sum Phase 16 source rows so an aggregation mismatch is visible as FAIL.
    var people = visiblePeople(), reportRows = GT.reports.sales().filter(function (row) {
      return row.kind === 'Invoice' && row.date.slice(0,7) === month;
    });
    return people.every(function (person) {
      var expected = reportRows.filter(function (row) { return Number(row.issued_by) === person.id; })
        .reduce(function (total, row) { return total + row.billed; }, 0);
      var matching = targetRows.filter(function (row) { return row.id === person.id; });
      return matching.length === 1 && matching[0].actual === expected;
    }) && targetRows.length === people.length;
  }
  function summary(month, targetRows) {
    var selected = targetRows || rows(month);
    var totals = selected.reduce(function (total, row) {
      total.target += row.target; total.actual += row.actual;
      if (row.has_target) total.assigned += 1;
      return total;
    }, { target:0, actual:0, assigned:0, people:selected.length });
    totals.percent = totals.target ? Math.floor(totals.actual / totals.target * 100) : 0;
    return totals;
  }
  return { canManage:canManage, salespeople:salespeople, save:save, history:history, rows:rows, reconcile:reconcile, summary:summary };
}());
