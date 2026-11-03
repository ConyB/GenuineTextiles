/* Phase 19 communication rules. All delivery is simulated (BUSINESS_RULES.md section 15). */
window.GT = window.GT || {};
window.GT.communication = (function () {
  var GT = window.GT;
  function actor() { return GT.session.currentUser(); }
  function role() { return actor().role; }
  function manager() { return role() === 'owner' || role() === 'general_manager'; }
  function template(id) { return GT.store.find('message_templates', id); }
  function segments(body) { return GT.debtors.smsSegments(body); } // BUSINESS_RULES.md 15, A-46: 160 then 153.
  function canEditTemplate(row) {
    return manager() || role() === 'marketing_manager' || (role() === 'accountant' && row && row.name === 'Payment reminder');
  }
  function saveTemplate(id, body) {
    var before = template(id), value = String(body || '').trim();
    if (!before || !canEditTemplate(before)) throw new Error('You cannot edit this template.');
    if (!value) throw new Error('Enter template text.');
    // A-102: Marketing edits wait for manager approval before Sales can use them.
    var after = GT.store.update('message_templates', id, {body:value, approved:manager(), approved_by:manager()?actor().id:null});
    GT.audit.log('update', 'message_templates', id, before, after);
    return after;
  }
  function approveTemplate(id) {
    if (!manager()) throw new Error('Manager approval is required.');
    var before=template(id); if (!before) throw new Error('Template not found.');
    var after=GT.store.update('message_templates',id,{approved:true,approved_by:actor().id});
    GT.audit.log('approve','message_templates',id,before,after); return after;
  }
  function customer(id) { return GT.store.find('customers', id); }
  function recipientContact(row, channel) { return channel === 'email' ? row.email : row.phone; }
  function latestOrder(row) {
    return GT.store.where('orders', {customer_id:row.id}).filter(function (order) { return order.number && order.status !== 'cancelled'; }).sort(function (a,b) { return b.id-a.id; })[0];
  }
  function overdue(row) { return GT.debtors.openInvoices(row.id).filter(function (doc) { return doc.isOverdue; }); }
  function valuesFor(row) {
    var order=latestOrder(row), docs=overdue(row), first=docs[0];
    return {customer_name:row.name, order_number:order?order.number:'', invoice_numbers:docs.map(function (doc) { return doc.number; }).join(', '),
      amount_due:first?GT.format.formatMoney(docs.reduce(function (sum,doc) { return sum+doc.balance; },0)):'', due_date:first?GT.dates.formatDate(first.due_date):'',
      business_name:GT.settings.businessName, phone_numbers:GT.settings.phones.join(', ')};
  }
  function preview(body, row) {
    var values=row && row.supplies !== undefined ? supplierValues(row) : valuesFor(row);
    return String(body || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/g,function (_match,key) { return Object.prototype.hasOwnProperty.call(values,key)?values[key]:''; });
  }
  function supplierValues(row) {
    var grn=GT.store.where('goods_received_notes',{supplier_id:row.id}).filter(function (item) { return item.status==='discrepancy'; }).sort(function (a,b) { return b.id-a.id; })[0];
    return {supplier_name:row.name,business_name:GT.settings.businessName,grn_number:grn?grn.number:'',
      grn_date:grn?GT.dates.formatDate(grn.received_at):'',failed_checks:grn?GT.grns.failedChecks(grn).join(', '):'',notes:grn?grn.notes:''};
  }
  function recentContact(id) {
    // A-103: use Phase 10's seven-day electronic contact clock for bulk messages too.
    return GT.store.all('messages').find(function (message) {
      return message.reference_type === 'customer' && Number(message.reference_id) === Number(id) && message.sent_at &&
        GT.dates.daysBetween(String(message.sent_at).slice(0,10),GT.dates.today()) >= 0 && GT.dates.daysBetween(String(message.sent_at).slice(0,10),GT.dates.today()) < 7;
    }) || GT.debtors.recentElectronic(id);
  }
  function skipReason(row, channel, chosen) {
    if (!row.active) return 'Inactive customer';
    if (!recipientContact(row,channel)) return channel === 'email' ? 'No email address' : 'No phone number';
    if (chosen && chosen.name === 'Payment reminder' && !overdue(row).length) return 'No overdue invoice';
    if (chosen && chosen.name === 'Order ready' && !latestOrder(row)) return 'No numbered order';
    if (recentContact(row.id)) return 'Contacted within seven days';
    return '';
  }
  function bulkPlan(groupId, channel, templateId, body) {
    var chosen=template(templateId);
    if (!chosen) throw new Error('Choose a template.');
    return GT.store.all('customers').filter(function (row) { return !groupId || Number(row.customer_group_id) === Number(groupId); }).map(function (row) {
      var reason=skipReason(row,channel,chosen), message=reason?'':preview(body || chosen.body,row);
      return {customer:row,reason:reason,body:message,segments:channel === 'sms' ? segments(message) : 0};
    });
  }
  function validateSend(row, channel, chosen, body, bulk) {
    if (!GT.permissions.can('messages','C') && !manager()) throw new Error('You cannot send messages.');
    if (bulk && !manager()) throw new Error('Only Owner or General Manager may send bulk messages.');
    if (!row || !row.active) throw new Error('Choose an active customer.');
    if (!chosen) throw new Error('Choose a template.');
    if (role() === 'sales' && chosen.approved === false) throw new Error('Sales may use approved templates only.');
    if (role() === 'sales' && chosen.name === 'Supplier discrepancy notice') throw new Error('Choose a customer template.');
    if (role() === 'accountant') throw new Error('Accountant can view templates and the log only.');
    if (chosen.name === 'Supplier discrepancy notice') throw new Error('Choose a supplier for this template.');
    if (chosen.name === 'Payment reminder' && !GT.permissions.can('payment_reminders','C')) throw new Error('You cannot send payment reminders.');
    if (['sms','email','whatsapp'].indexOf(channel) === -1) throw new Error('Choose a channel.');
    if (!recipientContact(row,channel)) throw new Error('Recipient has no '+(channel==='email'?'email address':'phone number')+'.');
    if (chosen.name === 'Payment reminder' && !overdue(row).length) throw new Error('Customer has no overdue invoice.');
    if (chosen.name === 'Order ready' && !latestOrder(row)) throw new Error('Customer has no numbered order.');
    if (!String(body || '').trim()) throw new Error('Enter message text.');
    if (/\{\{/.test(body)) throw new Error('Resolve placeholders before sending.');
  }
  function sendOne(values) {
    if (values.supplierId) return sendSupplier(values);
    var row=customer(values.customerId), chosen=template(values.templateId), body=String(values.body||'').trim();
    validateSend(row,values.channel,chosen,body,values.bulk);
    // BUSINESS_RULES.md section 4, A-46: payment contacts use the existing reminder ledger and spacing gate.
    if (chosen.name==='Payment reminder') {
      var reminder=GT.debtors.sendReminder({customerId:row.id,channel:values.channel,text:body,
        invoiceIds:overdue(row).map(function (doc) { return doc.id; }),overrideReason:values.overrideReason||''});
      return GT.store.update('messages',reminder.message_id,{status:'Simulated'});
    }
    if (values.bulk && skipReason(row,values.channel,chosen)) throw new Error('Customer is no longer eligible for bulk sending.');
    var saved=GT.store.create('messages',{channel:values.channel,recipient_name:row.name,recipient_contact:recipientContact(row,values.channel),
      template_id:chosen.id,body:body,status:'Simulated',sent_by:actor().id,sent_at:GT.dates.today()+'T12:00:00+03:00',reference_type:'customer',reference_id:row.id});
    GT.audit.log('send_simulated','messages',saved.id,null,saved); return saved;
  }
  function sendSupplier(values) {
    var row=GT.store.find('suppliers',values.supplierId),chosen=template(values.templateId),body=String(values.body||'').trim();
    if (!GT.permissions.can('messages_compose','C') || role()==='sales' || !row || !row.active || !chosen || chosen.name!=='Supplier discrepancy notice') throw new Error('Choose an active supplier and discrepancy template.');
    // BUSINESS_RULES.md section 7: supplier notices require a recorded GRN discrepancy.
    if (!GT.store.where('goods_received_notes',{supplier_id:row.id}).some(function (grn) { return grn.status==='discrepancy'; })) throw new Error('Supplier has no recorded GRN discrepancy.');
    if (!['sms','email','whatsapp'].includes(values.channel) || !recipientContact(row,values.channel)) throw new Error('Supplier has no contact for this channel.');
    if (!body || /\{\{/.test(body)) throw new Error('Enter resolved message text.');
    var saved=GT.store.create('messages',{channel:values.channel,recipient_name:row.name,recipient_contact:recipientContact(row,values.channel),
      template_id:chosen.id,body:body,status:'Simulated',sent_by:actor().id,sent_at:GT.dates.today()+'T12:00:00+03:00',reference_type:'supplier',reference_id:row.id});
    GT.audit.log('send_simulated','messages',saved.id,null,saved); return saved;
  }
  function sendBulk(values) {
    if (!manager()) throw new Error('Only Owner or General Manager may send bulk messages.');
    var plan=bulkPlan(values.groupId,values.channel,values.templateId,values.body);
    return GT.store.transaction(function () { return plan.filter(function (item) { return !item.reason; }).map(function (item) {
      return sendOne({customerId:item.customer.id,channel:values.channel,templateId:values.templateId,body:item.body,bulk:true});
    }); });
  }
  function log() { return GT.store.all('messages').filter(function (row) { return role() !== 'sales' || row.sent_by === actor().id; }).sort(function (a,b) { return String(b.sent_at||b.created_at).localeCompare(String(a.sent_at||a.created_at)); }); }
  function canSeePrice() { return ['owner','general_manager','sales','accountant','marketing_manager'].indexOf(role()) !== -1; }
  function savePoster(id, values) {
    if (!GT.permissions.can('poster_studio','V')) throw new Error('Poster Studio is unavailable.');
    if (!['whatsapp_status','instagram','facebook'].includes(values.size_preset) || !['promotion','price_list','event'].includes(values.template)) throw new Error('Choose a poster type and size.');
    if (values.template === 'price_list' && !canSeePrice()) throw new Error('Price lists are restricted.');
    if (!String(values.title||'').trim()) throw new Error('Enter a poster title.');
    var record={title:String(values.title).trim(),template:values.template,size_preset:values.size_preset,
      content_json:{text:String(values.text||'').trim(),start_date:values.start_date||'',end_date:values.end_date||'',contact:String(values.contact||'').trim(),price_text:values.template==='price_list'?String(values.price_text||'').trim():''},created_by:actor().id};
    if (id) { var before=GT.store.find('posters',id); if (!before) throw new Error('Poster not found.'); var updated=GT.store.update('posters',id,record); GT.audit.log('update','posters',id,before,updated); return updated; }
    var created=GT.store.create('posters',record); GT.audit.log('create','posters',created.id,null,created); return created;
  }
  return {segments:segments,canEditTemplate:canEditTemplate,saveTemplate:saveTemplate,approveTemplate:approveTemplate,preview:preview,
    bulkPlan:bulkPlan,sendOne:sendOne,sendBulk:sendBulk,log:log,savePoster:savePoster,canSeePrice:canSeePrice};
}());
