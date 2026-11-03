/* Phase 5 material register, full-page forms and stock-aware detail view. */
window.GT = window.GT || {};
window.GT.materialModule = (function () {
  var table = null;
  var tracker = null;

  function escape(value) { return window.GT.components.escapeHtml(value); }
  function title(value) { return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, function (letter) { return letter.toUpperCase(); }); }
  function options(values) { return values.map(function (value) { return { value: value, label: title(value) }; }); }
  function canSeeCost() { var role = window.GT.session.currentUser().role; return ['owner', 'general_manager', 'accountant'].indexOf(role) !== -1; }
  function canEditCost() { return window.GT.session.currentUser().role === 'owner'; }
  function canEdit() { return window.GT.permissions.can('materials_stock', 'E'); }
  function supplierName(id) { var supplier = window.GT.store.find('suppliers', id); return supplier ? supplier.name : 'Not assigned'; }
  function statusLabel(value) { return value === 'out' ? 'Out' : value === 'low' ? 'Low' : 'OK'; }
  function statusTone(value) { return value === 'out' ? 'error' : value === 'low' ? 'warning' : 'success'; }
  function statusBadge(value) { return window.GT.components.statusBadge(statusLabel(value), statusTone(value)); }
  function formatDate(value) { return new Intl.DateTimeFormat('en-GB', { timeZone:'Africa/Kampala', dateStyle:'medium', timeStyle:'short' }).format(new Date(value)); }

  function listRows() {
    return window.GT.store.all('materials').map(function (material) {
      var quantity = window.GT.inventory.totalStock(material.id);
      var materialStatus = window.GT.inventory.status(material);
      return Object.assign({}, material, {
        category_label: title(material.category), supplier_name: supplierName(material.supplier_id),
        fabric_details: material.category === 'fabric' ? title(material.fabric_type) + ' / ' + material.width_inches + ' in' : title(material.subtype || '—'),
        stock_quantity: quantity, stock_display: window.GT.inventory.formatQuantity(material, quantity),
        stock_status: materialStatus, active_label: material.active ? 'Active' : 'Inactive'
      });
    });
  }

  function changeStatus(row, active) {
    var current = window.GT.store.find('materials', row.id);
    function save() {
      var after = window.GT.store.update('materials', current.id, { active: active });
      window.GT.audit.log(active ? 'activate' : 'deactivate', 'materials', current.id, current, after);
      window.GT.components.showToast(after.name + (active ? ' was activated.' : ' was deactivated.'), 'success');
      window.GT.app.refreshChrome();
      if (table) table.refresh(); else window.GT.app.renderPage();
    }
    if (active) { save(); return; }
    window.GT.components.confirmDialog({ title:'Deactivate material', message:'Deactivate ' + current.name + '? It remains in stock history and only an approved adjustment may change its stock.', confirmText:'Deactivate' }).then(function (confirmed) { if (confirmed) save(); });
  }

  function columns() {
    var result = [
      { label:'Name', field:'name', sortable:true, priority:1, html:true, formatter:function (value,row) { return escape(value) + (!row.active ? ' ' + window.GT.components.statusBadge('Inactive','neutral') : ''); }, exportValue:function (row) { return row.name; } },
      { label:'Category', field:'category_label', sortable:true, priority:1 },
      { label:'Colour', field:'colour', sortable:true, priority:2 },
      { label:'Type / width', field:'fabric_details', sortable:true, priority:2 },
      { label:'Total stock', field:'stock_display', sortable:true, priority:1, align:'right', numeric:true, minWidth:120, sortValue:function (row) { return row.stock_quantity; } },
      { label:'Status', field:'stock_status', sortable:true, priority:1, html:true, formatter:function (value) { return statusBadge(value); }, exportValue:function (row) { return statusLabel(row.stock_status); } },
      { label:'Supplier', field:'supplier_name', sortable:true, priority:2 }
    ];
    // A-09: cost is omitted from the table and therefore from CSV for unauthorised roles.
    if (canSeeCost()) result.push({ label:'Cost per unit', field:'cost_per_unit', sortable:true, priority:1, align:'right', numeric:true, minWidth:120, formatter:window.GT.format.formatMoney, exportValue:function (row) { return row.cost_per_unit; } });
    return result;
  }

  function renderList() {
    table = window.GT.dataTable.create({
      id:'materialsTable', rows:listRows, caption:'Materials', searchFields:['name','category_label','colour','fabric_details','supplier_name'],
      searchPlaceholder:'Search materials',
      filters:[
        { name:'category', label:'Category', field:'category', options:options(window.GT.inventory.CATEGORIES) },
        { name:'status', label:'Status', field:'stock_status', options:[{value:'ok',label:'OK'},{value:'low',label:'Low'},{value:'out',label:'Out'}] },
        { name:'supplier', label:'Supplier', field:'supplier_id', options:window.GT.suppliers.options() },
        { name:'active', label:'Active status', options:[{value:'active',label:'Active'},{value:'inactive',label:'Inactive'}], test:function (row, value) { return value === 'active' ? row.active : !row.active; } }
      ],
      columns:columns(),
      actions:[
        { label:'View', icon:'eye', primary:true, onClick:function (row) { window.location.hash = '#/inventory/materials/' + row.id; } },
        { label:'Edit', icon:'pencil', primary:true, show:canEdit, onClick:function (row) { window.location.hash = '#/inventory/materials/' + row.id + '/edit'; } },
        { label:'Deactivate', icon:'circle-off', show:function (row) { return canEdit() && row.active; }, onClick:function (row) { changeStatus(row, false); } },
        { label:'Activate', icon:'circle-check', show:function (row) { return canEdit() && !row.active; }, onClick:function (row) { changeStatus(row, true); } }
      ],
      emptyState:{ message:'No materials match the current filters.' }, exportName:'genuine-textiles-materials.csv'
    });
    return '<section class="materials-page">' + window.GT.components.pageHeader({ title:'Materials', description:'Base-unit stock levels by material, supplier and location.', breadcrumbs:[{label:'Inventory'},{label:'Materials'}], actions:[{label:'New material',icon:'plus',route:'#/inventory/materials/new',permission:'materials_stock',permissionAction:'C'}] }) + '<div id="materialsListMount"></div></section>';
  }

  function formValues(existing) {
    return existing || { name:'', category:'', subtype:'', unit:'', colour:'', fabric_type:'', width_inches:null, supplier_id:null, full_stock_level:null, roll_length_m:null, cost_per_unit:null, notes:'', active:true };
  }

  function formSections(existing) {
    var sections = [
      { title:'Basic details', fields:[
        {name:'name',label:'Material name',type:'text',required:true},
        {name:'category',label:'Category',type:'select',required:true,options:options(window.GT.inventory.CATEGORIES)},
        {name:'subtype',label:'Subtype',type:'select',options:options(window.GT.inventory.ACCESSORY_SUBTYPES),className:'material-subtype-field'},
        {name:'unit',label:'Base unit',type:'select',required:true,options:options(window.GT.inventory.UNITS)},
        {name:'colour',label:'Colour',type:'text'},
        {name:'fabric_type',label:'Fabric type',type:'select',options:options(window.GT.inventory.FABRIC_TYPES),className:'material-fabric-field'},
        {name:'width_inches',label:'Width (inches)',type:'number',step:'0.1',className:'material-fabric-field'},
        {name:'supplier_id',label:'Primary supplier',type:'select',valueType:'number',options:window.GT.suppliers.options()}
      ]},
      { title:'Stock control', description:'Stock changes only through received goods, material issues or approved adjustments.', fields:[
        {name:'full_stock_level',label:'Full stock level',type:'number',step:'0.001',required:true},
        {name:'roll_length_m',label:'Roll length (metres)',type:'number',step:'0.001',className:'material-fabric-field'}
      ]}
    ];
    if (canSeeCost()) sections.push({ title:'Costing', description:canEditCost() ? 'Only the Owner may edit cost in this phase.' : 'Cost is visible to your role but read-only.', fields:[{name:'cost_per_unit',label:'Cost per unit (UGX)',type:'number',step:'1'}] });
    if (!existing) sections.push({ title:'Opening stock', description:'Opening quantities create controlled opening movements at each location.', fields:window.GT.store.all('locations').map(function (location) { return {name:'opening_' + location.id,label:location.name,type:'number',step:'0.001',defaultValue:0}; }) });
    sections.push({ title:'Notes', fields:[{name:'notes',label:'Notes',type:'textarea',rows:3,fullWidth:true}] });
    return sections;
  }

  function validate(values, id, creating) {
    var errors = {};
    if (!window.GT.validate.required(values.name)) errors.name = 'Material name is required.';
    if (!window.GT.validate.required(values.category)) errors.category = 'Category is required.';
    if (!window.GT.validate.required(values.unit)) errors.unit = 'Base unit is required.';
    if (values.category === 'fabric') {
      if (!window.GT.validate.required(values.colour)) errors.colour = 'Colour is required for fabric.';
      if (!window.GT.validate.required(values.fabric_type)) errors.fabric_type = 'Fabric type is required.';
      if (!(Number(values.width_inches) > 0)) errors.width_inches = 'Width is required for fabric.';
    }
    var duplicate = window.GT.store.all('materials').some(function (material) {
      return Number(material.id) !== Number(id) && String(material.name).trim().toLowerCase() === String(values.name).trim().toLowerCase() && String(material.colour || '').trim().toLowerCase() === String(values.colour || '').trim().toLowerCase() && Number(material.width_inches || 0) === Number(values.width_inches || 0);
    });
    if (duplicate) errors.name = 'A material with this name, colour and width already exists.';
    if (!(Number(values.full_stock_level) > 0)) errors.full_stock_level = 'Full stock level must be greater than zero.';
    if (values.roll_length_m !== null && values.roll_length_m !== '' && !(Number(values.roll_length_m) > 0)) errors.roll_length_m = 'Roll length must be greater than zero.';
    if (canEditCost() && values.cost_per_unit !== null && values.cost_per_unit !== '' && (!window.GT.validate.positiveInteger(values.cost_per_unit))) errors.cost_per_unit = 'Cost must be a positive whole number.';
    if (creating) window.GT.store.all('locations').forEach(function (location) { var field = 'opening_' + location.id; if (Number(values[field] || 0) < 0) errors[field] = 'Opening stock cannot be negative.'; });
    return errors;
  }

  function materialRecord(values, existing) {
    var cost = existing ? existing.cost_per_unit : 0;
    if (canEditCost() && values.cost_per_unit !== null && values.cost_per_unit !== '') cost = Number(values.cost_per_unit);
    return {
      name:values.name.trim(), category:values.category, subtype:values.category === 'accessory' ? values.subtype : '', unit:values.unit,
      colour:values.colour.trim(), fabric_type:values.category === 'fabric' ? values.fabric_type : '', width_inches:values.category === 'fabric' ? Number(values.width_inches) : null,
      supplier_id:values.supplier_id || null, cost_per_unit:cost, full_stock_level:Number(values.full_stock_level),
      roll_length_m:values.category === 'fabric' && values.roll_length_m ? Number(values.roll_length_m) : null,
      notes:values.notes.trim(), active:existing ? existing.active : true
    };
  }

  function updateConditionalFields(form) {
    var fabric = form.elements.category.value === 'fabric';
    var accessory = form.elements.category.value === 'accessory';
    form.querySelectorAll('.material-fabric-field').forEach(function (field) { field.hidden = !fabric; });
    var subtype = form.querySelector('.material-subtype-field'); if (subtype) subtype.hidden = !accessory;
  }

  function renderForm(params) {
    var existing = params.id ? window.GT.store.find('materials', Number(params.id)) : null;
    if (params.id && !existing) return '<section class="page-placeholder"><h1>Material not found</h1><a class="btn btn-primary" href="#/inventory/materials">Back to materials</a></section>';
    var creating = !existing; var sections = formSections(existing);
    var form = window.GT.forms.render({ id:'materialForm', sections:sections, values:formValues(existing), submitLabel:creating ? 'Create material' : 'Save changes', cancelRoute:existing ? '#/inventory/materials/' + existing.id : '#/inventory/materials' });
    return '<section class="materials-page material-form-page">' + window.GT.components.pageHeader({ title:creating ? 'New material' : 'Edit material', breadcrumbs:[{label:'Materials',route:'#/inventory/materials'},{label:creating ? 'New material' : existing.name}] }) + form + '</section>';
  }

  function bindForm(params) {
    var form = document.getElementById('materialForm'); if (!form) return;
    var id = params.id ? Number(params.id) : null; var existing = id ? window.GT.store.find('materials', id) : null; var sections = formSections(existing);
    tracker = window.GT.forms.trackDirty(form); updateConditionalFields(form);
    form.elements.category.addEventListener('change', function () { updateConditionalFields(form); });
    if (form.elements.cost_per_unit && !canEditCost()) { form.elements.cost_per_unit.readOnly = true; form.elements.cost_per_unit.setAttribute('aria-readonly','true'); }
    form.addEventListener('submit', function (event) {
      event.preventDefault(); var values = window.GT.forms.read(form, sections); var errors = validate(values, id, !existing);
      if (!window.GT.forms.showErrors(form, errors)) return;
      var saved;
      if (existing) {
        saved = window.GT.store.update('materials', id, materialRecord(values, existing));
        window.GT.audit.log('update', 'materials', id, existing, saved);
      } else {
        saved = window.GT.store.create('materials', materialRecord(values));
        window.GT.audit.log('create', 'materials', saved.id, null, saved);
        window.GT.store.all('locations').forEach(function (location) {
          var quantity = Number(values['opening_' + location.id] || 0);
          if (quantity > 0) window.GT.inventory.recordMovement({ materialId:saved.id, locationId:location.id, type:'opening', quantity:quantity, referenceType:'material', referenceId:saved.id, note:'Opening stock entered with the material.' });
        });
      }
      tracker.markSaved(); window.GT.components.showToast(saved.name + ' was saved.', 'success'); window.location.hash = '#/inventory/materials/' + saved.id;
    });
  }

  function movementTable(material) {
    var movements = window.GT.store.where('stock_movements', function (row) { return row.item_type === 'material' && Number(row.item_id) === Number(material.id); }).sort(function (a,b) { return new Date(b.created_at) - new Date(a.created_at); });
    if (!movements.length) return '<div class="empty-state"><p>No movements have been recorded for this material.</p></div>';
    return '<div class="table-wrapper"><table class="shared-data-table material-movement-table"><thead><tr><th>Date</th><th>Location</th><th>Type</th><th>Quantity</th><th>Before</th><th>After</th><th>Note</th></tr></thead><tbody>' + movements.map(function (movement) { var location = window.GT.store.find('locations', movement.location_id); return '<tr><td>' + escape(formatDate(movement.created_at)) + '</td><td>' + escape(location ? location.name : 'Unknown') + '</td><td>' + escape(title(movement.movement_type)) + '</td><td class="' + (movement.quantity > 0 ? 'stock-in' : 'stock-out') + '">' + escape((movement.quantity > 0 ? '+' : '') + movement.quantity) + '</td><td>' + escape(window.GT.inventory.formatQuantity(material,movement.before_qty)) + '</td><td>' + escape(window.GT.inventory.formatQuantity(material,movement.after_qty)) + '</td><td>' + escape(movement.note || '—') + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }

  function purchaseTable(material) {
    var lines = window.GT.store.where('grn_items', function (row) { return Number(row.material_id) === Number(material.id); }).map(function (item) { return { item:item, grn:window.GT.store.find('goods_received_notes',item.grn_id) }; }).filter(function (entry) { return entry.grn; }).sort(function (a,b) { return String(b.grn.received_at).localeCompare(String(a.grn.received_at)); });
    if (!lines.length) return '<div class="empty-state"><p>No goods received note lines have been posted for this material.</p></div>';
    var costHead = canSeeCost() ? '<th>Unit cost</th>' : '';
    return '<div class="table-wrapper"><table class="shared-data-table material-purchase-table"><thead><tr><th>Date</th><th>GRN</th><th>Supplier</th><th>Received</th><th>Accepted</th>' + costHead + '</tr></thead><tbody>' + lines.map(function (entry) { var supplier = window.GT.store.find('suppliers',entry.grn.supplier_id); return '<tr><td>' + escape(window.GT.dates.formatDate(entry.grn.received_at)) + '</td><td><a href="#/inventory/grns/' + entry.grn.id + '">' + escape(entry.grn.number) + '</a></td><td>' + escape(supplier ? supplier.name : 'Unknown') + '</td><td>' + escape(window.GT.inventory.formatQuantity(material,entry.item.quantity_received)) + '</td><td>' + escape(window.GT.inventory.formatQuantity(material,window.GT.grns.accepted(entry.item))) + '</td>' + (canSeeCost() ? '<td>' + escape(entry.item.unit_cost ? window.GT.format.formatMoney(entry.item.unit_cost) : '—') + '</td>' : '') + '</tr>'; }).join('') + '</tbody></table></div>';
  }

  function renderDetail(params) {
    var material = window.GT.store.find('materials', Number(params.id));
    if (!material) return '<section class="page-placeholder"><h1>Material not found</h1><a class="btn btn-primary" href="#/inventory/materials">Back to materials</a></section>';
    var quantity = window.GT.inventory.totalStock(material.id); var materialStatus = window.GT.inventory.status(material);
    var actions = [{label:'Edit material',route:'#/inventory/materials/' + material.id + '/edit',className:'btn-primary',permission:'materials_stock',permissionAction:'E'},{label:material.active ? 'Deactivate' : 'Activate',name:'toggle-status',className:'btn-outline-secondary',permission:'materials_stock',permissionAction:'E'}];
    var overview = window.GT.components.detailRow('Category',title(material.category)) + window.GT.components.detailRow('Subtype',title(material.subtype)) + window.GT.components.detailRow('Colour',material.colour) + window.GT.components.detailRow('Fabric type',title(material.fabric_type)) + window.GT.components.detailRow('Width',material.width_inches ? material.width_inches + ' inches' : '') + window.GT.components.detailRow('Base unit',title(material.unit)) + window.GT.components.detailRow('Primary supplier',supplierName(material.supplier_id)) + window.GT.components.detailRow('Full stock level',material.full_stock_level) + window.GT.components.detailRow('Roll length',material.roll_length_m ? material.roll_length_m + ' m' : '') + window.GT.components.detailRow('Total stock',window.GT.inventory.formatQuantity(material,quantity)) + window.GT.components.detailRow('Notes',material.notes);
    if (canSeeCost()) overview += window.GT.components.detailRow('Cost per unit',window.GT.format.formatMoney(material.cost_per_unit));
    var locationRows = window.GT.store.all('locations').map(function (location) { var locationQuantity = window.GT.inventory.getStock(material.id,location.id); var locationStatus = window.GT.inventory.statusAtLocation(material,location.id); return '<tr><td>' + escape(location.name) + '</td><td>' + escape(window.GT.inventory.formatQuantity(material,locationQuantity)) + '</td><td>' + statusBadge(locationStatus) + '</td></tr>'; }).join('');
    var stockPanel = '<p class="stock-control-note">Stock changes only through received goods, material issues or approved adjustments.</p><div class="table-wrapper"><table class="shared-data-table stock-location-table"><thead><tr><th>Location</th><th>Quantity</th><th>Status</th></tr></thead><tbody>' + locationRows + '</tbody></table></div>';
    return '<section class="materials-page material-detail-page" data-material-id="' + material.id + '">' + window.GT.components.pageHeader({ title:material.name, badge:statusBadge(materialStatus) + ' ' + window.GT.components.statusBadge(material.active ? 'Active' : 'Inactive',material.active ? 'success' : 'neutral'), breadcrumbs:[{label:'Materials',route:'#/inventory/materials'},{label:material.name}], actions:actions }) + '<div class="detail-card">' + window.GT.components.tabs([{id:'material-overview',label:'Overview'},{id:'material-stock',label:'Stock by location'},{id:'material-movements',label:'Movements'},{id:'material-purchases',label:'Suppliers and purchases'}],'material-overview') + '<section class="detail-tab-panel" id="material-overview" role="tabpanel"><h2>Overview</h2><dl class="detail-grid">' + overview + '</dl></section><section class="detail-tab-panel" id="material-stock" role="tabpanel" hidden><h2>Stock by location</h2>' + stockPanel + '</section><section class="detail-tab-panel" id="material-movements" role="tabpanel" hidden><h2>Movements</h2>' + movementTable(material) + '</section><section class="detail-tab-panel" id="material-purchases" role="tabpanel" hidden><h2>Suppliers and purchases</h2>' + purchaseTable(material) + '</section></div></section>';
  }

  function bindDetail(params) {
    var material = window.GT.store.find('materials', Number(params.id)); if (!material) return;
    document.querySelectorAll('[data-tab-target]').forEach(function (tab) { tab.addEventListener('click', function () { document.querySelectorAll('[data-tab-target]').forEach(function (item) { item.classList.toggle('active',item === tab); item.setAttribute('aria-selected',item === tab); }); document.querySelectorAll('.detail-tab-panel').forEach(function (panel) { panel.hidden = panel.id !== tab.dataset.tabTarget; }); }); });
    var toggle = document.querySelector('[data-page-action="toggle-status"]'); if (toggle) toggle.addEventListener('click', function () { changeStatus(material,!material.active); });
  }

  function render(view, params) { if (view === 'list') return renderList(); if (view === 'new' || view === 'edit') return renderForm(params || {}); return renderDetail(params || {}); }
  function bind(view, params) { if (view === 'list') table.mount('#materialsListMount'); else if (view === 'new' || view === 'edit') bindForm(params || {}); else bindDetail(params || {}); }
  var api = { render:render, bind:bind };
  [['#/inventory/materials','list','Materials','V'],['#/inventory/materials/new','new','New Material','C'],['#/inventory/materials/:id/edit','edit','Edit Material','E'],['#/inventory/materials/:id','detail','Material Details','V']].forEach(function (route) { window.GT.router.register(route[0],{module:api,view:route[1],title:route[2],permission:'materials_stock',action:route[3],baseRoute:'#/inventory/materials'}); });
  return api;
}());
