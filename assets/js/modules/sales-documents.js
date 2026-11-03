/* Shared quotation, proforma and invoice UI; lifecycle and calculations live in services. */
window.GT = window.GT || {};
window.GT.salesDocumentModule = (function () {
  var GT = window.GT, service = GT.salesDocs, table, editor, tracker, formSections, currentType;
  function esc(value) { return GT.components.escapeHtml(value === null || value === undefined ? '' : value); }
  function config(type) { return service.types[type]; }
  function userName(id) { var row = GT.store.find('users', id); return row ? row.name : 'Unknown'; }
  function customerName(id) { var row = GT.store.find('customers', id); return row ? row.name : 'Unknown'; }
  function label(doc) { return doc.number || 'Draft'; }
  function route(type, suffix) { return config(type).route + (suffix || ''); }
  function conversionSource() {
    var match = /^quotation:(\d+)$|^proforma:(\d+)$/.exec(new URLSearchParams(String(location.hash).split('?')[1] || '').get('from') || '');
    var type=match && match[1] ? 'quotation' : 'proforma', number=match ? String(match[1] || match[2]).padStart(3,'0') : '';
    var doc=match ? GT.store.where('sales_documents',function (row) { return row.type===type && row.number===number; })[0] : null;
    return doc && doc.type === (match[1] ? 'quotation' : 'proforma') && doc.status === 'issued' && service.mayView(doc) ? doc : null;
  }
  function status(doc) { return service.effectiveStatus(doc); }
  function statusBadge(doc) {
    var value = status(doc), tones = { draft:'neutral', issued:'info', expired:'danger', void:'danger', discarded:'neutral' };
    return GT.components.statusBadge(value.charAt(0).toUpperCase() + value.slice(1), tones[value]) + (doc.discount_status === 'requested' ? ' <span class="sales-discount-chip">Discount pending</span>' : '');
  }
  function listRows(type) {
    var showDiscarded = table && table.state.filters.status === 'discarded';
    return service.list(type, showDiscarded).filter(function (doc) { return showDiscarded || doc.status !== 'discarded'; }).map(function (doc) {
      var payment = type === 'invoice' ? GT.invoices.summary(doc.id) : null;
      return Object.assign({}, doc, { number_label:label(doc), customer_label:doc.customer_name || customerName(doc.customer_id), creator_name:userName(doc.created_by), status_label:status(doc), item_search:service.items(doc.id).map(function (item) { return item.description; }).join(' '),
        paid:payment ? payment.paid : 0, balance:payment ? payment.balance : 0, payment_label:payment && payment.paymentStatus || '', overdue:payment && payment.isOverdue, days_overdue:payment && payment.daysOverdue,
        delivery_label:type==='invoice' && doc.status==='issued' ? GT.deliveries.summary(doc.id).status : '' });
    });
  }
  function stats(type) {
    var rows = service.list(type), today = GT.dates.today();
    if (type === 'invoice') {
      var issued = rows.filter(function (doc) { return doc.status === 'issued'; });
      var overdue = issued.filter(function (doc) { return GT.invoices.summary(doc.id).isOverdue; });
      var collected = GT.store.where('receipts', function (row) { return row.status !== 'void' && String(row.received_at || '').slice(0,7) === today.slice(0,7) && issued.some(function (doc) { return Number(doc.id) === Number(row.invoice_id); }); });
      return [
        {label:'Issued this month',value:GT.format.formatMoney(issued.filter(function (doc) { return doc.issue_date.slice(0,7) === today.slice(0,7); }).reduce(function (sum,doc) { return sum + doc.total; },0)),icon:'file-text',tone:'brand',filterKey:'issued_this_month',onClick:filterCard},
        {label:'Outstanding',value:GT.format.formatMoney(issued.reduce(function (sum,doc) { return sum + GT.invoices.summary(doc.id).balance; },0)),icon:'wallet',tone:'warning',filterKey:'outstanding',onClick:filterCard},
        {label:'Overdue',value:GT.format.formatMoney(overdue.reduce(function (sum,doc) { return sum + GT.invoices.summary(doc.id).balance; },0)),helper:overdue.length+' invoices',icon:'alarm-clock',tone:'danger',filterKey:'overdue',onClick:filterCard},
        {label:'Collected this month',value:GT.format.formatMoney(collected.reduce(function (sum,row) { return sum + Number(row.amount); },0)),icon:'banknote',tone:'success',filterKey:'collected',onClick:filterCard}
      ];
    }
    if (type === 'proforma') {
      var month = today.slice(0,7), issued = rows.filter(function (doc) { return doc.status === 'issued' && doc.issue_date.slice(0,7) === month; });
      return [
        {label:'Issued this month',value:GT.format.formatMoney(issued.reduce(function (sum, doc) { return sum + doc.total; },0)),icon:'file-check',tone:'brand',filterKey:'issued_this_month',onClick:filterCard},
        {label:'Drafts',value:String(rows.filter(function (doc) { return doc.status === 'draft'; }).length),icon:'file-pen',tone:'neutral',filterKey:'draft',onClick:filterCard}
      ];
    }
    var open = rows.filter(function (doc) { return status(doc) === 'issued'; });
    var expiring = open.filter(function (doc) { return GT.dates.daysBetween(today, doc.valid_until) <= 7; });
    return [
      {label:'Open quotations',value:String(open.length),helper:GT.format.formatMoney(open.reduce(function (sum, doc) { return sum + doc.total; },0)),icon:'file-text',tone:'brand',filterKey:'issued',onClick:filterCard},
      {label:'Expiring within 7 days',value:String(expiring.length),icon:'clock',tone:'warning',filterKey:'expiring',onClick:filterCard},
      {label:'Expired',value:String(rows.filter(function (doc) { return status(doc) === 'expired'; }).length),icon:'calendar-x',tone:'danger',filterKey:'expired',onClick:filterCard},
      {label:'Drafts',value:String(rows.filter(function (doc) { return doc.status === 'draft'; }).length),icon:'file-pen',tone:'neutral',filterKey:'draft',onClick:filterCard}
    ];
  }
  function filterCard(card) {
    if (currentType === 'invoice' && ['outstanding','overdue'].indexOf(card.filterKey) === -1) {
      Object.keys(table.state.filters).forEach(function (name) { table.state.filters[name]=''; });
      table.state.search=''; table.refresh(); return;
    }
    table.toggleFilter('status', card.filterKey);
  }
  function updateCards(type) {
    var cards = stats(type);
    cards.forEach(function (card) { card.active = table.state.filters.status === card.filterKey; });
    var mount = document.getElementById('salesStats');
    if (mount) { mount.innerHTML = GT.statCards.render(cards); GT.statCards.bind(mount, cards); GT.components.refreshIcons(); }
  }
  function statusTest(doc, value) {
    if (value === 'outstanding') return doc.status === 'issued' && doc.balance > 0;
    if (value === 'overdue') return !!doc.overdue;
    if (value === 'collected') return doc.status === 'issued' && doc.paid > 0;
    if (value === 'expiring') return status(doc) === 'issued' && doc.valid_until && GT.dates.daysBetween(GT.dates.today(), doc.valid_until) <= 7;
    if (value === 'issued_this_month') return doc.status === 'issued' && doc.issue_date.slice(0,7) === GT.dates.today().slice(0,7);
    return status(doc) === value;
  }
  function makeList(type) {
    currentType = type;
    var columns = [
      {label:'Number',field:'number_label',sortable:true,priority:1,minWidth:90},
      {label:'Date',field:'issue_date',sortable:true,priority:1,formatter:GT.dates.formatDate,exportValue:function (row) { return row.issue_date; }},
      {label:'Customer',field:'customer_label',sortable:true,priority:1,minWidth:160},
      {label:'Total',field:'total',sortable:true,priority:1,align:'right',numeric:true,wrap:false,minWidth:135,formatter:GT.format.formatMoney},
      {label:'Status',field:'status_label',sortable:true,priority:1,html:true,formatter:function (_, row) { return statusBadge(row); },exportValue:function (row) { return row.status_label; }},
      {label:'Created by',field:'creator_name',sortable:true,priority:3}
    ];
    if (type === 'quotation') columns.splice(4,0,{label:'Valid until',field:'valid_until',sortable:true,priority:2,formatter:function (value) { return value ? GT.dates.formatDate(value) : ''; },exportValue:function (row) { return row.valid_until; }});
    if (type === 'invoice') columns.splice(4,0,
      {label:'Paid',field:'paid',sortable:true,priority:2,align:'right',numeric:true,wrap:false,formatter:GT.format.formatMoney},
      {label:'Balance',field:'balance',sortable:true,priority:1,align:'right',numeric:true,wrap:false,formatter:GT.format.formatMoney},
      {label:'Due date',field:'due_date',sortable:true,priority:2,formatter:function (value) { return value ? GT.dates.formatDate(value) : ''; }},
      {label:'Payment',field:'payment_label',sortable:true,priority:1,html:true,formatter:function (value,row) { if (!value) return '—'; return GT.components.statusBadge(value === 'part_paid' ? 'Part paid' : value[0].toUpperCase()+value.slice(1),value === 'paid' ? 'success' : value === 'part_paid' ? 'warning' : 'neutral')+(row.overdue?' '+GT.components.statusBadge('Overdue '+row.days_overdue+' days','danger'):''); },exportValue:function (row) { return row.overdue ? 'Overdue '+row.days_overdue+' days' : row.payment_label; }});
    if (type === 'invoice') columns.push({label:'Delivery',field:'delivery_label',priority:2,html:true,formatter:function (value) {
      return value ? GT.components.statusBadge(value.replace('_',' '),value==='delivered'?'success':value==='part_delivered'?'info':'neutral') : '—';
    },exportValue:function (row) { return row.delivery_label; }});
    var filters = [
      {name:'status',label:'Status',options:['draft','issued','expired','expiring','void','discarded'].filter(function (value) { return type === 'quotation' || ['expired','expiring'].indexOf(value) === -1; }).concat(type === 'proforma' ? ['issued_this_month'] : type === 'invoice' ? ['issued_this_month','outstanding','overdue','collected'] : []).map(function (value) { return {value:value,label:value.split('_').join(' ').replace(/^./,function (letter) { return letter.toUpperCase(); })}; }),test:statusTest},
      {name:'customer',label:'Customer',field:'customer_id',options:GT.customers.options()},
      {name:'date_from',label:'From date',type:'date',test:function (row,value) { return row.issue_date >= value; }},
      {name:'date_to',label:'To date',type:'date',test:function (row,value) { return row.issue_date <= value; }}
    ];
    if (type === 'invoice') filters.splice(1,0,{name:'payment',label:'Payment',field:'payment_label',options:[{value:'unpaid',label:'Unpaid'},{value:'part_paid',label:'Part paid'},{value:'paid',label:'Paid'}]}, {name:'overdue',label:'Overdue',options:[{value:'yes',label:'Overdue only'}],test:function (row) { return !!row.overdue; }});
    if (GT.session.currentUser().role !== 'sales') filters.splice(2,0,{name:'created_by',label:'Created by',field:'created_by',options:GT.session.users().map(function (row) { return {value:row.id,label:row.name}; })});
    table = GT.dataTable.create({ id:type+'Table',caption:config(type).plural,rows:function () { return listRows(type); },searchFields:['number_label','customer_label','item_search','fiscal_document_no'],searchPlaceholder:'Search number, customer or item',filters:filters,columns:columns,
      actions:[
        {label:'View',icon:'eye',primary:true,onClick:function (row) { location.hash=route(type,'/'+row.id); }},
        {label:'Edit',icon:'pencil',primary:true,show:service.canEdit,onClick:function (row) { location.hash=route(type,'/'+row.id+'/edit'); }},
        {label:'Print',icon:'printer',onClick:openPrint},
        {label:'Convert to invoice',icon:'arrow-right',show:function (row) { return type !== 'invoice' && row.status === 'issued' && service.canCreate('invoice'); },onClick:convert},
        {label:'Convert to order',icon:'clipboard-list',show:function (row) { return type !== 'invoice' && row.status === 'issued' && GT.permissions.can('orders','C') &&
          !GT.store.where('orders',function (item) { return Number(item.source_document_id) === row.id && item.status !== 'cancelled'; }).length; },
          onClick:function (row) { location.hash='#/orders/new?source='+row.id; }},
        {label:'Duplicate as new draft',icon:'copy',show:function () { return service.canCreate(type); },onClick:duplicate},
        {label:'Void',icon:'ban',destructive:true,show:service.canVoid,onClick:voidDoc},
        {label:'Discard draft',icon:'trash-2',destructive:true,show:service.canEdit,onClick:discard},
        {label:'Record payment',icon:'banknote',show:function () { return type === 'invoice' && GT.permissions.can('receipts','C'); },disabledReason:function (row) { return row.status !== 'issued' || GT.invoices.summary(row.id).balance<=0 ? 'Only issued invoices with a balance can receive payment.' : ''; },onClick:function (row) { location.hash='#/receipts/new?invoice='+row.id; }},
        {label:'Create delivery note',icon:'truck',show:function (row) { return type==='invoice' && row.status==='issued' && GT.permissions.can('delivery_notes','C') && GT.deliveries.summary(row.id).lines.some(function (line) { return line.remaining>0; }); },
          onClick:function (row) { location.hash='#/delivery-notes/new?invoice='+row.id; }}
      ],emptyState:{message:'No '+config(type).plural.toLowerCase()+' match the current filters.',action:{label:'New '+config(type).label,show:function () { return service.canCreate(type); },onClick:function () { location.hash=route(type,'/new'); }}},exportName:'genuine-textiles-'+type+'s.csv',onStateChange:function () { updateCards(type); } });
    return '<section class="sales-doc-page">'+GT.components.pageHeader({title:config(type).plural,description:'Prepare, issue and review '+config(type).plural.toLowerCase()+'.',actions:service.canCreate(type)?[{label:'New '+config(type).label,icon:'plus',route:route(type,'/new')}]:[]})+'<div id="salesStats"></div><div id="salesListMount"></div></section>';
  }
  function defaultValues(type, doc) {
    if (doc) return Object.assign({}, doc, {items:service.items(doc.id)});
    if (type === 'invoice' && conversionSource()) { var source=conversionSource(); return Object.assign({}, source, { issue_date:GT.dates.today(),due_date:'',order_reference:'',fiscal_document_no:'',items:service.items(source.id) }); }
    return {customer_id:'',issue_date:GT.dates.today(),valid_until:GT.dates.addDays(GT.dates.today(),GT.settings.quotationValidityDays),due_date:'',order_reference:'',fiscal_document_no:'',discount_amount:0,discount_reason:'',terms_text:type === 'invoice' ? '' : GT.settings.quotationTerms,notes:'',items:[{description:'',size:'All',quantity:null,unit:'pcs',unit_price:null}]};
  }
  function sections(type) {
    var detailFields = [{name:'issue_date',label:'Document date',type:'date',required:true}];
    if (config(type).hasValidity) detailFields.push({name:'valid_until',label:'Valid until',type:'date',required:true});
    if (type === 'invoice') detailFields.push({name:'due_date',label:'Due date',type:'date',readonly:true},{name:'order_reference',label:'Order reference',type:'text'},{name:'fiscal_document_no',label:'Fiscal Document No.',type:'text'});
    return [
      {title:'Customer',fields:[{name:'customer_search',label:'Search customers',type:'text',placeholder:'Search name, group or phone'},{name:'customer_id',label:'Customer',type:'select',required:true,valueType:'number',options:GT.customers.options().map(function (option) { var row=GT.store.find('customers',option.value),group=GT.store.find('customer_groups',row.customer_group_id); return {value:option.value,label:option.label+' — '+(group?group.name:'')+' — '+row.phone+(type === 'invoice' && row.is_credit ? ' — Balance '+GT.format.formatMoney(GT.customers.balance(row.id)) : '')}; })}]},
      {title:'Document details',fields:detailFields},
      {title:'Discount',fields:[{name:'discount_amount',label:'Discount amount (UGX)',type:'money'},{name:'discount_reason',label:'Discount reason',type:'text'}]},
      {title:'Terms and notes',fields:(config(type).hasTerms?[{name:'terms_text',label:'Printed terms',type:'textarea',fullWidth:true}]:[]).concat([{name:'notes',label:'Internal notes (not printed)',type:'textarea',fullWidth:true}])}
    ];
  }
  function formMarkup(type, doc) {
    var values=defaultValues(type,doc); formSections=sections(type);
    var html=GT.forms.render({id:'salesDocForm',sections:formSections,values:values,submitLabel:'Save draft',cancelRoute:doc?route(type,'/'+doc.id):route(type)});
    var extra='<div class="sales-customer-tools"><button class="btn btn-outline-primary" type="button" data-quick-customer>Quick add customer</button><div id="salesCustomerDetails" aria-live="polite"></div></div>'+(type === 'invoice' ? '<div class="sales-account-panel" id="salesAccountPanel" aria-live="polite"></div>' : '');
    html=html.replace('</div></fieldset>',extra+'</div></fieldset>');
    html=html.replace('<fieldset class="form-section"><legend>Discount</legend>','<fieldset class="form-section"><legend>Items</legend><div id="salesLineEditor"></div><p class="field-error" id="itemsError"></p></fieldset><fieldset class="form-section"><legend>Totals</legend><div id="salesLiveTotals" aria-live="polite"></div></fieldset><fieldset class="form-section"><legend>Discount</legend>');
    html=html.replace('<button class="btn btn-primary" type="submit">Save draft</button>','<button class="btn btn-primary" type="submit">Save draft</button><button class="btn btn-outline-primary" type="button" data-issue>Issue</button>');
    return '<section class="sales-doc-page sales-doc-form-page">'+GT.components.pageHeader({title:(doc?'Edit draft ':'New ')+config(type).label,description:'Document number is assigned only when issued.'})+'<div class="sales-form-tabs" role="tablist"><button class="active" type="button" data-sales-tab="form" aria-selected="true">Form</button><button type="button" data-sales-tab="preview" aria-selected="false">Preview</button></div><div class="sales-form-layout"><div class="sales-form-column">'+html+'</div><aside class="sales-preview-column"><div class="sales-preview-heading"><strong>Live A4 preview</strong><button class="btn btn-outline-secondary" type="button" data-preview-print>Print preview</button></div><div class="print-page sales-live-print" id="salesLivePreview"></div></aside></div></section>';
  }
  function lineColumns() {
    return [
      {key:'description',label:'Description',type:'text',validate:function (value) { return String(value||'').trim()?'':'Enter a description.'; }},
      {key:'size',label:'Size',type:'text'},
      {key:'quantity',label:'Qty',type:'number',validate:function (value) { return Number(value)>0?'':'Quantity must be above zero.'; }},
      {key:'unit',label:'Unit',type:'select',options:['pcs','pairs','sets','metres','yards'].map(function (value) { return {value:value,label:value}; }),validate:function (value) { return value?'':'Choose a unit.'; }},
      {key:'unit_price',label:'Unit price',type:'money',validate:function (value) { return Number(value)>0?'':'Price must be above zero.'; }},
      {key:'amount',label:'Amount',type:'computed',compute:function (row) { return Math.round(Number(row.quantity||0)*Number(row.unit_price||0)); },format:GT.format.formatMoney}
    ];
  }
  function valuesFromForm(form) { var values=GT.forms.read(form,formSections); values.items=editor.getRows().filter(function (row) { return String(row.description||'').trim() || Number(row.quantity)>0 || Number(row.unit_price)>0; }); return values; }
  function totalsMarkup(totals) { return '<dl class="sales-totals"><div><dt>Sub-total</dt><dd>'+GT.format.formatMoney(totals.subtotal)+'</dd></div><div><dt>Discount</dt><dd>'+GT.format.formatMoney(totals.discount)+'</dd></div><div><dt>VAT '+esc(GT.settings.vatRate)+'%</dt><dd>'+GT.format.formatMoney(totals.vat)+'</dd></div><div class="sales-total-final"><dt>TOTAL</dt><dd>'+GT.format.formatMoney(totals.total)+'</dd></div></dl><p class="sales-words">'+esc(GT.format.amountInWords(totals.total))+'</p>'; }
  function liveUpdate() {
    var form=document.getElementById('salesDocForm'); if (!form) return;
    var values=valuesFromForm(form), totals=GT.calc.calcTotals(values.items,values.discount_amount,GT.settings.vatRate);
    document.getElementById('salesLiveTotals').innerHTML=totalsMarkup(totals);
    var selected=GT.store.find('customers',values.customer_id), detail=document.getElementById('salesCustomerDetails');
    detail.textContent=selected ? ((selected.address||'No address recorded')+' · '+selected.phone) : '';
    if (currentType === 'invoice') {
      var account=document.getElementById('salesAccountPanel'), check=selected ? GT.invoices.creditCheck(selected.id,totals.total) : null;
      form.elements.due_date.value=selected ? GT.invoices.dueDate(values.issue_date,selected) : '';
      account.innerHTML=selected ? '<strong>Customer account</strong><p>Current balance: '+GT.format.formatMoney(check.balance)+'</p><p>Credit limit: '+(check.isCredit?GT.format.formatMoney(check.creditLimit):'Cash customer')+'</p><p>Available credit: '+(check.isCredit?GT.format.formatMoney(check.availableCredit):'Not applicable')+'</p>'+(check.exceedsLimit?'<p class="sales-credit-warning">Credit limit exceeded: '+GT.format.formatMoney(check.balance)+' + '+GT.format.formatMoney(totals.total)+' exceeds '+GT.format.formatMoney(check.creditLimit)+'. Approval is required to issue.</p>':'') : '<strong>Customer account</strong><p>Choose a customer.</p>';
    }
    var preview=Object.assign({}, values, {type:currentType,number:null,status:'draft',customer_name:selected?selected.name:'Customer',subtotal:totals.subtotal,vat_rate:GT.settings.vatRate,vat_amount:totals.vat,total:totals.total,amount_in_words:GT.format.amountInWords(totals.total)});
    document.getElementById('salesLivePreview').innerHTML=printMarkup(preview,values.items);
  }
  function formError(form,error) {
    if (error.validationErrors) { GT.forms.showErrors(form,error.validationErrors); document.getElementById('itemsError').textContent=error.validationErrors.items||''; }
    else GT.components.showToast(error.message,'error');
  }
  function bindForm(type,doc) {
    currentType=type;
    var source=type === 'invoice' && !doc ? conversionSource() : null;
    if (source && service.effectiveStatus(source)==='expired') GT.components.confirmDialog({title:'Convert expired quotation',message:'This quotation has expired. Prices may have changed. Continue?',confirmText:'Continue'}).then(function (confirmed) { if (!confirmed) location.hash=route(source.type,'/'+source.id); });
    var form=document.getElementById('salesDocForm');
    editor=GT.lineEditor.create({id:'salesLines',rows:defaultValues(type,doc).items,newRow:{description:'',size:'All',quantity:null,unit:'pcs',unit_price:null},columns:lineColumns(),addLabel:'Add item',onChange:liveUpdate}).mount('#salesLineEditor');
    form.elements.issue_date.max=GT.dates.today(); if (form.elements.valid_until) form.elements.valid_until.min=form.elements.issue_date.value;
    tracker=GT.forms.trackDirty(form);
    form.addEventListener('input',liveUpdate); form.addEventListener('change',liveUpdate);
    var allCustomers=Array.from(form.elements.customer_id.options).map(function (option) { return {value:option.value,label:option.textContent}; });
    form.elements.customer_search.addEventListener('input',function () { var term=this.value.trim().toLowerCase(),select=form.elements.customer_id,selected=select.value; select.innerHTML=''; allCustomers.filter(function (item) { return !term || !item.value || item.label.toLowerCase().indexOf(term)!==-1 || item.value===selected; }).forEach(function (item) { var option=document.createElement('option'); option.value=item.value; option.textContent=item.label; select.appendChild(option); }); select.value=selected; });
    form.elements.issue_date.addEventListener('change',function () { if (form.elements.valid_until) { form.elements.valid_until.min=this.value; if (!doc) form.elements.valid_until.value=GT.dates.addDays(this.value,GT.settings.quotationValidityDays); } liveUpdate(); });
    form.addEventListener('submit',function (event) { event.preventDefault(); saveForm(type,doc,false); });
    form.querySelector('[data-issue]').addEventListener('click',function () { saveForm(type,doc,true); });
    form.querySelector('[data-quick-customer]').addEventListener('click',quickCustomer);
    document.querySelector('[data-preview-print]').addEventListener('click',function () { var values=valuesFromForm(form),selected=GT.store.find('customers',values.customer_id); openPrint(Object.assign({},values,{type:type,number:null,status:'draft',customer_name:selected?selected.name:'Customer',vat_rate:GT.settings.vatRate}),values.items); });
    document.querySelectorAll('[data-sales-tab]').forEach(function (button) { button.addEventListener('click',function () { document.querySelector('.sales-form-layout').dataset.activeTab=button.dataset.salesTab; document.querySelectorAll('[data-sales-tab]').forEach(function (item) { item.classList.toggle('active',item===button); item.setAttribute('aria-selected',item===button?'true':'false'); }); }); });
    liveUpdate();
  }
  async function saveForm(type,doc,issue) {
    var form=document.getElementById('salesDocForm'), values=valuesFromForm(form);
    var lineErrors=editor.validate();
    try {
      var built=service.build(type,values); if (lineErrors.length) { var invalid=new Error('Correct the item lines.'); invalid.validationErrors={items:lineErrors[0].message}; throw invalid; }
      var approvedSource=type === 'invoice' && !doc && conversionSource() && conversionSource().discount_status==='approved';
      if (issue && built.discount_status==='requested' && !(doc && doc.discount_status==='approved' && doc.discount_amount===built.discount_amount && doc.discount_reason===built.discount_reason) && !approvedSource) { GT.components.showToast('A manager must approve this discount before issue. Save the draft to request approval.','warning'); return; }
      var credit=type === 'invoice' ? GT.invoices.creditCheck(values.customer_id,built.total) : null, reason='';
      if (issue && credit && credit.exceedsLimit && ['owner','general_manager'].indexOf(GT.session.currentUser().role) !== -1 && !(doc && doc.credit_override_approved_by && doc.total === built.total && doc.customer_id === built.customer_id)) {
        reason=await creditOverrideReason(credit); if (!reason) return;
      }
      if (issue && (!credit || !credit.exceedsLimit || reason || doc && doc.credit_override_approved_by)) { var confirmed=await GT.components.confirmDialog({title:'Issue '+config(type).label,message:'Number '+GT.numbering.peek(config(type).series)+' will be assigned. This document will be locked.',confirmText:'Issue document'}); if (!confirmed) return; }
      var source=type === 'invoice' && !doc ? conversionSource() : null;
      var converted=source ? GT.invoices.convertFrom(source.id) : null;
      var saved=service.saveDraft(type,values,doc&&doc.id || converted&&converted.id);
      if (issue && credit && credit.exceedsLimit && !reason && !saved.credit_override_approved_by) { GT.invoices.requestCreditApproval(saved.id); GT.components.showToast('Credit limit approval requested. The invoice remains a draft.','warning'); tracker.markSaved(); location.hash=route(type,'/'+saved.id); return; }
      if (issue) saved=service.issue(saved.id,reason);
      tracker.markSaved(); GT.components.showToast(config(type).label+' '+(issue?'issued as '+saved.number:'saved as a draft')+'.','success'); location.hash=route(type,'/'+saved.id);
    } catch (error) { formError(form,error); }
  }
  function creditOverrideReason(check) {
    return new Promise(function (resolve) {
      GT.components.openModal({title:'Credit limit override',content:'<p>The current balance '+GT.format.formatMoney(check.balance)+' plus this invoice '+GT.format.formatMoney(check.proposedTotal)+' exceeds the limit '+GT.format.formatMoney(check.creditLimit)+'. Give a reason to approve this override.</p><label class="form-label" for="creditOverrideReason">Reason</label><textarea class="form-control" id="creditOverrideReason" rows="3"></textarea><p class="field-error" id="creditOverrideError"></p><div class="gt-modal-actions"><button class="btn btn-primary" type="button" id="creditOverrideConfirm">Continue</button></div>'});
      document.querySelector('[data-modal-close]').addEventListener('click',function () { resolve(''); });
      document.getElementById('creditOverrideConfirm').addEventListener('click',function () { var value=document.getElementById('creditOverrideReason').value.trim(); if (!value) { document.getElementById('creditOverrideError').textContent='A reason is required.'; return; } GT.components.closeModal(); resolve(value); });
    });
  }
  function quickCustomer() {
    var fields=[{title:'Customer details',fields:[{name:'name',label:'Customer name',type:'text',required:true},{name:'phone',label:'Phone',type:'phone',required:true},{name:'customer_group_id',label:'Group',type:'select',required:true,valueType:'number',options:GT.store.all('customer_groups').map(function (group) { return {value:group.id,label:group.name}; })}]}];
    GT.components.openModal({title:'Quick add customer',content:GT.forms.render({id:'quickCustomerForm',sections:fields,values:{},submitLabel:'Add customer'})});
    var modalForm=document.getElementById('quickCustomerForm'); modalForm.querySelector('.form-actions a').remove();
    modalForm.addEventListener('submit',function (event) { event.preventDefault(); try { var saved=GT.customers.quickAdd(GT.forms.read(modalForm,fields)); var select=document.getElementById('customer_id'); var option=document.createElement('option'); option.value=saved.id; option.textContent=saved.name+' — '+saved.phone; option.selected=true; select.appendChild(option); select.dispatchEvent(new Event('change',{bubbles:true})); GT.components.closeModal(); GT.components.showToast(saved.name+' was added.','success'); } catch(error) { if (error.validationErrors) GT.forms.showErrors(modalForm,error.validationErrors); else GT.components.showToast(error.message,'error'); } });
  }
  function printMarkup(doc, lines) {
    lines=lines || service.items(doc.id);
    if (doc.type === 'invoice') return invoicePrintMarkup(doc,lines);
    var sums=GT.calc.calcTotals(lines,doc.discount_amount||0,doc.vat_rate===undefined?GT.settings.vatRate:doc.vat_rate);
    var filler=Math.max(0,8-lines.length), rows=lines.map(function (item,index) { return '<tr><td>'+(index+1)+'</td><td>'+esc(item.description)+'</td><td>'+esc(item.size||'All')+'</td><td>'+esc(item.quantity)+' '+esc(item.unit)+'</td><td>'+GT.format.formatMoneyPrint(item.unit_price)+'</td><td>'+GT.format.formatMoneyPrint(item.amount===undefined?Number(item.quantity)*Number(item.unit_price):item.amount)+'</td></tr>'; }).join('');
    for (var index=0;index<filler;index++) rows+='<tr class="sales-filler-row"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>';
    var title=config(doc.type).printTitle;
    return (doc.status==='void'?GT.print.watermark('VOID'):(doc.status==='draft'?GT.print.watermark('DRAFT'):''))+GT.print.letterhead()+'<div class="sales-print-top"><strong class="sales-print-number">'+(doc.number?'NO: '+esc(doc.number):'Draft')+'</strong><strong class="sales-print-title">'+title+'</strong><strong class="sales-print-date">'+(doc.issue_date?esc(GT.dates.formatDocDate(doc.issue_date)):'')+'</strong></div><p class="sales-print-client"><strong>CLIENT:</strong> '+esc(doc.customer_name||customerName(doc.customer_id))+'</p><table class="sales-print-table"><thead><tr><th>SL</th><th>DESCRIPTION</th><th>SIZE</th><th>QTY</th><th>UNIT PRICE</th><th>AMOUNT</th></tr></thead><tbody>'+rows+'</tbody></table><section class="print-keep-together sales-print-closing"><div class="sales-print-summary"><div><span>Sub-Total</span><strong>'+GT.format.formatMoneyPrint(sums.subtotal)+'</strong></div>'+(sums.discount?'<div><span>Discount</span><strong>'+GT.format.formatMoneyPrint(sums.discount)+'</strong></div>':'')+'<div><span>VAT '+esc(doc.vat_rate===undefined?GT.settings.vatRate:doc.vat_rate)+'%</span><strong>'+GT.format.formatMoneyPrint(sums.vat)+'</strong></div><div class="sales-print-grand"><span>TOTAL</span><strong>'+GT.format.formatMoneyPrint(sums.total)+'</strong></div></div><p class="sales-print-words"><strong>Amount in words:</strong> '+esc(GT.format.amountInWords(sums.total))+'</p><div class="sales-print-bank"><strong>Bank Account:</strong> '+esc(GT.settings.bank.accountNumber)+'<br><strong>Account Name:</strong> '+esc(GT.settings.bank.accountName)+'<br><strong>Bank:</strong> '+esc(GT.settings.bank.name)+'</div>'+(config(doc.type).hasTerms&&doc.terms_text?'<p class="sales-print-terms">'+esc(doc.terms_text)+'</p>':'')+GT.print.signatureBlock(['Authorised Signatory: '+GT.settings.authorisedSignatory])+'</section>';
  }
  function invoicePrintMarkup(doc,lines) {
    var sums=GT.calc.calcTotals(lines,doc.discount_amount||0,doc.vat_rate===undefined?GT.settings.vatRate:doc.vat_rate);
    var customer=GT.store.find('customers',doc.customer_id), due=doc.due_date || customer && GT.invoices.dueDate(doc.issue_date,customer);
    var rows=lines.map(function (item) { var particulars=item.description+(item.size && item.size !== 'All' ? ' — Size '+item.size : ''); return '<tr><td>'+esc(item.quantity)+' '+esc(item.unit)+'</td><td>'+esc(particulars)+'</td><td>'+GT.format.formatMoneyPrint(item.unit_price)+'</td><td>'+GT.format.formatMoneyPrint(item.amount===undefined?Number(item.quantity)*Number(item.unit_price):item.amount)+'</td></tr>'; }).join('');
    for (var index=lines.length;index<12;index++) rows+='<tr class="sales-filler-row"><td>&nbsp;</td><td></td><td></td><td></td></tr>';
    var terms=doc.terms_text || GT.invoices.terms(customer,due);
    return (doc.status==='void'?GT.print.watermark('VOID'):(doc.status==='draft'?GT.print.watermark('DRAFT'):''))+GT.print.letterhead()+'<p class="sales-print-tin">TIN: '+esc(GT.settings.tin)+'</p>'+
      '<div class="sales-print-top"><strong class="sales-print-number">'+(doc.number?'No. '+esc(doc.number):'Draft')+'</strong><strong class="sales-print-title">INVOICE</strong><strong class="sales-print-date">'+esc(GT.dates.formatDocDate(doc.issue_date))+'</strong></div>'+
      '<p class="sales-print-client"><strong>M/S:</strong> '+esc(doc.customer_name||customerName(doc.customer_id))+'<br>'+esc(doc.customer_address||customer&&customer.address||'')+'</p>'+
      '<p class="sales-print-references">'+(doc.order_reference?'<span>Order reference: '+esc(doc.order_reference)+'</span>':'')+(doc.fiscal_document_no?'<span>Fiscal Document No.: '+esc(doc.fiscal_document_no)+'</span>':'')+'</p>'+
      '<table class="sales-print-table sales-invoice-table"><thead><tr><th>Qty</th><th>PARTICULARS</th><th>RATE</th><th>AMOUNT</th></tr></thead><tbody>'+rows+'</tbody></table>'+
      '<section class="print-keep-together sales-print-closing"><div class="sales-print-summary"><div><span>Sub-total</span><strong>'+GT.format.formatMoneyPrint(sums.subtotal)+'</strong></div>'+(sums.discount?'<div><span>Discount</span><strong>'+GT.format.formatMoneyPrint(sums.discount)+'</strong></div>':'')+'<div><span>VAT '+esc(doc.vat_rate===undefined?GT.settings.vatRate:doc.vat_rate)+'%</span><strong>'+GT.format.formatMoneyPrint(sums.vat)+'</strong></div><div class="sales-print-grand"><span>TOTAL</span><strong>'+GT.format.formatMoneyPrint(sums.total)+'</strong></div></div><p class="sales-eoe">E&amp;OE</p><p class="sales-print-terms">'+esc(terms)+'</p><p class="sales-print-words"><strong>Amount in words:</strong> '+esc(GT.format.amountInWords(sums.total))+'</p><div class="sales-print-bank"><strong>Bank Account:</strong> '+esc(GT.settings.bank.accountNumber)+'<br><strong>Account Name:</strong> '+esc(GT.settings.bank.accountName)+'<br><strong>Bank:</strong> '+esc(GT.settings.bank.name)+'</div><div class="sales-invoice-signoff"><div><strong>For: Genuine Textiles</strong><div class="sales-signature-line">Signature</div></div><div class="sales-stamp-area">Company stamp</div></div></section>';
  }
  function openPrint(doc,lines) {
    var preview=GT.print.open(printMarkup(doc,lines),config(doc.type).label+' '+label(doc));
    if (/ENTER|PLACEHOLDER/i.test(String(GT.settings.bank.accountNumber)+' '+String(GT.settings.tin))) {
      var warning=document.createElement('p'); warning.className='sales-print-warning'; warning.textContent='Business settings still contain placeholder bank or TIN details'; preview.insertBefore(warning,preview.querySelector('.print-page'));
    }
  }
  function itemTable(doc) { return '<div class="table-responsive"><table class="sales-detail-table"><thead><tr><th>Description</th><th>Size</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>'+service.items(doc.id).map(function (item) { return '<tr><td>'+esc(item.description)+'</td><td>'+esc(item.size||'All')+'</td><td>'+esc(item.quantity)+' '+esc(item.unit)+'</td><td>'+GT.format.formatMoney(item.unit_price)+'</td><td>'+GT.format.formatMoney(item.amount)+'</td></tr>'; }).join('')+'</tbody></table></div>'; }
  function timeline(doc) {
    var events=[['Created',doc.created_at,userName(doc.created_by)]];
    if (doc.discount_status==='requested') events.push(['Discount requested',doc.updated_at,userName(doc.discount_requested_by)]);
    if (doc.discount_status==='approved') events.push(['Discount approved',doc.updated_at,userName(doc.discount_approved_by)]);
    if (doc.issued_at) events.push(['Issued',doc.issued_at,userName(doc.issued_by)]);
    if (doc.voided_at) events.push(['Voided',doc.voided_at,userName(doc.voided_by)+' — '+doc.voided_reason]);
    if (doc.discarded_at) events.push(['Discarded',doc.discarded_at,userName(doc.discarded_by)]);
    return '<ol class="sales-timeline">'+events.map(function (entry) { return '<li><strong>'+esc(entry[0])+'</strong><span>'+esc(entry[1] ? GT.dates.formatDate(entry[1]) : '')+' · '+esc(entry[2])+'</span></li>'; }).join('')+'</ol>';
  }
  function invoicePayment(doc) {
    var sum=GT.invoices.summary(doc.id), status=sum.paymentStatus ? sum.paymentStatus.replace('_',' ') : 'Not applicable';
    var rows=GT.invoices.receipts(doc.id).map(function (receipt) { return '<tr><td>'+esc(GT.dates.formatDate(receipt.received_at))+'</td><td><a href="#/receipts/'+receipt.id+'">'+esc(receipt.number)+'</a></td><td class="text-end">'+GT.format.formatMoney(receipt.amount)+'</td><td>'+esc(receipt.payment_method)+'</td></tr>'; }).join('');
    return '<h2>Payment</h2><dl class="detail-grid">'+GT.components.detailRow('Total',GT.format.formatMoney(doc.total))+GT.components.detailRow('Paid',GT.format.formatMoney(sum.paid))+GT.components.detailRow('Balance',GT.format.formatMoney(sum.balance))+GT.components.detailRow('Payment status',status)+GT.components.detailRow('Due date',GT.dates.formatDate(sum.dueDate))+GT.components.detailRow('Days overdue',sum.daysOverdue)+GT.components.detailRow('Ageing bucket',GT.invoices.ageBucket(sum.ageDays))+'</dl><h2>Receipts</h2>'+(rows?'<div class="table-responsive"><table class="sales-detail-table"><thead><tr><th>Date</th><th>Number</th><th>Amount</th><th>Method</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<p>No receipts recorded.</p>');
  }
  function sourceLinks(doc) {
    var source=doc.source_document_id ? GT.store.find('sales_documents',doc.source_document_id) : null;
    var converted=GT.store.where('sales_documents',function (row) { return row.type === 'invoice' && Number(row.source_document_id) === Number(doc.id) && row.status !== 'discarded'; });
    var linkedOrders=GT.store.where('orders',function (item) { return Number(item.source_document_id) === Number(doc.id) && item.status !== 'cancelled' && GT.orders.canView(item); });
    if (doc.type === 'invoice' && doc.order_id) {
      var linked=GT.store.find('orders',doc.order_id);
      if (linked && GT.orders.canView(linked) && !linkedOrders.some(function (item) { return item.id === linked.id; })) linkedOrders.push(linked);
    }
    return (source?'<p>Created from <a href="'+route(source.type,'/'+source.id)+'">'+esc(source.type)+' '+esc(source.number)+'</a></p>':'')+
      linkedOrders.map(function (item) { return '<p>Order: <a href="#/orders/'+item.id+'">'+esc(item.number||'Draft')+'</a></p>'; }).join('')+
      converted.map(function (row) { return '<p>Converted to <a href="'+route('invoice','/'+row.id)+'">invoice '+esc(row.number||'Draft')+'</a></p>'; }).join('');
  }
  function invoiceDetail(doc) {
    var customer=GT.store.find('customers',doc.customer_id), actions=[{label:'Print',name:'print',icon:'printer'}];
    var deliveryState=doc.status==='issued'?GT.deliveries.summary(doc.id):null;
    var deliveryBadge=deliveryState?GT.components.statusBadge(deliveryState.status.replace('_',' '),deliveryState.status==='delivered'?'success':deliveryState.status==='part_delivered'?'info':'neutral'):'';
    var deliveryAction=doc.status==='issued' && GT.permissions.can('delivery_notes','C') && deliveryState.lines.some(function (line) { return line.remaining>0; });
    var releaseWarning=doc.status==='issued' && GT.deliveries.releaseCheck(doc.id).status==='needs_approval' ? '<p class="sales-credit-warning">Dispatch release approval needed: '+esc(GT.deliveries.releaseCheck(doc.id).reason)+'</p>' : '';
    var deliverySection='<h2>Deliveries</h2>'+releaseWarning+'<div id="invoiceDeliveriesMount"></div>';
    if (deliveryAction) actions.push({label:'Create delivery note',route:'#/delivery-notes/new?invoice='+doc.id,icon:'truck'});
    if (service.canEdit(doc)) actions.push({label:'Edit',route:route('invoice','/'+doc.id+'/edit'),icon:'pencil'});
    if (service.canCreate('invoice')) actions.push({label:'Duplicate',name:'duplicate',icon:'copy'});
    if (service.canVoid(doc)) actions.push({label:'Void',name:'void',icon:'ban',className:'btn-outline-danger'});
    if (service.canEdit(doc)) actions.push({label:'Discard draft',name:'discard',icon:'trash-2',className:'btn-outline-danger'});
    if (doc.status==='issued' && GT.invoices.summary(doc.id).isOverdue && GT.permissions.can('payment_reminders','C')) actions.push({label:'Send reminder',name:'remind',icon:'bell-ring'});
    var fiscalAllowed=doc.status === 'issued' && ['owner','general_manager','accountant'].indexOf(GT.session.currentUser().role) !== -1;
    var pending=GT.store.where('approvals',function (row) { return row.type === 'credit_limit' && Number(row.entity_id) === Number(doc.id) && row.status === 'requested'; }).length > 0;
    var approval=pending ? '<h2>Credit limit approval</h2><p>This invoice exceeds the customer credit limit.</p>'+(fiscalAllowed || ['owner','general_manager'].indexOf(GT.session.currentUser().role)!==-1 ? '<button class="btn btn-primary" type="button" data-approve-credit>Approve credit override</button>' : '<p>Awaiting Owner or General Manager approval.</p>') : '';
    return '<section class="sales-doc-page" data-sales-id="'+doc.id+'">'+GT.components.pageHeader({title:'Invoice '+label(doc),badge:statusBadge(doc)+' '+deliveryBadge,description:'Prepared for '+(doc.customer_name||customerName(doc.customer_id))+'.',actions:actions})+
      (doc.status==='void'?'<div class="sales-void-banner">VOID · '+esc(doc.voided_reason)+'</div>':'')+
      '<div class="sales-detail-layout"><article class="detail-card"><h2>Document details</h2><dl class="detail-grid">'+GT.components.detailRow('Number',label(doc))+GT.components.detailRow('Invoice date',GT.dates.formatDate(doc.issue_date))+GT.components.detailRow('Due date',GT.dates.formatDate(doc.due_date))+GT.components.detailRow('Order reference',doc.order_reference||'—')+GT.components.detailRow('Created by',userName(doc.created_by))+GT.components.detailRow('Issued by',doc.issued_by?userName(doc.issued_by):'Not issued')+'</dl><p><strong>Customer:</strong> <a href="#/customers/'+doc.customer_id+'">'+esc(doc.customer_name||customerName(doc.customer_id))+'</a></p><p>'+esc(doc.customer_address||customer&&customer.address||'')+'</p>'+sourceLinks(doc)+
      '<h2>Items</h2>'+itemTable(doc)+'<div class="sales-detail-totals">'+totalsMarkup(service.totalsFor(doc))+'</div>'+deliverySection+'<h2>Terms</h2><p>'+esc(doc.terms_text||GT.invoices.terms(customer,doc.due_date))+'</p><h2>Internal notes</h2><p>'+esc(doc.notes||'No internal notes.')+'</p><div class="sales-convert">'+(GT.permissions.can('receipts','C')?'<a class="btn btn-outline-primary'+(doc.status!=='issued'||GT.invoices.summary(doc.id).balance<=0?' disabled':'')+'" href="#/receipts/new?invoice='+doc.id+'"'+(doc.status!=='issued'||GT.invoices.summary(doc.id).balance<=0?' title="Only issued invoices with a balance can receive payment" aria-disabled="true"':'')+'>Record payment</a>':'')+'</div></article>'+
      '<aside class="detail-card"><h2>Fiscal Document No.</h2><p>'+esc(doc.fiscal_document_no||'Not recorded')+'</p>'+(fiscalAllowed?'<button class="btn btn-outline-primary" type="button" data-edit-fiscal>Edit</button>':'')+invoicePayment(doc)+'<h2>Discount</h2><p>'+esc(doc.discount_status||'none')+(doc.discount_amount?' · '+GT.format.formatMoney(doc.discount_amount):'')+'</p>'+(doc.discount_reason?'<p>'+esc(doc.discount_reason)+'</p>':'')+(doc.discount_status==='requested'&&['owner','general_manager'].indexOf(GT.session.currentUser().role)!==-1?'<div class="sales-approval-actions"><button class="btn btn-primary" type="button" data-approve>Approve</button><button class="btn btn-outline-danger" type="button" data-reject>Reject</button></div>':'')+approval+'<h2>Timeline</h2>'+timeline(doc)+'</aside></div></section>';
  }
  function detailMarkup(type,id) {
    var doc=GT.store.find('sales_documents',id);
    if (!doc || doc.type!==type || !service.mayView(doc)) return '<section class="page-placeholder"><h1>Access denied</h1><p>This document is unavailable.</p></section>';
    if (type === 'invoice') return invoiceDetail(doc);
    var actions=[{label:'Print',name:'print',icon:'printer'}];
    if (doc.status === 'issued' && GT.permissions.can('orders','C') && !GT.store.where('orders',function (item) { return Number(item.source_document_id) === doc.id && item.status !== 'cancelled'; }).length) actions.push({label:'Convert to order',route:'#/orders/new?source='+doc.id,icon:'clipboard-list'});
    if (service.canEdit(doc)) actions.push({label:'Edit',route:route(type,'/'+id+'/edit'),icon:'pencil'});
    if (service.canCreate(type)) actions.push({label:'Duplicate',name:'duplicate',icon:'copy'});
    if (service.canVoid(doc)) actions.push({label:'Void',name:'void',icon:'ban',className:'btn-outline-danger'});
    if (service.canEdit(doc)) actions.push({label:'Discard draft',name:'discard',icon:'trash-2',className:'btn-outline-danger'});
    var customer=GT.store.find('customers',doc.customer_id);
    return '<section class="sales-doc-page" data-sales-id="'+id+'">'+GT.components.pageHeader({title:config(type).label+' '+label(doc),badge:statusBadge(doc),description:'Prepared for '+(doc.customer_name||customerName(doc.customer_id))+'.',actions:actions})+(doc.status==='void'?'<div class="sales-void-banner">VOID · '+esc(doc.voided_reason)+'</div>':'')+'<div class="sales-detail-layout"><article class="detail-card"><h2>Document details</h2><dl class="detail-grid">'+GT.components.detailRow('Number',label(doc))+GT.components.detailRow('Document date',GT.dates.formatDate(doc.issue_date))+GT.components.detailRow('Valid until',doc.valid_until?GT.dates.formatDate(doc.valid_until):'Not applicable')+GT.components.detailRow('Created by',userName(doc.created_by))+GT.components.detailRow('Issued by',doc.issued_by?userName(doc.issued_by):'Not issued')+'</dl><p><strong>Customer:</strong> <a href="#/customers/'+doc.customer_id+'">'+esc(doc.customer_name||customerName(doc.customer_id))+'</a></p><p>'+esc(doc.customer_address||customer&&customer.address||'')+' · '+esc(doc.customer_phone||customer&&customer.phone||'')+'</p><h2>Items</h2>'+itemTable(doc)+'<div class="sales-detail-totals">'+totalsMarkup(service.totalsFor(doc))+'</div>'+(config(type).hasTerms&&doc.terms_text?'<h2>Terms</h2><p>'+esc(doc.terms_text)+'</p>':'')+'<h2>Internal notes</h2><p>'+esc(doc.notes||'No internal notes.')+'</p><div class="sales-convert"><button class="btn btn-outline-secondary" type="button" disabled title="Available with Invoices">Convert to invoice</button></div></article><aside class="detail-card"><h2>Discount</h2><p>'+esc(doc.discount_status||'none')+(doc.discount_amount?' · '+GT.format.formatMoney(doc.discount_amount):'')+'</p>'+(doc.discount_reason?'<p>'+esc(doc.discount_reason)+'</p>':'')+(doc.discount_status==='requested'&&['owner','general_manager'].indexOf(GT.session.currentUser().role)!==-1?'<div class="sales-approval-actions"><button class="btn btn-primary" type="button" data-approve>Approve</button><button class="btn btn-outline-danger" type="button" data-reject>Reject</button></div>':'')+'<h2>Timeline</h2>'+timeline(doc)+'</aside></div></section>';
  }
  function duplicate(doc) { try { var draft=service.duplicate(doc.id); GT.components.showToast('New draft created.','success'); location.hash=route(doc.type,'/'+draft.id+'/edit'); } catch(error) { GT.components.showToast(error.message,'error'); } }
  async function convert(doc) {
    if (service.effectiveStatus(doc) === 'expired') {
      var confirmed=await GT.components.confirmDialog({title:'Convert expired quotation',message:'This quotation has expired. Prices may have changed. Continue?',confirmText:'Convert to invoice'});
      if (!confirmed) return;
    }
    try { var draft=GT.invoices.convertFrom(doc.id); GT.components.showToast('Invoice draft created.','success'); location.hash=route('invoice','/'+draft.id+'/edit'); }
    catch(error) { GT.components.showToast(error.message,'error'); }
  }
  function editFiscal(doc) {
    GT.components.openModal({title:'Fiscal Document No.',content:'<label class="form-label" for="fiscalNoEdit">Fiscal Document No.</label><input class="form-control" id="fiscalNoEdit" value="'+esc(doc.fiscal_document_no||'')+'"><div class="gt-modal-actions"><button class="btn btn-primary" type="button" id="saveFiscalNo">Save</button></div>'});
    document.getElementById('saveFiscalNo').addEventListener('click',function () { try { GT.invoices.setFiscalNo(doc.id,document.getElementById('fiscalNoEdit').value); GT.components.closeModal(); GT.components.showToast('Fiscal Document No. saved.','success'); GT.app.renderPage(); } catch(error) { GT.components.showToast(error.message,'error'); } });
  }
  async function discard(doc) { if (!await GT.components.confirmDialog({title:'Discard draft',message:'This draft will be hidden from the normal list. It remains in the record.',confirmText:'Discard draft'})) return; try { service.discard(doc.id); GT.components.showToast('Draft discarded.','success'); location.hash=route(doc.type); if (location.hash===route(doc.type)) GT.app.renderPage(); } catch(error) { GT.components.showToast(error.message,'error'); } }
  function voidDoc(doc) {
    GT.components.openModal({title:'Void '+config(doc.type).label+' '+label(doc),content:'<p>The number will remain in the record. Give a reason.</p><label class="form-label" for="salesVoidReason">Reason</label><textarea class="form-control" id="salesVoidReason" rows="3"></textarea><p class="field-error" id="salesVoidError"></p><div class="gt-modal-actions"><button class="btn btn-outline-danger" type="button" id="salesVoidConfirm">Void document</button></div>'});
    document.getElementById('salesVoidConfirm').addEventListener('click',async function () { var reason=document.getElementById('salesVoidReason').value.trim(); if (!reason) { document.getElementById('salesVoidError').textContent='A reason is required.'; return; } if (!await GT.components.confirmDialog({title:'Confirm void',message:'Void '+label(doc)+'? This keeps the issued number and records the reason.',confirmText:'Void document'})) return; try { service.voidDoc(doc.id,reason); GT.components.showToast('Document voided.','success'); GT.app.renderPage(); } catch(error) { if (doc.type==='invoice' && /receipts first/.test(error.message)) GT.components.openModal({title:'Invoice has receipts',content:'<p>Void its active receipts before voiding this invoice.</p><p><a href="#/receipts?invoice='+doc.id+'">View the invoice receipts</a></p>'}); else GT.components.showToast(error.message,'error'); } });
  }
  function mountInvoiceDeliveries(doc) {
    var mount=document.getElementById('invoiceDeliveriesMount'); if (!mount) return;
    var rows=GT.deliveries.list().filter(function (row) { return Number(row.invoice_id)===Number(doc.id); });
    GT.dataTable.create({id:'invoiceDeliveriesTable',rows:rows,searchFields:['number'],
      columns:[{label:'Note',field:'number',priority:1,formatter:function (value) { return value||'Draft'; }},
        {label:'Date',field:'delivery_date',priority:1,formatter:GT.dates.formatDate},
        {label:'Status',field:'status',priority:1,html:true,formatter:function (value) { return GT.components.statusBadge(value,value==='delivered'?'success':value==='issued'?'info':value==='void'?'danger':'neutral'); }}],
      actions:[{label:'View',icon:'eye',primary:true,onClick:function (row) { location.hash='#/delivery-notes/'+row.id; }}],
      emptyState:{message:'No delivery notes for this invoice.'},exportName:'invoice-deliveries.csv'}).mount(mount);
  }
  function bindDetail(type,id) {
    var doc=GT.store.find('sales_documents',id); if (!doc||!service.mayView(doc)) return;
    if (type==='invoice') mountInvoiceDeliveries(doc);
    document.querySelectorAll('[data-page-action]').forEach(function (button) { button.addEventListener('click',function () { var action=button.dataset.pageAction; if (action==='print') openPrint(doc); if (action==='duplicate') duplicate(doc); if (action==='void') voidDoc(doc); if (action==='discard') discard(doc); if (action==='remind') GT.reminderModule.openSend(doc.customer_id,doc.id); }); });
    var convertButton=document.querySelector('.sales-convert button');
    if (convertButton && type !== 'invoice' && doc.status === 'issued' && service.canCreate('invoice')) { convertButton.disabled=false; convertButton.removeAttribute('title'); convertButton.addEventListener('click',function () { convert(doc); }); }
    if (type !== 'invoice' && document.querySelector('.sales-convert')) document.querySelector('.sales-convert').insertAdjacentHTML('beforebegin',sourceLinks(doc));
    var fiscal=document.querySelector('[data-edit-fiscal]'); if (fiscal) fiscal.addEventListener('click',function () { editFiscal(doc); });
    var credit=document.querySelector('[data-approve-credit]'); if (credit) credit.addEventListener('click',function () { try { GT.invoices.approveCredit(doc.id); GT.components.showToast('Credit override approved.','success'); GT.app.renderPage(); } catch(error) { GT.components.showToast(error.message,'error'); } });
    var approve=document.querySelector('[data-approve]'),reject=document.querySelector('[data-reject]');
    if (approve) approve.addEventListener('click',function () { try { service.approveDiscount(doc.id); GT.components.showToast('Discount approved.','success'); GT.app.renderPage(); } catch(error) { GT.components.showToast(error.message,'error'); } });
    if (reject) reject.addEventListener('click',function () { try { service.rejectDiscount(doc.id); GT.components.showToast('Discount rejected.','info'); GT.app.renderPage(); } catch(error) { GT.components.showToast(error.message,'error'); } });
  }
  function render(view,params) {
    var parts=view.split(':'), type=parts[0], page=parts[1]; currentType=type;
    if (page==='list') return makeList(type);
    if (page==='new') return formMarkup(type);
    var doc=GT.store.find('sales_documents',params.id);
    if (!doc||doc.type!==type||!service.mayView(doc)) return '<section class="page-placeholder"><h1>Access denied</h1><p>This document is unavailable.</p></section>';
    if (page==='edit') return service.canEdit(doc) ? formMarkup(type,doc) : '<section class="page-placeholder"><h1>Document locked</h1><p>Duplicate it as a new draft to make changes.</p></section>';
    return detailMarkup(type,params.id);
  }
  function bind(view,params) { var parts=view.split(':'),type=parts[0],page=parts[1]; if (page==='list') table.mount('#salesListMount'); else if (page==='new') bindForm(type,null); else if (page==='edit') { var doc=GT.store.find('sales_documents',params.id); if (doc&&service.canEdit(doc)) bindForm(type,doc); } else bindDetail(type,params.id); }
  var api={render:render,bind:bind,printMarkup:printMarkup};
  Object.keys(service.types).forEach(function (type) {
    var cfg=config(type); [cfg.route,cfg.shortRoute].forEach(function (base) {
      GT.router.register(base,{module:api,view:type+':list',title:cfg.plural,permission:cfg.permission,action:'V',baseRoute:cfg.route});
      GT.router.register(base+'/new',{module:api,view:type+':new',title:'New '+cfg.label,permission:cfg.permission,action:'C',baseRoute:cfg.route});
      GT.router.register(base+'/:id/edit',{module:api,view:type+':edit',title:'Edit '+cfg.label,permission:cfg.permission,action:'C',baseRoute:cfg.route});
      GT.router.register(base+'/:id',{module:api,view:type+':detail',title:cfg.label+' Details',permission:cfg.permission,action:'V',baseRoute:cfg.route});
    });
  });
  return api;
}());
