/* Owner-approved expenditures; all reads and writes use GT.store. */
window.GT.expenses = (function () {
  var GT = window.GT;
  function actor() { return GT.session.currentUser(); }
  function owner() { return actor() && actor().role === 'owner'; }
  function canCreate() { return GT.permissions.can('expenses', 'C'); }
  function category(id) { return GT.store.find('expense_categories', id); }
  function list() { return GT.store.all('expenses').filter(function (row) { return row.status !== 'discarded'; }).sort(function (a, b) { return b.expense_date.localeCompare(a.expense_date) || b.id - a.id; }); }
  function validate(values) {
    var errors = {}, amount = Number(values.amount), day = String(values.expense_date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || isNaN(new Date(day+'T12:00:00Z').getTime()) || GT.dates.addDays(day, 0) !== day || day > GT.dates.today()) errors.expense_date = 'Enter a valid date through today.';
    if (!category(values.category_id)) errors.category_id = 'Choose a category.';
    if (!String(values.payee || '').trim()) errors.payee = 'Enter the person or business paid.';
    if (!String(values.description || '').trim()) errors.description = 'Enter a description.';
    if (!Number.isSafeInteger(amount) || amount < 1) errors.amount = 'Enter a positive whole UGX amount.';
    if (['cash', 'bank'].indexOf(values.payment_method) < 0) errors.payment_method = 'Choose cash or bank.';
    if (values.receipt_photo_path && !/^data:image\/jpeg;base64,/.test(values.receipt_photo_path)) errors.receipt_photo_path = 'Choose a valid receipt image.';
    return errors;
  }
  function save(values, submit) {
    if (!canCreate()) throw new Error('You cannot record expenses.');
    var errors = validate(values);
    if (Object.keys(errors).length) { var failure = new Error('Correct the expense fields.'); failure.fields = errors; throw failure; }
    if (values.receipt_photo_path) GT.files.ensureWithinLimit(values.receipt_photo_path);
    return GT.store.transaction(function () {
      // BUSINESS_RULES.md section 12, A-83: submission requests approval and consumes no voucher number.
      var row = GT.store.create('expenses', { expense_date:values.expense_date, category_id:Number(values.category_id),
        amount:Number(values.amount), payee:String(values.payee).trim(), payment_method:values.payment_method,
        description:String(values.description).trim(), receipt_photo_path:values.receipt_photo_path || null, is_recurring:false,
        status:submit ? 'pending' : 'draft', voucher_number:null, recorded_by:actor().id,
        approved_by:null, approved_at:null, rejection_reason:null, cancelled_by:null, cancelled_at:null, cancellation_reason:null });
      if (submit) GT.store.create('approvals', { type:'expense', entity_type:'expenses', entity_id:row.id,
        requested_by:actor().id, approved_by:null, status:'requested', reason:row.description });
      GT.audit.log(submit ? 'submit' : 'create_draft', 'expenses', row.id, null, row);
      window.dispatchEvent(new Event('gt:expense-changed'));
      return row;
    });
  }
  function submit(id) {
    if (!canCreate()) throw new Error('You cannot submit expenses.');
    var before = GT.store.find('expenses', id);
    if (!before || before.status !== 'draft') throw new Error('Only a draft can be submitted.');
    var errors = validate(before); if (Object.keys(errors).length) throw new Error('Correct this draft before submission.');
    return GT.store.transaction(function () {
      var after = GT.store.update('expenses', id, { status:'pending' });
      GT.store.create('approvals', { type:'expense', entity_type:'expenses', entity_id:id,
        requested_by:before.recorded_by, approved_by:null, status:'requested', reason:before.description });
      GT.audit.log('submit', 'expenses', id, before, after); window.dispatchEvent(new Event('gt:expense-changed')); return after;
    });
  }
  function discard(id) {
    var before = GT.store.find('expenses', id);
    if (!before || before.status !== 'draft' || !(owner() || Number(before.recorded_by) === Number(actor().id))) throw new Error('Only your unnumbered draft can be discarded.');
    var after = GT.store.update('expenses', id, { status:'discarded' });
    GT.audit.log('discard', 'expenses', id, before, after); window.dispatchEvent(new Event('gt:expense-changed')); return after;
  }
  function decide(id, approve, reason) {
    if (!owner()) throw new Error('Only Owner may decide expenditures.');
    var before = GT.store.find('expenses', id), note = String(reason || '').trim();
    if (!before || before.status !== 'pending') throw new Error('Only a pending expense can be decided.');
    if (!approve && !note) throw new Error('A rejection reason is required.');
    return GT.store.transaction(function () {
      // ROLE_PERMISSION_MATRIX.md hard rule 5, A-83: posting and numbering happen after Owner approval.
      var changes = approve ? { status:'approved', approved_by:actor().id, approved_at:new Date().toISOString(),
        voucher_number:GT.numbering.next('payment_voucher') } : { status:'rejected', rejection_reason:note };
      var after = GT.store.update('expenses', id, changes);
      var approval = GT.store.where('approvals', function (row) { return row.type === 'expense' && Number(row.entity_id) === Number(id) && row.status === 'requested'; })[0];
      if (approval) GT.store.update('approvals', approval.id, { status:approve ? 'approved' : 'rejected', approved_by:actor().id, reason:note || before.description });
      if (approve) GT.cashBook.expense(after, false);
      else GT.people.reopenRejectedExpense(id);
      GT.audit.log(approve ? 'approve' : 'reject', 'expenses', id, before, after); window.dispatchEvent(new Event('gt:expense-changed')); return after;
    });
  }
  function cancel(id, reason) {
    if (!owner()) throw new Error('Only Owner may cancel an approved expense.');
    var before = GT.store.find('expenses', id), note = String(reason || '').trim();
    if (!before || before.status !== 'approved') throw new Error('Only an approved expense can be cancelled.');
    if (!note) throw new Error('A cancellation reason is required.');
    return GT.store.transaction(function () {
      // A-84: retain the numbered voucher and post the opposite movement instead of deleting history.
      var after = GT.store.update('expenses', id, { status:'cancelled', cancellation_reason:note,
        cancelled_by:actor().id, cancelled_at:new Date().toISOString() });
      GT.cashBook.expense(after, true);
      GT.audit.log('cancel', 'expenses', id, before, after); window.dispatchEvent(new Event('gt:expense-changed')); return after;
    });
  }
  function approvedTotal(from, to) { return list().filter(function (row) { return row.status === 'approved' && row.expense_date >= from && row.expense_date <= to; }).reduce(function (sum, row) { return sum + Number(row.amount); }, 0); }
  return { list:list, validate:validate, save:save, submit:submit, discard:discard, decide:decide, cancel:cancel, approvedTotal:approvedTotal };
}());
