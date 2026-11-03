/* Statement register, issue form and locked letter: DOCUMENT_TEMPLATES.md section 6. */
window.GT = window.GT || {};
window.GT.statementModule = (function () {
  var GT=window.GT,table,lineTable,tracker,fields;
  function esc(v) { return GT.components.escapeHtml(v); }
  function money(v) { return GT.format.formatMoney(v); }
  function clientName(id) { var row=GT.store.find('customers',id); return row?row.name:'Unknown'; }
  function userName(id) { var row=GT.store.find('users',id); return row?row.name:'Unknown'; }
  function dateDots(value) { var date=String(value||''); return date.slice(8,10)+'.'+date.slice(5,7)+'.'+date.slice(0,4); }
  function linesOf(row) { return Array.isArray(row.lines_json)?row.lines_json:[]; }
  function printMarkup(row) {
    var lines=linesOf(row).map(function (line) { return '<tr><td>'+esc(line.document_ref)+'</td><td>'+esc(line.particulars)+'</td><td>'+dateDots(line.delivery_date)+'</td><td class="amount">'+money(line.gross_amount)+'</td><td class="amount">'+(line.advance?money(line.advance):'—')+'</td><td class="amount">'+money(line.amount_due)+'</td></tr>'; }).join('');
    var phones=GT.settings.phones.map(esc).join(' · ');
    return GT.print.letterhead()+'<div class="statement-brand-stripe"></div>'+(row.status==='void'?GT.print.watermark('VOID'):'')+
      '<div class="statement-date">'+dateDots(row.statement_date)+'</div><div class="statement-addressee">'+esc(row.addressee_title)+'<br>'+esc(row.addressee_name)+'</div><p>Dear Sir / Madam</p><p class="statement-subject"><u>REF: STATEMENT OF ACCOUNT</u></p><p>'+esc(row.intro_text)+'</p>'+
      '<table class="statement-letter-table"><thead><tr><th>Fiscal Document Number</th><th>Particulars</th><th>Delivery Date</th><th>Gross Amount</th><th>Advance</th><th>Gross Amount Due</th></tr></thead><tbody>'+lines+'</tbody><tfoot><tr class="print-keep-together"><th colspan="5">TOTAL GROSS AMOUNT DUE</th><th class="amount">'+money(row.total_due)+'</th></tr></tfoot></table>'+
      '<div class="statement-signoff print-keep-together"><p>Yours faithfully,</p><strong>'+esc(row.signatory_name||GT.settings.authorisedSignatory)+'</strong><span>Authorised Signature</span></div><div class="statement-footer">'+phones+'</div>';
  }
  function print(row) {
    var preview=GT.print.open(printMarkup(row),'STATEMENT OF ACCOUNT');
    if (/ENTER /.test(GT.settings.tin+' '+GT.settings.bank.accountNumber)) {
      var warning=document.createElement('p'); warning.className='print-placeholder-warning'; warning.textContent='Prototype settings include placeholder business details.'; preview.insertBefore(warning,preview.querySelector('.print-page'));
    }
  }
  function voidPrompt(row) {
    GT.components.openModal({title:'Void statement',content:'<label class="form-label" for="statementVoidReason">Reason</label><textarea class="form-control" id="statementVoidReason"></textarea><p class="field-error" id="statementVoidError"></p><div class="gt-modal-actions"><button class="btn btn-outline-danger" type="button" id="statementVoidSave">Void statement</button></div>'});
    document.getElementById('statementVoidSave').addEventListener('click',async function () {
      var reason=document.getElementById('statementVoidReason').value.trim(); if (!reason) { document.getElementById('statementVoidError').textContent='A reason is required.'; return; }
      if (!await GT.components.confirmDialog({title:'Confirm void',message:'Keep this statement in history with a VOID watermark?',confirmText:'Void'})) return;
      try { GT.debtors.voidStatement(row.id,reason); GT.components.showToast('Statement voided.','success'); GT.app.renderPage(); }
      catch(error) { GT.components.showToast(error.message,'error'); }
    });
  }
  function records() { return GT.store.all('statements').map(function (row) { return Object.assign({},row,{customer_name:clientName(row.customer_id),created_by_name:userName(row.created_by),invoice_count:linesOf(row).length}); }).sort(function (a,b) { return b.statement_date.localeCompare(a.statement_date); }); }
  function list() {
    table=GT.dataTable.create({id:'statementsTable',rows:records,searchFields:['customer_name'],
      filters:[{name:'customer',label:'Customer',field:'customer_id',options:GT.store.all('customers').map(function (row) { return {value:row.id,label:row.name}; })},
        {name:'status',label:'Status',field:'status',options:[{value:'issued',label:'Issued'},{value:'void',label:'Void'}]},
        {name:'date_from',label:'From date',type:'date',test:function (row,v) { return row.statement_date>=v; }},
        {name:'date_to',label:'To date',type:'date',test:function (row,v) { return row.statement_date<=v; }}],
      columns:[{label:'Date',field:'statement_date',sortable:true,formatter:GT.dates.formatDate,priority:1},
        {label:'Customer',field:'customer_name',sortable:true,priority:1},{label:'Invoices',field:'invoice_count',align:'right',numeric:true,priority:2},
        {label:'Total due',field:'total_due',align:'right',numeric:true,sortable:true,formatter:money,priority:1},
        {label:'Created by',field:'created_by_name',priority:2},{label:'Status',field:'status',html:true,formatter:function (v) { return GT.components.statusBadge(v==='void'?'Void':'Issued',v==='void'?'danger':'info'); },priority:1}],
      actions:[{label:'View',icon:'eye',primary:true,onClick:function (row) { location.hash='#/statements/'+row.id; }},
        {label:'Print',icon:'printer',primary:true,onClick:print},
        {label:'Void',icon:'ban',destructive:true,show:function (row) { return row.status==='issued'&&['owner','general_manager'].indexOf(GT.session.currentUser().role)!==-1; },onClick:voidPrompt}],
      emptyState:{message:'No statements match the filters.'},exportName:'statements.csv'});
    return '<section class="debtors-page">'+GT.components.pageHeader({title:'Statements of Account',description:'Issued letters remain in the record.',actions:[{label:'Create statement',route:'#/statements/new',icon:'plus',permission:'debtors',permissionAction:'C'}]})+'<div id="statementsMount"></div></section>';
  }
  function chosenCustomer() { return Number(new URLSearchParams(String(location.hash).split('?')[1]||'').get('customer'))||0; }
  function chosenInvoices() { var raw=new URLSearchParams(String(location.hash).split('?')[1]||'').get('invoices'); return raw?raw.split(',').map(Number):null; }
  function customerOptions() { return GT.debtors.list().map(function (row) { return {value:row.id,label:row.name}; }); }
  function form() {
    var customerId=chosenCustomer(), draft=customerId?GT.debtors.buildStatement(customerId,chosenInvoices()):null;
    fields=[{title:'Statement letter',fields:[
      {name:'customer_id',label:'Customer',type:'select',valueType:'number',required:true,options:customerOptions()},
      {name:'statement_date',label:'Statement date',type:'date',required:true},
      {name:'addressee_title',label:'Addressee title',type:'text',required:true},
      {name:'addressee_name',label:'Addressee name',type:'text',required:true},
      {name:'intro_text',label:'Intro paragraph',type:'textarea',required:true,fullWidth:true},
      {name:'signatory_name',label:'Signatory',type:'text',required:true}
    ]}];
    var values=draft||{customer_id:'',statement_date:GT.dates.today(),addressee_title:'The Finance Manager',addressee_name:'',intro_text:'We kindly request payment for the goods already supplied, as stated with reference to the document numbers below.',signatory_name:GT.settings.authorisedSignatory};
    return '<section class="debtors-page">'+GT.components.pageHeader({title:'Create statement',description:'The letter is issued and locked on save.'})+'<div class="statement-mobile-tabs">'+GT.components.tabs([{id:'statementFormPanel',label:'Form'},{id:'statementPreviewPanel',label:'Preview'}],'statementFormPanel')+'</div><div class="statement-form-layout"><div id="statementFormPanel">'+GT.forms.render({id:'statementForm',sections:fields,values:values,submitLabel:'Save',cancelRoute:'#/statements'})+'<div class="detail-card"><h2>Invoices to include</h2><div id="statementLinesMount"></div><p id="statementFormTotal"></p></div><button class="btn btn-outline-primary" type="button" id="statementSavePrint">Save and print</button></div><aside id="statementPreviewPanel" class="detail-card statement-live"><h2>Live preview</h2><div id="statementLivePage" class="print-page"></div></aside></div></section>';
  }
  function lineRows(id) { return GT.debtors.openInvoices(id).map(function (doc) { var built=GT.debtors.buildStatement(id,[doc.id]).lines_json[0]; return Object.assign({},built,{number:doc.number}); }); }
  function mountLines(id) {
    var mount=document.getElementById('statementLinesMount'); if (!mount) return;
    if (!id) { mount.innerHTML='<p>Choose a debtor to see open invoices.</p>'; return; }
    lineTable=GT.dataTable.create({id:'statementLinesTable',rows:lineRows(id),searchFields:['document_ref'],columns:[
      {label:'Include',field:'invoice_id',html:true,formatter:function (v) { return '<input type="checkbox" data-statement-check value="'+v+'" checked aria-label="Include invoice">'; },export:false},
      {label:'Document',field:'document_ref',priority:1},
      {label:'Particulars',field:'particulars',html:true,formatter:function (v,row) { return '<input class="form-control" data-statement-particulars="'+row.invoice_id+'" value="'+esc(v)+'" aria-label="Particulars for '+esc(row.document_ref)+'">'; },exportValue:function (row) { return row.particulars; },priority:1},
      {label:'Delivery date',field:'delivery_date',html:true,formatter:function (v,row) { return '<input class="form-control" type="date" data-statement-date="'+row.invoice_id+'" value="'+esc(v)+'" aria-label="Delivery date for '+esc(row.document_ref)+'">'; },priority:1},
      {label:'Gross',field:'gross_amount',align:'right',numeric:true,formatter:money,priority:2},
      {label:'Advance',field:'advance',align:'right',numeric:true,formatter:money,priority:2},
      {label:'Due',field:'amount_due',align:'right',numeric:true,formatter:money,priority:1}],emptyState:{message:'No open invoices.'},exportName:'statement-lines.csv'});
    lineTable.state.pageSize=50; lineTable.mount(mount);
  }
  function readDraft() {
    var form=document.getElementById('statementForm'), values=GT.forms.read(form,fields), id=Number(values.customer_id);
    if (!id) return null;
    var selected=Array.from(document.querySelectorAll('#statementLinesMount [data-statement-check]:checked')).map(function (node) { return Number(node.value); });
    if (!selected.length) return null;
    var draft=GT.debtors.buildStatement(id,selected);
    draft.lines_json.forEach(function (line) { var particulars=document.querySelector('[data-statement-particulars="'+line.invoice_id+'"]'), date=document.querySelector('[data-statement-date="'+line.invoice_id+'"]'); if (particulars) line.particulars=particulars.value; if (date) line.delivery_date=date.value; });
    return Object.assign(draft,values,{customer_id:id,status:'issued'});
  }
  function refreshPreview() { var draft=readDraft(), preview=document.getElementById('statementLivePage'); if (!preview) return; preview.innerHTML=draft?printMarkup(draft):'<p>Choose a debtor and at least one invoice.</p>'; document.getElementById('statementFormTotal').textContent=draft?'Total gross amount due: '+money(draft.total_due):''; }
  function bindForm() {
    var form=document.getElementById('statementForm'); tracker=GT.forms.trackDirty(form);
    mountLines(Number(form.elements.customer_id.value));
    form.elements.customer_id.addEventListener('change',function () { var selected=GT.store.find('customers',this.value); form.elements.addressee_name.value=selected?selected.name:''; mountLines(Number(this.value)); refreshPreview(); });
    document.querySelector('.statement-form-layout').addEventListener('input',refreshPreview);
    document.querySelector('.statement-form-layout').addEventListener('change',refreshPreview);
    document.querySelectorAll('.statement-mobile-tabs [data-tab-target]').forEach(function (tab) { tab.addEventListener('click',function () { document.querySelectorAll('.statement-mobile-tabs [data-tab-target]').forEach(function (item) { item.classList.toggle('active',item===tab); item.setAttribute('aria-selected',String(item===tab)); }); document.querySelector('.statement-form-layout').classList.toggle('show-preview',tab.dataset.tabTarget==='statementPreviewPanel'); }); });
    function save(andPrint) {
      var draft=readDraft(); if (!draft) { GT.components.showToast('Choose a debtor and at least one invoice.','error'); return; }
      var errors={}; ['statement_date','addressee_title','addressee_name','intro_text','signatory_name'].forEach(function (key) { if (!String(draft[key]||'').trim()) errors[key]='Required.'; });
      if (draft.statement_date>GT.dates.today()) errors.statement_date='Date cannot be in the future.';
      if (!GT.forms.showErrors(form,errors)) return;
      try { var saved=GT.debtors.saveStatement(draft); tracker.markSaved(); GT.components.showToast('Statement issued.','success'); location.hash='#/statements/'+saved.id; if (andPrint) print(saved); }
      catch(error) { GT.components.showToast(error.message,'error'); }
    }
    form.addEventListener('submit',function (event) { event.preventDefault(); save(false); });
    document.getElementById('statementSavePrint').addEventListener('click',function () { save(true); });
    refreshPreview();
  }
  function detail(params) {
    var row=GT.store.find('statements',params.id);
    if (!row) return '<section>'+GT.components.pageHeader({title:'Statement not found'})+'</section>';
    return '<section class="debtors-page">'+GT.components.pageHeader({title:'Statement of Account',description:clientName(row.customer_id)+' · '+GT.dates.formatDate(row.statement_date),badge:GT.components.statusBadge(row.status==='void'?'Void':'Issued',row.status==='void'?'danger':'info'),actions:[{label:'Print',name:'print',icon:'printer'}].concat(row.status==='issued'&&['owner','general_manager'].indexOf(GT.session.currentUser().role)!==-1?[{label:'Void',name:'void',icon:'ban',className:'btn-outline-danger'}]:[])})+'<div class="statement-detail-page print-page">'+printMarkup(row)+'</div></section>';
  }
  function bind(view,params) {
    if (view==='list') { table.mount('#statementsMount'); return; }
    if (view==='new') { bindForm(); return; }
    var row=GT.store.find('statements',params.id); if (!row) return;
    document.querySelector('[data-page-action="print"]').addEventListener('click',function () { print(row); });
    var voidButton=document.querySelector('[data-page-action="void"]'); if (voidButton) voidButton.addEventListener('click',function () { voidPrompt(row); });
  }
  var api={render:function (view,params) { return view==='list'?list():view==='new'?form():detail(params); },bind:bind,print:print};
  GT.router.register('#/statements',{module:api,view:'list',title:'Statements of Account',permission:'debtors',baseRoute:'#/statements'});
  GT.router.register('#/statements/new',{module:api,view:'new',title:'Create Statement',permission:'debtors',action:'C',baseRoute:'#/statements'});
  GT.router.register('#/statements/:id',{module:api,view:'detail',title:'Statement of Account',permission:'debtors',baseRoute:'#/statements'});
  return api;
}());
