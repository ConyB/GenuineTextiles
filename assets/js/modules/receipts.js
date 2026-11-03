/* Receipt list, payment form, detail and pad-style print UI: PAGE_PATTERNS.md and DOCUMENT_TEMPLATES.md section 4. */
window.GT = window.GT || {};
window.GT.receiptModule = (function () {
  var GT = window.GT, table, fields, tracker;
  function esc(value) { return GT.components.escapeHtml(value == null ? '' : value); }
  function money(value) { return GT.format.formatMoney(value); }
  function name(id, tableName) { var row = GT.store.find(tableName, id); return row ? row.name : 'Unknown'; }
  function canView(row) { var user=GT.session.currentUser(); return GT.permissions.can('receipts','V') && (user.role !== 'sales' || Number(row.received_by) === Number(user.id)); }
  function rows() {
    return GT.store.all('receipts').filter(canView).map(function (row) {
      var doc=GT.store.find('sales_documents',row.invoice_id);
      return Object.assign({},row,{customer_label:row.customer_name || name(row.customer_id,'customers'),invoice_number:doc ? doc.number : '',receiver_name:name(row.received_by,'users'),day:String(row.received_at).slice(0,10)});
    }).sort(function (a,b) { return b.number.localeCompare(a.number,undefined,{numeric:true}); });
  }
  function clearFilters() { Object.keys(table.state.filters).forEach(function (key) { table.state.filters[key]=''; }); table.state.search=''; table.refresh(); }
  function cardFilter(card) {
    if (card.filterKey === 'cash' || card.filterKey === 'mobile_bank') table.toggleFilter('method',card.filterKey);
    else clearFilters();
  }
  function cards() {
    var today=GT.dates.today(), own=GT.session.currentUser().role==='sales'?GT.session.currentUser().id:null;
    var month=GT.receipts.totalsByMethod({from:today.slice(0,7)+'-01',to:GT.dates.endOfMonth(today),received_by:own});
    return [
      {label:'Collected today',value:money(GT.receipts.collectedOn(today,own)),icon:'banknote',tone:'success',filterKey:'today',onClick:cardFilter},
      {label:'Collected this month',value:money(GT.receipts.collectedInMonth(today,own)),icon:'calendar-check',tone:'brand',filterKey:'month',onClick:cardFilter},
      {label:'Cash this month',value:money(month.cash),icon:'coins',tone:'neutral',filterKey:'cash',active:table.state.filters.method==='cash',onClick:cardFilter},
      {label:'Mobile Money and bank this month',value:money(month.mtn+month.airtel+month.bank),icon:'smartphone',tone:'info',filterKey:'mobile_bank',active:table.state.filters.method==='mobile_bank',onClick:cardFilter}
    ];
  }
  function updateCards() { var mount=document.getElementById('receiptStats'); if (!mount) return; var list=cards(); mount.innerHTML=GT.statCards.render(list); if (!mount.dataset.bound) { GT.statCards.bind(mount,list); mount.dataset.bound='true'; } GT.components.refreshIcons(); }
  function voidPrompt(row) {
    GT.components.openModal({title:'Void receipt '+row.number,content:'<p>The receipt remains in the record. Give a reason.</p><label class="form-label" for="receiptVoidReason">Reason</label><textarea class="form-control" id="receiptVoidReason"></textarea><p class="field-error" id="receiptVoidError"></p><div class="gt-modal-actions"><button class="btn btn-outline-danger" id="receiptVoidContinue" type="button">Continue</button></div>'});
    document.getElementById('receiptVoidContinue').addEventListener('click',async function () {
      var reason=document.getElementById('receiptVoidReason').value.trim();
      if (!reason) { document.getElementById('receiptVoidError').textContent='A reason is required.'; return; }
      if (!await GT.components.confirmDialog({title:'Confirm void',message:'Void receipt '+row.number+'? This restores the invoice balance.',confirmText:'Void receipt'})) return;
      try { GT.receipts.voidReceipt(row.id,reason); GT.components.showToast('Receipt voided.','success'); GT.app.renderPage(); }
      catch(error) { GT.components.showToast(error.message,'error'); }
    });
  }
  function list() {
    var methods=['cash','mtn','airtel','bank','cheque'].map(function (value) { return {value:value,label:value==='mtn'?'MTN':value[0].toUpperCase()+value.slice(1)}; });
    table=GT.dataTable.create({id:'receiptsTable',caption:'Receipts',rows:rows,searchFields:['number','customer_label','reference','invoice_number'],searchPlaceholder:'Search number, customer, reference or invoice',
      filters:[
        {name:'method',label:'Method',options:methods.concat([{value:'mobile_bank',label:'Mobile Money and bank'}]),test:function (row,value) { return value==='mobile_bank'?['mtn','airtel','bank'].indexOf(row.payment_method)!==-1:row.payment_method===value; }},
        {name:'status',label:'Status',field:'status',options:[{value:'issued',label:'Issued'},{value:'void',label:'Void'}]},
        {name:'customer',label:'Customer',field:'customer_id',options:GT.customers.options()},
        {name:'date_from',label:'From date',type:'date',test:function (row,value) { return row.day>=value; }},
        {name:'date_to',label:'To date',type:'date',test:function (row,value) { return row.day<=value; }}
      ].concat(GT.session.currentUser().role==='sales'?[]:[{name:'receiver',label:'Received by',field:'received_by',options:GT.session.users().map(function (user) { return {value:user.id,label:user.name}; })}]),
      columns:[
        {label:'Number',field:'number',sortable:true,priority:1},
        {label:'Date',field:'day',sortable:true,priority:1,formatter:GT.dates.formatDate,exportValue:function (row) { return row.day; }},
        {label:'Customer',field:'customer_label',sortable:true,priority:1,minWidth:160},
        {label:'Invoice',field:'invoice_number',priority:2,html:true,formatter:function (value,row) { var sale=GT.store.where('quick_sales',{receipt_id:row.id})[0]; return sale?'<a href="#/sales/quick-sales/'+sale.id+'">Quick sale</a>':'<a href="#/invoices/'+row.invoice_id+'">'+esc(value)+'</a>'; },exportValue:function (row) { return row.invoice_number || 'Quick sale'; }},
        {label:'Method',field:'payment_method',priority:2,html:true,formatter:function (value) { return GT.components.statusBadge(value==='mtn'?'MTN':value[0].toUpperCase()+value.slice(1),'info'); },exportValue:function (row) { return row.payment_method; }},
        {label:'Reference',field:'reference',priority:3},
        {label:'Amount',field:'amount',sortable:true,priority:1,align:'right',numeric:true,formatter:money},
        {label:'Balance after',field:'balance_after',priority:2,align:'right',numeric:true,formatter:money},
        {label:'Received by',field:'receiver_name',priority:3},
        {label:'Status',field:'status',priority:1,html:true,formatter:function (value) { return GT.components.statusBadge(value==='void'?'Void':'Issued',value==='void'?'danger':'success'); },exportValue:function (row) { return row.status; }}
      ],actions:[
        {label:'View',icon:'eye',primary:true,onClick:function (row) { location.hash='#/receipts/'+row.id; }},
        {label:'Print',icon:'printer',primary:true,onClick:print},
        {label:'Void',icon:'ban',destructive:true,show:function (row) { return row.invoice_id && row.status==='issued' && GT.receipts.canVoid(GT.session.currentUser()); },onClick:voidPrompt}
      ],emptyState:{message:'No receipts match the current filters.'},exportName:'genuine-textiles-receipts.csv',onStateChange:updateCards});
    return '<section class="receipts-page">'+GT.components.pageHeader({title:'Receipts',description:'Payments against issued invoices.',actions:GT.permissions.can('receipts','C')?[{label:'Record payment',icon:'plus',route:'#/receipts/new'}]:[]})+'<div id="receiptStats"></div><div id="receiptListMount"></div></section>';
  }
  function customerOptions() {
    var ids={}; GT.receipts.openInvoicesFor().forEach(function (doc) { ids[doc.customer_id]=true; });
    return GT.store.all('customers').filter(function (row) { return ids[row.id]; }).map(function (row) { return {value:row.id,label:row.name+' — '+money(GT.customers.balance(row.id))}; });
  }
  function invoiceOptions(customerId) {
    if (!customerId) return [];
    return GT.receipts.openInvoicesFor(customerId).map(function (doc) { var sum=GT.invoices.summary(doc.id); return {value:doc.id,label:'Invoice '+doc.number+' · '+GT.dates.formatDate(doc.issue_date)+' · '+money(doc.total)+' · Balance '+money(sum.balance)+' · Due '+GT.dates.formatDate(sum.dueDate)+(sum.isOverdue?' · Overdue':'')}; });
  }
  function formValues() {
    var wanted=new URLSearchParams(String(location.hash).split('?')[1]||'').get('invoice');
    var doc=wanted&&GT.receipts.openInvoicesFor().filter(function (row) { return Number(row.id)===Number(wanted); })[0];
    var wantedCustomer=new URLSearchParams(String(location.hash).split('?')[1]||'').get('customer');
    return {customer_id:doc?doc.customer_id:(wantedCustomer||''),invoice_id:doc?doc.id:'',amount:'',received_at:GT.dates.today(),payment_method:'cash',reference:'',description:'',received_by:GT.session.currentUser().name};
  }
  function sections(values) {
    return [{title:'Payment',fields:[
      {name:'customer_id',label:'Customer',type:'select',required:true,valueType:'number',options:customerOptions()},
      {name:'invoice_id',label:'Invoice',type:'select',required:true,valueType:'number',options:invoiceOptions(values.customer_id)},
      {name:'amount',label:'Amount (UGX)',type:'money',required:true},
      {name:'received_at',label:'Date',type:'date',required:true},
      {name:'payment_method',label:'Payment method',type:'radio',required:true,fullWidth:true,options:[{value:'cash',label:'Cash'},{value:'mtn',label:'MTN'},{value:'airtel',label:'Airtel'},{value:'bank',label:'Bank'},{value:'cheque',label:'Cheque'}]},
      {name:'reference',label:'Reference',type:'text'},
      {name:'description',label:'Being payment of',type:'textarea',fullWidth:true},
      {name:'received_by',label:'Received by',type:'text',readonly:true}
    ]}];
  }
  function form() {
    var values=formValues(); fields=sections(values);
    return '<section class="receipts-page">'+GT.components.pageHeader({title:'Record payment',description:'The receipt is numbered and locked when saved.'})+
      '<div class="receipt-mobile-tabs">'+GT.components.tabs([{id:'receiptFormPanel',label:'Form'},{id:'receiptPreviewPanel',label:'Preview'}],'receiptFormPanel')+'</div><div class="receipt-form-layout"><div id="receiptFormPanel">'+GT.forms.render({id:'receiptForm',sections:fields,values:values,submitLabel:'Save',cancelRoute:'#/receipts'})+
      '<div class="receipt-quick"><button type="button" class="btn btn-outline-secondary" data-quick="full">Pay full balance</button><button type="button" class="btn btn-outline-secondary" data-quick="half">50% deposit</button></div><p id="receiptInvoiceSummary" aria-live="polite"></p><p id="receiptBalanceAfter" aria-live="polite"></p><button type="button" class="btn btn-outline-primary" id="receiptSavePrint">Save and print</button></div><aside id="receiptPreviewPanel" class="detail-card receipt-live"><h2>Receipt preview</h2><div id="receiptLivePreview"></div></aside></div></section>';
  }
  function selectedInvoice(form) { var doc=GT.store.find('sales_documents',form.elements.invoice_id.value); return doc && doc.type==='invoice' ? doc : null; }
  function read(form) { var values=GT.forms.read(form,fields); if (form.dataset.amountDecimal==='true') values.amount=NaN; delete values.received_by; return values; }
  function refreshForm(form, fillDescription) {
    var doc=selectedInvoice(form), amount=GT.format.parseMoney(form.elements.amount.value), summary=doc?GT.invoices.summary(doc.id):null;
    document.getElementById('receiptInvoiceSummary').innerHTML=doc?'<strong>Invoice summary</strong> · Total '+money(doc.total)+' · Paid '+money(summary.paid)+' · Balance '+money(summary.balance)+' · Due '+GT.dates.formatDate(summary.dueDate)+(summary.isOverdue?' · '+GT.components.statusBadge('Overdue '+summary.daysOverdue+' days','danger'):''):'Choose an open invoice.';
    document.getElementById('receiptBalanceAfter').textContent=doc?'Balance after this payment: '+money(summary.balance-amount):'';
    document.getElementById('receiptBalanceAfter').hidden=!doc;
    document.querySelector('[data-quick="full"]').disabled=!doc;
    document.querySelector('[data-quick="half"]').hidden=!doc || GT.receipts.listForInvoice(doc.id).some(function (row) { return row.status!=='void'; });
    if (doc && fillDescription) form.elements.description.value=GT.receipts.defaultDescription(doc,amount);
    document.getElementById('receiptLivePreview').innerHTML=printMarkup(Object.assign({},read(form),{number:GT.numbering.peek('receipt'),customer_name:doc?name(doc.customer_id,'customers'):'',balance_after:doc?summary.balance-amount:0,status:'issued'}));
  }
  function bindForm() {
    var form=document.getElementById('receiptForm'); tracker=GT.forms.trackDirty(form);
    form.elements.amount.addEventListener('input',function () { form.dataset.amountDecimal=/\./.test(this.value)?'true':'false'; });
    form.querySelector('[data-field-wrap="invoice_id"]').after(document.getElementById('receiptInvoiceSummary'));
    form.querySelector('[data-field-wrap="amount"]').appendChild(document.querySelector('.receipt-quick'));
    form.querySelector('[data-field-wrap="amount"]').appendChild(document.getElementById('receiptBalanceAfter'));
    form.querySelector('.form-actions').insertBefore(document.getElementById('receiptSavePrint'),form.querySelector('.form-actions a'));
    document.querySelectorAll('.receipt-mobile-tabs [data-tab-target]').forEach(function (tab) { tab.addEventListener('click',function () { document.querySelectorAll('.receipt-mobile-tabs [data-tab-target]').forEach(function (item) { item.classList.toggle('active',item===tab); item.setAttribute('aria-selected',item===tab); }); document.querySelector('.receipt-form-layout').classList.toggle('show-preview',tab.dataset.tabTarget==='receiptPreviewPanel'); }); });
    function update() { refreshForm(form,false); }
    form.elements.customer_id.addEventListener('change',function () {
      var picker=form.elements.invoice_id; picker.innerHTML='<option value="">Select an invoice</option>'+invoiceOptions(form.elements.customer_id.value).map(function (item) { return '<option value="'+item.value+'">'+esc(item.label)+'</option>'; }).join('');
      form.elements.amount.value=''; form.elements.description.value=''; update();
    });
    form.elements.invoice_id.addEventListener('change',function () { form.elements.amount.value=''; refreshForm(form,true); });
    form.elements.amount.addEventListener('input',function () { refreshForm(form,true); });
    form.querySelectorAll('[name="payment_method"]').forEach(function (input) { input.addEventListener('change',function () { form.elements.reference.value=''; form.querySelector('[data-field-wrap="reference"]').hidden=form.elements.payment_method.value==='cash'; update(); }); });
    ['received_at','reference','description'].forEach(function (key) { form.elements[key].addEventListener('input',update); });
    form.querySelector('[data-field-wrap="reference"]').hidden=true;
    document.querySelectorAll('[data-quick]').forEach(function (button) { button.addEventListener('click',function () { var doc=selectedInvoice(form); if (!doc) return; var balance=GT.invoices.summary(doc.id).balance; form.elements.amount.value=(button.dataset.quick==='full'?balance:Math.min(balance,Math.round(balance/2))).toLocaleString('en-US'); form.elements.amount.dispatchEvent(new Event('input',{bubbles:true})); }); });
    async function save(andPrint) {
      var values=read(form);
      if (!GT.forms.showErrors(form,GT.receipts.validate(values))) return;
      try { var row=GT.receipts.save(values); tracker.markSaved(); GT.components.showToast('Receipt '+row.number+' issued.','success'); location.hash='#/receipts/'+row.id; if (andPrint) print(row); }
      catch(error) { if (error.fields) GT.forms.showErrors(form,error.fields); else GT.components.showToast(error.message,'error'); }
    }
    form.addEventListener('submit',function (event) { event.preventDefault(); save(false); });
    document.getElementById('receiptSavePrint').addEventListener('click',function () { save(true); });
    refreshForm(form,true);
  }
  function printMarkup(row) {
    var doc=GT.store.find('sales_documents',row.invoice_id), number=row.number||GT.numbering.peek('receipt');
    return (row.status==='void'?GT.print.watermark('VOID'):'')+GT.print.letterhead()+'<div class="receipt-print-top"><strong class="receipt-print-title">RECEIPT</strong><strong class="receipt-print-number">No. '+esc(number)+'</strong><span>Date: '+esc(GT.dates.formatDocDate(row.received_at||GT.dates.today()))+'</span></div><p class="receipt-print-tin">TIN: '+esc(GT.settings.tin)+'</p>'+
      '<p>Received with thanks from <strong>'+esc(row.customer_name||'________________')+'</strong></p><p>The sum of shillings <strong>'+esc(GT.format.amountInWords(row.amount||0))+'</strong></p><p>Being payment of <strong>'+esc(row.description||'________________')+'</strong></p>'+(doc?'<p>Invoice <strong>'+esc(doc.number)+'</strong></p>':'')+'<p>Cash / Cheque No.: <strong>'+esc(row.payment_method||'cash')+' '+esc(row.reference||'')+'</strong></p><p>Balance: <strong>'+money(row.balance_after||0)+'</strong></p><div class="receipt-figure">Shs. <strong>'+GT.format.formatMoneyPrint(row.amount||0)+'</strong></div><div class="receipt-signoff"><div><span class="receipt-sign-line"></span>Authorised Sign<br><strong>For: Genuine Textiles</strong><br>With thanks</div><div class="sales-stamp-area">Company stamp</div></div>';
  }
  function print(row) {
    var warning=/ENTER|PLACEHOLDER/i.test(String(GT.settings.bank.accountNumber)+' '+String(GT.settings.tin));
    var preview=GT.print.open(printMarkup(row),'Receipt '+row.number);
    var toolbar=preview.querySelector('.print-preview-toolbar');
    toolbar.insertAdjacentHTML('beforeend','<label class="receipt-copy-select">Copies <select class="form-select" id="receiptCopies"><option value="one">One receipt per page</option><option value="two">Two copies on one page</option></select></label>');
    if (warning) toolbar.insertAdjacentHTML('afterend','<div class="receipt-preview-warning">Check placeholder TIN or bank details before printing.</div>');
    preview.querySelector('#receiptCopies').addEventListener('change',function () {
      preview.querySelector('.print-page').innerHTML=this.value==='two'?'<div class="receipt-two-copy"><div><p>Customer copy</p><div class="receipt-copy-body">'+printMarkup(row)+'</div></div><div class="receipt-cut-line">Cut here</div><div><p>Office copy</p><div class="receipt-copy-body">'+printMarkup(row)+'</div></div></div>':printMarkup(row);
    });
  }
  function detail(params) {
    var row=GT.store.find('receipts',params.id);
    if (!row || !canView(row)) return '<section class="page-placeholder"><h1>Access denied</h1><p>This receipt is unavailable.</p></section>';
    if (!row.invoice_id) { var sale=GT.store.where('quick_sales',{receipt_id:row.id})[0];
      return '<section class="receipts-page">'+GT.components.pageHeader({title:'Receipt '+row.number,description:'Quick sale · '+GT.dates.formatDate(row.received_at),badge:GT.components.statusBadge(row.status==='void'?'Void':'Issued',row.status==='void'?'danger':'success'),actions:[{label:'Print',icon:'printer',name:'print'}]})+
        '<div class="detail-card"><h2>Receipt details</h2><dl class="detail-grid">'+GT.components.detailRow('Customer',row.customer_name)+GT.components.detailRow('Amount',money(row.amount))+GT.components.detailRow('Method',row.payment_method.toUpperCase())+
        GT.components.detailRow('Reference',row.reference)+GT.components.detailRow('Received by',name(row.received_by,'users'))+'</dl>'+(sale?'<a href="#/sales/quick-sales/'+sale.id+'">View quick sale</a>':'')+'</div></section>'; }
    var doc=GT.store.find('sales_documents',row.invoice_id), sum=GT.invoices.summary(doc.id);
    var others=GT.receipts.listForInvoice(doc.id).filter(function (item) { return item.id!==row.id && canView(item); });
    return '<section class="receipts-page">'+GT.components.pageHeader({title:'Receipt '+row.number,badge:GT.components.statusBadge(row.status==='void'?'Void':'Issued',row.status==='void'?'danger':'success'),description:GT.dates.formatDate(row.received_at),actions:[{label:'Print',icon:'printer',name:'print'},{label:'Void',icon:'ban',name:'void',className:'btn-outline-danger',permission:'receipts',permissionAction:'E'}].filter(function (action) { return action.name!=='void'||row.status==='issued'; })})+
      (row.status==='void'?'<div class="sales-void-banner">VOID · '+esc(row.void_reason)+'</div>':'')+'<div class="receipt-detail-layout"><article class="detail-card"><h2>Receipt details</h2><dl class="detail-grid">'+GT.components.detailRow('Customer',row.customer_name)+GT.components.detailRow('Invoice',doc.number)+GT.components.detailRow('Amount',money(row.amount))+GT.components.detailRow('Amount in words',GT.format.amountInWords(row.amount))+GT.components.detailRow('Method',row.payment_method.toUpperCase())+GT.components.detailRow('Reference',row.reference)+GT.components.detailRow('Description',row.description)+GT.components.detailRow('Balance after',money(row.balance_after))+GT.components.detailRow('Received by',name(row.received_by,'users'))+'</dl><p><a href="#/customers/'+row.customer_id+'">View customer</a> · <a href="#/invoices/'+doc.id+'">View invoice '+esc(doc.number)+'</a></p></article><aside class="detail-card"><h2>Invoice now</h2><dl class="detail-grid">'+GT.components.detailRow('Total',money(doc.total))+GT.components.detailRow('Paid',money(sum.paid))+GT.components.detailRow('Balance',money(sum.balance))+GT.components.detailRow('Payment status',sum.paymentStatus?sum.paymentStatus.replace('_',' '):'None')+'</dl><h2>Other receipts</h2>'+(others.length?'<ul>'+others.map(function (item) { return '<li><a href="#/receipts/'+item.id+'">'+esc(item.number)+'</a> · '+money(item.amount)+'</li>'; }).join('')+'</ul>':'<p>No other receipts.</p>')+'<h2>Timeline</h2><p>Issued '+esc(GT.dates.formatDate(row.received_at))+' by '+esc(name(row.received_by,'users'))+'</p>'+(row.voided_at?'<p>Voided '+esc(GT.dates.formatDate(row.voided_at))+' by '+esc(name(row.voided_by,'users'))+' · '+esc(row.void_reason)+'</p>':'')+'</aside></div></section>';
  }
  function bindDetail(params) { var row=GT.store.find('receipts',params.id); document.querySelectorAll('[data-page-action]').forEach(function (button) { button.addEventListener('click',function () { if (button.dataset.pageAction==='print') print(row); else voidPrompt(row); }); }); }
  var api={render:function (view,params) { return view==='list'?list():view==='new'?form():detail(params); },bind:function (view,params) { if (view==='list') { table.mount('#receiptListMount'); var query=new URLSearchParams(String(location.hash).split('?')[1]||''), customer=query.get('customer'), invoice=query.get('invoice'); if (customer) table.setFilter('customer',customer); if (invoice) { var doc=GT.store.find('sales_documents',invoice); if (doc) { table.state.search=doc.number; table.refresh(); } } updateCards(); } else if (view==='new') bindForm(); else bindDetail(params); },printMarkup:printMarkup,print:print};
  ['#/receipts','#/sales/receipts'].forEach(function (base) {
    GT.router.register(base,{module:api,view:'list',title:'Receipts',permission:'receipts',action:'V',baseRoute:'#/sales/receipts'});
    GT.router.register(base+'/new',{module:api,view:'new',title:'Record payment',permission:'receipts',action:'C',baseRoute:'#/sales/receipts'});
    GT.router.register(base+'/:id',{module:api,view:'detail',title:'Receipt Details',permission:'receipts',action:'V',baseRoute:'#/sales/receipts'});
  });
  return api;
}());
