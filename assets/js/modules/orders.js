/* Orders screens: PAGE_PATTERNS.md shared list, form, detail and print contracts (A-57). */
window.GT = window.GT || {};
window.GT.orderModule = (function () {
  var GT = window.GT, table, editor, sections, tracker;
  function esc(value) { return GT.components.escapeHtml(value); }
  function user() { return GT.session.currentUser(); }
  function manager() { return ['owner', 'general_manager'].indexOf(user().role) !== -1; }
  function moneyRole() { return ['store_keeper', 'workshop_supervisor'].indexOf(user().role) === -1; }
  function customer(id) { return GT.store.find('customers', id); }
  function doc(id) { return id && GT.store.find('sales_documents', id); }
  function order(id) { var found = GT.store.find('orders', id); return found && GT.orders.canView(found) ? found : null; }
  function route(id) { return '#/orders/' + id; }
  function badge(label, tone) { return GT.components.statusBadge(label, tone); }
  function dueLabel(info) { return info.status === 'completed' ? 'Delivered' : info.status === 'cancelled' ? 'Cancelled' :
    info.daysToDue < 0 ? Math.abs(info.daysToDue) + ' days late' : info.daysToDue === 0 ? 'Due today' : 'In ' + info.daysToDue + ' days'; }
  function rows() { return GT.orders.list().map(function (item) {
    var info = GT.orders.summary(item.id), client = customer(item.customer_id);
    return Object.assign({}, item, { number_label:item.number || 'Draft', customer_name:client ? client.name : 'Unknown',
      stage_label:info.currentStage, status_label:info.status, due_label:dueLabel(info), is_late:info.isLate,
      deposit_met:info.depositMet, delivery_status:info.deliveryStatus, items_count:GT.orders.lines(item.id).length });
  }).sort(function (a, b) { return Number(b.priority === 'urgent') - Number(a.priority === 'urgent') || a.due_date.localeCompare(b.due_date); }); }
  function stageOptions() { return GT.orders.stages().map(function (item) { return { value:item.name, label:item.name }; }); }
  function cards() { var all = rows(), selected = table.state.filters.quick || '';
    function card(label, value, key, icon, tone) { return { label:label, value:value, icon:icon, tone:tone,
      filterKey:'quick', active:selected === key, onClick:function () { table.toggleFilter('quick', key); } }; }
    return [card('Active orders', all.filter(function (item) { return item.status_label === 'active'; }).length, 'active', 'clipboard-list', 'brand'),
      card('Late', all.filter(function (item) { return item.is_late; }).length, 'late', 'clock-3', 'danger'),
      card('Awaiting deposit', all.filter(function (item) { return item.status_label === 'active' && !item.deposit_met; }).length, 'deposit', 'wallet', 'warning'),
      card('Ready for delivery', all.filter(function (item) { return item.stage_label === 'Ready for delivery'; }).length, 'ready', 'truck', 'success')]; }
  function updateCards() { var mount = document.getElementById('orderStats'); if (!mount) return;
    mount.innerHTML = GT.statCards.render(cards()); if (!mount.dataset.bound) { GT.statCards.bind(mount, cards()); mount.dataset.bound = 'true'; }
    GT.components.refreshIcons(); }
  function listPage() {
    table = GT.dataTable.create({ id:'ordersTable', caption:'Orders', rows:rows,
      searchFields:['number_label', 'customer_name', 'description'], searchPlaceholder:'Search number, customer or description',
      filters:[
        { name:'stage', label:'Stage', field:'stage_label', options:stageOptions() },
        { name:'status', label:'Status', field:'status_label', options:['draft','active','cancelled','completed'].map(function (value) { return { value:value, label:value }; }) },
        { name:'priority', label:'Priority', field:'priority', options:[{value:'normal',label:'Normal'},{value:'urgent',label:'Urgent'}] },
        { name:'late', label:'Late only', options:[{value:'yes',label:'Late only'}], test:function (item, value) { return value !== 'yes' || item.is_late; } },
        { name:'customer', label:'Customer', field:'customer_id', options:GT.customers.options() },
        { name:'date_from', label:'From date', type:'date', test:function (item, value) { return item.order_date >= value; } },
        { name:'date_to', label:'To date', type:'date', test:function (item, value) { return item.order_date <= value; } },
        { name:'quick', label:'Quick filter', options:[{value:'active',label:'Active orders'},{value:'late',label:'Late'},{value:'deposit',label:'Awaiting deposit'},{value:'ready',label:'Ready for delivery'}],
          test:function (item, value) { return value === 'active' ? item.status_label === 'active' : value === 'late' ? item.is_late :
            value === 'deposit' ? item.status_label === 'active' && !item.deposit_met : value === 'ready' ? item.stage_label === 'Ready for delivery' : true; } }
      ],
      columns:[{label:'Number',field:'number_label',sortable:true,priority:1},
        {label:'Customer',field:'customer_name',sortable:true,priority:1,minWidth:150},
        {label:'Description',field:'description',priority:2,minWidth:180},
        {label:'Due date',field:'due_date',sortable:true,priority:1,html:true,formatter:function (value, item) { return esc(GT.dates.formatDate(value)) + '<small class="order-due-hint' + (item.is_late ? ' late' : '') + '">' + esc(item.due_label) + '</small>'; },exportValue:function (item) { return item.due_date + ' (' + item.due_label + ')'; }},
        {label:'Stage',field:'stage_label',priority:1,html:true,formatter:function (value) { return '<span class="order-stage-chip">' + badge(value, value === 'Delivered' ? 'success' : 'info') + '</span>'; },exportValue:function (item) { return item.stage_label; }},
        {label:'Priority',field:'priority',priority:2,html:true,formatter:function (value) { return badge(value === 'urgent' ? 'Urgent' : 'Normal',value === 'urgent' ? 'danger' : 'neutral'); }},
        {label:'Deposit',field:'deposit_met',priority:1,html:true,formatter:function (value) { return badge(value ? 'Deposit met' : 'Deposit not met', value ? 'success' : 'warning'); },exportValue:function (item) { return item.deposit_met ? 'Deposit met' : 'Deposit not met'; }},
        {label:'Delivery',field:'delivery_status',priority:2,html:true,formatter:function (value) { return badge(value.replace(/_/g, ' '), value === 'delivered' ? 'success' : 'neutral'); }},
        {label:'Items',field:'items_count',priority:3,align:'right',numeric:true}],
      actions:[{label:'View',icon:'eye',primary:true,onClick:function (item) { location.hash = route(item.id); }},
        {label:'Move stage',icon:'arrow-right',show:function (item) { return GT.orders.canMove(item) && item.status_label === 'active'; },onClick:openStage},
        {label:'Create invoice',icon:'receipt-text',show:function (item) { return GT.permissions.can('invoices','C') && GT.orders.canView(item) && item.status_label === 'active' && !item.invoice_id; },onClick:createInvoice},
        {label:'Create delivery note',icon:'truck',show:function (item) { return !!item.invoice_id && !!doc(item.invoice_id) && doc(item.invoice_id).status === 'issued' && GT.permissions.can('delivery_notes','C') && GT.deliveries.summary(item.invoice_id).lines.some(function (line) { return line.remaining > 0; }); },onClick:function (item) { location.hash = '#/delivery-notes/new?invoice=' + item.invoice_id; }},
        {label:'Cancel',icon:'ban',destructive:true,show:GT.orders.canCancel,onClick:openCancel}],
      emptyState:{message:'No orders match the current filters.'}, exportName:'orders.csv', onStateChange:updateCards });
    table.state.pageSize = 25;
    return '<section class="orders-page">' + GT.components.pageHeader({title:'Orders',description:'Track promises, deposits and production stages.',actions:GT.permissions.can('orders','C') ? [{label:'Create order',icon:'plus',route:'#/orders/new'}] : []}) +
      '<div id="orderStats"></div><div id="ordersMount"></div></section>';
  }
  function sourceFromUrl() { var id = Number(new URLSearchParams(String(location.hash).split('?')[1] || '').get('source')); var found = doc(id);
    return found && ['quotation','proforma'].indexOf(found.type) !== -1 && found.status === 'issued' && GT.salesDocs.mayView(found) ? found : null; }
  function formFields() { return [{ title:'Order details', fields:[
    {name:'customer_id',label:'Customer',type:'select',required:true,valueType:'number',options:GT.customers.options()},
    {name:'description',label:'Description',type:'text',required:true},
    {name:'due_date',label:'Promised delivery date',type:'date',required:true},
    {name:'priority',label:'Priority',type:'select',required:true,options:[{value:'normal',label:'Normal'},{value:'urgent',label:'Urgent'}]},
    {name:'notes',label:'Workshop notes',type:'textarea',fullWidth:true}]}]; }
  function formPage(params) {
    var current = params.id ? order(params.id) : null, source = current ? doc(current.source_document_id) : sourceFromUrl();
    if (params.id && (!current || current.status !== 'draft')) return missing('Draft unavailable');
    var sourceLines = source ? GT.salesDocs.items(source.id) : [];
    var values = current || {customer_id:source ? source.customer_id : '',description:sourceLines.map(function (line) { return line.description; }).join(', '),
      due_date:GT.dates.today(),priority:'normal',notes:source ? source.notes || '' : ''};
    sections = formFields();
    var form = GT.forms.render({id:'orderForm',sections:sections,values:values,submitLabel:'Save draft',cancelRoute:current ? route(current.id) : '#/orders'});
    form = form.replace('<div class="form-actions">','<fieldset class="form-section"><legend>Order lines</legend><div id="orderLineMount"></div><p class="field-error" id="orderLineError" role="alert"></p></fieldset><div class="form-actions"><button class="btn btn-outline-primary" type="button" id="orderConfirm">Confirm order</button>');
    return '<section class="orders-page order-form-page" data-order-id="' + (current ? current.id : '') + '" data-source-id="' + (source ? source.id : '') + '">' +
      GT.components.pageHeader({title:current ? 'Edit order draft' : source ? 'Convert to order' : 'Create order',description:'The order number is assigned on confirmation.'}) +
      (source ? '<p class="order-source-note">Source: ' + esc(source.type + ' ' + source.number) + '</p>' : '') +
      form + '</section>';
  }
  function lineColumns() { return [
    {key:'description',label:'Description',type:'text',validate:function (value) { return String(value || '').trim() ? '' : 'Enter a description.'; }},
    {key:'size',label:'Size',type:'text'},
    {key:'quantity',label:'Quantity',type:'number',validate:function (value) { return Number(value) > 0 ? '' : 'Enter a positive quantity.'; }},
    {key:'unit',label:'Unit',type:'select',options:['pcs','pairs','sets','metres','yards'].map(function (value) { return {value:value,label:value}; })},
    {key:'unit_price',label:'Unit price (UGX)',type:'money',validate:function (value) { return Number(GT.format.parseMoney(value)) > 0 ? '' : 'Enter a positive whole UGX amount.'; }}]; }
  function bindForm(params) {
    var node = document.querySelector('.order-form-page'), form = document.getElementById('orderForm'); if (!form) return;
    var current = node.dataset.orderId ? order(node.dataset.orderId) : null, source = node.dataset.sourceId ? doc(node.dataset.sourceId) : null;
    editor = GT.lineEditor.create({id:'orderLines',rows:current ? GT.orders.lines(current.id) : source ? GT.salesDocs.items(source.id) : [{description:'',size:'All',quantity:1,unit:'pcs',unit_price:''}],columns:lineColumns()}).mount('#orderLineMount');
    tracker = GT.forms.trackDirty(form);
    function save(confirm) {
      var values = GT.forms.read(form, sections); values.items = editor.getRows();
      var errors = {}, lineErrors = editor.validate();
      if (!values.customer_id) errors.customer_id = 'Choose a customer.';
      if (!String(values.description || '').trim()) errors.description = 'Enter a description.';
      if (!values.due_date || values.due_date < GT.dates.today()) errors.due_date = 'Choose today or a later date.';
      if (source && Number(values.customer_id) !== Number(source.customer_id)) errors.customer_id = 'Keep the source customer.';
      if (!GT.forms.showErrors(form, errors)) return;
      if (lineErrors.length) { document.getElementById('orderLineError').textContent = lineErrors[0].message; return; }
      document.getElementById('orderLineError').textContent = '';
      try {
        var saved = current ? GT.orders.saveDraft(current.id, values) : source ? GT.orders.saveDraft(GT.orders.createFromDocument(source.id).id, values) : GT.orders.createDraft(values);
        if (confirm) saved = GT.orders.confirm(saved.id);
        tracker.markSaved(); GT.components.showToast(confirm ? 'Order ' + saved.number + ' confirmed.' : 'Order draft saved.', 'success');
        GT.app.refreshChrome(); location.hash = route(saved.id);
      } catch (error) { GT.components.showToast(error.message, 'error'); }
    }
    form.addEventListener('submit', function (event) { event.preventDefault(); save(false); });
    document.getElementById('orderConfirm').addEventListener('click', function () { save(true); });
  }
  function missing(title) { return '<section class="orders-page">' + GT.components.pageHeader({title:title,description:'This order is unavailable for your role.'}) + '</section>'; }
  function stageTracker(item, info) { var reached = GT.orders.stages().find(function (stage) { return stage.name === info.currentStage; });
    return '<ol class="order-stage-tracker" aria-label="Production stages">' + GT.orders.stages().map(function (stage) {
      var state = stage.sort_order < reached.sort_order ? ' done' : stage.id === reached.id ? ' current' : '';
      return '<li class="order-stage-step' + state + '"' + (stage.id === reached.id ? ' aria-current="step"' : '') + '><span class="order-stage-number">' + stage.sort_order + '</span><span>' + esc(stage.name) + '</span></li>';
    }).join('') + '</ol>'; }
  function detailPage(params) {
    var item = order(params.id); if (!item) return missing('Order unavailable');
    var info = GT.orders.summary(item.id), client = customer(item.customer_id), linkedInvoice = doc(item.invoice_id), source = doc(item.source_document_id);
    var actions = [{label:'Print job card',icon:'printer',name:'print'}];
    if (item.status === 'draft' && GT.permissions.can('orders','C')) actions.unshift({label:'Edit draft',icon:'pencil',route:route(item.id) + '/edit'});
    if (item.status === 'draft' && GT.permissions.can('orders','C')) actions.push({label:'Confirm',icon:'check',name:'confirm'});
    if (GT.orders.canMove(item) && info.status === 'active') actions.push({label:'Move stage',icon:'arrow-right',name:'stage'});
    if (!item.invoice_id && GT.permissions.can('invoices','C') && info.status === 'active') actions.push({label:'Create invoice',icon:'receipt-text',name:'invoice'});
    if (linkedInvoice && linkedInvoice.status === 'issued' && GT.permissions.can('delivery_notes','C') && GT.deliveries.summary(linkedInvoice.id).lines.some(function (line) { return line.remaining > 0; })) actions.push({label:'Create delivery note',icon:'truck',route:'#/delivery-notes/new?invoice=' + linkedInvoice.id});
    if (GT.orders.canCancel(item)) actions.push({label:'Cancel',icon:'ban',name:'cancel'});
    if (info.status === 'active' && GT.materialIssues.canRequest()) actions.push({label:'Request material',icon:'package-plus',route:'#/material-issues/new?order=' + item.id});
    var pending = GT.orders.approvalFor(item.id, 'requested');
    var payment = moneyRole() ? '<dl class="detail-grid">' + GT.components.detailRow('Total',GT.format.formatMoney(info.total)) + GT.components.detailRow('Paid',GT.format.formatMoney(info.paid)) + GT.components.detailRow('Balance',GT.format.formatMoney(info.balance)) + GT.components.detailRow('50% deposit line',GT.format.formatMoney(Math.ceil(info.total / 2))) + '</dl>' : '';
    var references = (source ? '<p>' + esc(source.type) + ': <a href="#/' + source.type + 's/' + source.id + '">' + esc(source.number || 'Draft') + '</a></p>' : '') +
      (linkedInvoice ? '<p>Invoice: ' + (GT.permissions.can('invoices','V') && GT.salesDocs.mayView(linkedInvoice) ? '<a href="#/invoices/' + linkedInvoice.id + '">' + esc(linkedInvoice.number || 'Draft') + '</a>' : esc(linkedInvoice.number || 'Draft')) + '</p>' : '<p>No invoice linked.</p>');
    var notes = linkedInvoice ? GT.deliveries.list().filter(function (row) { return Number(row.invoice_id) === linkedInvoice.id; }) : [];
    references += notes.length ? '<p>Delivery notes: ' + notes.map(function (note) { return '<a href="#/delivery-notes/' + note.id + '">' + esc(note.number || 'Draft') + '</a>'; }).join(', ') + '</p>' : '<p>No delivery notes yet.</p>';
    var history = GT.store.where('order_stage_history', {order_id:item.id}).sort(function (a, b) { return a.changed_at.localeCompare(b.changed_at); });
    var sent = GT.store.where('messages', function (message) { return message.reference_type === 'order' && Number(message.reference_id) === item.id; });
    return '<section class="orders-page order-detail-page" data-order-id="' + item.id + '">' +
      GT.components.pageHeader({title:'Order ' + (item.number || 'Draft'),description:client.name + ' · Due ' + GT.dates.formatDate(item.due_date),badge:badge(info.status,info.status === 'completed' ? 'success' : info.status === 'cancelled' ? 'danger' : 'info'),actions:actions}) +
      (item.status === 'cancelled' && info.paid ? '<p class="order-warning">Receipts exist. Handle the money on the linked invoice.</p>' : '') +
      '<div class="detail-card"><h2>Production stages</h2>' + stageTracker(item, info) + '</div>' +
      '<div class="order-detail-grid"><article class="detail-card"><h2>Order details</h2><dl class="detail-grid">' + GT.components.detailRow('Customer',client.name) + GT.components.detailRow('Order date',GT.dates.formatDate(item.order_date)) + GT.components.detailRow('Due date',GT.dates.formatDate(item.due_date)) + GT.components.detailRow('Priority',item.priority) + GT.components.detailRow('Delivery',info.deliveryStatus.replace(/_/g,' ')) + '</dl><h2>Items</h2>' +
      '<div id="orderDetailLines"></div><h2>Notes</h2><p>' + esc(item.notes || 'No workshop notes.') + '</p></article>' +
      '<aside><div class="detail-card"><h2>Deposit</h2><p>' + badge(info.depositMet ? 'Deposit met' : 'Deposit not met',info.depositMet ? 'success' : 'warning') + '</p>' + payment + '<p>' + badge(pending ? 'Approval needed' : 'Cleared',pending ? 'warning' : 'success') + '</p>' + (pending && manager() ? '<button class="btn btn-primary" type="button" data-order-approve>Approve stage</button> <button class="btn btn-outline-danger" type="button" data-order-reject>Reject</button>' : '') + '</div>' +
      '<div class="detail-card"><h2>Linked documents</h2>' + references + '</div>' +
      '<div class="detail-card"><h2>Stage history</h2>' + (history.length ? '<ol class="order-timeline">' + history.map(function (event) { var staff = GT.store.find('users',event.changed_by); return '<li><strong>' + esc(event.stage || GT.orders.stages().find(function (stage) { return stage.id === event.stage_id; }).name) + '</strong><span>' + esc(staff ? staff.name : 'System') + ' · ' + esc(GT.dates.formatDate(event.changed_at)) + '</span>' + (event.note ? '<p>' + esc(event.note) + '</p>' : '') + '</li>'; }).join('') + '</ol>' : '<p>No stage moves yet.</p>') + '</div>' +
      '<div class="detail-card"><h2>Messages</h2>' + (sent.length ? sent.map(function (message) { return '<p>' + esc(message.status) + ' · ' + esc(message.body) + '</p>'; }).join('') : '<p>No order messages sent.</p>') + '</div></aside></div>' +
      (GT.permissions.can('material_issue','V') ? '<div class="detail-card"><h2>Materials issued</h2><div id="orderMaterialIssues"></div></div>' : '') + '</section>';
  }
  function dialog(title, content, onSubmit) { GT.components.openModal({title:title,content:'<form id="orderDialogForm">' + content + '<p class="field-error" id="orderDialogError" role="alert"></p><button class="btn btn-primary" type="submit">Continue</button></form>'});
    document.getElementById('orderDialogForm').addEventListener('submit', function (event) { event.preventDefault();
      try { onSubmit(new FormData(event.target)); GT.components.closeModal(); GT.app.refreshChrome(); GT.app.renderPage(); }
      catch (error) { document.getElementById('orderDialogError').textContent = error.message; } }); }
  function openStage(item) { var current = GT.orders.stages().find(function (stage) { return stage.name === item.current_stage; });
    var choices = GT.orders.stages().filter(function (stage) { return stage.name !== 'Delivered' && stage.id !== current.id; });
    dialog('Move production stage','<label class="form-label" for="orderTarget">Stage</label><select class="form-select" name="target" id="orderTarget">' + choices.map(function (stage) { return '<option value="' + esc(stage.name) + '">' + esc(stage.name) + '</option>'; }).join('') + '</select><label class="form-label" for="orderStageNote">Note or approval reason</label><textarea class="form-control" name="note" id="orderStageNote"></textarea>',function (data) {
      var target = data.get('target'), note = data.get('note');
      if (!GT.orders.summary(item.id).depositMet && GT.orders.stages().find(function (stage) { return stage.name === target; }).sort_order > 1 && !GT.orders.approvalFor(item.id, 'approved')) {
        GT.orders.requestStageApproval(item.id, target, note); GT.components.showToast('Stage approval requested.','warning'); return;
      }
      GT.orders.moveStage(item.id, target, note); GT.components.showToast('Production stage updated.','success');
      if (target === 'Ready for delivery' && customer(item.customer_id).phone) {
        window.setTimeout(async function () { var yes = await GT.components.confirmDialog({title:'Customer update',message:'Send the ready SMS using the saved template? This is simulated.',confirmText:'Log simulated SMS'});
          if (yes) { GT.orders.sendReadyMessage(item.id); GT.components.showToast('Ready SMS logged as simulated.','success'); GT.app.renderPage(); } }, 0);
      }
    }); }
  function openCancel(item) { dialog('Cancel order','<label class="form-label" for="orderCancelReason">Reason</label><textarea class="form-control" name="reason" id="orderCancelReason" required></textarea>',function (data) {
    GT.orders.cancel(item.id, data.get('reason')); GT.components.showToast('Order cancelled.','warning'); }); }
  function createInvoice(item) { try { var invoice = GT.orders.createInvoice(item.id); GT.components.showToast('Invoice draft created.','success'); GT.app.refreshChrome(); location.hash = '#/invoices/' + invoice.id + '/edit'; } catch (error) { GT.components.showToast(error.message,'error'); } }
  function decision(item, approve) { dialog(approve ? 'Approve production move' : 'Reject production move','<label class="form-label" for="orderDecisionReason">Reason</label><textarea class="form-control" name="reason" id="orderDecisionReason" required></textarea>',function (data) {
    if (approve) GT.orders.approveStage(item.id, data.get('reason')); else GT.orders.rejectStage(item.id, data.get('reason'));
    GT.components.showToast(approve ? 'Stage approved and moved.' : 'Stage request rejected.','success'); }); }
  function printJob(item) { var client = customer(item.customer_id), lines = GT.orders.lines(item.id);
    var body = GT.print.letterhead() + '<div class="order-job-title"><h1>JOB CARD</h1><strong>No. ' + esc(item.number || 'Draft') + '</strong></div>' +
      '<div class="order-job-details"><div><strong>Customer</strong><span>' + esc(client.name) + '</span></div><div><strong>Due date</strong><span>' + esc(GT.dates.formatDate(item.due_date)) + '</span></div><div><strong>Priority</strong><span>' + esc(item.priority) + '</span></div></div>' +
      '<table class="print-table order-job-table"><thead><tr><th>Item</th><th>Size</th><th>Quantity</th></tr></thead><tbody>' + lines.map(function (line) { return '<tr><td>' + esc(line.description) + '</td><td>' + esc(line.size) + '</td><td>' + esc(line.quantity) + ' ' + esc(line.unit) + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<section class="order-job-notes"><h2>Workshop notes</h2><p>' + esc(item.notes || '') + '</p><span></span><span></span></section>' +
      '<section class="order-job-signoff"><h2>Stage sign-off</h2>' + GT.orders.stages().filter(function (stage) { return stage.name !== 'Delivered'; }).map(function (stage) { return '<div><strong>' + esc(stage.name) + '</strong><span>By: ____________________</span><span>Date: __________</span></div>'; }).join('') + '</section>' + GT.print.signatureBlock(['Workshop Supervisor','Authorised Signatory']);
    GT.print.open(body,'Job card ' + (item.number || 'Draft')); }
  function bindDetail(params) { var item = order(params.id); if (!item) return;
    var columns = [{label:'Description',field:'description',priority:1},{label:'Size',field:'size',priority:1},
      {label:'Quantity',field:'quantity',priority:1,align:'right',numeric:true}];
    if (moneyRole()) columns.push({label:'Unit price',field:'unit_price',priority:2,align:'right',numeric:true,formatter:GT.format.formatMoney});
    GT.dataTable.create({id:'orderDetailItems',rows:function () { return GT.orders.lines(item.id); },columns:columns,
      emptyState:{message:'No order items.'},exportName:'order-items.csv'}).mount('#orderDetailLines');
    if (document.getElementById('orderMaterialIssues')) GT.dataTable.create({id:'orderMaterialIssueTable',rows:function () {
      return GT.materialIssues.forOrder(item.id).map(function (entry) { var lines = GT.materialIssues.lines(entry.id);
        return {id:entry.id,number:entry.number,status:entry.status,quantity:lines.map(function (line) {
          var material = GT.store.find('materials',line.material_id); return line.quantity + ' ' + material.unit + ' ' + material.name;
        }).join(', ')}; }); },columns:[{label:'Issue',field:'number',priority:1},{label:'Status',field:'status',priority:1},
        {label:'Issued quantities',field:'quantity',priority:1}],actions:[{label:'View',icon:'eye',primary:true,
          onClick:function (entry) { location.hash = '#/material-issues/' + entry.id; }}],
      emptyState:{message:'No materials have been issued for this order.'},exportName:'order-material-issues.csv'}).mount('#orderMaterialIssues');
    document.querySelectorAll('[data-page-action]').forEach(function (button) { button.addEventListener('click',function () {
      var action = button.dataset.pageAction;
      if (action === 'print') printJob(item);
      if (action === 'stage') openStage(item);
      if (action === 'invoice') createInvoice(item);
      if (action === 'cancel') openCancel(item);
      if (action === 'confirm') { try { GT.orders.confirm(item.id); GT.components.showToast('Order confirmed.','success'); GT.app.refreshChrome(); GT.app.renderPage(); } catch(error) { GT.components.showToast(error.message,'error'); } }
    }); });
    var approve = document.querySelector('[data-order-approve]'), reject = document.querySelector('[data-order-reject]');
    if (approve) approve.addEventListener('click',function () { decision(item,true); });
    if (reject) reject.addEventListener('click',function () { decision(item,false); }); }
  function render(view, params) { if (view === 'list') return listPage(); if (view === 'new' || view === 'edit') return formPage(params || {}); return detailPage(params || {}); }
  function bind(view, params) { if (view === 'list') { table.mount('#ordersMount'); updateCards(); }
    else if (view === 'new' || view === 'edit') bindForm(params || {}); else bindDetail(params || {}); }
  var api = {render:render,bind:bind};
  GT.router.register('#/orders',{module:api,view:'list',title:'Orders',permission:'orders',baseRoute:'#/orders'});
  GT.router.register('#/orders/new',{module:api,view:'new',title:'Create order',permission:'orders',action:'C',baseRoute:'#/orders'});
  GT.router.register('#/orders/:id/edit',{module:api,view:'edit',title:'Edit order',permission:'orders',action:'C',baseRoute:'#/orders'});
  GT.router.register('#/orders/:id',{module:api,view:'detail',title:'Order',permission:'orders',baseRoute:'#/orders'});
  return api;
}());
