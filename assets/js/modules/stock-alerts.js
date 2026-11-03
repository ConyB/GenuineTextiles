/* Phase 5 reorder view for active materials at or below the A-04 25% threshold. */
window.GT = window.GT || {};
window.GT.stockAlertsModule = (function () {
  var table = null;
  function title(value){return String(value||'').replace(/_/g,' ').replace(/\b\w/g,function(letter){return letter.toUpperCase();});}
  function supplierName(id){var supplier=window.GT.store.find('suppliers',id);return supplier?supplier.name:'Not assigned';}
  function statusLabel(value){return value==='out'?'Out':'Low';}
  function rows(){return window.GT.inventory.lowStockItems().map(function(material){return Object.assign({},material,{category_label:title(material.category),supplier_name:supplierName(material.supplier_id),status_label:statusLabel(material.stock_status),current_display:window.GT.inventory.formatQuantity(material,material.stock_quantity),full_display:window.GT.inventory.formatQuantity(material,material.full_stock_level)});});}
  function syncStatCards(){var selected=table?String(table.state.filters.status||''):'';document.querySelectorAll('#stockAlertStats [data-stat-card]').forEach(function(button,index){button.setAttribute('aria-pressed',String(index===0?selected==='out':index===1?selected==='low':!selected));});}
  function statCards(items){var out=items.filter(function(item){return item.stock_status==='out';}).length;var low=items.filter(function(item){return item.stock_status==='low';}).length;var selected=table?String(table.state.filters.status||''):'';return[
    {label:'Out of stock',value:out,helper:'At zero stock',icon:'package-x',tone:'danger',filterKey:'status',active:selected==='out',onClick:function(){table.toggleFilter('status','out');}},
    {label:'Low stock',value:low,helper:'At or below 25% of full level',icon:'alert-triangle',tone:'warning',filterKey:'status',active:selected==='low',onClick:function(){table.toggleFilter('status','low');}},
    {label:'Total items to reorder',value:items.length,helper:'Out of stock plus low stock',icon:'shopping-cart',tone:'brand',filterKey:'status',active:!selected,onClick:function(){table.setFilter('status','');}}
  ];}
  function percentageMarkup(value,row){var percent=Math.max(0,Math.min(100,Number(value)||0));var tone=row.stock_status==='out'?'error':'warning';return '<div class="stock-percentage"><span>'+Math.round(percent)+'%</span><div class="stock-level-bar" role="progressbar" aria-label="'+Math.round(percent)+' percent left" aria-valuenow="'+Math.round(percent)+'" aria-valuemin="0" aria-valuemax="100"><i class="'+tone+'" style="width:'+percent+'%"></i></div></div>';}
  function render(){
    var items=rows();
    table=window.GT.dataTable.create({id:'stockAlertsTable',rows:rows,caption:'Stock alerts',searchFields:['name','colour','supplier_name'],searchPlaceholder:'Search alerts',filters:[
      {name:'category',label:'Category',field:'category',options:window.GT.inventory.CATEGORIES.map(function(value){return {value:value,label:title(value)};})},
      {name:'supplier',label:'Supplier',field:'supplier_id',options:window.GT.suppliers.options()},
      {name:'status',label:'Status',field:'stock_status',options:[{value:'low',label:'Low'},{value:'out',label:'Out'}]}
    ],columns:[
      {label:'Material',field:'name',sortable:true,priority:1},{label:'Colour',field:'colour',sortable:true,priority:3},{label:'Category',field:'category_label',sortable:true,priority:2},
      {label:'Current stock',field:'current_display',sortable:true,priority:1,align:'right',numeric:true,minWidth:120,sortValue:function(row){return row.stock_quantity;}},{label:'Full stock level',field:'full_display',priority:3,align:'right',numeric:true,minWidth:130},
      {label:'Left',field:'percentage_left',sortable:true,priority:1,align:'right',numeric:true,minWidth:100,html:true,formatter:percentageMarkup,exportValue:function(row){return Math.round(row.percentage_left)+'%';}},
      {label:'Status',field:'stock_status',sortable:true,priority:1,html:true,formatter:function(value){return window.GT.components.statusBadge(statusLabel(value),value==='out'?'error':'warning');},exportValue:function(row){return row.status_label;}},
      {label:'Supplier',field:'supplier_name',sortable:true,priority:2}
    ],actions:[
      {label:'View',icon:'eye',primary:true,onClick:function(row){window.location.hash='#/inventory/materials/'+row.id;}},
      {label:'Receive stock',icon:'package-plus',primary:true,showLabel:true,disabledReason:function(){return window.GT.permissions.can('goods_received_notes','C')?'':'You do not have permission to receive stock';},className:'btn-outline-primary',onClick:function(row){window.location.hash='#/inventory/grns/new?material='+row.id+'&supplier='+row.supplier_id;}}
    ],emptyState:{message:'No active materials are low or out of stock.'},exportName:'genuine-textiles-stock-alerts.csv',onStateChange:syncStatCards});
    return '<section class="stock-alerts-page">'+window.GT.components.pageHeader({title:'Stock Alerts',description:'Active materials at or below 25% of their full stock level.'})+'<div id="stockAlertStats">'+window.GT.statCards.render(statCards(items))+'</div><div id="stockAlertsMount"></div></section>';
  }
  function bind(){table.mount('#stockAlertsMount');window.GT.statCards.bind('#stockAlertStats',statCards(rows()));syncStatCards();}
  var api={render:render,bind:bind};
  window.GT.router.register('#/inventory/alerts',{module:api,view:'list',title:'Stock Alerts',permission:'materials_stock',action:'V',baseRoute:'#/inventory/alerts'});
  return api;
}());
