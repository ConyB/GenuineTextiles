/* Phase 15 expense register, form, decisions and A4 voucher. */
window.GT.expenseModule = (function () {
  var GT = window.GT, table, sections, photoData = '', photoPending = false;
  function esc(value) { return GT.components.escapeHtml(value); }
  function money(value) { return GT.format.formatMoney(value); }
  function person(id) { var row = GT.store.find('users', id); return row ? row.name : 'Unknown'; }
  function category(id) { var row = GT.store.find('expense_categories', id); return row ? row.name : 'Unknown'; }
  function displayRows() { return GT.expenses.list().map(function (row) { return Object.assign({}, row, {
    category_name:category(row.category_id), recorded_name:person(row.recorded_by) }); }); }
  function badge(row) { return GT.components.statusBadge(row.status, row.status === 'approved' ? 'success' :
    row.status === 'cancelled' || row.status === 'rejected' ? 'danger' : row.status === 'pending' ? 'warning' : 'neutral'); }
  function cards() { var rows = displayRows(), today = GT.dates.today(), month = today.slice(0, 7), quick = table.state.filters.quick || '';
    function card(label, value, key, icon, tone) { return { label:label, value:value, icon:icon, tone:tone,
      filterKey:key, active:quick === key, onClick:function () { table.toggleFilter('quick', key); } }; }
    return [card('Approved this month',money(GT.expenses.approvedTotal(month+'-01',GT.dates.endOfMonth(today))),'month','banknote','brand'),
      card('Pending approval',rows.filter(function (row) { return row.status === 'pending'; }).length,'pending','clock-3','warning'),
      card('Rejected',rows.filter(function (row) { return row.status === 'rejected'; }).length,'rejected','circle-x','danger')]; }
  function refreshCards() { var mount = document.getElementById('expenseStats'); if (!mount) return;
    mount.innerHTML = GT.statCards.render(cards()); GT.statCards.bind(mount, cards()); GT.components.refreshIcons(); }
  function list() {
    table = GT.dataTable.create({ id:'expensesTable', caption:'Expenses', rows:displayRows,
      searchFields:['payee','description','category_name','recorded_name','voucher_number'],
      filters:[{name:'date_from',label:'From date',type:'date',test:function (row, value) { return row.expense_date >= value; }},
        {name:'date_to',label:'To date',type:'date',test:function (row, value) { return row.expense_date <= value; }},
        {name:'category',label:'Category',field:'category_id',options:GT.store.all('expense_categories').map(function (row) { return {value:String(row.id),label:row.name}; })},
        {name:'status',label:'Status',field:'status',options:['draft','pending','approved','rejected','cancelled'].map(function (value) { return {value:value,label:value}; })},
        {name:'quick',label:'Quick filter',options:[{value:'month',label:'Approved this month'},{value:'pending',label:'Pending'},{value:'rejected',label:'Rejected'}],
          test:function (row, value) { return value === 'month' ? row.status === 'approved' && row.expense_date.slice(0,7) === GT.dates.today().slice(0,7) : row.status === value; }}],
      columns:[{label:'Date',field:'expense_date',sortable:true,formatter:GT.dates.formatDate,exportValue:function (row) { return row.expense_date; }},
        {label:'Category',field:'category_name',sortable:true},{label:'Description',field:'description',priority:1},
        {label:'Amount',field:'amount',align:'right',numeric:true,sortable:true,formatter:money},
        {label:'Paid from',field:'payment_method',priority:2},{label:'Recorded by',field:'recorded_name',priority:2},
        {label:'Status',field:'status',html:true,formatter:function (value, row) { return badge(row); },exportValue:function (row) { return row.status; }}],
      actions:[{label:'View',icon:'eye',primary:true,onClick:function (row) { location.hash = '#/finance/expenses/'+row.id; }}],
      onRowClick:function (row) { location.hash = '#/finance/expenses/'+row.id; },
      emptyState:{message:'No expenses match these filters.'},exportName:'expenses.csv',onStateChange:refreshCards });
    return '<section class="expense-page">'+GT.components.pageHeader({title:'Expenses',description:'Record and approve money going out.',
      actions:GT.permissions.can('expenses','C')?[{label:'New expense',icon:'plus',route:'#/finance/expenses/new'}]:[]})+
      '<div id="expenseStats"></div><div id="expenseListMount"></div></section>';
  }
  function formSections() { return [{title:'Expenditure',fields:[
    {name:'expense_date',label:'Date',type:'date',required:true},
    {name:'category_id',label:'Category',type:'select',valueType:'number',required:true,
      options:GT.store.all('expense_categories').map(function (row) { return {value:row.id,label:row.name}; })},
    {name:'payee',label:'Paid to',type:'text',required:true},
    {name:'amount',label:'Amount (UGX)',type:'money',required:true},
    {name:'payment_method',label:'Paid from',type:'select',required:true,options:[{value:'cash',label:'Cash'},{value:'bank',label:'Bank'}]},
    {name:'description',label:'Description',type:'textarea',required:true,fullWidth:true}
  ]}]; }
  function form() { sections = formSections(); return '<section class="expense-page">'+
    GT.components.pageHeader({title:'New expense',description:'A voucher number is assigned after Owner approval.'})+
    GT.forms.render({id:'expenseForm',sections:sections,values:{expense_date:GT.dates.today(),payment_method:'cash'},submitLabel:'Submit for approval',cancelRoute:'#/finance/expenses'})
      .replace('<div class="form-actions">','<fieldset class="form-section"><legend>Receipt</legend><div class="form-field"><label class="form-label" for="expensePhoto">Receipt photo (optional)</label><input class="form-control" id="expensePhoto" type="file" accept="image/*"><p class="field-help">Compressed to 800px and kept in this prototype.</p><p class="field-error" id="expensePhotoError"></p><img class="expense-photo-preview" id="expensePhotoPreview" alt="Selected receipt photo" hidden></div></fieldset><div class="form-actions">')+
    '<button class="btn btn-outline-secondary" type="button" id="saveExpenseDraft">Save draft</button></section>'; }
  function bindForm() { var form = document.getElementById('expenseForm'), dirty = GT.forms.trackDirty(form);
    photoData=''; photoPending=false;
    document.getElementById('expensePhoto').addEventListener('change',function () { var file=this.files[0], error=document.getElementById('expensePhotoError');
      photoData=''; error.textContent=''; if (!file) return; photoPending=true;
      GT.files.compressImage(file,800).then(function (data) { photoData=data; var preview=document.getElementById('expensePhotoPreview'); preview.src=data; preview.hidden=false; })
        .catch(function (failure) { error.textContent=failure.message; }).finally(function () { photoPending=false; });
    });
    function save(submit) { try { if (photoPending) throw new Error('Wait for the receipt photo to finish loading.');
        if (document.getElementById('expensePhotoError').textContent) throw new Error('Correct the receipt photo.');
        var values = GT.forms.read(form, sections); values.receipt_photo_path=photoData; var errors = GT.expenses.validate(values);
        if (!GT.forms.showErrors(form, errors)) return;
        var row = GT.expenses.save(values, submit); dirty.markSaved();
        GT.components.showToast(submit ? 'Expense sent for approval.' : 'Expense draft saved.','success');
        location.hash = '#/finance/expenses/'+row.id;
      } catch (error) { GT.components.showToast(error.message,'error'); } }
    form.addEventListener('submit',function (event) { event.preventDefault(); save(true); });
    document.getElementById('saveExpenseDraft').addEventListener('click',function () { save(false); });
  }
  function detail(params) { var row = GT.store.find('expenses', params.id);
    if (!row || row.status === 'discarded') return GT.components.pageHeader({title:'Expense unavailable',description:'The record is unavailable.'});
    var actions = [];
    if (row.status === 'draft') { actions.push({label:'Submit',name:'submit',icon:'send'}); actions.push({label:'Discard draft',name:'discard',icon:'trash-2',className:'btn-outline-danger'}); }
    if (row.status === 'pending' && GT.session.currentUser().role === 'owner') { actions.push({label:'Approve',name:'approve',icon:'check'}); actions.push({label:'Reject',name:'reject',icon:'x',className:'btn-outline-danger'}); }
    if (row.voucher_number) actions.push({label:'Print voucher',name:'print',icon:'printer'});
    if (row.status === 'approved' && GT.session.currentUser().role === 'owner') actions.push({label:'Cancel expense',name:'cancel',icon:'ban',className:'btn-outline-danger'});
    return '<section class="expense-page">'+GT.components.pageHeader({title:row.voucher_number?'Expense voucher '+row.voucher_number:'Expense request '+row.id,
      description:GT.dates.formatDate(row.expense_date)+' · '+category(row.category_id),badge:badge(row),actions:actions})+
      '<div class="detail-card"><h2>Payment</h2><dl class="detail-grid">'+
      GT.components.detailRow('Paid to',row.payee)+GT.components.detailRow('Description',row.description)+
      GT.components.detailRow('Amount',money(row.amount))+GT.components.detailRow('Paid from',row.payment_method)+
      GT.components.detailRow('Recorded by',person(row.recorded_by))+GT.components.detailRow('Approved by',row.approved_by?person(row.approved_by):'Awaiting approval')+
      (row.rejection_reason?GT.components.detailRow('Rejection reason',row.rejection_reason):'')+
      (row.cancellation_reason?GT.components.detailRow('Cancellation reason',row.cancellation_reason):'')+
      '</dl>'+(row.receipt_photo_path?'<button class="expense-photo-button" type="button" id="openExpensePhoto"><img src="'+esc(row.receipt_photo_path)+'" alt="Receipt photo thumbnail"></button>':'')+'</div></section>';
  }
  function voucher(row) { var cancelled = row.status === 'cancelled';
    return GT.print.letterhead()+(cancelled?GT.print.watermark('VOID'):'')+
      '<div class="print-document-heading"><span>No. '+esc(row.voucher_number)+'</span><h2>PAYMENT VOUCHER</h2><span>'+esc(GT.dates.formatDate(row.expense_date))+'</span></div>'+
      '<div class="print-document-body"><p><strong>Paid to:</strong> '+esc(row.payee)+'</p><p><strong>Category:</strong> '+esc(category(row.category_id))+'</p>'+
      '<p><strong>Being payment for:</strong> '+esc(row.description)+'</p><p><strong>Paid from:</strong> '+esc(row.payment_method.toUpperCase())+'</p>'+
      '<p><strong>Amount:</strong> '+esc(money(row.amount))+'</p><p><strong>Amount in words:</strong> '+esc(GT.format.amountInWords(row.amount))+'</p>'+
      (cancelled?'<p><strong>Cancelled:</strong> '+esc(row.cancellation_reason)+'</p>':'')+'</div>'+
      '<div class="print-keep-together">'+GT.print.signatureBlock(['Recorded by: '+person(row.recorded_by),'Approved by: '+person(row.approved_by),'Received by'])+'</div>';
  }
  function decision(title, callback) { GT.components.openModal({title:title,content:'<label class="form-label" for="expenseDecisionReason">Reason</label><textarea class="form-control" id="expenseDecisionReason"></textarea><p class="field-error" id="expenseDecisionError" role="alert"></p><div class="gt-modal-actions"><button class="btn btn-primary" id="expenseDecisionSave" type="button">Confirm</button></div>'});
    document.getElementById('expenseDecisionSave').addEventListener('click',function () { try { callback(document.getElementById('expenseDecisionReason').value);
      GT.components.closeModal(); GT.components.showToast('Expense decision recorded.','success'); GT.app.renderPage(); GT.app.refreshChrome();
    } catch (error) { document.getElementById('expenseDecisionError').textContent=error.message; } }); }
  function bindDetail(params) { var row = GT.store.find('expenses', params.id); if (!row) return;
    var photo=document.getElementById('openExpensePhoto'); if (photo) photo.addEventListener('click',function () { GT.components.openModal({title:'Receipt photo',content:'<img class="expense-photo-large" src="'+esc(row.receipt_photo_path)+'" alt="Receipt photo">'}); });
    document.querySelectorAll('[data-page-action]').forEach(function (button) { button.addEventListener('click',function () { var action = button.dataset.pageAction;
      if (action === 'print') GT.print.open(voucher(row),'Payment voucher '+row.voucher_number);
      else if (action === 'approve') decision('Approve expense',function (reason) { GT.expenses.decide(row.id,true,reason); });
      else if (action === 'reject') decision('Reject expense',function (reason) { GT.expenses.decide(row.id,false,reason); });
      else if (action === 'cancel') decision('Cancel approved expense',function (reason) { GT.expenses.cancel(row.id,reason); });
      else if (action === 'submit') { GT.expenses.submit(row.id); GT.components.showToast('Expense sent for approval.','success'); GT.app.renderPage(); }
      else if (action === 'discard') GT.components.confirmDialog({title:'Discard draft?',message:'This unnumbered draft will be archived.',confirmText:'Discard'}).then(function (confirmed) {
        if (confirmed) { GT.expenses.discard(row.id); location.hash='#/finance/expenses'; }
      });
    }); }); }
  var api = {render:function (view,params) { return view==='list'?list():view==='new'?form():detail(params); },
    bind:function (view,params) { if (view==='list') { table.mount('#expenseListMount'); refreshCards(); } else if (view==='new') bindForm(); else bindDetail(params); }, voucher:voucher};
  GT.router.register('#/finance/expenses',{module:api,view:'list',title:'Expenses',permission:'expenses'});
  GT.router.register('#/finance/expenses/new',{module:api,view:'new',title:'New Expense',permission:'expenses',action:'C',baseRoute:'#/finance/expenses'});
  GT.router.register('#/finance/expenses/:id',{module:api,view:'detail',title:'Expense',permission:'expenses',baseRoute:'#/finance/expenses'});
  return api;
}());
