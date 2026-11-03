/* Derived debt, statement snapshots and reminder posting: BUSINESS_RULES.md sections 3, 4 and 15. */
window.GT = window.GT || {};
window.GT.debtors = (function () {
  var GT = window.GT;
  function day(value) { return String(value || '').slice(0, 10); }
  function today() { return GT.dates.today(); }
  function actor() { return GT.session.currentUser(); }
  function money(value) { return GT.format.formatMoney(value); }
  function customer(id) { return GT.store.find('customers', id); }
  function allReminders() { return GT.store.all('debt_reminders').sort(function (a,b) { return String(b.sent_at).localeCompare(String(a.sent_at)); }); }
  function remindersFor(id) { return allReminders().filter(function (row) { return Number(row.customer_id) === Number(id); }); }
  function openInvoices(id, asOf) {
    // BUSINESS_RULES.md section 3: only issued invoices with a receipt-derived balance contribute to debt.
    return GT.store.where('sales_documents', function (row) {
      return row.type === 'invoice' && row.status === 'issued' && Number(row.customer_id) === Number(id);
    }).map(function (doc) { return Object.assign({}, doc, GT.invoices.summary(doc.id, asOf || today())); })
      .filter(function (doc) { return doc.balance > 0; })
      .sort(function (a,b) { return a.issue_date.localeCompare(b.issue_date); });
  }
  function bucket(days) { return days <= 30 ? 'b0_30' : days <= 60 ? 'b31_60' : 'b61_plus'; }
  function promiseStatus(id, asOf) {
    var promise = remindersFor(id).find(function (row) { return row.outcome === 'promised' && row.promise_date && Number(row.promise_amount) > 0; });
    if (!promise) return { status:'none', reminder:null };
    var date = asOf || today();
    // BUSINESS_RULES.md section 4 (A-45): only later, non-void payments keep a promise.
    // New invoices and changes to the account balance cannot change this result.
    var paid = GT.store.where('receipts', function (row) {
      var received = day(row.received_at);
      return Number(row.customer_id) === Number(id) && row.status !== 'void' &&
        received > day(promise.sent_at) && received <= date;
    }).reduce(function (sum, row) { return sum + Number(row.amount || 0); }, 0);
    return { status:paid >= Number(promise.promise_amount) ? 'kept' : date > promise.promise_date ? 'missed' : 'pending', reminder:promise, paid_after:paid };
  }
  function list(asOf) {
    var date = asOf || today();
    return GT.store.all('customers').map(function (client) {
      var invoices = openInvoices(client.id, date);
      if (!invoices.length) return null;
      var amounts = { b0_30:0, b31_60:0, b61_plus:0 };
      invoices.forEach(function (doc) { amounts[bucket(doc.ageDays)] += doc.balance; });
      var balance = GT.customers.balance(client.id);
      var limit = Number(client.credit_limit || 0);
      return Object.assign({ id:client.id, customer:client, customer_id:client.id, name:client.name,
        group_id:client.customer_group_id, balance:balance, open_invoices:invoices,
        open_invoice_count:invoices.length,
        overdue_amount:invoices.reduce(function (sum,doc) { return sum + (doc.isOverdue ? doc.balance : 0); },0),
        oldest_age:Math.max.apply(null,invoices.map(function (doc) { return doc.ageDays; })),
        credit_limit:limit, available_credit:client.is_credit ? limit - balance : null,
        over_limit:!!client.is_credit && balance > limit,
        last_reminder:remindersFor(client.id)[0] || null,
        promise:promiseStatus(client.id,date) }, amounts);
    }).filter(Boolean).sort(function (a,b) { return a.name.localeCompare(b.name); });
  }
  function ageingTotals(asOf) {
    var rows = list(asOf), result = { b0_30:0, b31_60:0, b61_plus:0, total:0,
      customers:{ b0_30:0, b31_60:0, b61_plus:0 } };
    rows.forEach(function (row) {
      ['b0_30','b31_60','b61_plus'].forEach(function (key) {
        result[key] += row[key]; if (row[key] > 0) result.customers[key] += 1;
      });
      result.total += row.balance;
    });
    return result;
  }
  function defaultParticulars(doc) {
    var first = GT.salesDocs.items(doc.id)[0];
    return first ? first.quantity + ' ' + first.unit + ' of ' + first.description : 'Invoice ' + doc.number;
  }
  function buildStatement(customerId, invoiceIds) {
    var client = customer(customerId);
    if (!client || GT.customers.balance(client.id) <= 0) throw new Error('Choose a customer with a balance.');
    var selected = invoiceIds && invoiceIds.length ? invoiceIds.map(Number) : openInvoices(client.id).map(function (doc) { return doc.id; });
    var docs = openInvoices(client.id).filter(function (doc) { return selected.indexOf(doc.id) !== -1; });
    if (!docs.length || docs.length !== selected.length) throw new Error('Choose open invoices for this customer.');
    var lines = docs.map(function (doc) {
      return { invoice_id:doc.id, document_ref:doc.fiscal_document_no || doc.number,
        particulars:defaultParticulars(doc), delivery_date:doc.issue_date,
        gross_amount:Number(doc.total), advance:Number(doc.paid), amount_due:Number(doc.balance) };
    });
    return { customer_id:client.id, statement_date:today(), addressee_title:'The Finance Manager',
      addressee_name:client.name, intro_text:'We kindly request payment for the goods already supplied, as stated with reference to the document numbers below.',
      signatory_name:GT.settings.authorisedSignatory, lines_json:lines,
      total_gross:lines.reduce(function (sum,line) { return sum + line.gross_amount; },0),
      total_advance:lines.reduce(function (sum,line) { return sum + line.advance; },0),
      total_due:lines.reduce(function (sum,line) { return sum + line.amount_due; },0) };
  }
  function saveStatement(values) {
    if (!GT.permissions.can('debtors','C')) throw new Error('You cannot issue statements.');
    if (!values || !values.statement_date || values.statement_date > today()) throw new Error('Statement date cannot be in the future.');
    var selected = (values.lines_json || []).map(function (line) { return Number(line.invoice_id); });
    var snapshot = buildStatement(values.customer_id, selected);
    var lines = snapshot.lines_json.map(function (line) {
      var edited = values.lines_json.find(function (item) { return Number(item.invoice_id) === line.invoice_id; });
      return Object.assign({}, line, { particulars:String(edited.particulars || '').trim(), delivery_date:day(edited.delivery_date) });
    });
    if (lines.some(function (line) { return !line.particulars || !/^\d{4}-\d{2}-\d{2}$/.test(line.delivery_date) || line.delivery_date > today(); })) throw new Error('Each line needs particulars and a valid delivery date.');
    return GT.store.transaction(function () {
      // DOCUMENT_TEMPLATES.md section 6: lock the issue-time invoice figures and wording.
      var row = GT.store.create('statements', Object.assign({}, snapshot, {
        statement_date:values.statement_date, addressee_title:String(values.addressee_title || '').trim(),
        addressee_name:String(values.addressee_name || '').trim(), intro_text:String(values.intro_text || '').trim(),
        signatory_name:String(values.signatory_name || GT.settings.authorisedSignatory).trim(), lines_json:lines,
        created_by:actor().id, status:'issued', void_reason:null
      }));
      GT.audit.log('issue','statements',row.id,null,row);
      return row;
    });
  }
  function voidStatement(id, reason) {
    var role = actor() && actor().role, before = GT.store.find('statements',id);
    if (['owner','general_manager'].indexOf(role) === -1) throw new Error('Only Owner or General Manager may void statements.');
    if (!before || before.status !== 'issued' || !String(reason || '').trim()) throw new Error('An issued statement and a reason are required.');
    return GT.store.transaction(function () {
      var after = GT.store.update('statements',id,{ status:'void', void_reason:String(reason).trim() });
      GT.audit.log('void','statements',id,before,after); return after;
    });
  }
  function reminderText(customerId, templateKey, invoiceIds) {
    var client = customer(customerId), docs = openInvoices(customerId).filter(function (doc) { return !invoiceIds || invoiceIds.indexOf(doc.id) !== -1; });
    if (!client || !docs.length) throw new Error('Choose an open invoice.');
    var key = String(templateKey || 'payment reminder').toLowerCase();
    var template = GT.store.all('message_templates').find(function (row) { return row.name.toLowerCase() === key; });
    if (!template) throw new Error('Payment reminder template is missing.');
    var values = { customer_name:client.name, invoice_numbers:docs.map(function (doc) { return doc.number; }).join(', '),
      amount_due:money(docs.reduce(function (sum,doc) { return sum + doc.balance; },0)),
      due_date:GT.dates.formatDate(docs.reduce(function (earliest,doc) { return doc.dueDate < earliest ? doc.dueDate : earliest; },docs[0].dueDate)),
      business_name:GT.settings.businessName, phone_numbers:GT.settings.phones.join(', ') };
    return template.body.replace(/\{\{?([a-z_]+)\}?\}/g,function (whole,name) { return values[name] === undefined ? whole : values[name]; });
  }
  function smsSegments(value) { var length = Array.from(String(value || '')).length; return length <= 160 ? (length ? 1 : 0) : Math.ceil(length / 153); }
  function recentElectronic(id, asOf) {
    var date = asOf || today();
    return remindersFor(id).find(function (row) { return row.channel !== 'call' && GT.dates.daysBetween(day(row.sent_at),date) >= 0 && GT.dates.daysBetween(day(row.sent_at),date) < 7; }) || null;
  }
  function ensureOverdue(id) {
    var row = list().find(function (item) { return item.id === Number(id); });
    if (!row || row.overdue_amount <= 0) throw new Error('Only a customer with an overdue balance can be reminded.');
    return row;
  }
  function sendReminder(values) {
    if (!GT.permissions.can('payment_reminders','C')) throw new Error('You cannot send payment reminders.');
    if (['sms','email'].indexOf(values.channel) === -1) throw new Error('Choose SMS or email.');
    var debtor = ensureOverdue(values.customerId), selected = (values.invoiceIds || []).map(Number);
    var docs = debtor.open_invoices.filter(function (doc) { return selected.indexOf(doc.id) !== -1 && doc.isOverdue; });
    if (!docs.length || docs.length !== selected.length) throw new Error('Choose overdue invoices for this customer.');
    var text = String(values.text || '').trim(); if (!text) throw new Error('Enter reminder text.');
    var recent = recentElectronic(debtor.id), role = actor().role, reason = String(values.overrideReason || '').trim();
    // BUSINESS_RULES.md section 4 (A-46): only a manager can override the seven-day spacing, with a reason.
    if (recent && (role !== 'general_manager' || !reason)) throw new Error(role === 'accountant' ? 'A reminder was sent within seven days. Ask the General Manager.' : 'An override reason is required for a second reminder within seven days.');
    if (values.channel === 'email' && !debtor.customer.email) throw new Error('This customer has no email address.');
    return GT.store.transaction(function () {
      var template = GT.store.all('message_templates').find(function (row) { return row.name.toLowerCase() === 'payment reminder'; });
      var message = GT.store.create('messages', { channel:values.channel, recipient_name:debtor.name,
        recipient_contact:values.channel === 'sms' ? debtor.customer.phone : debtor.customer.email,
        template_id:template ? template.id : null, body:text, status:'sent (simulated)',
        sent_by:actor().id, sent_at:today()+'T12:00:00+03:00', reference_type:'debt_reminder', reference_id:null });
      var reminder = GT.store.create('debt_reminders', { customer_id:debtor.id, invoice_ids_json:selected,
        channel:values.channel, message_id:message.id, message_text:text, outcome:'sent', promise_date:null,
        promise_amount:null, balance_at_reminder:debtor.balance, override_reason:recent ? reason : null,
        sent_by:actor().id, sent_at:today()+'T12:00:00+03:00' });
      GT.store.update('messages',message.id,{ reference_id:reminder.id });
      GT.audit.log('send_reminder','debt_reminders',reminder.id,null,reminder);
      window.dispatchEvent(new Event('gt:debtor-changed'));
      return reminder;
    });
  }
  function logCall(values) {
    if (!GT.permissions.can('payment_reminders','C')) throw new Error('You cannot log calls.');
    var debtor = ensureOverdue(values.customerId), sentAt = String(values.sentAt || today()+'T12:00:00+03:00');
    if (day(sentAt) > today() || new Date(sentAt).getTime() > Date.now()) throw new Error('A call cannot be in the future.');
    if (['no_answer','promised','refused','other'].indexOf(values.outcome) === -1) throw new Error('Choose a call outcome.');
    if (values.outcome === 'promised' && (!values.promiseDate || values.promiseDate <= today() || !Number.isSafeInteger(Number(values.promiseAmount)) || Number(values.promiseAmount) <= 0 || Number(values.promiseAmount) > debtor.balance)) throw new Error('Enter a future promise date and an amount within the balance.');
    return GT.store.transaction(function () {
      var reminder = GT.store.create('debt_reminders', { customer_id:debtor.id,
        invoice_ids_json:debtor.open_invoices.filter(function (doc) { return doc.isOverdue; }).map(function (doc) { return doc.id; }),
        channel:'call', message_id:null, message_text:String(values.notes || '').trim(), outcome:values.outcome,
        promise_date:values.outcome === 'promised' ? values.promiseDate : null,
        promise_amount:values.outcome === 'promised' ? Number(values.promiseAmount) : null,
        balance_at_reminder:debtor.balance, sent_by:actor().id, sent_at:sentAt });
      GT.audit.log('log_call','debt_reminders',reminder.id,null,reminder);
      window.dispatchEvent(new Event('gt:debtor-changed'));
      return reminder;
    });
  }
  function smsCountThisMonth(asOf) { var month = (asOf || today()).slice(0,7); return allReminders().filter(function (row) { return row.channel === 'sms' && day(row.sent_at).slice(0,7) === month; }).reduce(function (sum,row) { return sum + smsSegments(row.message_text); },0); }
  function overdueDebtorCount(asOf) { return list(asOf).filter(function (row) { return row.overdue_amount > 0; }).length; }
  return { list:list, ageingTotals:ageingTotals, openInvoices:openInvoices, buildStatement:buildStatement,
    saveStatement:saveStatement, voidStatement:voidStatement, reminderText:reminderText,
    smsSegments:smsSegments, sendReminder:sendReminder, logCall:logCall, remindersFor:remindersFor,
    smsCountThisMonth:smsCountThisMonth, overdueDebtorCount:overdueDebtorCount,
    promiseStatus:promiseStatus, recentElectronic:recentElectronic, bucket:bucket };
}());
