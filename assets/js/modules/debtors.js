/* Debtor register and account detail: PAGE_PATTERNS.md and BUSINESS_RULES.md section 4. */
window.GT = window.GT || {};
window.GT.debtorModule = (function () {
  var GT = window.GT, table, detailTables=[];
  function esc(value) { return GT.components.escapeHtml(value); }
  function money(value) { return GT.format.formatMoney(value); }
  function badge(label,tone) { return GT.components.statusBadge(label,tone); }
  function groupName(id) { var row=GT.store.find('customer_groups',id); return row?row.name:'Unassigned'; }
  function openDetail(row) { location.hash='#/debtors/'+row.id; }
  function promise(row) { if (row.promise.status==='none') return '—'; var date=row.promise.reminder.promise_date, shortDate=Number(date.slice(8,10))+' '+GT.dates.formatDate(date).slice(3,6); return badge(row.promise.status==='missed'?'Promise missed':row.promise.status==='kept'?'Promise kept':'Promise to pay '+shortDate,row.promise.status==='missed'?'danger':'success'); }
  function rows() { return GT.debtors.list().map(function (row) { return Object.assign({},row,{group_name:groupName(row.group_id),age_bucket:GT.debtors.bucket(row.oldest_age)}); }); }
  function stats() {
    var all=rows(), overdue=all.filter(function (row) { return row.overdue_amount>0; }), over=all.filter(function (row) { return row.over_limit; });
    var active=table.state.filters.status||'';
    var cards=[
      {label:'Total outstanding',value:money(all.reduce(function (sum,row) { return sum+row.balance; },0)),icon:'wallet',tone:'warning',filterKey:'status',active:active==='',onClick:function () { table.setFilter('status',''); }},
      {label:'Overdue',value:money(overdue.reduce(function (sum,row) { return sum+row.overdue_amount; },0)),helper:overdue.length+' customers',icon:'alarm-clock',tone:'danger',filterKey:'status',active:active==='overdue',onClick:function () { table.toggleFilter('status','overdue'); }},
      {label:'Debtors',value:all.length,icon:'users',tone:'brand',filterKey:'status',active:active==='',onClick:function () { table.setFilter('status',''); }},
      {label:'Over credit limit',value:over.length,icon:'shield-alert',tone:'danger',filterKey:'status',active:active==='over_limit',onClick:function () { table.toggleFilter('status','over_limit'); }}
    ];
    var mount=document.getElementById('debtorStats'); if (!mount) return;
    mount.innerHTML=GT.statCards.render(cards); if (!mount.dataset.bound) { GT.statCards.bind(mount,cards); mount.dataset.bound='true'; } GT.components.refreshIcons();
  }
  function list() {
    table=GT.dataTable.create({id:'debtorsTable',caption:'Debtors',rows:rows,searchFields:['name'],searchPlaceholder:'Search customers',
      filters:[
        {name:'age',label:'Ageing bucket',options:[{value:'b0_30',label:'0–30 days'},{value:'b31_60',label:'31–60 days'},{value:'b61_plus',label:'61+ days'}],test:function (row,value) { return row[value]>0; }},
        {name:'status',label:'Account status',options:[{value:'overdue',label:'Overdue only'},{value:'over_limit',label:'Over limit'}],test:function (row,value) { return value==='overdue'?row.overdue_amount>0:row.over_limit; }},
        {name:'group',label:'Group',field:'group_id',options:GT.store.all('customer_groups').map(function (row) { return {value:row.id,label:row.name}; })},
        {name:'contact',label:'Last contact',options:[{value:'recent',label:'Contacted in 7 days'},{value:'not_recent',label:'Not contacted in 7 days'}],test:function (row,value) { var recent=!!row.last_reminder&&GT.dates.daysBetween(String(row.last_reminder.sent_at).slice(0,10),GT.dates.today())<7; return value==='recent'?recent:!recent; }}
      ],columns:[
        {label:'Customer',field:'name',sortable:true,priority:1,minWidth:170,html:true,formatter:function (value,row) { return '<a href="#/debtors/'+row.id+'">'+esc(value)+'</a>'+(row.over_limit?'<br>'+badge('Over limit','danger'):'')+(row.promise.status!=='none'?'<br>'+promise(row):''); },exportValue:function (row) { return row.name; }},
        {label:'Group',field:'group_name',priority:2},
        {label:'Open invoices',field:'open_invoice_count',align:'right',numeric:true,priority:2},
        {label:'Total owed',field:'balance',sortable:true,align:'right',numeric:true,priority:1,formatter:money},
        {label:'Overdue amount',field:'overdue_amount',sortable:true,align:'right',numeric:true,priority:1,formatter:money},
        {label:'Oldest age',field:'oldest_age',sortable:true,priority:2,formatter:function (value) { return value+' days'; }},
        {label:'Ageing',field:'age_bucket',priority:1,html:true,formatter:function (value) { return badge(value==='b0_30'?'0–30':value==='b31_60'?'31–60':'61+',value==='b0_30'?'success':value==='b31_60'?'warning':'danger'); }},
        {label:'Credit limit',field:'credit_limit',priority:3,align:'right',numeric:true,formatter:money},
        {label:'Available credit',field:'available_credit',priority:2,align:'right',numeric:true,html:true,formatter:function (value,row) { return (value===null?'—':money(value))+(row.over_limit?' '+badge('Over limit','danger'):''); },exportValue:function (row) { return row.available_credit; }},
        {label:'Last reminder',field:'last_reminder',priority:3,formatter:function (value) { return value?GT.dates.formatDate(value.sent_at)+' '+value.channel.toUpperCase():'—'; },exportValue:function (row) { return row.last_reminder?row.last_reminder.sent_at+' '+row.last_reminder.channel:''; }},
        {label:'Promise',field:'promise',priority:2,html:true,formatter:function (value,row) { return promise(row); },exportValue:function (row) { return row.promise.status; }}
      ],actions:[
        {label:'Remind',icon:'bell-ring',primary:true,show:function (row) { return row.overdue_amount>0&&GT.permissions.can('payment_reminders','C'); },onClick:function (row) { GT.reminderModule.openSend(row.id); }},
        {label:'View',icon:'eye',primary:true,show:function (row) { return !(row.overdue_amount>0&&GT.permissions.can('payment_reminders','C')); },onClick:openDetail},
        {label:'View',icon:'eye',show:function (row) { return row.overdue_amount>0&&GT.permissions.can('payment_reminders','C'); },onClick:openDetail},
        {label:'Create statement',icon:'file-text',show:function () { return GT.permissions.can('debtors','C'); },onClick:function (row) { location.hash='#/statements/new?customer='+row.id; }},
        {label:'Record payment',icon:'wallet',show:function () { return GT.permissions.can('receipts','C'); },onClick:function (row) { location.hash='#/receipts/new?customer='+row.id; }},
        {label:'Log a call',icon:'phone',show:function (row) { return row.overdue_amount>0&&GT.permissions.can('payment_reminders','C'); },onClick:function (row) { GT.reminderModule.openCall(row.id); }}
      ],emptyState:{message:'No debtors match the current search and filters.'},exportName:'genuine-textiles-debtors.csv',onStateChange:stats});
    table.state.pageSize=25;
    return '<section class="debtors-page">'+GT.components.pageHeader({title:'Debtors List',description:'Outstanding customer balances from invoices and receipts.'})+'<div id="debtorStats"></div><div id="debtorTableMount"></div></section>';
  }
  function selectedIds() { return Array.from(document.querySelectorAll('#debtorOpenMount [data-invoice-check]:checked')).map(function (item) { return Number(item.value); }); }
  function detail(params) {
    var row=rows().find(function (item) { return item.id===Number(params.id); });
    if (!row) return '<section>'+GT.components.pageHeader({title:'Debtor not found'})+'<p>No balance exists for this customer.</p></section>';
    var client=row.customer, actions=[];
    if (GT.permissions.can('payment_reminders','C')&&row.overdue_amount>0) { actions.push({label:'Send reminder',name:'remind',icon:'bell-ring'}); actions.push({label:'Log a call',name:'call',icon:'phone'}); }
    if (GT.permissions.can('debtors','C')) actions.push({label:'Create statement',name:'statement',icon:'file-text'});
    if (GT.permissions.can('receipts','C')) actions.push({label:'Record payment',route:'#/receipts/new?customer='+row.id,icon:'wallet'});
    var tabs=[{id:'debtorOpen',label:'Open invoices'},{id:'debtorPayments',label:'Payments'},{id:'debtorStatements',label:'Statements'},{id:'debtorReminders',label:'Reminders'}];
    return '<section class="debtors-page" data-debtor-id="'+row.id+'">'+GT.components.pageHeader({title:client.name,description:'Debtor account as at '+GT.dates.formatDate(GT.dates.today()),actions:actions})+
      '<div class="detail-card"><dl class="detail-grid">'+GT.components.detailRow('Contact person',client.contact_person)+GT.components.detailRow('Phone',client.phone)+GT.components.detailRow('Credit terms',client.is_credit?client.credit_days+' days':'Cash')+GT.components.detailRow('Balance',money(row.balance))+GT.components.detailRow('Overdue',money(row.overdue_amount))+GT.components.detailRow('Available credit',row.available_credit===null?'Not applicable':money(row.available_credit))+'</dl><p><a href="tel:'+esc(client.phone)+'">Call '+esc(client.phone)+'</a> · '+badge(row.age_bucket==='b0_30'?'0–30 days':row.age_bucket==='b31_60'?'31–60 days':'61+ days',row.age_bucket==='b0_30'?'success':row.age_bucket==='b31_60'?'warning':'danger')+' '+promise(row)+'</p></div>'+
      '<div class="detail-card">'+GT.components.tabs(tabs,'debtorOpen')+
      '<section id="debtorOpen" class="detail-tab-panel" role="tabpanel"><h2>Open invoices</h2><div id="debtorOpenMount"></div></section>'+
      '<section id="debtorPayments" class="detail-tab-panel" role="tabpanel" hidden><h2>Recent payments</h2><div id="debtorPaymentsMount"></div></section>'+
      '<section id="debtorStatements" class="detail-tab-panel" role="tabpanel" hidden><h2>Statements</h2><div id="debtorStatementsMount"></div></section>'+
      '<section id="debtorReminders" class="detail-tab-panel" role="tabpanel" hidden><h2>Reminders and calls</h2><div id="debtorRemindersMount"></div></section></div></section>';
  }
  function mountDetails(id) {
    var invoices=GT.debtors.openInvoices(id), receipts=GT.receipts.listForCustomer(id).filter(function (row) { return row.status!=='void'; }), statements=GT.store.where('statements',{customer_id:Number(id)}), reminders=GT.debtors.remindersFor(id);
    function make(mount,config) { var item=GT.dataTable.create(config); item.mount(mount); detailTables.push(item); }
    make('#debtorOpenMount',{id:'debtorOpenTable',rows:invoices,searchFields:['number'],columns:[
      {label:'Select',field:'id',html:true,formatter:function (value) { return '<input type="checkbox" data-invoice-check value="'+value+'" checked aria-label="Select invoice">'; },export:false},
      {label:'Number',field:'number',html:true,formatter:function (value,row) { return '<a href="#/invoices/'+row.id+'">'+esc(value)+'</a>'; },exportValue:function (row) { return row.number; }},
      {label:'Date',field:'issue_date',formatter:GT.dates.formatDate}, {label:'Due date',field:'dueDate',formatter:GT.dates.formatDate},
      {label:'Total',field:'total',align:'right',numeric:true,formatter:money}, {label:'Paid',field:'paid',align:'right',numeric:true,formatter:money},
      {label:'Balance',field:'balance',align:'right',numeric:true,formatter:money}, {label:'Age',field:'ageDays',formatter:function (v) { return v+' days'; }},
      {label:'Status',field:'isOverdue',html:true,formatter:function (v) { return v?badge('Overdue','danger'):badge('Open','info'); }}],emptyState:{message:'No open invoices.'},exportName:'debtor-open-invoices.csv'});
    make('#debtorPaymentsMount',{id:'debtorPaymentsTable',rows:receipts,searchFields:['number'],columns:[
      {label:'Receipt',field:'number',html:true,formatter:function (v,row) { return '<a href="#/receipts/'+row.id+'">'+esc(v)+'</a>'; },exportValue:function (row) { return row.number; }},
      {label:'Date',field:'received_at',formatter:GT.dates.formatDate},{label:'Amount',field:'amount',align:'right',numeric:true,formatter:money},
      {label:'Method',field:'payment_method'}],emptyState:{message:'No payments recorded.'},exportName:'debtor-payments.csv'});
    make('#debtorStatementsMount',{id:'debtorStatementsTable',rows:statements,searchFields:['statement_date'],columns:[
      {label:'Date',field:'statement_date',formatter:GT.dates.formatDate},{label:'Invoices',field:'lines_json',formatter:function (v) { return v.length; }},
      {label:'Total due',field:'total_due',align:'right',numeric:true,formatter:money},{label:'Status',field:'status',html:true,formatter:function (v) { return badge(v==='void'?'Void':'Issued',v==='void'?'danger':'info'); }}],
      actions:[{label:'View',icon:'eye',primary:true,onClick:function (row) { location.hash='#/statements/'+row.id; }}],emptyState:{message:'No statements issued.'},exportName:'debtor-statements.csv'});
    make('#debtorRemindersMount',{id:'debtorRemindersTable',rows:reminders,searchFields:['message_text'],columns:[
      {label:'Date',field:'sent_at',formatter:GT.dates.formatDate},{label:'Channel',field:'channel'},{label:'Message or notes',field:'message_text'},
      {label:'Outcome',field:'outcome'},{label:'Promise',field:'promise_date',formatter:function (v) { return v?GT.dates.formatDate(v):'—'; }}],emptyState:{message:'No reminders or calls logged.'},exportName:'debtor-reminders.csv'});
  }
  function bind(view,params) {
    if (view==='list') { table.mount('#debtorTableMount'); return; }
    var id=Number(params.id); if (!GT.debtors.list().some(function (row) { return row.id===id; })) return;
    mountDetails(id);
    document.querySelectorAll('.debtors-page [data-tab-target]').forEach(function (tab) { tab.addEventListener('click',function () {
      document.querySelectorAll('.debtors-page [data-tab-target]').forEach(function (item) { var active=item===tab; item.classList.toggle('active',active); item.setAttribute('aria-selected',String(active)); document.getElementById(item.dataset.tabTarget).hidden=!active; });
    }); });
    document.querySelectorAll('.debtors-page [data-page-action]').forEach(function (button) { button.addEventListener('click',function () {
      if (button.dataset.pageAction==='remind') GT.reminderModule.openSend(id);
      if (button.dataset.pageAction==='call') GT.reminderModule.openCall(id);
      if (button.dataset.pageAction==='statement') location.hash='#/statements/new?customer='+id+'&invoices='+selectedIds().join(',');
    }); });
  }
  var api={render:function (view,params) { return view==='list'?list():detail(params); },bind:bind};
  GT.router.register('#/debtors',{module:api,view:'list',title:'Debtors List',permission:'debtors',baseRoute:'#/debtors'});
  GT.router.register('#/debtors/:id',{module:api,view:'detail',title:'Debtor Details',permission:'debtors',baseRoute:'#/debtors'});
  return api;
}());
