/* Simulated payment reminders and call log: BUSINESS_RULES.md sections 4 and 15. */
window.GT = window.GT || {};
window.GT.reminderModule = (function () {
  var GT=window.GT, table;
  function esc(value) { return GT.components.escapeHtml(value); }
  function money(value) { return GT.format.formatMoney(value); }
  function name(id) { var row=GT.store.find('customers',id); return row?row.name:'Unknown'; }
  function refresh() { GT.components.closeModal(); GT.app.refreshChrome(); GT.app.renderPage(); }
  function overdueInvoices(id) { return GT.debtors.openInvoices(id).filter(function (doc) { return doc.isOverdue; }); }
  function selectedInvoices(root) { return Array.from(root.querySelectorAll('[data-reminder-invoice]:checked')).map(function (node) { return Number(node.value); }); }
  function promoteAction(root,id) { root.querySelector('.gt-modal > .gt-modal-actions').appendChild(root.querySelector('#'+id)); }
  function openSend(customerId,preselectId) {
    if (!GT.permissions.can('payment_reminders','C')) return;
    var client=GT.store.find('customers',customerId), docs=overdueInvoices(customerId);
    if (!client||!docs.length) { GT.components.showToast('This customer has no overdue invoice.','warning'); return; }
    var checks=docs.map(function (doc) { return '<label class="reminder-check"><input type="checkbox" data-reminder-invoice value="'+doc.id+'"'+(!preselectId||Number(preselectId)===doc.id?' checked':'')+'> Invoice '+esc(doc.number)+' · '+money(doc.balance)+'</label>'; }).join('');
    GT.components.openModal({title:'Send reminder to '+esc(client.name),content:'<div class="reminder-form"><label class="form-label" for="reminderChannel">Channel</label><select class="form-select" id="reminderChannel"><option value="sms">SMS</option><option value="email">Email</option></select><fieldset><legend>Invoices to mention</legend>'+checks+'</fieldset><label class="form-label" for="reminderText">Message</label><textarea class="form-control" id="reminderText" rows="6"></textarea><p id="reminderCounter" aria-live="polite"></p><p class="text-muted">SMS sending is simulated in this prototype.</p><div id="reminderOverride" hidden><label class="form-label" for="reminderReason">Reason for sending within seven days</label><textarea class="form-control" id="reminderReason"></textarea></div><p class="field-error" id="reminderError" role="alert"></p><div class="gt-modal-actions"><button type="button" class="btn btn-primary" id="reminderSend">Send</button></div></div>'});
    var root=document.getElementById('modalContainer'), text=root.querySelector('#reminderText'), recent=GT.debtors.recentElectronic(customerId);
    promoteAction(root,'reminderSend');
    if (recent) {
      if (GT.session.currentUser().role!=='general_manager') { root.querySelector('#reminderError').textContent='A reminder was sent within seven days. Ask the General Manager.'; root.querySelector('#reminderSend').disabled=true; }
      else root.querySelector('#reminderOverride').hidden=false;
    }
    function updateText() {
      var ids=selectedInvoices(root), old=text.dataset.generated||'';
      if (!text.value||text.value===old) { text.value=ids.length?GT.debtors.reminderText(customerId,'payment reminder',ids):''; text.dataset.generated=text.value; }
      counter();
    }
    function counter() { var length=Array.from(text.value).length; root.querySelector('#reminderCounter').textContent='SMS: '+length+' characters, '+GT.debtors.smsSegments(text.value)+' segments'; }
    root.querySelectorAll('[data-reminder-invoice]').forEach(function (check) { check.addEventListener('change',updateText); });
    text.addEventListener('input',counter); root.querySelector('#reminderChannel').addEventListener('change',function () { root.querySelector('#reminderCounter').hidden=this.value!=='sms'; });
    root.querySelector('#reminderSend').addEventListener('click',async function () {
      var ids=selectedInvoices(root), channel=root.querySelector('#reminderChannel').value, reason=root.querySelector('#reminderReason').value.trim();
      if (recent&&!reason) { root.querySelector('#reminderError').textContent='Enter a reason for the seven-day override.'; return; }
      if (recent&&!await GT.components.confirmDialog({title:'Send another reminder?',message:'A reminder went to this customer within seven days. Continue with the recorded reason?',confirmText:'Send reminder'})) return;
      try { GT.debtors.sendReminder({customerId:customerId,channel:channel,text:text.value,invoiceIds:ids,overrideReason:reason}); GT.components.showToast('Reminder recorded as simulated.','success'); refresh(); }
      catch(error) { var errorBox=document.getElementById('reminderError'); if (errorBox) errorBox.textContent=error.message; else GT.components.showToast(error.message,'error'); }
    });
    updateText(); GT.components.refreshIcons();
  }
  function openCall(customerId) {
    if (!GT.permissions.can('payment_reminders','C')) return;
    var client=GT.store.find('customers',customerId);
    if (!client||!overdueInvoices(customerId).length) { GT.components.showToast('This customer has no overdue invoice.','warning'); return; }
    var now=new Date(), local=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16);
    GT.components.openModal({title:'Log a call with '+esc(client.name),content:'<div class="reminder-form"><label class="form-label" for="callAt">Date and time</label><input class="form-control" type="datetime-local" id="callAt" value="'+local+'"><label class="form-label" for="callOutcome">Outcome</label><select class="form-select" id="callOutcome"><option value="no_answer">No answer</option><option value="promised">Promised to pay</option><option value="refused">Refused</option><option value="other">Other</option></select><label class="form-label" for="callNotes">Notes</label><textarea class="form-control" id="callNotes"></textarea><div id="promiseFields" hidden><label class="form-label" for="promiseDate">Promise date</label><input class="form-control" type="date" id="promiseDate"><label class="form-label" for="promiseAmount">Promise amount (UGX)</label><input class="form-control" type="number" min="1" id="promiseAmount"></div><p class="field-error" id="callError" role="alert"></p><div class="gt-modal-actions"><button class="btn btn-primary" type="button" id="saveCall">Log call</button></div></div>'});
    var root=document.getElementById('modalContainer'); promoteAction(root,'saveCall'); root.querySelector('#callOutcome').addEventListener('change',function () { root.querySelector('#promiseFields').hidden=this.value!=='promised'; });
    root.querySelector('#saveCall').addEventListener('click',function () {
      try { var value=root.querySelector('#callAt').value; GT.debtors.logCall({customerId:customerId,sentAt:value?new Date(value).toISOString():null,outcome:root.querySelector('#callOutcome').value,notes:root.querySelector('#callNotes').value,promiseDate:root.querySelector('#promiseDate').value,promiseAmount:root.querySelector('#promiseAmount').value}); GT.components.showToast('Call logged.','success'); refresh(); }
      catch(error) { root.querySelector('#callError').textContent=error.message; }
    });
  }
  function openBulk() {
    if (GT.session.currentUser().role!=='general_manager' && GT.session.currentUser().role!=='owner') return;
    var eligible=GT.debtors.list().filter(function (row) { return row.overdue_amount>0&&!GT.debtors.recentElectronic(row.id); });
    var checks=eligible.map(function (row) { return '<label class="reminder-check"><input type="checkbox" data-bulk-id value="'+row.id+'" checked> '+esc(row.name)+' · '+money(row.overdue_amount)+'</label>'; }).join('');
    GT.components.openModal({title:'Remind all overdue',content:'<div class="reminder-form"><p>Eligible overdue customers with no SMS or email reminder in seven days.</p><div id="bulkCustomers">'+(checks||'<p>No eligible customers.</p>')+'</div><p id="bulkPreview"></p><p id="bulkCount"></p><p>SMS used this month: '+GT.debtors.smsCountThisMonth()+' of about 120</p><p class="text-muted">SMS sending is simulated in this prototype.</p><p class="field-error" id="bulkError"></p><div class="gt-modal-actions"><button class="btn btn-primary" id="bulkSend" type="button"'+(eligible.length?'':' disabled')+'>Send</button></div></div>'});
    var root=document.getElementById('modalContainer'); promoteAction(root,'bulkSend');
    function selected() { return Array.from(root.querySelectorAll('[data-bulk-id]:checked')).map(function (input) { return Number(input.value); }); }
    function update() { var ids=selected(), first=ids[0]; root.querySelector('#bulkPreview').textContent=first?'Preview: '+GT.debtors.reminderText(first):''; root.querySelector('#bulkCount').textContent='Total SMS segments: '+ids.reduce(function (sum,id) { return sum+GT.debtors.smsSegments(GT.debtors.reminderText(id)); },0); }
    root.querySelectorAll('[data-bulk-id]').forEach(function (input) { input.addEventListener('change',update); });
    root.querySelector('#bulkSend').addEventListener('click',function () {
      try { selected().forEach(function (id) { GT.debtors.sendReminder({customerId:id,channel:'sms',text:GT.debtors.reminderText(id),invoiceIds:overdueInvoices(id).map(function (doc) { return doc.id; }),bulk:true}); }); GT.components.showToast('Simulated reminders recorded.','success'); refresh(); }
      catch(error) { root.querySelector('#bulkError').textContent=error.message; }
    }); update();
  }
  function records() { return GT.store.all('debt_reminders').map(function (row) { var user=GT.store.find('users',row.sent_by); return Object.assign({},row,{customer_name:name(row.customer_id),day:String(row.sent_at).slice(0,10),sent_by_name:user?user.name:'Unknown',invoice_numbers:(row.invoice_ids_json||[]).map(function (id) { var doc=GT.store.find('sales_documents',id); return doc?doc.number:'?'; }).join(', ')}); }).sort(function (a,b) { return b.sent_at.localeCompare(a.sent_at); }); }
  function stats() { var rows=records(),month=GT.dates.today().slice(0,7),pending=GT.debtors.list().filter(function (row) { return row.promise.status==='pending'; }).length,missed=GT.debtors.list().filter(function (row) { return row.promise.status==='missed'; }).length;
    return [{label:'Reminders this month',value:rows.filter(function (row) { return row.day.slice(0,7)===month; }).length,icon:'bell',tone:'brand'},
      {label:'SMS this month',value:GT.debtors.smsCountThisMonth(),helper:'of about 120 planned',icon:'message-square',tone:'info'},
      {label:'Promises pending',value:pending,icon:'handshake',tone:'success'},
      {label:'Promises missed',value:missed,icon:'alert-octagon',tone:'danger'}]; }
  function render() {
    table=GT.dataTable.create({id:'remindersTable',rows:records,searchFields:['customer_name','message_text','invoice_numbers'],
      filters:[{name:'channel',label:'Channel',field:'channel',options:['sms','email','call'].map(function (v) { return {value:v,label:v.toUpperCase()}; })},
        {name:'outcome',label:'Outcome',field:'outcome',options:['sent','no_answer','promised','refused','other'].map(function (v) { return {value:v,label:v.replace('_',' ')}; })},
        {name:'customer',label:'Customer',field:'customer_id',options:GT.debtors.list().map(function (row) { return {value:row.id,label:row.name}; })},
        {name:'date_from',label:'From date',type:'date',test:function (row,value) { return row.day>=value; }},
        {name:'date_to',label:'To date',type:'date',test:function (row,value) { return row.day<=value; }}],
      columns:[{label:'Date',field:'day',formatter:GT.dates.formatDate,priority:1},{label:'Customer',field:'customer_name',priority:1},
        {label:'Channel',field:'channel',html:true,formatter:function (v) { return GT.components.statusBadge(v.toUpperCase(),'info'); },priority:1},
        {label:'Invoices',field:'invoice_numbers',priority:2},{label:'Message or notes',field:'message_text',priority:2,formatter:function (v) { return v.length>90?v.slice(0,90)+'…':v; },exportValue:function (row) { return row.message_text; }},
        {label:'Outcome',field:'outcome',html:true,formatter:function (v) { return GT.components.statusBadge(v.replace('_',' '),v==='promised'?'success':v==='refused'?'danger':'neutral'); },priority:1},
        {label:'Promise',field:'promise_date',formatter:function (v) { return v?GT.dates.formatDate(v):'—'; },priority:2},
        {label:'Sent by',field:'sent_by_name',priority:3}],onRowClick:function (row) { location.hash='#/debtors/'+row.customer_id; },emptyState:{message:'No reminders match the filters.'},exportName:'debt-reminders.csv'});
    table.state.pageSize=25;
    return '<section class="debtors-page">'+GT.components.pageHeader({title:'Reminders',description:'Simulated messages and logged calls.',actions:GT.session.currentUser().role==='general_manager'||GT.session.currentUser().role==='owner'?[{label:'Remind all overdue',name:'bulk',icon:'bell-ring'}]:[]})+'<div id="reminderStats">'+GT.statCards.render(stats())+'</div><div id="remindersMount"></div></section>';
  }
  function bind() { table.mount('#remindersMount'); var bulk=document.querySelector('[data-page-action="bulk"]'); if (bulk) bulk.addEventListener('click',openBulk); }
  var api={render:render,bind:bind,openSend:openSend,openCall:openCall,openBulk:openBulk};
  GT.router.register('#/reminders',{module:api,view:'list',title:'Reminders',permission:'payment_reminders',baseRoute:'#/reminders'});
  return api;
}());
