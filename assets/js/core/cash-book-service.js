/* Cash-book movements for Phase 15. The ledger is posted by source services. */
window.GT.cashBook = (function () {
  var GT = window.GT;
  function account(method) { return GT.store.where('accounts', { code: method === 'bank' ? '1010' : '1000' })[0]; }
  function entries() { return GT.store.all('ledger_entries').sort(function (a, b) { return b.entry_date.localeCompare(a.entry_date) || b.id - a.id; }); }
  function post(date, method, amount, type, id, narration, reverse) {
    // A-85: one cash or bank movement per collected receipt or approved expense; a reversal keeps the audit trail.
    var incoming = type === 'receipt' ? !reverse : !!reverse;
    return GT.store.create('ledger_entries', { entry_date:date, account_id:account(method).id,
      debit:incoming ? amount : 0, credit:incoming ? 0 : amount,
      reference_type:reverse ? type + '_reversal' : type, reference_id:id, narration:narration });
  }
  function has(type, id, reverse) { return GT.store.where('ledger_entries', { reference_type:reverse ? type + '_reversal' : type, reference_id:Number(id) }).length > 0; }
  function receipt(row, reverse) {
    if (!row || has('receipt', row.id, reverse)) return null;
    return post((reverse ? GT.dates.today() : row.received_at.slice(0, 10)), row.payment_method,
      Number(row.amount), 'receipt', row.id, (reverse ? 'Void ' : '') + 'Receipt ' + row.number, reverse);
  }
  function expense(row, reverse) {
    if (!row || has('expense', row.id, reverse)) return null;
    return post(reverse ? GT.dates.today() : row.expense_date, row.payment_method, Number(row.amount),
      'expense', row.id, (reverse ? 'Cancel ' : '') + 'Voucher ' + row.voucher_number, reverse);
  }
  function monthly(day) {
    var month = String(day).slice(0, 7), rows = entries().filter(function (row) { return row.entry_date.slice(0, 7) === month; });
    // BUSINESS_RULES.md section 13, A-85: use dated expense posts and reversals so this matches statement expenditure.
    return { in:GT.receipts.collectedInMonth(day),
      out:rows.reduce(function (total, row) {
        return total + (row.reference_type === 'expense' ? Number(row.credit || 0) : row.reference_type === 'expense_reversal' ? -Number(row.debit || 0) : 0);
      }, 0), rows:rows };
  }
  return { entries:entries, receipt:receipt, expense:expense, monthly:monthly };
}());
