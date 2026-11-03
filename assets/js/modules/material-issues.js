/* Material issue screens use PAGE_PATTERNS.md shared list, form, line editor and print contracts. */
window.GT.materialIssueModule = (function () {
  var GT = window.GT, table, editor, sections;
  function esc(value) { return GT.components.escapeHtml(value); }
  function route(id) { return '#/material-issues/' + id; }
  function userName(id) { var user = GT.store.find('users', id); return user ? user.name : 'Unknown'; }
  function order(id) { return GT.store.find('orders', id); }
  function client(id) { var found = GT.store.find('customers', id); return found ? found.name : 'Unknown'; }
  function issue(id) { var found = GT.store.find('material_issues', id); return found && GT.materialIssues.canView(found) ? found : null; }
  function status(item) { return GT.components.statusBadge(item.status, item.status === 'issued' ? 'success' : item.status === 'requested' ? 'warning' : 'danger'); }
  function rows() { return GT.materialIssues.list().map(function (item) { var job = order(item.order_id);
    return Object.assign({}, item, {number_label:item.number || 'Request', order_number:job ? job.number : '',
      customer_name:job ? client(job.customer_id) : '', requester_name:userName(item.requested_by),
      line_count:GT.materialIssues.lines(item.id).length,
      partly_returned:GT.materialIssues.lines(item.id).some(function (line) { return line.returned_quantity > 0; })});
  }).sort(function (a,b) { return b.id-a.id; }); }
  function cards() { var items = rows(), selected = table.state.filters.quick || '';
    function card(label, value, key, icon, tone) { return {label:label,value:value,filterKey:'quick',icon:icon,tone:tone,
      active:selected === key,onClick:function () { table.toggleFilter('quick',key); }}; }
    var month = GT.dates.today().slice(0,7);
    return [card('Waiting to issue',items.filter(function (item) { return item.status === 'requested'; }).length,'requested','clock-3','warning'),
      card('Issued this month',items.filter(function (item) { return item.status === 'issued' && String(item.issued_at).slice(0,7) === month; }).length,'month','package-check','brand'),
      card('Partly returned',items.filter(function (item) { return item.partly_returned; }).length,'returned','undo-2','info'),
      card('Rejected',items.filter(function (item) { return item.status === 'rejected'; }).length,'rejected','ban','danger')]; }
  function refreshCards() { var mount = document.getElementById('issueStats'); if (!mount) return;
    mount.innerHTML = GT.statCards.render(cards()); if (!mount.dataset.bound) { GT.statCards.bind(mount,cards()); mount.dataset.bound = '1'; }
    GT.components.refreshIcons(); }
  function listPage() {
    table = GT.dataTable.create({id:'materialIssuesTable',caption:'Material issues',rows:rows,
      searchFields:['number_label','order_number','customer_name'],searchPlaceholder:'Search issue, order or customer',
      filters:[{name:'status',label:'Status',field:'status',options:['requested','issued','rejected','cancelled','void'].map(function (value) { return {value:value,label:value}; })},
        {name:'order',label:'Order',field:'order_id',options:GT.store.where('orders',{status:'active'}).map(function (job) { return {value:job.id,label:'Order ' + job.number}; })},
        {name:'requester',label:'Requested by',field:'requested_by',options:GT.store.all('users').map(function (person) { return {value:person.id,label:person.name}; })},
        {name:'date_from',label:'From date',type:'date',test:function (item,value) { return item.requested_at.slice(0,10) >= value; }},
        {name:'date_to',label:'To date',type:'date',test:function (item,value) { return item.requested_at.slice(0,10) <= value; }},
        {name:'quick',label:'Quick filter',options:[{value:'requested',label:'Waiting to issue'},{value:'month',label:'Issued this month'},{value:'returned',label:'Partly returned'},{value:'rejected',label:'Rejected'}],
          test:function (item,value) { return value === 'month' ? item.status === 'issued' && String(item.issued_at).slice(0,7) === GT.dates.today().slice(0,7) :
            value === 'returned' ? item.partly_returned : item.status === value; }}],
      columns:[{label:'Number',field:'number_label',priority:1,sortable:true},{label:'Order',field:'order_number',priority:1,sortable:true},
        {label:'Customer',field:'customer_name',priority:1,minWidth:150},{label:'Requested by',field:'requester_name',priority:2},
        {label:'Date',field:'requested_at',priority:2,formatter:function (value) { return GT.dates.formatDate(value); },exportValue:function (item) { return item.requested_at.slice(0,10); }},
        {label:'Status',field:'status',priority:1,html:true,formatter:function (value,item) { return status(item); }},
        {label:'Lines',field:'line_count',priority:3,align:'right',numeric:true}],
      actions:[{label:'View',icon:'eye',primary:true,onClick:function (item) { location.hash = route(item.id); }},
        {label:'Issue',icon:'package-check',show:function (item) { return item.status === 'requested' && GT.materialIssues.canIssue(); },onClick:function (item) { confirmIssue(item); }},
        {label:'Reject',icon:'ban',show:function (item) { return item.status === 'requested' && GT.materialIssues.canIssue(); },onClick:function (item) { reasonDialog('Reject request',item,'reject'); }},
        {label:'Record return',icon:'undo-2',show:function (item) { return item.status === 'issued' && GT.materialIssues.canIssue(); },onClick:openReturn},
        {label:'Void',icon:'circle-x',destructive:true,show:function (item) { return item.status === 'issued' && GT.materialIssues.canVoid() && !item.partly_returned; },onClick:function (item) { reasonDialog('Void issue',item,'void'); }},
        {label:'Cancel request',icon:'x',show:function (item) { return item.status === 'requested' && item.requested_by === GT.session.currentUser().id; },onClick:confirmCancel}],
      emptyState:{message:'No material issues match the current filters.'},exportName:'material-issues.csv',onStateChange:refreshCards});
    table.state.pageSize = 25;
    return '<section class="material-issues-page">' + GT.components.pageHeader({title:'Material Issues',description:'Request, issue and return materials for active orders.',
      actions:GT.materialIssues.canRequest() ? [{label:'New request',icon:'plus',route:'#/material-issues/new'}] : []}) +
      '<div id="issueStats"></div><div id="issuesMount"></div></section>';
  }
  function activeOrders() { return GT.store.where('orders',{status:'active'}).map(function (job) { return {value:job.id,label:'Order ' + job.number + ' · ' + client(job.customer_id)}; }); }
  function formPage(params) {
    var current = params.id ? issue(params.id) : null;
    if (params.id && (!current || current.status !== 'requested')) return missing();
    var prefill = Number(new URLSearchParams(String(location.hash).split('?')[1] || '').get('order'));
    var values = current || {order_id:prefill || '',location_id:GT.session.currentUser().location_id,notes:''};
    sections = [{title:'Request details',fields:[{name:'order_id',label:'Order',type:'select',valueType:'number',required:true,options:activeOrders()},
      {name:'location_id',label:'Store location',type:'select',valueType:'number',required:true,options:GT.store.all('locations').map(function (place) { return {value:place.id,label:place.name}; })},
      {name:'notes',label:'Notes',type:'textarea',fullWidth:true}]}];
    var form = GT.forms.render({id:'materialIssueForm',sections:sections,values:values,submitLabel:current ? 'Save request' : 'Create request',cancelRoute:current ? route(current.id) : '#/material-issues'});
    form = form.replace('<div class="form-actions">','<fieldset class="form-section"><legend>Materials</legend><div id="issueLineMount"></div><p class="field-error" id="issueLineError" role="alert"></p><p class="issue-stock-note" id="issueStockNote" aria-live="polite"></p></fieldset><div class="form-actions">');
    return '<section class="material-issues-page issue-form-page" data-issue-id="' + (current ? current.id : '') + '">' +
      GT.components.pageHeader({title:current ? 'Edit material request' : 'New material request',description:'Quantities use each material’s base unit. A number is assigned when issued.'}) + form + '</section>';
  }
  function formColumns() { return [
    {key:'material_id',label:'Material',type:'search-select',options:GT.store.where('materials',{active:true}).map(function (item) { return {value:item.id,label:item.name}; }),
      validate:function (value) { return GT.store.find('materials',value) ? '' : 'Choose a material.'; }},
    {key:'quantity',label:'Quantity',type:'number',step:'0.001',validate:function (value,row) {
      if (!(Number(value) > 0)) return 'Enter a positive quantity.';
      if (GT.materialIssues.canIssue() && Number(value) > GT.inventory.getStock(row.material_id,document.getElementById('location_id').value)) return 'Not enough in stock.';
      return ''; }},
    {key:'unit',label:'Unit',type:'computed',compute:function (row) { var material = GT.store.find('materials',row.material_id); return material ? material.unit : ''; }},
    {key:'stock',label:'In stock',type:'computed',compute:function (row) { var material = GT.store.find('materials',row.material_id);
      return material ? GT.inventory.getStock(material.id,document.getElementById('location_id').value) + ' ' + GT.inventory.unitLabel(material.unit,0) : ''; }},
    {key:'note',label:'Line note',type:'text'}]; }
  function bindForm(params) {
    var form = document.getElementById('materialIssueForm'); if (!form) return;
    var current = params.id ? issue(params.id) : null, tracker = GT.forms.trackDirty(form);
    editor = GT.lineEditor.create({id:'materialIssueLines',rows:current ? GT.materialIssues.lines(current.id) : [{material_id:'',quantity:1,note:''}],
      columns:formColumns(),onChange:function (rows) {
        var low = rows.some(function (line) { return line.material_id && Number(line.quantity) > GT.inventory.getStock(line.material_id,form.elements.location_id.value); });
        document.getElementById('issueStockNote').textContent = low && !GT.materialIssues.canIssue() ? 'Not enough in stock. The request can still be saved for review.' : '';
      }}).mount('#issueLineMount');
    form.elements.location_id.addEventListener('change',function () { editor.setRows(editor.getRows()); });
    form.addEventListener('submit',function (event) { event.preventDefault();
      var values = GT.forms.read(form,sections); values.lines = editor.getRows();
      var errors = {}; if (!values.order_id) errors.order_id = 'Choose an active order.';
      if (!values.location_id) errors.location_id = 'Choose a location.';
      if (!GT.forms.showErrors(form,errors)) return;
      var lineErrors = editor.validate(); if (lineErrors.length) { document.getElementById('issueLineError').textContent = lineErrors[0].message; return; }
      try { var saved = current ? GT.materialIssues.updateRequest(current.id,values) : GT.materialIssues.createRequest(values);
        tracker.markSaved(); GT.components.showToast('Material request saved.','success'); GT.app.refreshChrome(); location.hash = route(saved.id);
      } catch(error) { GT.components.showToast(error.message,'error'); }
    });
  }
  function missing() { return '<section class="material-issues-page">' + GT.components.pageHeader({title:'Material issue unavailable',description:'This issue is unavailable for your role.'}) + '</section>'; }
  function detailPage(params) {
    var item = issue(params.id); if (!item) return missing();
    var job = order(item.order_id), lines = GT.materialIssues.lines(item.id), actions = [];
    if (item.status === 'requested' && (item.requested_by === GT.session.currentUser().id || GT.materialIssues.canVoid())) actions.push({label:'Edit request',icon:'pencil',route:route(item.id) + '/edit'});
    if (item.status === 'requested' && GT.materialIssues.canIssue()) actions.push({label:'Issue',icon:'package-check',name:'issue'},{label:'Reject',icon:'ban',name:'reject'});
    if (item.status === 'requested' && item.requested_by === GT.session.currentUser().id) actions.push({label:'Cancel request',icon:'x',name:'cancel'});
    if (item.status === 'issued') { actions.push({label:'Print slip',icon:'printer',name:'print'});
      if (GT.materialIssues.canIssue()) actions.push({label:'Record return',icon:'undo-2',name:'return'});
      if (GT.materialIssues.canVoid() && !lines.some(function (line) { return line.returned_quantity; })) actions.push({label:'Void',icon:'circle-x',name:'void'}); }
    var history = GT.store.where('audit_logs',function (entry) { return entry.entity_type === 'material_issues' && Number(entry.entity_id) === item.id; });
    return '<section class="material-issues-page issue-detail-page" data-issue-id="' + item.id + '">' +
      GT.components.pageHeader({title:'Material issue ' + (item.number || 'request'),description:'Order ' + job.number + ' · ' + client(job.customer_id),badge:status(item),actions:actions}) +
      '<div class="issue-detail-grid"><article class="detail-card"><h2>Issue details</h2><dl class="detail-grid">' +
      GT.components.detailRow('Order','Order ' + job.number) + GT.components.detailRow('Requested by',userName(item.requested_by)) +
      GT.components.detailRow('Requested',GT.dates.formatDate(item.requested_at)) + GT.components.detailRow('Issued by',item.issued_by ? userName(item.issued_by) : 'Pending') +
      GT.components.detailRow('Issued',item.issued_at ? GT.dates.formatDate(item.issued_at) : 'Pending') +
      GT.components.detailRow('Location',GT.store.find('locations',item.location_id).name) + '</dl><p><a href="#/orders/' + job.id + '">View order ' + esc(job.number) + '</a></p>' +
      '<h2>Materials</h2><div id="issueDetailLines"></div><h2>Notes</h2><p>' + esc(item.notes || 'No notes.') + '</p>' +
      (item.decision_note ? '<p><strong>Decision:</strong> ' + esc(item.decision_note) + '</p>' : '') + '</article>' +
      '<aside class="detail-card"><h2>Timeline</h2>' + (history.length ? '<ol class="order-timeline">' + history.map(function (entry) {
        return '<li><strong>' + esc(entry.action.replace(/_/g,' ')) + '</strong><span>' + esc(userName(entry.user_id)) + ' · ' + esc(GT.dates.formatDate(entry.created_at)) + '</span></li>'; }).join('') + '</ol>' : '<p>No actions recorded.</p>') + '</aside></div></section>';
  }
  function refresh() { GT.app.refreshChrome(); GT.app.renderPage(); }
  function confirmIssue(item) { GT.components.confirmDialog({title:'Issue material',message:'Post stock movements and assign the next issue number?',confirmText:'Issue'}).then(function (yes) {
    if (!yes) return; try { GT.materialIssues.issue(item.id); GT.components.showToast('Material issued.','success'); refresh(); }
    catch(error) { GT.components.showToast(error.message,'error'); } }); }
  function confirmCancel(item) { GT.components.confirmDialog({title:'Cancel request',message:'Cancel this unissued request?',confirmText:'Cancel request'}).then(function (yes) {
    if (!yes) return; try { GT.materialIssues.cancelRequest(item.id); GT.components.showToast('Request cancelled.','success'); refresh(); }
    catch(error) { GT.components.showToast(error.message,'error'); } }); }
  function reasonDialog(title,item,action) { GT.components.openModal({title:title,content:'<form id="issueDecisionForm"><label class="form-label" for="issueReason">Reason</label><textarea class="form-control" id="issueReason" required></textarea><p class="field-error" id="issueDecisionError" role="alert"></p><button class="btn btn-primary" type="submit">Confirm</button></form>'});
    document.getElementById('issueDecisionForm').addEventListener('submit',function (event) { event.preventDefault();
      try { var reason = document.getElementById('issueReason').value;
        if (action === 'reject') GT.materialIssues.reject(item.id,reason); else GT.materialIssues.void(item.id,reason);
        GT.components.closeModal(); GT.components.showToast(action === 'reject' ? 'Request rejected.' : 'Issue voided.','success'); refresh();
      } catch(error) { document.getElementById('issueDecisionError').textContent = error.message; } }); }
  function openReturn(item) { var lines = GT.materialIssues.lines(item.id).filter(function (line) { return line.quantity > line.returned_quantity; });
    var content = '<form id="issueReturnForm"><p>Enter quantities to return to store.</p>' + lines.map(function (line) { var material = GT.store.find('materials',line.material_id);
      return '<label class="form-label" for="return-' + line.id + '">' + esc(material.name) + ' (up to ' + (line.quantity - line.returned_quantity) + ' ' + esc(material.unit) + ')</label><input class="form-control" type="number" min="0" step="0.001" id="return-' + line.id + '" data-return-line="' + line.id + '" value="0">'; }).join('') +
      '<p class="field-error" id="issueReturnError" role="alert"></p><button class="btn btn-primary" type="submit">Record return</button></form>';
    GT.components.openModal({title:'Record return',content:content});
    document.getElementById('issueReturnForm').addEventListener('submit',function (event) { event.preventDefault();
      var entries = Array.from(event.target.querySelectorAll('[data-return-line]')).filter(function (input) { return Number(input.value) > 0; })
        .map(function (input) { return {item_id:Number(input.dataset.returnLine),quantity:Number(input.value)}; });
      try { GT.materialIssues.recordReturn(item.id,entries); GT.components.closeModal(); GT.components.showToast('Return recorded.','success'); refresh(); }
      catch(error) { document.getElementById('issueReturnError').textContent = error.message; } }); }
  function printSlip(item) { var job = order(item.order_id), lines = GT.materialIssues.lines(item.id);
    var body = GT.print.letterhead() + '<div class="issue-slip-heading"><h1>MATERIAL ISSUE SLIP</h1><strong>No. ' + esc(item.number) + '</strong></div>' +
      '<dl class="issue-slip-meta"><div><dt>Order</dt><dd>' + esc(job.number) + '</dd></div><div><dt>Customer</dt><dd>' + esc(client(job.customer_id)) + '</dd></div>' +
      '<div><dt>Date</dt><dd>' + esc(GT.dates.formatDate(item.issued_at)) + '</dd></div></dl>' +
      '<table class="print-table"><thead><tr><th>Material</th><th>Issued quantity</th><th>Returned</th></tr></thead><tbody>' + lines.map(function (line) {
        var material = GT.store.find('materials',line.material_id); return '<tr><td>' + esc(material.name) + '</td><td>' + esc(line.quantity + ' ' + material.unit) + '</td><td>' + esc(line.returned_quantity + ' ' + material.unit) + '</td></tr>'; }).join('') + '</tbody></table>' +
      GT.print.signatureBlock(['Issued by','Received by','Returned']);
    GT.print.open(body,'Material issue ' + item.number); }
  function bindDetail(params) { var item = issue(params.id); if (!item) return;
    GT.dataTable.create({id:'issueDetailTable',rows:function () { return GT.materialIssues.lines(item.id).map(function (line) { var material = GT.store.find('materials',line.material_id);
      return {material:material.name,requested:line.quantity,issued:item.status === 'issued' || item.status === 'void' ? line.quantity : 0,
        returned:line.returned_quantity,unit:material.unit,note:line.note}; }); },
      columns:[{label:'Material',field:'material',priority:1},{label:'Requested',field:'requested',priority:1,align:'right',numeric:true},
        {label:'Issued',field:'issued',priority:1,align:'right',numeric:true},{label:'Returned',field:'returned',priority:2,align:'right',numeric:true},
        {label:'Unit',field:'unit',priority:2},{label:'Note',field:'note',priority:3}],emptyState:{message:'No material lines.'},exportName:'material-issue-lines.csv'}).mount('#issueDetailLines');
    document.querySelectorAll('[data-page-action]').forEach(function (button) { button.addEventListener('click',function () {
      var action = button.dataset.pageAction;
      if (action === 'issue') confirmIssue(item); if (action === 'reject' || action === 'void') reasonDialog(action === 'reject' ? 'Reject request' : 'Void issue',item,action);
      if (action === 'cancel') confirmCancel(item); if (action === 'return') openReturn(item); if (action === 'print') printSlip(item);
    }); }); }
  function render(view,params) { if (view === 'list') return listPage(); if (view === 'new' || view === 'edit') return formPage(params || {}); return detailPage(params || {}); }
  function bind(view,params) { if (view === 'list') { table.mount('#issuesMount'); refreshCards(); } else if (view === 'new' || view === 'edit') bindForm(params || {}); else bindDetail(params || {}); }
  var api = {render:render,bind:bind};
  GT.router.register('#/material-issues',{module:api,view:'list',title:'Material Issues',permission:'material_issue',baseRoute:'#/material-issues'});
  GT.router.register('#/material-issues/new',{module:api,view:'new',title:'New material request',permission:'material_issue',action:'C',baseRoute:'#/material-issues'});
  GT.router.register('#/material-issues/:id/edit',{module:api,view:'edit',title:'Edit material request',permission:'material_issue',action:'C',baseRoute:'#/material-issues'});
  GT.router.register('#/material-issues/:id',{module:api,view:'detail',title:'Material issue',permission:'material_issue',baseRoute:'#/material-issues'});
  return api;
}());
