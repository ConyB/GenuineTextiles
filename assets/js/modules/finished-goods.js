/* Finished Goods screens follow PAGE_PATTERNS.md list and detail contracts. */
window.GT.finishedGoodsModule = (function () {
  var GT = window.GT, table;
  function esc(value) { return GT.components.escapeHtml(value); }
  function route(id) { return '#/inventory/finished-goods/' + id; }
  function user(id) { var row = GT.store.find('users',id); return row ? row.name : 'System'; }
  function locationName(id) { var row = GT.store.find('locations',id); return row ? row.name : ''; }
  function decorated() { return GT.finishedGoods.rows().map(function (row) { return Object.assign({},row,{name:row.product.name,
    category:row.product.category,location_name:locationName(row.location_id)}); }); }
  function badge(value) { return GT.components.statusBadge(value,value==='In stock'?'success':value==='Low'?'warning':'danger'); }
  function cards() { var rows=decorated(), selected=table.state.filters.stock || '';
    return [{label:'Variants',value:rows.length,icon:'boxes',tone:'brand',filterKey:'all',active:!selected,onClick:function () { table.setFilter('stock',''); }},
      {label:'In stock',value:rows.filter(function (row) { return row.stock_status==='In stock'; }).length,icon:'package-check',tone:'success',filterKey:'In stock',active:selected==='In stock',onClick:function () { table.toggleFilter('stock','In stock'); }},
      {label:'Low',value:rows.filter(function (row) { return row.stock_status==='Low'; }).length,icon:'triangle-alert',tone:'warning',filterKey:'Low',active:selected==='Low',onClick:function () { table.toggleFilter('stock','Low'); }},
      {label:'Out',value:rows.filter(function (row) { return row.stock_status==='Out'; }).length,icon:'package-x',tone:'danger',filterKey:'Out',active:selected==='Out',onClick:function () { table.toggleFilter('stock','Out'); }}]; }
  function updateCards() { var mount=document.getElementById('finishedGoodsStats'); if (!mount) return; mount.innerHTML=GT.statCards.render(cards()); if (!mount.dataset.bound) { GT.statCards.bind(mount,cards()); mount.dataset.bound='1'; } GT.components.refreshIcons(); }
  function list() {
    table=GT.dataTable.create({id:'finishedGoodsTable',caption:'Finished goods',rows:decorated,searchFields:['name','size','colour','category'],searchPlaceholder:'Search item, size or colour',
      filters:[{name:'category',label:'Category',field:'category',options:['school','corporate','industrial','hospitality','medical','sweater'].map(function (value) { return {value:value,label:value[0].toUpperCase()+value.slice(1)}; })},
        {name:'location',label:'Location',field:'location_id',options:GT.store.all('locations').map(function (row) { return {value:row.id,label:row.name}; })},
        {name:'stock',label:'Stock status',field:'stock_status',options:['In stock','Low','Out'].map(function (value) { return {value:value,label:value}; })}],
      columns:[{label:'Item',field:'name',priority:1,sortable:true,minWidth:170},{label:'Category',field:'category',priority:2},
        {label:'Size',field:'size',priority:1},{label:'Colour',field:'colour',priority:2},
        {label:'Quantity on hand',field:'quantity',priority:1,align:'right',numeric:true,sortable:true},
        {label:'Location',field:'location_name',priority:2},{label:'Status',field:'stock_status',priority:1,html:true,
          formatter:function (value) { return badge(value); },exportValue:function (row) { return row.stock_status; }}],
      actions:[{label:'View',icon:'eye',primary:true,onClick:function (row) { location.hash=route(row.id); }}],
      onRowClick:function (row) { location.hash=route(row.id); },emptyState:{message:'No finished goods match these filters.'},
      exportName:'finished-goods.csv',onStateChange:updateCards});
    return '<section class="finished-goods-page">'+GT.components.pageHeader({title:'Finished Goods',description:'Ready-made items by size, colour and location.'})+
      '<div id="finishedGoodsStats"></div><div id="finishedGoodsMount"></div></section>';
  }
  function movementRows(id) { return GT.finishedGoods.movements(id).sort(function (a,b) { return b.id-a.id; }).map(function (row) {
    return Object.assign({},row,{user_name:user(row.user_id),reference_label:(row.reference_type||'').replace(/_/g,' ')+' '+(row.reference_id||''),
      type_label:row.movement_type.replace(/_/g,' ')}); }); }
  function adjustmentRows(id) { return GT.store.where('finished_good_adjustments',{product_variant_id:Number(id)}).sort(function (a,b) { return b.id-a.id; }); }
  function detail(params) {
    var row=decorated().find(function (item) { return Number(item.id)===Number(params.id); });
    if (!row) return GT.components.pageHeader({title:'Finished good unavailable',description:'This item could not be found.'});
    var role=GT.session.currentUser().role, canAdjust=['owner','general_manager','store_keeper'].includes(role), canStockOrder=['owner','general_manager'].includes(role),
      canAdvance=['owner','general_manager','workshop_supervisor'].includes(role), orders=GT.finishedGoods.stockOrders(row.id);
    var actions=[];
    if (role==='owner' && !row.quantity && !GT.finishedGoods.movements(row.id).length) actions.push({label:'Opening stock',icon:'package-plus',name:'opening'});
    if (canAdjust) actions.push({label:'Adjustment',icon:'sliders-horizontal',name:'adjust'});
    if (canAdjust) actions.push({label:'Transfer',icon:'arrow-left-right',name:'transfer',className:'btn-outline-primary'});
    if (canStockOrder) actions.push({label:'New stock order',icon:'plus',name:'stock-order',className:'btn-outline-primary'});
    return '<section class="finished-goods-page" data-variant-id="'+row.id+'">'+GT.components.pageHeader({title:row.name+' · '+row.size,
      description:row.colour+' · '+row.location_name,badge:badge(row.stock_status),actions:actions})+
      '<div class="detail-card"><h2>Stock position</h2><dl class="detail-grid">'+GT.components.detailRow('Category',row.category)+
      GT.components.detailRow('Quantity on hand',row.quantity+' pieces')+GT.components.detailRow('Full stock level',row.full_stock_level+' pieces')+
      GT.components.detailRow('Location',row.location_name)+'</dl></div>'+
      '<div class="detail-card"><h2>Production orders for stock</h2>'+(orders.length?orders.map(function (order) { var ordered=GT.store.where('order_items',{order_id:order.id}).reduce(function (sum,line) { return sum+Number(line.quantity); },0);
        var received=GT.store.where('stock_movements',function (movement) { return movement.reference_type==='stock_order' && Number(movement.reference_id)===order.id && movement.quantity>0; }).reduce(function (sum,movement) { return sum+Number(movement.quantity); },0);
        return '<div class="fg-order"><strong>Order '+esc(order.number)+'</strong> · '+esc(order.current_stage)+' · '+(ordered-received)+' of '+ordered+' to receive'+
          (canAdvance && order.current_stage!=='Ready for delivery'?'<button class="btn btn-outline-primary" type="button" data-advance="'+order.id+'">Advance stage</button>':'')+
          (canAdjust && order.current_stage==='Ready for delivery' && ordered>received?'<button class="btn btn-primary" type="button" data-receive="'+order.id+'">Receive from production</button>':'')+'</div>'; }).join(''):'<p>No stock production orders for this variant.</p>')+'</div>'+
      '<div class="detail-card"><h2>Adjustment requests</h2><div id="fgAdjustments"></div></div>'+
      '<div class="detail-card"><h2>Stock movement history</h2><div id="fgMovements"></div></div></section>';
  }
  function modal(title,fields,submit,callback) {
    GT.components.openModal({title:title,content:'<form id="fgDialog"><div class="fg-dialog-fields">'+fields+'</div><p class="field-error" id="fgDialogError" role="alert"></p><div class="gt-modal-actions"><button class="btn btn-primary" type="submit">'+esc(submit)+'</button></div></form>'});
    document.getElementById('fgDialog').addEventListener('submit',function (event) { event.preventDefault(); try { callback(new FormData(event.target)); GT.components.closeModal(); GT.components.showToast(title+' saved.','success'); GT.app.renderPage(); GT.app.refreshChrome(); } catch(error) { document.getElementById('fgDialogError').textContent=error.message; } });
  }
  function input(label,name,type,extra) { return '<label class="form-label" for="fg_'+name+'">'+esc(label)+'</label><input class="form-control" id="fg_'+name+'" name="'+name+'" type="'+(type||'text')+'" '+(extra||'')+' required>'; }
  function select(label,name,options) { return '<label class="form-label" for="fg_'+name+'">'+esc(label)+'</label><select class="form-select" id="fg_'+name+'" name="'+name+'">'+options.map(function (item) { return '<option value="'+esc(item.value)+'">'+esc(item.label)+'</option>'; }).join('')+'</select>'; }
  function bindDetail(params) {
    var id=Number(params.id), role=GT.session.currentUser().role;
    GT.dataTable.create({id:'fgAdjustmentTable',rows:function () { return adjustmentRows(id); },columns:[
      {label:'Requested',field:'requested_at',priority:1,formatter:GT.dates.formatDate},
      {label:'Direction',field:'direction',priority:1},{label:'Quantity',field:'quantity',priority:1,align:'right',numeric:true},
      {label:'Reason',field:'reason',priority:2},{label:'Status',field:'status',priority:1}],
      actions:[{label:'Approve',icon:'check',primary:true,show:function (row) { return role==='owner' && row.status==='pending'; },onClick:function (row) { decision(row,true); }},
        {label:'Reject',icon:'x',primary:true,show:function (row) { return role==='owner' && row.status==='pending'; },onClick:function (row) { decision(row,false); }}],
      emptyState:{message:'No adjustments requested.'},exportName:'finished-good-adjustments.csv'}).mount('#fgAdjustments');
    GT.dataTable.create({id:'fgMovementTable',rows:function () { return movementRows(id); },columns:[
      {label:'Date',field:'created_at',priority:1,formatter:GT.dates.formatDate,exportValue:function (row) { return row.created_at; }},
      {label:'Type',field:'type_label',priority:1},{label:'Quantity',field:'quantity',priority:1,align:'right',numeric:true},
      {label:'Reference',field:'reference_label',priority:2},{label:'User',field:'user_name',priority:2}],
      emptyState:{message:'No stock movements for this item.'},exportName:'finished-good-movements.csv'}).mount('#fgMovements');
    document.querySelectorAll('[data-page-action]').forEach(function (button) { button.addEventListener('click',function () {
      var action=button.dataset.pageAction;
      if (action==='adjust') modal('Stock adjustment',select('Direction','direction',[{value:'increase',label:'Increase'},{value:'decrease',label:'Decrease'}])+input('Quantity','quantity','number','min="1" step="1"')+input('Reason','reason'), 'Request adjustment',function (data) { GT.finishedGoods.adjust({product_variant_id:id,direction:data.get('direction'),quantity:data.get('quantity'),reason:data.get('reason')}); });
      if (action==='opening') modal('Opening stock',input('Quantity','quantity','number','min="1" step="1"')+input('Reason','reason'),'Record opening stock',function (data) { GT.finishedGoods.openingStock(id,data.get('quantity'),data.get('reason')); });
      if (action==='transfer') modal('Transfer finished goods',select('To location','location',GT.store.all('locations').filter(function (item) { return Number(item.id)!==Number(GT.store.find('product_variants',id).location_id); }).map(function (item) { return {value:item.id,label:item.name}; }))+input('Quantity','quantity','number','min="1" step="1"'),'Transfer',function (data) { GT.finishedGoods.transfer(id,data.get('quantity'),data.get('location')); });
      if (action==='stock-order') modal('New stock production order',input('Quantity','quantity','number','min="1" step="1"')+input('Due date','due_date','date','min="'+GT.dates.today()+'" value="'+GT.dates.today()+'"'),'Create order',function (data) { GT.finishedGoods.createStockOrder(id,data.get('quantity'),data.get('due_date')); });
    }); });
    document.querySelectorAll('[data-advance]').forEach(function (button) { button.addEventListener('click',async function () {
      if (!await GT.components.confirmDialog({title:'Advance stock order',message:'Move this order to the next production stage?',confirmText:'Advance'})) return;
      try { GT.finishedGoods.advanceStockOrder(button.dataset.advance); GT.components.showToast('Production stage updated.','success'); GT.app.renderPage(); } catch(error) { GT.components.showToast(error.message,'error'); }
    }); });
    document.querySelectorAll('[data-receive]').forEach(function (button) { button.addEventListener('click',function () {
      modal('Receive from production',input('Quantity received','quantity','number','min="1" step="1"'),'Receive',function (data) { GT.finishedGoods.receive(button.dataset.receive,data.get('quantity')); });
    }); });
  }
  function decision(row,approve) { modal(approve?'Approve adjustment':'Reject adjustment',input('Decision note','note'),'Save decision',function (data) { GT.finishedGoods.decide(row.id,approve,data.get('note')); }); }
  var api={render:function (view,params) { return view==='list'?list():detail(params); },bind:function (view,params) { if (view==='list') { table.mount('#finishedGoodsMount'); updateCards(); } else if (document.getElementById('fgMovements')) bindDetail(params); }};
  GT.router.register('#/inventory/finished-goods',{module:api,view:'list',title:'Finished Goods',permission:'materials_stock',baseRoute:'#/inventory/finished-goods'});
  GT.router.register('#/inventory/finished-goods/:id',{module:api,view:'detail',title:'Finished Good',permission:'materials_stock',baseRoute:'#/inventory/finished-goods'});
  return api;
}());
