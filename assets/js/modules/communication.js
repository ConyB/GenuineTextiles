/* Phase 19 pages: BUSINESS_RULES.md section 15 and PAGE_PATTERNS.md. */
window.GT = window.GT || {};
window.GT.communicationModule = (function () {
  var GT=window.GT, table, posterId=null, posterTracker=null;
  function esc(value) { return GT.components.escapeHtml(value); }
  function user() { return GT.session.currentUser(); }
  function manager() { return ['owner','general_manager'].indexOf(user().role)!==-1; }
  function options(rows,selected) { return rows.map(function (row) { return '<option value="'+esc(row.id)+'"'+(String(row.id)===String(selected)?' selected':'')+'>'+esc(row.name)+'</option>'; }).join(''); }
  function templates() { return GT.store.all('message_templates'); }
  function allowedTemplates() { return templates().filter(function (row) {
    if (user().role==='accountant') return row.name==='Payment reminder';
    if (user().role==='sales') return row.approved!==false && row.name!=='Supplier discrepancy notice' && row.name!=='Payment reminder';
    if (user().role==='marketing_manager') return row.name!=='Payment reminder';
    return true;
  }); }
  function customers() { return GT.store.all('customers').filter(function (row) { return row.active; }).sort(function (a,b) { return a.name.localeCompare(b.name); }); }
  function discrepancySuppliers() { return GT.store.all('suppliers').filter(function (row) { return row.active && GT.store.where('goods_received_notes',{supplier_id:row.id}).some(function (grn) { return grn.status==='discrepancy'; }); }); }
  function header(title,description,actions) { return GT.components.pageHeader({title:title,description:description,actions:actions||[]}); }
  function error(id,message) { document.getElementById(id).textContent=message||''; }
  function field(label,id,control) { return '<div class="gt-communication-field"><label class="form-label" for="'+id+'">'+label+'</label>'+control+'</div>'; }
  function select(id,items,selected) { return '<select class="form-select" id="'+id+'">'+items.map(function (item) { return '<option value="'+esc(item.value)+'"'+(String(item.value)===String(selected)?' selected':'')+'>'+esc(item.label)+'</option>'; }).join('')+'</select>'; }
  function templateRows() { return templates().map(function (row) { return Object.assign({},row,{approval:row.approved===false?'Awaiting approval':'Approved',segments:GT.communication.segments(row.body)}); }); }
  function renderTemplates() {
    table=GT.dataTable.create({id:'messageTemplatesTable',rows:templateRows,searchFields:['name','body'],columns:[
      {label:'Template',field:'name',priority:1,sortable:true},{label:'Channel',field:'channel',priority:1},{label:'Text',field:'body',priority:2},
      {label:'SMS segments',field:'segments',priority:2,align:'right',numeric:true},{label:'Approval',field:'approval',priority:1}],
      actions:[{label:'Edit',icon:'pencil',primary:true,show:function (row) { return GT.communication.canEditTemplate(row); },onClick:function (row) { location.hash='#/communication/templates/'+row.id; }},
        {label:'Approve',icon:'check',primary:true,show:function (row) { return manager()&&row.approved===false; },onClick:function (row) { GT.communication.approveTemplate(row.id); GT.components.showToast('Template approved.','success'); table.refresh(); }}],
      emptyState:{message:'No message templates match the filters.'},exportName:'message-templates.csv'});
    return '<section class="communication-page">'+header('Templates','Edit message wording and review approval before Sales use.')+'<div id="communicationTable"></div></section>';
  }
  function renderTemplateEdit(params) {
    var row=GT.store.find('message_templates',Number(params.id));
    if (!row||!GT.communication.canEditTemplate(row)) return '<section class="page-placeholder"><h1>Access denied</h1><p>This template cannot be edited by your role.</p></section>';
    var isSupplier=row.name==='Supplier discrepancy notice', previewRows=isSupplier?discrepancySuppliers():customers();
    return '<section class="communication-page">'+header('Edit '+row.name,'Placeholders are filled for each recipient before sending.')+'<form id="templateForm" class="gt-communication-form" novalidate>'+field('Template text','templateBody','<textarea class="form-control" id="templateBody" rows="7">'+esc(row.body)+'</textarea>')+'<p id="templateCounter" aria-live="polite"></p>'+field(isSupplier?'Preview supplier':'Preview customer','templateCustomer','<select class="form-select" id="templateCustomer">'+options(previewRows,previewRows[0]&&previewRows[0].id)+'</select>')+'<div class="gt-communication-preview" id="templatePreview"></div><p class="field-error" id="templateError" role="alert"></p><div class="gt-communication-actions"><button class="btn btn-primary" type="submit">Save template</button><a class="btn btn-outline-secondary" href="#/communication/templates">Cancel</a></div></form></section>';
  }
  function bindTemplateEdit(params) {
    var form=document.getElementById('templateForm'); if (!form) return;
    var tracker=GT.forms.trackDirty(form);
    function update() { var body=document.getElementById('templateBody').value,source=Number(params.id)===6?'suppliers':'customers',row=GT.store.find(source,Number(document.getElementById('templateCustomer').value));
      document.getElementById('templateCounter').textContent=Array.from(body).length+' characters · '+GT.communication.segments(body)+' SMS segments';
      document.getElementById('templatePreview').textContent=row?GT.communication.preview(body,row):body;
    }
    form.addEventListener('input',update); form.addEventListener('change',update);
    form.addEventListener('submit',function (event) { event.preventDefault(); try { GT.communication.saveTemplate(Number(params.id),document.getElementById('templateBody').value); tracker.markSaved(); GT.components.showToast('Template saved.','success'); location.hash='#/communication/templates'; } catch (problem) { error('templateError',problem.message); } }); update();
  }
  function recipientMarkup() {
    var rows=customers(); return '<option value="">Choose a customer</option>'+options(rows,'');
  }
  function renderCompose() {
    if (!GT.permissions.can('messages','C')&&!manager()) return '<section class="page-placeholder"><h1>Access denied</h1><p>Your role cannot compose messages.</p></section>';
    var choices=allowedTemplates();
    return '<section class="communication-page">'+header('Messages','Compose and record a simulated message. No SMS, email or WhatsApp is delivered.',manager()?[{label:'Bulk messages',name:'bulk',icon:'users'}]:[])+'<form id="composeForm" class="gt-communication-form" novalidate><div class="gt-communication-grid">'+
      field('Channel','messageChannel',select('messageChannel',[{value:'sms',label:'SMS'},{value:'email',label:'Email'},{value:'whatsapp',label:'WhatsApp'}],'sms'))+
      '<div id="customerRecipient">'+field('Customer','messageCustomer','<select class="form-select" id="messageCustomer">'+recipientMarkup()+'</select>')+'</div>'+
      '<div id="supplierRecipient" hidden>'+field('Supplier','messageSupplier','<select class="form-select" id="messageSupplier"><option value="">Choose a supplier</option>'+options(discrepancySuppliers(),'')+'</select>')+'</div>'+
      field('Template','messageTemplate','<select class="form-select" id="messageTemplate"><option value="">Choose a template</option>'+options(choices,'')+'</select>')+'</div>'+
      '<p id="emailSender" class="text-muted" hidden>From: '+esc(GT.settings.sendingEmail)+'</p>'+
      field('Message text','messageBody','<textarea class="form-control" id="messageBody" rows="7"></textarea>')+
      '<div id="messageOverride" hidden>'+field('Seven-day override reason','overrideReason','<textarea class="form-control" id="overrideReason" rows="2"></textarea>')+'</div>'+
      '<p id="messageCounter" aria-live="polite"></p><section class="gt-communication-preview"><strong>Preview</strong><p id="messagePreview"></p></section><p class="field-error" id="messageError" role="alert"></p><div class="gt-communication-actions"><button type="submit" class="btn btn-primary" id="sendMessage">Record simulated send</button></div></form></section>';
  }
  function composeValues() { return {channel:document.getElementById('messageChannel').value,customerId:Number(document.getElementById('messageCustomer').value),supplierId:Number(document.getElementById('messageSupplier').value),templateId:Number(document.getElementById('messageTemplate').value),body:document.getElementById('messagePreview').textContent,overrideReason:document.getElementById('overrideReason').value}; }
  function bindCompose() {
    var form=document.getElementById('composeForm'); if (!form) return;
    var tracker=GT.forms.trackDirty(form);
    function update() {
      var template=GT.store.find('message_templates',Number(document.getElementById('messageTemplate').value)),supplier=template&&template.name==='Supplier discrepancy notice';
      document.getElementById('customerRecipient').hidden=Boolean(supplier); document.getElementById('supplierRecipient').hidden=!supplier;
      var row=supplier?GT.store.find('suppliers',Number(document.getElementById('messageSupplier').value)):GT.store.find('customers',Number(document.getElementById('messageCustomer').value));
      var raw=document.getElementById('messageBody').value,body=row?GT.communication.preview(raw,row):raw,channel=document.getElementById('messageChannel').value;
      document.getElementById('messagePreview').textContent=body;
      document.getElementById('messageCounter').textContent=Array.from(body).length+' characters'+(channel==='sms'?' · '+GT.communication.segments(body)+' SMS segments':'');
      document.getElementById('emailSender').hidden=channel!=='email';
      document.getElementById('messageOverride').hidden=!(template&&template.name==='Payment reminder'&&row&&GT.debtors.recentElectronic(row.id)&&user().role==='general_manager');
    }
    document.getElementById('messageTemplate').addEventListener('change',function () { var template=GT.store.find('message_templates',Number(this.value)); document.getElementById('messageBody').value=template?template.body:''; update(); });
    form.addEventListener('input',update); form.addEventListener('change',update);
    form.addEventListener('submit',function (event) { event.preventDefault(); try { var button=document.getElementById('sendMessage'); button.disabled=true; GT.communication.sendOne(composeValues()); tracker.markSaved(); GT.components.showToast('Message recorded as simulated.','success'); location.hash='#/communication/log'; } catch (problem) { error('messageError',problem.message); document.getElementById('sendMessage').disabled=false; } });
    var bulk=document.querySelector('[data-page-action="bulk"]'); if (bulk) bulk.addEventListener('click',function () { location.hash='#/communication/bulk'; }); update();
  }
  function renderBulk() {
    if (!manager()) return '<section class="page-placeholder"><h1>Access denied</h1><p>Bulk messages require Owner or General Manager.</p></section>';
    return '<section class="communication-page">'+header('Bulk messages','Review eligible customers, skipped customers and SMS segments before recording.',[{label:'Back to messages',route:'#/communication/messages',className:'btn-outline-secondary'}])+
      '<form id="bulkForm" class="gt-communication-form" novalidate><div class="gt-communication-grid">'+
      field('Channel','bulkChannel',select('bulkChannel',[{value:'sms',label:'SMS'},{value:'email',label:'Email'},{value:'whatsapp',label:'WhatsApp'}],'sms'))+
      field('Customer group','bulkGroup','<select class="form-select" id="bulkGroup"><option value="">All customers</option>'+options(GT.store.all('customer_groups'),'')+'</select>')+
      field('Template','bulkTemplate','<select class="form-select" id="bulkTemplate"><option value="">Choose a template</option>'+options(allowedTemplates(),'')+'</select>')+'</div>'+
      field('Message text','bulkBody','<textarea class="form-control" id="bulkBody" rows="5"></textarea>')+
      '<p id="bulkSummary" aria-live="polite"></p><div id="bulkRecipients"></div><p class="field-error" id="bulkError" role="alert"></p><div class="gt-communication-actions"><button type="submit" class="btn btn-primary" id="bulkSend">Record simulated sends</button></div></form></section>';
  }
  function bindBulk() {
    var form=document.getElementById('bulkForm'); if (!form) return;
    var tracker=GT.forms.trackDirty(form);
    function values() { return {channel:document.getElementById('bulkChannel').value,groupId:Number(document.getElementById('bulkGroup').value),templateId:Number(document.getElementById('bulkTemplate').value),body:document.getElementById('bulkBody').value}; }
    function update() { var selected=values(),plan=selected.templateId?GT.communication.bulkPlan(selected.groupId,selected.channel,selected.templateId,selected.body):[];
      var eligible=plan.filter(function (item) { return !item.reason; }),skipped=plan.filter(function (item) { return item.reason; });
      document.getElementById('bulkSummary').textContent=eligible.length+' eligible · '+skipped.length+' skipped · '+eligible.reduce(function (sum,item) { return sum+item.segments; },0)+' estimated SMS segments';
      document.getElementById('bulkRecipients').innerHTML='<h2>Eligible</h2>'+(eligible.length?'<ul>'+eligible.map(function (item) { return '<li>'+esc(item.customer.name)+' — '+esc(item.body)+'</li>'; }).join('')+'</ul>':'<p>No eligible customers.</p>')+
        '<h2>Skipped</h2>'+(skipped.length?'<ul>'+skipped.map(function (item) { return '<li>'+esc(item.customer.name)+' — '+esc(item.reason)+'</li>'; }).join('')+'</ul>':'<p>No customers skipped.</p>');
    }
    document.getElementById('bulkTemplate').addEventListener('change',function () { var row=GT.store.find('message_templates',Number(this.value)); document.getElementById('bulkBody').value=row?row.body:''; update(); });
    form.addEventListener('input',update); form.addEventListener('change',update);
    form.addEventListener('submit',function (event) { event.preventDefault(); try { var button=document.getElementById('bulkSend'); button.disabled=true; var saved=GT.communication.sendBulk(values()); tracker.markSaved(); GT.components.showToast(saved.length+' simulated messages recorded.','success'); location.hash='#/communication/log'; } catch (problem) { error('bulkError',problem.message); document.getElementById('bulkSend').disabled=false; } }); update();
  }
  function logRows() { return GT.communication.log().map(function (row) { var template=GT.store.find('message_templates',row.template_id),sender=GT.store.find('users',row.sent_by); return Object.assign({},row,{template_name:template?template.name:'Unlinked',sender_name:sender?sender.name:'Not sent',day:String(row.sent_at||row.created_at).slice(0,10)}); }); }
  function renderLog() {
    table=GT.dataTable.create({id:'messageLogTable',rows:logRows,searchFields:['recipient_name','body','recipient_contact'],filters:[
      {name:'channel',label:'Channel',field:'channel',options:['sms','email','whatsapp'].map(function (value) { return {value:value,label:value.toUpperCase()}; })},
      {name:'template',label:'Template',field:'template_id',options:templates().map(function (row) { return {value:row.id,label:row.name}; })},
      {name:'sender',label:'Sender',field:'sent_by',options:GT.store.all('users').map(function (row) { return {value:row.id,label:row.name}; })},
      {name:'date_from',label:'From date',type:'date',test:function (row,value) { return row.day>=value; }},
      {name:'date_to',label:'To date',type:'date',test:function (row,value) { return row.day<=value; }}],columns:[
      {label:'Date',field:'day',priority:1,formatter:GT.dates.formatDate},{label:'Recipient',field:'recipient_name',priority:1},
      {label:'Channel',field:'channel',priority:1},{label:'Template',field:'template_name',priority:2},{label:'Sender',field:'sender_name',priority:2},
      {label:'Status',field:'status',priority:1},{label:'Message',field:'body',priority:2}],emptyState:{message:'No messages match the filters.'},exportName:'message-log.csv'});
    return '<section class="communication-page">'+header('Message Log','Simulated and historical message records.')+'<div id="communicationTable"></div></section>';
  }
  function posterValues() { return {title:document.getElementById('posterTitle').value,template:document.getElementById('posterType').value,size_preset:document.getElementById('posterSize').value,
    text:document.getElementById('posterText').value,start_date:document.getElementById('posterStart').value,end_date:document.getElementById('posterEnd').value,
    contact:document.getElementById('posterContact').value,price_text:document.getElementById('posterPrices').value}; }
  function posterArt(values) {
    var c=values.content_json||values,showPrices=GT.communication.canSeePrice()&&values.template==='price_list';
    return '<div class="poster-art poster-'+esc(values.template)+' poster-'+esc(values.size_preset)+'"><img src="'+esc(GT.settings.logoSmall)+'" alt="'+esc(GT.settings.logoAlt)+'"><strong>'+esc(GT.settings.businessName)+'</strong><small>'+esc(GT.settings.tagline)+'</small><h2>'+esc(values.title||'Your poster title')+'</h2><p>'+esc(c.text||'Your announcement')+'</p>'+
      (showPrices&&c.price_text?'<p class="poster-prices">'+esc(c.price_text)+'</p>':'')+
      (c.start_date?'<p>'+esc(GT.dates.formatDate(c.start_date))+(c.end_date?' – '+esc(GT.dates.formatDate(c.end_date)):'')+'</p>':'')+
      '<footer>'+esc(c.contact||GT.settings.phones[0]||'')+'</footer></div>';
  }
  function renderPoster() {
    table=GT.dataTable.create({id:'postersTable',rows:function () { return GT.store.all('posters').filter(function (row) { return manager()||user().role==='marketing_manager'||row.created_by===user().id; }); },searchFields:['title'],columns:[{label:'Title',field:'title',priority:1},{label:'Type',field:'template',priority:1},{label:'Size',field:'size_preset',priority:2}],actions:[{label:'Open',icon:'pencil',primary:true,onClick:function (row) { loadPoster(row.id); }}],emptyState:{message:'No posters saved yet.'},exportName:'posters.csv'});
    return '<section class="communication-page">'+header('Poster Studio','Create, save and print a poster using the shared business identity.')+'<form id="posterForm" class="gt-communication-form" novalidate><div class="gt-communication-grid">'+
      field('Title','posterTitle','<input class="form-control" id="posterTitle" required>')+
      field('Type','posterType',select('posterType',[{value:'promotion',label:'Promotion'},{value:'price_list',label:'Price list'},{value:'event',label:'Event announcement'}],'promotion'))+
      field('Size','posterSize',select('posterSize',[{value:'whatsapp_status',label:'WhatsApp status'},{value:'instagram',label:'Instagram'},{value:'facebook',label:'Facebook'}],'whatsapp_status'))+
      field('Start date','posterStart','<input class="form-control" type="date" id="posterStart">')+
      field('End date','posterEnd','<input class="form-control" type="date" id="posterEnd">')+
      field('Contact','posterContact','<input class="form-control" id="posterContact" value="'+esc(GT.settings.phones[0]||'')+'">')+'</div>'+
      field('Text','posterText','<textarea class="form-control" id="posterText" rows="4"></textarea>')+
      '<div id="posterPriceField">'+field('Prices','posterPrices','<textarea class="form-control" id="posterPrices" rows="3" placeholder="Item — UGX price"></textarea>')+'<p class="form-text">Type prices by hand. This poster does not use or change product prices.</p></div>'+
      '<h2>Live preview</h2><div id="posterPreview"></div><p class="field-error" id="posterError" role="alert"></p><div class="gt-communication-actions"><button class="btn btn-primary" type="submit">Save poster</button><button class="btn btn-outline-secondary" type="button" id="printPoster">Print preview</button><button class="btn btn-outline-secondary" type="button" id="newPoster">New poster</button></div></form><h2>Saved posters</h2><div id="communicationTable"></div></section>';
  }
  function loadPoster(id) {
    if (GT.forms.hasUnsavedChanges()&&!window.confirm('You have unsaved changes. Open another poster?')) return;
    var row=GT.store.find('posters',id); if (!row) return; posterId=row.id; var c=row.content_json||{};
    [['posterTitle',row.title],['posterType',row.template],['posterSize',row.size_preset],['posterText',c.text],['posterStart',c.start_date],['posterEnd',c.end_date],['posterContact',c.contact],['posterPrices',c.price_text]].forEach(function (pair) { document.getElementById(pair[0]).value=pair[1]||''; }); if (posterTracker) posterTracker.markSaved(); updatePoster(); window.scrollTo(0,0);
  }
  function updatePoster() { var values=posterValues(); document.getElementById('posterPriceField').hidden=values.template!=='price_list'||!GT.communication.canSeePrice(); document.getElementById('posterPreview').innerHTML=posterArt(values); }
  function bindPoster() {
    posterId=null; table.mount('#communicationTable'); var form=document.getElementById('posterForm'); posterTracker=GT.forms.trackDirty(form); form.addEventListener('input',updatePoster); form.addEventListener('change',updatePoster);
    form.addEventListener('submit',function (event) { event.preventDefault(); try { var saved=GT.communication.savePoster(posterId,posterValues()); posterId=saved.id; posterTracker.markSaved(); GT.components.showToast('Poster saved.','success'); table.refresh(); } catch (problem) { error('posterError',problem.message); } });
    document.getElementById('newPoster').addEventListener('click',function () { if (GT.forms.hasUnsavedChanges()&&!window.confirm('You have unsaved changes. Start a new poster?')) return; posterId=null; form.reset(); posterTracker.markSaved(); updatePoster(); });
    document.getElementById('printPoster').addEventListener('click',function () { var values=posterValues(); if (values.template==='price_list'&&!GT.communication.canSeePrice()) return; GT.print.open(GT.print.letterhead()+'<div class="poster-print">'+posterArt(values)+'</div>','Poster print preview'); }); updatePoster();
  }
  function render(view,params) { if (view==='templates') return renderTemplates(); if (view==='templateEdit') return renderTemplateEdit(params); if (view==='compose') return renderCompose(); if (view==='bulk') return renderBulk(); if (view==='log') return renderLog(); return renderPoster(); }
  function bind(view,params) { if (view==='templates'||view==='log') table.mount('#communicationTable'); else if (view==='templateEdit') bindTemplateEdit(params); else if (view==='compose') bindCompose(); else if (view==='bulk') bindBulk(); else bindPoster(); }
  var api={render:render,bind:bind};
  [['#/communication/messages','compose','Messages','messages_compose'],['#/communication/bulk','bulk','Bulk messages','bulk_messages'],
    ['#/communication/templates','templates','Templates','messages_templates'],['#/communication/templates/:id','templateEdit','Edit template','messages_templates'],
    ['#/communication/log','log','Message Log','messages_log'],['#/communication/poster-studio','poster','Poster Studio','poster_studio']].forEach(function (item) {
    GT.router.register(item[0],{module:api,view:item[1],title:item[2],permission:item[3],baseRoute:item[1]==='bulk'?'#/communication/messages':item[1]==='templateEdit'?'#/communication/templates':item[0]});
  });
  return api;
}());
