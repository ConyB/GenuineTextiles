/* Phase 5 read-only stock ledger; stock rows are opened through their material detail. */
window.GT = window.GT || {};
window.GT.stockMovementsModule = (function () {
  var table = null;
  function title(value) { return String(value || '').replace(/_/g,' ').replace(/\b\w/g,function (letter) { return letter.toUpperCase(); }); }
  function options(values) { return values.map(function (value) { return {value:value,label:title(value)}; }); }
  function dateTime(value) { return new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Kampala',dateStyle:'medium',timeStyle:'short'}).format(new Date(value)); }
  function userName(id) { var user = window.GT.store.find('users',id); return user ? user.name : 'System'; }
  function typeTone(type) { if (type === 'grn' || type === 'return' || type === 'opening') return 'success'; if (type === 'adjustment') return 'warning'; return 'error'; }
  function reference(row) { return row.reference_type ? title(row.reference_type) + (row.reference_id ? ' #' + row.reference_id : '') : '—'; }
  function rows() {
    return window.GT.store.where('stock_movements',{item_type:'material'}).sort(function (a,b) { return new Date(b.created_at)-new Date(a.created_at); }).map(function (movement) {
      var material = window.GT.store.find('materials',movement.item_id); var location = window.GT.store.find('locations',movement.location_id);
      return Object.assign({},movement,{
        material_name:material ? material.name : 'Unknown material', location_name:location ? location.name : 'Unknown location',
        type_label:title(movement.movement_type), quantity_display:(movement.quantity > 0 ? '+' : '-') + window.GT.inventory.formatQuantity(Object.assign({},material || {unit:''},{roll_length_m:null}),Math.abs(movement.quantity)),
        before_display:window.GT.inventory.formatQuantity(material || {unit:''},movement.before_qty), after_display:window.GT.inventory.formatQuantity(material || {unit:''},movement.after_qty),
        reference_display:reference(movement), user_name:userName(movement.user_id), date_display:dateTime(movement.created_at)
      });
    });
  }
  function render() {
    table = window.GT.dataTable.create({
      id:'stockMovementsTable', rows:rows, caption:'Stock movements', searchFields:['material_name','location_name','type_label','reference_display','user_name','note'], searchPlaceholder:'Search movements',
      filters:[
        {name:'material',label:'Material',field:'item_id',options:window.GT.store.all('materials').sort(function(a,b){return a.name.localeCompare(b.name);}).map(function(material){return {value:material.id,label:material.name};})},
        {name:'location',label:'Location',field:'location_id',options:window.GT.store.all('locations').map(function(location){return {value:location.id,label:location.name};})},
        {name:'type',label:'Type',field:'movement_type',options:options(window.GT.inventory.MOVEMENT_TYPES)},
        {name:'date_from',label:'From date',type:'date',test:function(row,value){return String(row.created_at).slice(0,10)>=value;}},
        {name:'date_to',label:'To date',type:'date',test:function(row,value){return String(row.created_at).slice(0,10)<=value;}}
      ],
      columns:[
        {label:'Date and time',field:'created_at',sortable:true,priority:1,minWidth:150,formatter:function(value){return dateTime(value);},exportValue:function(row){return row.created_at;}},
        {label:'Material',field:'material_name',sortable:true,priority:1},{label:'Location',field:'location_name',sortable:true,priority:1},
        {label:'Type',field:'movement_type',sortable:true,priority:1,html:true,formatter:function(value){return window.GT.components.statusBadge(title(value),typeTone(value));},exportValue:function(row){return row.type_label;}},
        {label:'Signed quantity',field:'quantity_display',sortable:true,priority:1,align:'right',numeric:true,minWidth:130,sortValue:function(row){return row.quantity;},html:true,formatter:function(value,row){return '<span class="' + (row.quantity>0?'stock-in':'stock-out') + '">' + window.GT.components.escapeHtml(value) + '</span>';},exportValue:function(row){return row.quantity;}},
        {label:'Before',field:'before_display',priority:3,align:'right',numeric:true,minWidth:110},{label:'After',field:'after_display',priority:3,align:'right',numeric:true,minWidth:110},{label:'Reference',field:'reference_display',priority:2},
        {label:'User',field:'user_name',sortable:true,priority:2},{label:'Note',field:'note',priority:3}
      ],
      onRowClick:function(row){window.location.hash='#/inventory/materials/'+row.item_id;},
      emptyState:{message:'No stock movements match the current filters.'}, exportName:'genuine-textiles-stock-movements.csv'
    });
    return '<section class="stock-movements-page">' + window.GT.components.pageHeader({title:'Stock Movements',description:'Read-only history of every controlled material stock change.',breadcrumbs:[{label:'Inventory'},{label:'Stock Movements'}]}) + '<div id="stockMovementsMount"></div></section>';
  }
  function bind(){table.mount('#stockMovementsMount');}
  var api={render:render,bind:bind};
  window.GT.router.register('#/inventory/movements',{module:api,view:'list',title:'Stock Movements',permission:'materials_stock',action:'V',baseRoute:'#/inventory/movements'});
  return api;
}());
