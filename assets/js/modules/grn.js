/* Phase 6 Goods Received Notes: role-aware forms, posting, notices, voiding and print. */
window.GT = window.GT || {};
window.GT.grnModule = (function () {
  var table = null;
  var editor = null;
  var tracker = null;
  var photoData = '';

  function escape(value) { return window.GT.components.escapeHtml(value); }
  function user() { return window.GT.session.currentUser(); }
  function supplier(id) { return window.GT.store.find('suppliers', id); }
  function location(id) { return window.GT.store.find('locations', id); }
  function receiver(id) { return window.GT.store.find('users', id); }
  function material(id) { return window.GT.store.find('materials', id); }
  function statusTone(status) { return status === 'ok' ? 'success' : 'error'; }
  function statusLabel(status) { return status === 'ok' ? 'OK' : status === 'void' ? 'Void' : 'Discrepancy'; }
  function checkSummary(row) { return row.quantity_ok && row.quality_ok && row.damage_ok && row.colour_ok ? 'All OK' : 'Discrepancy'; }
  function checksMarkup(grn) { return [['Quantity',grn.quantity_ok],['Quality',grn.quality_ok],['Damage',grn.damage_ok],['Colour',grn.colour_ok]].map(function (entry) { return '<span class="status-badge ' + (entry[1] ? 'status-success' : 'status-error') + '">' + entry[0] + ': ' + (entry[1] ? 'OK' : 'Issue') + '</span>'; }).join(''); }

  function listRows() {
    return window.GT.store.all('goods_received_notes').sort(function (a,b) { return String(b.received_at).localeCompare(String(a.received_at)) || b.id-a.id; }).map(function (grn) {
      var notices = grn.status === 'discrepancy' ? (grn.supplier_notified ? 'Yes' : 'No') : 'Not needed';
      return Object.assign({}, grn, { supplier_name:(supplier(grn.supplier_id)||{}).name || 'Unknown', location_name:(location(grn.location_id)||{}).name || 'Unknown', receiver_name:(receiver(grn.received_by)||{}).name || 'Unknown', line_count:window.GT.grns.items(grn.id).length, checks_label:checkSummary(grn), status_label:statusLabel(grn.status), notice_label:notices, cost_total:window.GT.grns.totalCost(grn.id) });
    });
  }

  function openPrint(row) { window.GT.print.open(window.GT.grns.printMarkup(row.id), 'GRN ' + row.number); }

  function openNotice(row) {
    var message;
    try { message = window.GT.grns.createNotice(row.id); }
    catch (error) { window.GT.components.showToast(error.message, 'error'); return; }
    window.GT.components.openModal({ title:'Supplier discrepancy notice', content:'<p class="field-help">Prototype email draft. No message is sent.</p><textarea class="form-control supplier-notice-text" id="supplierNoticeText" rows="10" readonly>' + escape(message.body) + '</textarea><div class="gt-modal-actions"><button class="btn btn-outline-primary" type="button" id="copySupplierNotice"><i data-lucide="copy" aria-hidden="true"></i> Copy</button><button class="btn btn-primary" type="button" id="markSupplierNotified">Mark as notified</button></div>' });
    document.getElementById('copySupplierNotice').addEventListener('click', function () {
      var text = document.getElementById('supplierNoticeText').value;
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { window.GT.components.showToast('Supplier notice copied.', 'success'); });
      else { document.getElementById('supplierNoticeText').select(); document.execCommand('copy'); window.GT.components.showToast('Supplier notice copied.', 'success'); }
    });
    document.getElementById('markSupplierNotified').addEventListener('click', function () { window.GT.grns.markNotified(row.id); window.GT.components.closeModal(); window.GT.components.showToast('Supplier marked as notified.', 'success'); window.GT.app.renderPage(); });
    window.GT.components.refreshIcons();
  }

  function openVoid(row) {
    window.GT.components.openModal({ title:'Void goods received note', content:'<p>Stock received on this GRN will be reversed. This is refused if any of it has already been used.</p><label class="form-label" for="grnVoidReason">Reason</label><textarea class="form-control" id="grnVoidReason" rows="3"></textarea><p class="field-error" id="grnVoidError"></p><div class="gt-modal-actions"><button class="btn btn-danger" type="button" id="confirmGrnVoid">Void GRN</button></div>' });
    document.getElementById('confirmGrnVoid').addEventListener('click', function () {
      var reason = document.getElementById('grnVoidReason').value.trim();
      if (!reason) { document.getElementById('grnVoidError').textContent = 'Enter a reason.'; return; }
      try { window.GT.grns.voidNote(row.id, reason); window.GT.components.closeModal(); window.GT.components.showToast('GRN ' + row.number + ' was voided and its stock was reversed.', 'success'); window.GT.app.refreshChrome(); window.GT.app.renderPage(); }
      catch (error) { document.getElementById('grnVoidError').textContent = error.message; }
    });
  }

  function renderList() {
    var columns = [
      {label:'Number',field:'number',sortable:true,priority:1,align:'right',numeric:true,minWidth:120},{label:'Date',field:'received_at',sortable:true,priority:1,minWidth:110,formatter:window.GT.dates.formatDate},{label:'Supplier',field:'supplier_name',sortable:true,priority:1},
      {label:'Supplier document',field:'supplier_doc_no',priority:2,formatter:function(value,row){return row.supplier_doc_missing ? 'None supplied' : value;}},{label:'Location',field:'location_name',sortable:true,priority:2},{label:'Lines',field:'line_count',sortable:true,priority:3,align:'right',numeric:true,minWidth:80},
      {label:'Checks',field:'checks_label',sortable:true,priority:2,html:true,formatter:function(value){return window.GT.components.statusBadge(value,value === 'All OK' ? 'success' : 'error');},exportValue:function(row){return row.checks_label;}},
      {label:'Status',field:'status_label',sortable:true,priority:1,html:true,formatter:function(value,row){return window.GT.components.statusBadge(value,statusTone(row.status));},exportValue:function(row){return row.status_label;}},
      {label:'Supplier notified',field:'notice_label',sortable:true,priority:3},{label:'Received by',field:'receiver_name',sortable:true,priority:3}
    ];
    if (window.GT.grns.canSeeCost()) columns.splice(6,0,{label:'Accepted cost',field:'cost_total',sortable:true,priority:1,align:'right',numeric:true,minWidth:130,formatter:window.GT.format.formatMoney,exportValue:function(row){return row.cost_total;}});
    table = window.GT.dataTable.create({ id:'grnTable',rows:listRows,caption:'Goods Received Notes',searchFields:['number','supplier_name','supplier_doc_no','receiver_name'],searchPlaceholder:'Search GRNs',filters:[
      {name:'supplier',label:'Supplier',field:'supplier_id',options:window.GT.suppliers.options()},
      {name:'status',label:'Status',field:'status',options:[{value:'ok',label:'OK'},{value:'discrepancy',label:'Discrepancy'},{value:'void',label:'Void'}]},
      {name:'location',label:'Location',field:'location_id',options:window.GT.store.all('locations').map(function(row){return {value:row.id,label:row.name};})},
      {name:'date_from',label:'From date',type:'date',test:function(row,value){return row.received_at>=value;}},{name:'date_to',label:'To date',type:'date',test:function(row,value){return row.received_at<=value;}}
    ],columns:columns,actions:[
      {label:'View',icon:'eye',primary:true,onClick:function(row){window.location.hash='#/inventory/grns/'+row.id;}},
      {label:'Print',icon:'printer',onClick:openPrint},
      {label:'Prepare supplier notice',icon:'mail',show:function(row){return row.status==='discrepancy'&&window.GT.permissions.can('goods_received_notes','C');},onClick:openNotice},
      {label:'Void',icon:'ban',destructive:true,show:function(row){return user().role==='owner'&&row.status!=='void';},onClick:openVoid}
    ],emptyState:{message:'No goods received notes match the current filters.'},exportName:'genuine-textiles-grns.csv' });
    return '<section class="grn-page">' + window.GT.components.pageHeader({title:'Goods Received Notes',description:'Post supplier deliveries and record quantity, quality, damage and colour checks.',breadcrumbs:[{label:'Inventory'},{label:'Goods Received Notes'}],actions:[{label:'New GRN',icon:'plus',route:'#/inventory/grns/new',permission:'goods_received_notes',permissionAction:'C'}]}) + '<div id="grnListMount"></div></section>';
  }

  function activeUserOptions() { return window.GT.session.users().map(function(row){return {value:row.id,label:row.name};}); }
  function locationOptions() { return window.GT.store.all('locations').map(function(row){return {value:row.id,label:row.name};}); }
  function materialOptions() { return window.GT.store.where('materials',{active:true}).map(function(row){return {value:row.id,label:row.name+' — '+(row.colour||'No colour')+(row.width_inches?' — '+row.width_inches+' in':'')};}); }
  function unitFor(row) { var selected=material(row.material_id); return row.entry_unit==='roll'?'roll':(selected?selected.unit:'—'); }
  function lineColumns() {
    var result = [
      {key:'material_id',label:'Material',type:'search-select',options:materialOptions,validate:function(value){return material(value)?'':'Choose a material from the list.';}},
      {key:'entry_unit',label:'Enter as',type:'select',options:[{value:'base',label:'Base unit'},{value:'roll',label:'Rolls (fabric only)'}]},
      {key:'quantity_received',label:'Received',type:'number',step:'0.001',validate:function(value){return Number(value)>0?'':'Enter a quantity above zero.';}},
      {key:'quantity_rejected',label:'Rejected',type:'number',step:'0.001',validate:function(value,row){return Number(value)>=0&&Number(value)<=Number(row.quantity_received)?'':'Rejected must be between zero and received.';}},
      {key:'unit_label',label:'Unit',type:'computed',compute:unitFor}
    ];
    if (window.GT.grns.canEnterCost()) result.push({key:'unit_cost',label:'Unit cost',type:'money',validate:function(value){return value===null||value===''||value===undefined||(Number.isInteger(Number(value))&&Number(value)>0)?'':'Use a positive whole UGX amount.';}});
    return result;
  }

  function checkField(name,label) { return '<fieldset class="grn-check"><legend>'+label+'</legend><label><input type="radio" name="'+name+'" value="ok" checked> OK</label><label><input type="radio" name="'+name+'" value="issue"> Issue</label></fieldset>'; }

  function createFormMarkup() {
    var params = new URLSearchParams((window.location.hash.split('?')[1]||''));
    var materialId = Number(params.get('material'))||'';
    var supplierId = Number(params.get('supplier'))||'';
    var selectedMaterial = material(materialId);
    if (selectedMaterial && !supplierId) supplierId=selectedMaterial.supplier_id;
    var values={supplier_id:supplierId,received_at:window.GT.dates.today(),location_id:user().location_id,supplier_doc_no:'',supplier_doc_missing:false,received_by:user().id};
    var delivery=[{title:'Delivery details',fields:[{name:'supplier_id',label:'Supplier',type:'select',required:true,valueType:'number',options:window.GT.suppliers.options()},{name:'received_at',label:'Date received',type:'date',required:true},{name:'location_id',label:'Location',type:'select',required:true,valueType:'number',options:locationOptions()},{name:'supplier_doc_no',label:'Supplier document number',type:'text',required:true},{name:'supplier_doc_missing',label:'No supplier document',type:'checkbox',checkboxLabel:'No supplier document was provided',fullWidth:true},{name:'received_by',label:'Received by',type:'select',required:true,valueType:'number',options:activeUserOptions()}]}];
    var form=window.GT.forms.render({id:'grnForm',sections:delivery,values:values,submitLabel:'Post GRN',cancelRoute:'#/inventory/grns'});
    var custom='<fieldset class="form-section"><legend>Items</legend><p class="form-section-description">Quantities post in each material\'s base unit. Choose Rolls only when a fabric has a roll length.</p><div id="grnLineEditor"></div><p class="field-error" id="itemsError"></p></fieldset><fieldset class="form-section"><legend>Delivery checks</legend><div class="grn-check-grid">'+checkField('quantity_ok','Quantity')+checkField('quality_ok','Quality')+checkField('damage_ok','Damage')+checkField('colour_ok','Colour')+'</div></fieldset><fieldset class="form-section"><legend>Notes and photo</legend><div class="form-grid"><div class="form-field form-field-full" data-field-wrap="notes"><label class="form-label" for="notes">Notes</label><textarea class="form-control" id="notes" name="notes" rows="3" aria-describedby="notesError"></textarea><p class="field-error" id="notesError"></p></div><div class="form-field form-field-full"><label class="form-label" for="grnPhoto">Delivery photo (optional)</label><input class="form-control" id="grnPhoto" type="file" accept="image/*"><p class="field-help">Compressed to 800px and stored only in this prototype.</p><p class="field-error" id="grnPhotoError"></p><img class="grn-photo-preview" id="grnPhotoPreview" alt="Selected delivery photo preview" hidden></div></div></fieldset>';
    form=form.replace('<div class="form-actions">',custom+'<div class="form-actions">');
    var initialRows=[{material_id:materialId,entry_unit:'base',quantity_received:null,quantity_rejected:0,unit_cost:null}];
    return {html:'<section class="grn-page grn-form-page">'+window.GT.components.pageHeader({title:'New Goods Received Note',description:'Saving posts accepted quantities to stock immediately.',breadcrumbs:[{label:'Goods Received Notes',route:'#/inventory/grns'},{label:'New GRN'}]})+form+'</section>',sections:delivery,rows:initialRows};
  }

  var pendingCreateConfig=null;
  function mergeDuplicates(rows) {
    var grouped={}; var duplicate=false;
    rows.forEach(function(row){ if(!row.material_id)return; if(grouped[row.material_id]){duplicate=true; var existing=grouped[row.material_id]; var selected=material(row.material_id); existing.quantity_received=window.GT.grns.toBaseQuantity(selected,existing.quantity_received,existing.entry_unit)+window.GT.grns.toBaseQuantity(selected,row.quantity_received,row.entry_unit); existing.quantity_rejected=window.GT.grns.toBaseQuantity(selected,existing.quantity_rejected,existing.entry_unit)+window.GT.grns.toBaseQuantity(selected,row.quantity_rejected,row.entry_unit); existing.entry_unit='base'; } else grouped[row.material_id]=Object.assign({},row); });
    return {duplicate:duplicate,rows:Object.keys(grouped).map(function(key){return grouped[key];})};
  }

  function bindCreate() {
    var form=document.getElementById('grnForm'); photoData='';
    form.elements.received_at.max=window.GT.dates.today();
    editor=window.GT.lineEditor.create({id:'grnLines',rows:pendingCreateConfig.rows,newRow:{material_id:'',entry_unit:'base',quantity_received:null,quantity_rejected:0,unit_cost:null},columns:lineColumns(),addLabel:'Add material',footer:window.GT.grns.canEnterCost()?function(rows){var total=rows.reduce(function(sum,row){return sum+Math.max(0,Number(row.quantity_received||0)-Number(row.quantity_rejected||0))*Number(row.unit_cost||0);},0);return '<strong>Accepted cost: '+window.GT.format.formatMoney(total)+'</strong>';}:null}).mount('#grnLineEditor');
    tracker=window.GT.forms.trackDirty(form);
    form.elements.supplier_doc_missing.addEventListener('change',function(){ var missing=this.checked; form.elements.supplier_doc_no.disabled=missing; form.elements.supplier_doc_no.required=!missing; if(missing)form.elements.supplier_doc_no.value=''; });
    document.getElementById('grnPhoto').addEventListener('change',function(){ var file=this.files[0]; if(!file)return; document.getElementById('grnPhotoError').textContent=''; window.GT.files.compressImage(file,800).then(function(data){photoData=data; var preview=document.getElementById('grnPhotoPreview'); preview.src=data; preview.hidden=false;}).catch(function(error){document.getElementById('grnPhotoError').textContent=error.message;}); });
    form.addEventListener('submit',function(event){ event.preventDefault(); var values=window.GT.forms.read(form,pendingCreateConfig.sections); var rows=editor.getRows().filter(function(row){return row.material_id||Number(row.quantity_received)>0;}); var merged=mergeDuplicates(rows); if(merged.duplicate){ if(window.confirm('The same material appears more than once. Merge duplicate lines?')){editor.setRows(merged.rows);window.GT.components.showToast('Duplicate material lines were merged. Review them, then post again.','info');} return; }
      var draft=Object.assign(values,{items:rows,notes:form.elements.notes.value,photo_data:photoData}); ['quantity_ok','quality_ok','damage_ok','colour_ok'].forEach(function(key){draft[key]=form.elements[key].value==='ok';});
      var lineErrors=editor.validate(); var errors=window.GT.grns.validateDraft(Object.assign({},draft,{items:rows.map(function(row){try{return Object.assign({},row,{quantity_received:window.GT.grns.toBaseQuantity(material(row.material_id),row.quantity_received,row.entry_unit),quantity_rejected:window.GT.grns.toBaseQuantity(material(row.material_id),row.quantity_rejected,row.entry_unit)});}catch(error){return row;}})})); if(lineErrors.length&&!errors.items)errors.items=lineErrors[0].message;
      if(!window.GT.forms.showErrors(form,errors)){var itemError=document.getElementById('itemsError');if(itemError)itemError.textContent=errors.items||'';return;}
      try{var saved=window.GT.grns.post(draft);tracker.markSaved();window.GT.components.showToast('GRN '+saved.number+' was posted and stock was updated.','success');window.location.hash='#/inventory/grns/'+saved.id;}catch(error){if(error.validationErrors)window.GT.forms.showErrors(form,error.validationErrors);else window.GT.components.showToast(error.message,'error');}
    });
  }

  function itemTable(grn,editable) {
    var showCost=window.GT.grns.canSeeCost();
    var head='<th>Material</th><th>Received</th><th>Rejected</th><th>Accepted</th><th>Unit</th>'+(showCost?'<th>Unit cost</th>':'');
    var body=window.GT.grns.items(grn.id).map(function(item){var row=material(item.material_id);var cost=showCost?(editable&&window.GT.grns.canEditCost()?'<input class="form-control form-control-sm" type="text" inputmode="numeric" data-item-cost="'+item.id+'" value="'+escape(item.unit_cost||'')+'">':(item.unit_cost?window.GT.format.formatMoney(item.unit_cost):'—')):'';return '<tr><td>'+escape(row.name)+'</td><td>'+item.quantity_received+'</td><td>'+item.quantity_rejected+'</td><td>'+window.GT.grns.accepted(item)+'</td><td>'+escape(row.unit)+'</td>'+(showCost?'<td>'+cost+'</td>':'')+'</tr>';}).join('');
    return '<div class="table-responsive"><table class="grn-items-table"><thead><tr>'+head+'</tr></thead><tbody>'+body+'</tbody></table></div>';
  }

  function detailActions(grn) { var actions=[{label:'Print',name:'print',icon:'printer'}]; if(grn.status==='discrepancy'&&window.GT.permissions.can('goods_received_notes','C'))actions.push({label:'Prepare supplier notice',name:'notice',icon:'mail'}); if(window.GT.permissions.can('goods_received_notes','E')&&grn.status!=='void')actions.push({label:'Edit notes',route:'#/inventory/grns/'+grn.id+'/edit',icon:'pencil'}); if(user().role==='owner'&&grn.status!=='void')actions.push({label:'Void',name:'void',icon:'ban',className:'btn-outline-danger'}); return actions; }
  function timeline(grn) { var creator=receiver(grn.created_by); var values=['<li><strong>Created</strong><span>'+escape(grn.created_at||grn.received_at)+' by '+escape(creator?creator.name:'Unknown')+'</span></li>']; if(grn.supplier_notified)values.push('<li><strong>Supplier notified</strong><span>'+escape(grn.supplier_notified_at||'Recorded')+'</span></li>'); if(grn.status==='void'){var voider=receiver(grn.voided_by);values.push('<li><strong>Voided</strong><span>'+escape(grn.voided_at)+' by '+escape(voider?voider.name:'Unknown')+' — '+escape(grn.void_reason)+'</span></li>');} return '<ol class="grn-timeline">'+values.join('')+'</ol>'; }
  function renderDetail(params) { var grn=window.GT.store.find('goods_received_notes',params.id); if(!grn)return '<section class="page-placeholder"><h1>GRN not found</h1></section>'; var sup=supplier(grn.supplier_id),loc=location(grn.location_id),rec=receiver(grn.received_by); var movements=window.GT.store.where('stock_movements',function(row){return row.reference_type==='goods_received_note'&&Number(row.reference_id)===Number(grn.id);}); return '<section class="grn-page" data-grn-id="'+grn.id+'">'+window.GT.components.pageHeader({title:'GRN '+grn.number,badge:window.GT.components.statusBadge(statusLabel(grn.status),statusTone(grn.status)),description:'Posted goods receipt. Quantities change only through void and replacement.',breadcrumbs:[{label:'Goods Received Notes',route:'#/inventory/grns'},{label:'GRN '+grn.number}],actions:detailActions(grn)})+'<div class="grn-detail-grid"><article class="detail-card grn-detail-main"><h2>Delivery</h2><dl class="detail-grid">'+window.GT.components.detailRow('Supplier',sup?sup.name:'Unknown')+window.GT.components.detailRow('Date',window.GT.dates.formatDate(grn.received_at))+window.GT.components.detailRow('Supplier document',grn.supplier_doc_missing?'No supplier document':grn.supplier_doc_no)+window.GT.components.detailRow('Location',loc?loc.name:'Unknown')+window.GT.components.detailRow('Received by',rec?rec.name:'Unknown')+window.GT.components.detailRow('Supplier notified',grn.status==='discrepancy'?(grn.supplier_notified?'Yes':'No'):'Not needed')+'</dl><h2>Items</h2>'+itemTable(grn,false)+'<h2>Checks</h2><div class="grn-check-summary">'+checksMarkup(grn)+'</div><h2>Notes</h2><p>'+escape(grn.notes||'No notes.')+'</p>'+(grn.photo_data?'<button class="grn-photo-button" type="button" data-photo-open><img src="'+grn.photo_data+'" alt="Delivery photo thumbnail"></button>':'')+'<h2>Stock movements</h2><ul class="grn-movement-links">'+movements.map(function(row){return '<li><a href="#/inventory/movements">Movement '+row.id+': '+row.quantity+' units</a></li>';}).join('')+'</ul></article><aside class="detail-card grn-timeline-card"><h2>Timeline</h2>'+timeline(grn)+'</aside></div></section>'; }

  function bindDetail(params) { var grn=window.GT.store.find('goods_received_notes',params.id); document.querySelectorAll('[data-page-action]').forEach(function(button){button.addEventListener('click',function(){if(button.dataset.pageAction==='print')openPrint(grn);if(button.dataset.pageAction==='notice')openNotice(grn);if(button.dataset.pageAction==='void')openVoid(grn);});}); var photo=document.querySelector('[data-photo-open]');if(photo)photo.addEventListener('click',function(){window.GT.components.openModal({title:'Delivery photo',content:'<img class="grn-photo-large" src="'+grn.photo_data+'" alt="Delivery photo">'});}); }

  function renderEdit(params) { var grn=window.GT.store.find('goods_received_notes',params.id); if(!grn)return '<section class="page-placeholder"><h1>GRN not found</h1></section>'; var form='<form class="gt-form" id="grnEditForm" novalidate><div class="form-error-summary" data-error-summary tabindex="-1" hidden><strong>Please correct the following:</strong><ul></ul></div><fieldset class="form-section"><legend>Locked posted fields</legend><p class="locked-note">Quantities are locked once posted. To correct them, void this note and enter a new one.</p><dl class="detail-grid">'+window.GT.components.detailRow('Supplier',(supplier(grn.supplier_id)||{}).name)+window.GT.components.detailRow('Date',window.GT.dates.formatDate(grn.received_at))+window.GT.components.detailRow('Location',(location(grn.location_id)||{}).name)+'</dl>'+itemTable(grn,true)+'</fieldset><fieldset class="form-section"><legend>Editable details</legend><div class="form-grid"><div class="form-field"><label class="form-label" for="editSupplierDoc">Supplier document number</label><input class="form-control" id="editSupplierDoc" name="supplier_doc_no" value="'+escape(grn.supplier_doc_no)+'"'+(grn.supplier_doc_missing?' disabled':'')+'><p class="field-error" id="supplier_doc_noError"></p></div><div class="form-field"><label class="form-check"><input class="form-check-input" id="editDocMissing" name="supplier_doc_missing" type="checkbox"'+(grn.supplier_doc_missing?' checked':'')+'><span>No supplier document</span></label></div><div class="form-field form-field-full"><label class="form-label" for="editNotes">Notes</label><textarea class="form-control" id="editNotes" name="notes" rows="3">'+escape(grn.notes)+'</textarea></div><div class="form-field form-field-full"><label class="form-check"><input class="form-check-input" name="supplier_notified" type="checkbox"'+(grn.supplier_notified?' checked':'')+'><span>Supplier notified</span></label></div><div class="form-field form-field-full"><label class="form-label" for="editGrnPhoto">Replace photo</label><input class="form-control" id="editGrnPhoto" type="file" accept="image/*"><p class="field-error" id="editGrnPhotoError"></p></div></div></fieldset><div class="form-actions"><button class="btn btn-primary" type="submit">Save changes</button><a class="btn btn-outline-secondary" href="#/inventory/grns/'+grn.id+'">Cancel</a></div></form>'; return '<section class="grn-page grn-form-page">'+window.GT.components.pageHeader({title:'Edit GRN '+grn.number,description:'Only metadata and permitted unit costs can change after posting.',breadcrumbs:[{label:'Goods Received Notes',route:'#/inventory/grns'},{label:'GRN '+grn.number,route:'#/inventory/grns/'+grn.id},{label:'Edit'}]})+form+'</section>'; }
  function bindEdit(params) { var grn=window.GT.store.find('goods_received_notes',params.id),form=document.getElementById('grnEditForm');photoData=grn.photo_data||'';tracker=window.GT.forms.trackDirty(form);form.elements.supplier_doc_missing.addEventListener('change',function(){form.elements.supplier_doc_no.disabled=this.checked;if(this.checked)form.elements.supplier_doc_no.value='';});document.getElementById('editGrnPhoto').addEventListener('change',function(){if(!this.files[0])return;window.GT.files.compressImage(this.files[0],800).then(function(data){photoData=data;}).catch(function(error){document.getElementById('editGrnPhotoError').textContent=error.message;});});form.addEventListener('submit',function(event){event.preventDefault();var itemChanges=Array.from(form.querySelectorAll('[data-item-cost]')).map(function(input){return {id:Number(input.dataset.itemCost),unit_cost:input.value===''?null:window.GT.format.parseMoney(input.value)};});try{window.GT.grns.updateEditable(grn.id,{notes:form.elements.notes.value,supplier_doc_no:form.elements.supplier_doc_no.value,supplier_doc_missing:form.elements.supplier_doc_missing.checked,supplier_notified:form.elements.supplier_notified.checked,photo_data:photoData,items:itemChanges});tracker.markSaved();window.GT.components.showToast('GRN details were updated.','success');window.location.hash='#/inventory/grns/'+grn.id;}catch(error){window.GT.components.showToast(error.message,'error');}}); }

  function render(view,params){if(view==='list')return renderList();if(view==='create'){pendingCreateConfig=createFormMarkup();return pendingCreateConfig.html;}if(view==='edit')return renderEdit(params);return renderDetail(params);}
  function bind(view,params){if(view==='list')table.mount('#grnListMount');else if(view==='create')bindCreate();else if(view==='edit')bindEdit(params);else bindDetail(params);}
  var api={render:render,bind:bind};
  window.GT.router.register('#/inventory/grns',{module:api,view:'list',title:'Goods Received Notes',permission:'goods_received_notes',action:'V',baseRoute:'#/inventory/grns'});
  window.GT.router.register('#/inventory/grns/new',{module:api,view:'create',title:'New GRN',permission:'goods_received_notes',action:'C',baseRoute:'#/inventory/grns'});
  window.GT.router.register('#/inventory/grns/:id/edit',{module:api,view:'edit',title:'Edit GRN',permission:'goods_received_notes',action:'E',baseRoute:'#/inventory/grns'});
  window.GT.router.register('#/inventory/grns/:id',{module:api,view:'detail',title:'GRN Details',permission:'goods_received_notes',action:'V',baseRoute:'#/inventory/grns'});
  return api;
}());
