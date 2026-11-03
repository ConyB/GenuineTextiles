/* Delivery note screens: PAGE_PATTERNS.md and BUSINESS_RULES.md section 9 (A-49 to A-56). */
window.GT = window.GT || {};
window.GT.deliveryModule = (function () {
  var GT=window.GT, table, lineEditor, formSections, tracker, activeInvoiceId;
  var methodNames={delivered_by_us:'Delivered by us',collected_by_customer:'Collected by customer',courier:'Courier'};
  var statusNames={draft:'Draft',issued:'Issued',delivered:'Delivered',void:'Void'};
  function esc(value) { return GT.components.escapeHtml(value); }
  function user() { return GT.session.currentUser(); }
  function manager() { return ['owner','general_manager'].indexOf(user().role)!==-1; }
  function showMoney() { return ['store_keeper','workshop_supervisor'].indexOf(user().role)===-1; }
  function label(value, names) { return names[value] || value || '—'; }
  function person(id) { var row=GT.store.find('users',id); return row?row.name:'—'; }
  function badge(value) { return GT.components.statusBadge(label(value,statusNames),value==='delivered'?'success':value==='issued'?'info':value==='void'?'danger':'neutral'); }
  function route(id) { return '#/delivery-notes/'+id; }
  function currentNote(id) { var row=GT.store.find('delivery_notes',id); return row && GT.deliveries.canView(row) && !row.discarded_at ? row : null; }
  function invoice(id) { var row=GT.store.find('sales_documents',id); return row && row.type==='invoice'?row:null; }
  function customer(id) { return GT.store.find('customers',id); }
  function invoiceLink(row) {
    var doc=invoice(row.invoice_id), number=doc?doc.number:'—';
    return doc && GT.permissions.can('invoices','V') && GT.salesDocs.mayView(doc) ? '<a href="#/invoices/'+doc.id+'">'+esc(number)+'</a>' : esc(number);
  }
  function release(row) {
    if (row.status==='void') return {status:'cleared',reason:'Delivery note voided.'};
    var approved=GT.deliveries.approvalFor(row.id,'approved');
    return approved ? {status:'cleared',reason:'Release approved.'} : GT.deliveries.releaseCheck(row.invoice_id);
  }
  function visibleRows() {
    return GT.deliveries.list().map(function (row) {
      var doc=invoice(row.invoice_id), client=customer(row.customer_id), check=release(row);
      return Object.assign({},row,{customer_name:client?client.name:'Unknown',invoice_number:doc?doc.number:'',
        number_label:row.number||'Draft',method_label:label(row.delivery_method,methodNames),
        item_count:GT.deliveries.noteLines(row.id).filter(function (item) { return Number(item.qty_dispatched)>0; }).length,
        release_status:check.status,dispatched_name:row.dispatched_by?person(row.dispatched_by):'—'});
    }).sort(function (a,b) { return (b.delivery_date||'').localeCompare(a.delivery_date||'') || b.id-a.id; });
  }
  function toDeliverCount() {
    return GT.store.all('sales_documents').filter(function (doc) {
      return doc.type==='invoice' && doc.status==='issued' &&
        (user().role!=='sales' || Number(doc.created_by)===Number(user().id)) &&
        GT.deliveries.summary(doc.id).lines.some(function (line) { return line.remaining>0; });
    }).length;
  }
  function cardRows() {
    var notes=visibleRows(), month=GT.dates.today().slice(0,7), selected=table.state.filters.card||'';
    function card(name,value,filter,icon,tone) { return {label:name,value:value,icon:icon,tone:tone,filterKey:'card',active:selected===filter,
      onClick:function () { table.toggleFilter('card',filter); }}; }
    return [card('To deliver',toDeliverCount(),'to_deliver','truck','warning'),
      card('Awaiting confirmation',notes.filter(function (row) { return row.status==='issued'; }).length,'awaiting_confirmation','clipboard-check','info'),
      card('Awaiting release approval',notes.filter(function (row) { return row.status==='draft' && GT.deliveries.approvalFor(row.id,'requested'); }).length,'awaiting_release','shield-alert','danger'),
      card('Delivered this month',notes.filter(function (row) { return row.status==='delivered' && String(row.received_date).slice(0,7)===month; }).length,'delivered_month','calendar-check','success')];
  }
  function updateCards() {
    var mount=document.getElementById('deliveryStats'); if (!mount) return;
    mount.innerHTML=GT.statCards.render(cardRows());
    if (!mount.dataset.bound) { GT.statCards.bind(mount,cardRows()); mount.dataset.bound='true'; }
    GT.components.refreshIcons();
  }
  function cardTest(row,value) {
    if (value==='to_deliver') return invoice(row.invoice_id).status==='issued' && GT.deliveries.summary(row.invoice_id).lines.some(function (line) { return line.remaining>0; });
    if (value==='awaiting_confirmation') return row.status==='issued';
    if (value==='awaiting_release') return row.status==='draft' && !!GT.deliveries.approvalFor(row.id,'requested');
    if (value==='delivered_month') return row.status==='delivered' && String(row.received_date).slice(0,7)===GT.dates.today().slice(0,7);
    return true;
  }
  function listPage() {
    table=GT.dataTable.create({id:'deliveryNotesTable',caption:'Delivery notes',rows:visibleRows,
      searchFields:['number_label','customer_name'],searchPlaceholder:'Search number or customer',
      filters:[{name:'status',label:'Status',field:'status',options:Object.keys(statusNames).map(function (key) { return {value:key,label:statusNames[key]}; })},
        {name:'method',label:'Method',field:'delivery_method',options:Object.keys(methodNames).map(function (key) { return {value:key,label:methodNames[key]}; })},
        {name:'customer',label:'Customer',field:'customer_id',options:GT.customers.options()},
        {name:'date_from',label:'From date',type:'date',test:function (row,value) { return row.delivery_date>=value; }},
        {name:'date_to',label:'To date',type:'date',test:function (row,value) { return row.delivery_date<=value; }},
        {name:'card',label:'Quick filter',options:[{value:'to_deliver',label:'To deliver'},{value:'awaiting_confirmation',label:'Awaiting confirmation'},
          {value:'awaiting_release',label:'Awaiting release approval'},{value:'delivered_month',label:'Delivered this month'}],test:cardTest}],
      columns:[{label:'Number',field:'number_label',sortable:true,priority:1},
        {label:'Date',field:'delivery_date',sortable:true,priority:1,formatter:GT.dates.formatDate},
        {label:'Customer',field:'customer_name',sortable:true,priority:1,minWidth:160},
        {label:'Invoice',field:'invoice_number',priority:2,html:true,formatter:function (_,row) { return invoiceLink(row); },exportValue:function (row) { return row.invoice_number; }},
        {label:'Method',field:'method_label',priority:2},
        {label:'Items',field:'item_count',priority:2,align:'right',numeric:true},
        {label:'Status',field:'status',priority:1,html:true,formatter:badge,exportValue:function (row) { return label(row.status,statusNames); }},
        {label:'Release',field:'release_status',priority:2,html:true,formatter:function (value) { return GT.components.statusBadge(value==='cleared'?'Cleared':'Approval needed',value==='cleared'?'success':'warning'); },exportValue:function (row) { return row.release_status==='cleared'?'Cleared':'Approval needed'; }},
        {label:'Dispatched by',field:'dispatched_name',priority:3}],
      actions:[{label:'View',icon:'eye',primary:true,onClick:function (row) { location.hash=route(row.id); }},
        {label:'Print',icon:'printer',primary:true,onClick:print},
        {label:'Confirm delivery',icon:'check',show:canConfirm,onClick:openConfirm},
        {label:'Duplicate as new draft',icon:'copy',show:function (row) { return GT.permissions.can('delivery_notes','C') &&
          invoice(row.invoice_id).status==='issued' && GT.deliveries.summary(row.invoice_id).lines.some(function (line) { return line.remaining>0; }); },onClick:duplicate},
        {label:'Void',icon:'ban',destructive:true,show:function (row) { return manager() && ['draft','issued'].indexOf(row.status)!==-1; },onClick:openVoid}],
      emptyState:{message:'No delivery notes match the current filters.'},exportName:'delivery-notes.csv',onStateChange:updateCards});
    table.state.pageSize=25;
    return '<section class="delivery-page">'+GT.components.pageHeader({title:'Delivery Notes',description:'Prepare dispatches and record proof of delivery.',
      actions:GT.permissions.can('delivery_notes','C')?[{label:'Create delivery note',icon:'plus',route:'#/delivery-notes/new'}]:[]})+
      '<div id="deliveryStats"></div><div id="deliveryNotesMount"></div></section>';
  }

  function invoiceOptions() {
    return GT.store.all('sales_documents').filter(function (doc) {
      return doc.type==='invoice' && doc.status==='issued' &&
        (user().role!=='sales' || Number(doc.created_by)===Number(user().id)) &&
        GT.deliveries.summary(doc.id).lines.some(function (line) { return line.remaining>0; });
    }).map(function (doc) { var client=customer(doc.customer_id); return {value:doc.id,label:'Invoice '+doc.number+' — '+(client?client.name:'Unknown')}; });
  }
  function formLines(note,doc) {
    var remaining=GT.deliveries.summary(doc.id).lines, saved=note?GT.deliveries.noteLines(note.id):[];
    return remaining.map(function (line) { var previous=saved.find(function (row) { return Number(row.sales_document_item_id)===line.sales_document_item_id; });
      return {sales_document_item_id:line.sales_document_item_id,description:line.description,size:line.size,ordered:line.ordered,
        remaining:line.remaining,qty_dispatched:previous?Number(previous.qty_dispatched):line.remaining}; });
  }
  function formFields(doc,note) {
    var client=customer(doc.customer_id);
    return [{title:'Delivery details',fields:[
      {name:'delivery_date',label:'Delivery date',type:'date',required:true},
      {name:'delivery_method',label:'Method',type:'select',required:true,options:Object.keys(methodNames).map(function (key) { return {value:key,label:methodNames[key]}; })},
      {name:'carrier_or_collector_name',label:'Carrier or collector',type:'text'},
      {name:'phone',label:'Carrier or collector phone',type:'phone'},
      {name:'delivery_address',label:'Delivery address',type:'textarea',required:true,fullWidth:true},
      {name:'contact_person',label:'Contact person',type:'text'},
      {name:'contact_phone',label:'Contact phone',type:'phone'},
      {name:'notes',label:'Notes',type:'textarea',fullWidth:true}]}];
  }
  function formPage(params) {
    var id=Number(params.id), note=id?currentNote(id):null;
    if (id && (!note || !GT.deliveries.canEdit(note))) return notFound('Draft not available');
    var wanted=new URLSearchParams(String(location.hash).split('?')[1]||'').get('invoice');
    var doc=note?invoice(note.invoice_id):invoice(wanted);
    if (doc && (doc.status!=='issued' || (user().role==='sales' && Number(doc.created_by)!==Number(user().id)))) doc=null;
    activeInvoiceId=doc?doc.id:null;
    if (!doc) return '<section class="delivery-page">'+GT.components.pageHeader({title:'Create delivery note',description:'Choose an issued invoice with items remaining.'})+
      '<div class="detail-card delivery-pick"><label class="form-label" for="deliveryInvoicePicker">Invoice</label><select class="form-select" id="deliveryInvoicePicker"><option value="">Choose an invoice</option>'+invoiceOptions().map(function (option) { return '<option value="'+option.value+'">'+esc(option.label)+'</option>'; }).join('')+'</select><p class="field-error" id="deliveryPickerError"></p><button class="btn btn-primary" type="button" id="deliveryChooseInvoice">Continue</button></div></section>';
    var client=customer(doc.customer_id), values=note||{delivery_date:GT.dates.today(),delivery_method:'',carrier_or_collector_name:'',phone:'',
      delivery_address:client.address||'',contact_person:client.contact_person||'',contact_phone:client.phone||'',notes:''};
    formSections=formFields(doc,note);
    var fields=GT.forms.render({id:'deliveryForm',sections:formSections,values:values,submitLabel:'Save draft',cancelRoute:note?route(note.id):'#/delivery-notes'});
    fields=fields.replace('<div class="form-actions">','<div class="form-actions"><button class="btn btn-outline-primary" type="button" id="deliveryIssue">Issue</button><button class="btn btn-outline-primary" type="button" id="deliverySetToday" hidden>Set to today</button>');
    fields=fields.replace('<div class="form-actions">','<fieldset class="form-section"><legend>Invoice items</legend><p>Set the quantity to dispatch now. Zero leaves an item for a later note.</p><div id="deliveryLineMount"></div><p class="field-error" id="deliveryLineError" role="alert"></p></fieldset><div class="form-actions">');
    var heading=note?'Edit draft':'Create delivery note';
    return '<section class="delivery-page delivery-form-page" data-invoice-id="'+doc.id+'"'+(note?' data-note-id="'+note.id+'"':'')+'>'+GT.components.pageHeader({title:heading,description:'Invoice '+doc.number+' — '+client.name+'. Number assigned on issue.'})+
      '<div class="delivery-form-layout"><div>'+fields+'</div><aside><div class="detail-card"><h2>Invoice and release</h2><div id="deliveryReleasePanel"></div></div><div class="detail-card delivery-live"><h2>Delivery note preview</h2><div id="deliveryLivePreview"></div></div></aside></div></section>';
  }
  function lineColumns() {
    return [{key:'description',label:'Item',type:'readonly',format:function (value) { return String(value||''); }},
      {key:'size',label:'Size',type:'readonly',format:function (value) { return String(value||''); }},
      {key:'ordered',label:'Ordered',type:'readonly',format:String},
      {key:'remaining',label:'Remaining',type:'readonly',format:String},
      {key:'qty_dispatched',label:'Dispatch now',type:'number',validate:function (value,row) {
        return !Number.isFinite(Number(value)) || Number(value)<0 || Number(value)>Number(row.remaining) ? 'Enter a quantity from zero to remaining.' : ''; }}];
  }
  function releaseMarkup(doc,note) {
    var check=note?release(note):GT.deliveries.releaseCheck(doc.id), restricted=!showMoney();
    var state=check.status==='cleared'?'Cleared':'Approval needed';
    var detail='<p>'+GT.components.statusBadge(state,check.status==='cleared'?'success':'warning')+'</p>';
    if (restricted) return detail;
    var payment=GT.invoices.summary(doc.id);
    return detail+'<p>'+esc(check.reason)+'</p><dl class="detail-grid">'+GT.components.detailRow('Invoice total',GT.format.formatMoney(doc.total))+
      GT.components.detailRow('Paid',GT.format.formatMoney(payment.paid))+GT.components.detailRow('Balance',GT.format.formatMoney(payment.balance))+'</dl>';
  }
  function updateForm() {
    var form=document.getElementById('deliveryForm'); if (!form) return;
    var doc=invoice(activeInvoiceId), noteId=Number(document.querySelector('.delivery-form-page').dataset.noteId), note=noteId?currentNote(noteId):null;
    document.getElementById('deliveryReleasePanel').innerHTML=releaseMarkup(doc,note);
    var future=form.elements.delivery_date.value>GT.dates.today();
    document.getElementById('deliveryIssue').hidden=future;
    document.getElementById('deliverySetToday').hidden=!future;
    var check=note?release(note):GT.deliveries.releaseCheck(doc.id);
    document.getElementById('deliveryIssue').textContent=check.status==='needs_approval'?(manager()?'Approve and issue':'Request release'):'Issue';
    var preview=Object.assign({},GT.forms.read(form,formSections),{number:note?note.number:null,status:'draft',invoice_id:doc.id,
      customer_id:doc.customer_id});
    document.getElementById('deliveryLivePreview').innerHTML=printMarkup(preview,lineEditor.getRows(),false);
  }
  function formData(form) { var values=GT.forms.read(form,formSections); values.lines=lineEditor.getRows().map(function (row) {
    return {sales_document_item_id:row.sales_document_item_id,qty_dispatched:row.qty_dispatched}; }); return values; }
  function formErrors(values,doc) {
    var errors={};
    if (!values.delivery_date) errors.delivery_date='Choose a delivery date.';
    if (!values.delivery_method) errors.delivery_method='Choose a method.';
    if (!String(values.delivery_address||'').trim()) errors.delivery_address='Enter the delivery address.';
    if (values.delivery_date && values.delivery_date<doc.issue_date) errors.delivery_date='Date cannot be before the invoice date.';
    return errors;
  }
  function bindForm() {
    var chooser=document.getElementById('deliveryInvoicePicker');
    if (chooser) { document.getElementById('deliveryChooseInvoice').addEventListener('click',function () {
      if (chooser.value) location.hash='#/delivery-notes/new?invoice='+chooser.value;
      else document.getElementById('deliveryPickerError').textContent='Choose an invoice.';
    }); return; }
    var form=document.getElementById('deliveryForm'), doc=invoice(activeInvoiceId), noteId=Number(document.querySelector('.delivery-form-page').dataset.noteId), note=noteId?currentNote(noteId):null;
    lineEditor=GT.lineEditor.create({id:'deliveryLines',rows:formLines(note,doc),columns:lineColumns(),fixedRows:true,onChange:updateForm}).mount('#deliveryLineMount');
    tracker=GT.forms.trackDirty(form);
    form.addEventListener('input',updateForm); form.addEventListener('change',updateForm);
    document.getElementById('deliverySetToday').addEventListener('click',function () {
      form.elements.delivery_date.value=GT.dates.today(); form.elements.delivery_date.dispatchEvent(new Event('change',{bubbles:true}));
    });
    function save(issue) {
      var values=formData(form), errors=formErrors(values,doc), lineErrors=lineEditor.validate();
      if (lineErrors.length) { document.getElementById('deliveryLineError').textContent=lineErrors[0].message; return; }
      document.getElementById('deliveryLineError').textContent='';
      if (!GT.forms.showErrors(form,errors)) return;
      if (issue && values.delivery_date>GT.dates.today()) { GT.components.showToast('Set the planned date to today before issuing.','warning'); return; }
      try {
        var saved=note?GT.deliveries.saveDraft(note.id,values):GT.deliveries.createDraft(doc.id,values.lines);
        if (!note) saved=GT.deliveries.saveDraft(saved.id,values);
        if (issue) {
          var check=release(saved), reason='';
          if (check.status==='needs_approval' && manager()) {
            openReleaseReason(saved);
            tracker.markSaved(); location.hash=route(saved.id); return;
          }
          var result=GT.deliveries.issue(saved.id);
          if (result.status==='approval_requested') GT.components.showToast('Release approval requested. The note remains a draft.','warning');
          else GT.components.showToast('Delivery note '+result.number+' issued.','success');
        } else GT.components.showToast('Delivery note saved as a draft.','success');
        tracker.markSaved(); GT.app.refreshChrome(); location.hash=route(saved.id);
      } catch(error) { GT.components.showToast(error.message,'error'); }
    }
    form.addEventListener('submit',function (event) { event.preventDefault(); save(false); });
    document.getElementById('deliveryIssue').addEventListener('click',function () { save(true); });
    updateForm();
  }

  function canConfirm(row) {
    return row.status==='issued' && ['owner','general_manager','store_keeper','sales'].indexOf(user().role)!==-1 && GT.deliveries.canView(row);
  }
  function refresh() { GT.components.closeModal(); GT.app.refreshChrome(); GT.app.renderPage(); }
  function openConfirm(row) {
    if (!canConfirm(row)) return;
    var lines=GT.deliveries.noteLines(row.id);
    GT.components.openModal({title:'Confirm delivery '+row.number,content:'<div class="delivery-confirm"><label class="form-label" for="deliveryReceivedBy">Received by</label><input class="form-control" id="deliveryReceivedBy" type="text"><p class="field-error" id="deliveryReceivedByError"></p><label class="form-label" for="deliveryReceivedDate">Received date</label><input class="form-control" id="deliveryReceivedDate" type="date" value="'+esc(GT.dates.today())+'"><p class="field-error" id="deliveryReceivedDateError"></p><p>Record received quantities. Any difference is a return and needs a reason.</p><div id="deliveryConfirmLines"></div><p class="field-error" id="deliveryConfirmError" role="alert"></p><div class="gt-modal-actions"><button class="btn btn-primary" id="deliveryConfirmSave" type="button">Confirm delivery</button></div></div>'});
    var root=document.getElementById('modalContainer'), save=root.querySelector('#deliveryConfirmSave');
    root.querySelector('.gt-modal > .gt-modal-actions').prepend(save);
    var editor=GT.lineEditor.create({id:'deliveryReceivedLines',fixedRows:true,
      rows:lines.map(function (line) { return {delivery_note_item_id:line.id,description:line.description,size:line.size,
        qty_dispatched:line.qty_dispatched,qty_received:line.qty_dispatched,return_reason:''}; }),
      columns:[{key:'description',label:'Item',type:'readonly'}, {key:'size',label:'Size',type:'readonly'},
        {key:'qty_dispatched',label:'Dispatched',type:'readonly',format:String},
        {key:'qty_received',label:'Received',type:'number',validate:function (value,row) { return value===null || !Number.isFinite(Number(value)) || Number(value)<0 || Number(value)>Number(row.qty_dispatched)?'Enter a valid received quantity.':''; }},
        {key:'return_reason',label:'Return reason',type:'select',options:[{value:'damaged',label:'Damaged'},{value:'wrong_size',label:'Wrong size'},{value:'refused',label:'Refused'},{value:'other',label:'Other'}],
          validate:function (value,row) { return Number(row.qty_received)<Number(row.qty_dispatched)&&!value?'Choose a return reason.':''; }}]
    }).mount('#deliveryConfirmLines');
    save.addEventListener('click',function () {
      var name=root.querySelector('#deliveryReceivedBy').value.trim(), date=root.querySelector('#deliveryReceivedDate').value;
      root.querySelector('#deliveryReceivedByError').textContent=name?'':'Enter the receiver name.';
      root.querySelector('#deliveryReceivedDateError').textContent=date && date>=row.delivery_date && date<=GT.dates.today()?'':'Choose a date from delivery date through today.';
      if (!name || !date || date<row.delivery_date || date>GT.dates.today() || editor.validate().length) return;
      try { GT.deliveries.confirm(row.id,{received_by:name,received_date:date,lines:editor.getRows()});
        GT.components.showToast('Delivery confirmed.','success'); refresh(); }
      catch(error) { root.querySelector('#deliveryConfirmError').textContent=error.message; }
    });
    GT.components.refreshIcons();
  }
  function openVoid(row) {
    if (!manager() || ['draft','issued'].indexOf(row.status)===-1) return;
    GT.components.openModal({title:'Void delivery note '+(row.number||'Draft'),content:'<p>This releases the dispatched quantities. Give a reason.</p><label class="form-label" for="deliveryVoidReason">Reason</label><textarea class="form-control" id="deliveryVoidReason"></textarea><p class="field-error" id="deliveryVoidError" role="alert"></p><div class="gt-modal-actions"><button class="btn btn-outline-danger" id="deliveryVoidSave" type="button">Continue</button></div>'});
    var root=document.getElementById('modalContainer'), button=root.querySelector('#deliveryVoidSave');
    root.querySelector('.gt-modal > .gt-modal-actions').prepend(button);
    button.addEventListener('click',async function () {
      var reason=root.querySelector('#deliveryVoidReason').value.trim();
      if (!reason) { root.querySelector('#deliveryVoidError').textContent='A reason is required.'; return; }
      if (!await GT.components.confirmDialog({title:'Confirm void',message:'Void this delivery note and release its quantities?',confirmText:'Void note'})) return;
      try { GT.deliveries.void(row.id,reason); GT.components.showToast('Delivery note voided.','success'); refresh(); }
      catch(error) { GT.components.showToast(error.message,'error'); }
    });
  }
  function duplicate(row) {
    try {
      var draft=GT.deliveries.createDraft(row.invoice_id);
      draft=GT.deliveries.saveDraft(draft.id,{delivery_date:GT.dates.today(),delivery_method:row.delivery_method,
        carrier_or_collector_name:row.carrier_or_collector_name,phone:row.phone,
        delivery_address:row.delivery_address,contact_person:row.contact_person,
        contact_phone:row.contact_phone,notes:row.notes});
      GT.components.showToast('New delivery draft created.','success'); GT.app.refreshChrome(); location.hash=route(draft.id)+'/edit';
    } catch(error) { GT.components.showToast(error.message,'error'); }
  }
  function openReleaseReason(row) {
    if (!manager()) return;
    var pending=GT.deliveries.approvalFor(row.id,'requested');
    GT.components.openModal({title:'Approve release for '+(row.number||'Draft'),content:'<p>Record why dispatch may proceed.</p><label class="form-label" for="deliveryReleaseReason">Approval reason</label><textarea class="form-control" id="deliveryReleaseReason"></textarea><p class="field-error" id="deliveryReleaseError" role="alert"></p><div class="gt-modal-actions"><button class="btn btn-primary" id="deliveryReleaseApprove" type="button">Approve and issue</button>'+(pending?'<button class="btn btn-outline-danger" id="deliveryReleaseReject" type="button">Reject</button>':'')+'</div>'});
    var root=document.getElementById('modalContainer');
    root.querySelectorAll('#deliveryReleaseApprove,#deliveryReleaseReject').forEach(function (button) { root.querySelector('.gt-modal > .gt-modal-actions').prepend(button); });
    root.querySelector('#deliveryReleaseApprove').addEventListener('click',function () {
      var reason=root.querySelector('#deliveryReleaseReason').value.trim();
      if (!reason) { root.querySelector('#deliveryReleaseError').textContent='An approval reason is required.'; return; }
      try { var issued=GT.deliveries.issue(row.id,reason); GT.components.showToast('Delivery note '+issued.number+' issued.','success');
        GT.components.closeModal(); GT.app.refreshChrome(); location.hash=route(row.id); GT.app.renderPage(); }
      catch(error) { root.querySelector('#deliveryReleaseError').textContent=error.message; }
    });
    var reject=root.querySelector('#deliveryReleaseReject');
    if (reject) reject.addEventListener('click',function () {
      var reason=root.querySelector('#deliveryReleaseReason').value.trim();
      if (!reason) { root.querySelector('#deliveryReleaseError').textContent='A rejection reason is required.'; return; }
      try { GT.deliveries.rejectRelease(row.id,reason); GT.components.showToast('Release rejected. The note remains a draft.','warning'); refresh(); }
      catch(error) { root.querySelector('#deliveryReleaseError').textContent=error.message; }
    });
  }
  function issueDraft(row) {
    if (row.delivery_date>GT.dates.today()) { location.hash=route(row.id)+'/edit'; return; }
    try {
      if (release(row).status==='needs_approval' && manager()) { openReleaseReason(row); return; }
      var result=GT.deliveries.issue(row.id);
      GT.components.showToast(result.status==='approval_requested'?'Release approval requested.':'Delivery note '+result.number+' issued.',result.status==='approval_requested'?'warning':'success');
      refresh();
    } catch(error) { GT.components.showToast(error.message,'error'); }
  }
  function discard(row) {
    GT.components.confirmDialog({title:'Discard draft?',message:'This unnumbered draft will leave the delivery list.',confirmText:'Discard draft'}).then(function (confirmed) {
      if (!confirmed) return;
      try { GT.deliveries.discardDraft(row.id); GT.components.showToast('Draft discarded.','success');
        GT.components.closeModal(); GT.app.refreshChrome(); location.hash='#/delivery-notes'; }
      catch(error) { GT.components.showToast(error.message,'error'); }
    });
  }
  function notFound(title) { return '<section class="delivery-page">'+GT.components.pageHeader({title:title})+'<p>This delivery note is not available.</p></section>'; }
  function timeline(row) {
    var approved=GT.deliveries.approvalFor(row.id,'approved');
    var events=[{name:'Created',date:row.created_at}];
    if (approved) events.push({name:'Release approved',date:approved.updated_at||approved.created_at});
    if (row.issued_at) events.push({name:'Issued',date:row.issued_at});
    if (row.confirmed_at) events.push({name:'Delivered',date:row.confirmed_at});
    if (row.voided_at) events.push({name:'Void',date:row.voided_at});
    return '<ol class="delivery-timeline">'+events.map(function (event) {
      return '<li><strong>'+esc(event.name)+'</strong><span>'+esc(GT.dates.formatDate(event.date))+'</span></li>';
    }).join('')+'</ol>';
  }
  function detailPage(params) {
    var row=currentNote(params.id); if (!row) return notFound('Delivery note not found');
    var client=customer(row.customer_id), check=release(row), pending=GT.deliveries.approvalFor(row.id,'requested');
    var actions=[];
    if (GT.deliveries.canEdit(row)) actions.push({label:'Edit draft',icon:'pencil',route:route(row.id)+'/edit'});
    if (GT.deliveries.canEdit(row) && row.delivery_date<=GT.dates.today() && !pending) actions.push({label:check.status==='needs_approval'?(manager()?'Approve and issue':'Request release'):'Issue',icon:'send',name:'issue'});
    if (manager() && pending) actions.push({label:'Decide release',icon:'shield-check',name:'release'});
    if (canConfirm(row)) actions.push({label:'Confirm delivery',icon:'check',name:'confirm'});
    actions.push({label:'Print',icon:'printer',name:'print',className:'btn-outline-primary'});
    if (manager() && ['draft','issued'].indexOf(row.status)!==-1) actions.push({label:'Void',icon:'ban',name:'void',className:'btn-outline-danger'});
    if (GT.deliveries.canEdit(row)) actions.push({label:'Discard draft',icon:'trash-2',name:'discard',className:'btn-outline-secondary'});
    var notes=esc(row.notes||'—');
    return '<section class="delivery-page delivery-detail-page" data-note-id="'+row.id+'">'+GT.components.pageHeader({title:'Delivery Note '+(row.number||'Draft'),
      description:'For '+(client?client.name:'Unknown')+' · '+GT.dates.formatDate(row.delivery_date),badge:badge(row.status),actions:actions})+
      '<div class="delivery-detail-layout"><div class="detail-card"><h2>Delivery</h2><dl class="detail-grid">'+
        GT.components.detailRow('Customer',client?client.name:'—')+
        GT.components.detailRow('Date',GT.dates.formatDate(row.delivery_date))+GT.components.detailRow('Method',label(row.delivery_method,methodNames))+
        GT.components.detailRow('Carrier or collector',row.carrier_or_collector_name)+GT.components.detailRow('Phone',row.phone)+
        GT.components.detailRow('Address',row.delivery_address)+GT.components.detailRow('Contact person',row.contact_person)+
        GT.components.detailRow('Contact phone',row.contact_phone)+GT.components.detailRow('Dispatched by',row.dispatched_by?person(row.dispatched_by):'—')+
        GT.components.detailRow('Received by',row.received_by)+GT.components.detailRow('Received date',row.received_date?GT.dates.formatDate(row.received_date):'—')+'</dl><p>Invoice: '+invoiceLink(row)+'</p><p>Notes: '+notes+'</p></div>'+
      '<aside><div class="detail-card"><h2>Progress</h2>'+timeline(row)+'</div><div class="detail-card"><h2>Release</h2>'+releaseMarkup(invoice(row.invoice_id),row)+'</div></aside></div>'+
      '<div class="detail-card"><h2>Items</h2><div id="deliveryDetailLines"></div></div>'+
      (row.status==='void'?'<p class="delivery-void-reason">Void reason: '+esc(row.void_reason)+'</p>':'')+'</section>';
  }
  function bindDetail(params) {
    var row=currentNote(params.id); if (!row) return;
    var lines=GT.deliveries.noteLines(row.id), detailTable=GT.dataTable.create({id:'deliveryDetailTable',rows:lines,
      searchFields:['description','size'],columns:[{label:'Item',field:'description',priority:1},
        {label:'Size',field:'size',priority:2}, {label:'Ordered',field:'quantity_ordered',align:'right',numeric:true,priority:1},
        {label:'Dispatched',field:'qty_dispatched',align:'right',numeric:true,priority:1},
        {label:'Received',field:'qty_received',align:'right',numeric:true,priority:1,formatter:function (value) { return value==null?'—':value; }},
        {label:'Returned',field:'qty_returned',align:'right',numeric:true,priority:1}],
      emptyState:{message:'No invoice items on this note.'},exportName:'delivery-note-items.csv'});
    detailTable.mount('#deliveryDetailLines');
    document.querySelectorAll('.delivery-detail-page [data-page-action]').forEach(function (button) { button.addEventListener('click',function () {
      var action=button.dataset.pageAction;
      if (action==='issue') issueDraft(row);
      if (action==='release') openReleaseReason(row);
      if (action==='confirm') openConfirm(row);
      if (action==='print') print(row);
      if (action==='void') openVoid(row);
      if (action==='discard') discard(row);
    }); });
  }

  function printMarkup(row,lines,copy) {
    var doc=invoice(row.invoice_id), client=customer(row.customer_id);
    var body=lines.map(function (line) {
      var balance=GT.deliveries.remainingAfter(row,line.sales_document_item_id,line.qty_dispatched);
      return '<tr><td>'+esc(line.description)+'</td><td>'+esc(line.size)+'</td><td>'+esc(line.quantity_ordered==null?line.ordered:line.quantity_ordered)+'</td><td>'+esc(line.qty_dispatched)+'</td><td>'+esc(balance)+'</td></tr>';
    }).join('');
    return '<div class="delivery-print-copy">'+(copy?'<p class="delivery-copy-label">'+esc(copy)+'</p>':'')+(row.status==='void'?GT.print.watermark('VOID'):'')+
      GT.print.letterhead()+'<header class="delivery-print-heading"><h2>DELIVERY NOTE</h2><strong>No. '+esc(row.number||'Draft')+'</strong><span>Date: '+esc(GT.dates.formatDocDate(row.delivery_date||GT.dates.today()))+'</span></header>'+
      '<dl class="delivery-print-meta"><div><dt>Customer</dt><dd>'+esc(client?client.name:'')+'</dd></div><div><dt>Invoice</dt><dd>'+esc(doc?doc.number:'')+'</dd></div><div><dt>Delivery address</dt><dd>'+esc(row.delivery_address)+'</dd></div><div><dt>Method</dt><dd>'+esc(label(row.delivery_method,methodNames))+'</dd></div><div><dt>Carrier or collector</dt><dd>'+esc(row.carrier_or_collector_name)+'</dd></div><div><dt>Contact</dt><dd>'+esc(row.contact_person)+' '+esc(row.contact_phone)+'</dd></div></dl>'+
      '<table class="delivery-print-table"><thead><tr><th>Item</th><th>Size</th><th>Ordered</th><th>Delivered now</th><th>Balance still to deliver</th></tr></thead><tbody>'+body+'</tbody></table>'+
      '<div class="delivery-print-signoff print-keep-together">'+GT.print.signatureBlock(['Delivered by','Received by (name, signature, date)'])+
      '<div class="sales-stamp-area">Company stamp</div></div></div>';
  }
  function print(row) {
    var lines=GT.deliveries.noteLines(row.id), preview=GT.print.open(printMarkup(row,lines,'Original'),'Delivery Note '+(row.number||'Draft'));
    var toolbar=preview.querySelector('.print-preview-toolbar');
    toolbar.insertAdjacentHTML('beforeend','<label class="delivery-copy-select">Copies <select class="form-select" id="deliveryCopies"><option value="one">Original only</option><option value="two">Original and duplicate</option></select></label>');
    preview.querySelector('#deliveryCopies').addEventListener('change',function () {
      preview.querySelector('.print-page').innerHTML=this.value==='two' ? printMarkup(row,lines,'Original')+'<div class="delivery-cut-line">Cut line</div>'+printMarkup(row,lines,'Duplicate') : printMarkup(row,lines,'Original');
      preview.classList.toggle('delivery-two-copies',this.value==='two');
    });
    return preview;
  }
  var api={render:function (view,params) { return view==='list'?listPage():view==='new'||view==='edit'?formPage(params):detailPage(params); },
    bind:function (view,params) { if (view==='list') { table.mount('#deliveryNotesMount'); updateCards(); }
      else if (view==='new'||view==='edit') bindForm(); else bindDetail(params); },
    print:print,printMarkup:printMarkup,openConfirm:openConfirm};
  GT.router.register('#/delivery-notes',{module:api,view:'list',title:'Delivery Notes',permission:'delivery_notes',baseRoute:'#/delivery-notes'});
  GT.router.register('#/delivery-notes/new',{module:api,view:'new',title:'Create delivery note',permission:'delivery_notes',action:'C',baseRoute:'#/delivery-notes'});
  GT.router.register('#/delivery-notes/:id/edit',{module:api,view:'edit',title:'Edit delivery draft',permission:'delivery_notes',action:'C',baseRoute:'#/delivery-notes'});
  GT.router.register('#/delivery-notes/:id',{module:api,view:'detail',title:'Delivery Note',permission:'delivery_notes',baseRoute:'#/delivery-notes'});
  return api;
}());
