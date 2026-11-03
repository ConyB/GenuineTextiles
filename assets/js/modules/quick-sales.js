/* Counter sales: shared register, cards, A4 receipt and controlled stock actions. */
window.GT.quickSaleModule = (function () {
  var GT=window.GT, table, cart=[];
  function esc(value) { return GT.components.escapeHtml(value); }
  function money(value) { return GT.format.formatMoney(value); }
  function user(id) { var row=GT.store.find('users',id); return row ? row.name : 'Unknown'; }
  function receipt(row) { return row.receipt_id ? GT.store.find('receipts',row.receipt_id) : null; }
  function status(row) { return GT.components.statusBadge(row.status.replace(/_/g,' '),row.status==='issued'?'success':row.status==='void'?'danger':'warning'); }
  function rows() { return GT.quickSales.list().map(function (row) { var paper=receipt(row); return Object.assign({},row,{receipt_number:paper?paper.number:'—',cashier_name:user(row.cashier_id),day:row.sale_date}); }); }
  function cards() { var list=rows(), filter=table.state.filters.quick||'', today=GT.dates.today();
    function card(label,value,key,icon,tone) { return {label:label,value:value,icon:icon,tone:tone,filterKey:key,active:filter===key,onClick:function () { table.toggleFilter('quick',key); }}; }
    return [card('Sales today',list.filter(function (r) { return r.status==='issued' && r.day===today; }).length,'today','shopping-cart','brand'),
      card('Takings today',money(list.filter(function (r) { return r.status==='issued' && r.day===today; }).reduce(function (sum,r) { return sum+r.total; },0)),'today','banknote','success'),
      card('Awaiting approval',list.filter(function (r) { return ['pending_discount','void_pending'].includes(r.status); }).length,'pending','clock-3','warning'),
      card('Voided',list.filter(function (r) { return r.status==='void'; }).length,'void','ban','danger')]; }
  function updateCards() { var mount=document.getElementById('quickSaleStats'); if (!mount) return; mount.innerHTML=GT.statCards.render(cards()); if (!mount.dataset.bound) { GT.statCards.bind(mount,cards()); mount.dataset.bound='1'; } GT.components.refreshIcons(); }
  function list() {
    table=GT.dataTable.create({id:'quickSalesTable',caption:'Quick sales',rows:rows,searchFields:['receipt_number','cashier_name','payment_method'],searchPlaceholder:'Search receipt, cashier or method',
      filters:[{name:'status',label:'Status',field:'status',options:['issued','pending_discount','ready','void_pending','void','rejected'].map(function (value) { return {value:value,label:value.replace(/_/g,' ')}; })},
        {name:'method',label:'Method',field:'payment_method',options:['cash','mtn','airtel','bank','cheque'].map(function (value) { return {value:value,label:value.toUpperCase()}; })},
        {name:'date_from',label:'From date',type:'date',test:function (row,value) { return row.day>=value; }},
        {name:'date_to',label:'To date',type:'date',test:function (row,value) { return row.day<=value; }},
        {name:'quick',label:'Quick filter',options:[{value:'today',label:'Today'},{value:'pending',label:'Awaiting approval'},{value:'void',label:'Voided'}],test:function (row,value) { return value==='today'?row.day===GT.dates.today()&&row.status==='issued':value==='pending'?['pending_discount','void_pending'].includes(row.status):row.status==='void'; }}],
      columns:[{label:'Receipt',field:'receipt_number',priority:1,sortable:true},{label:'Date',field:'day',priority:1,sortable:true,formatter:GT.dates.formatDate,exportValue:function (row) { return row.day; }},
        {label:'Cashier',field:'cashier_name',priority:2},{label:'Method',field:'payment_method',priority:2},
        {label:'Total',field:'total',priority:1,align:'right',numeric:true,formatter:money},
        {label:'Status',field:'status',priority:1,html:true,formatter:function (value,row) { return status(row); },exportValue:function (row) { return row.status; }}],
      actions:[{label:'View',icon:'eye',primary:true,onClick:function (row) { location.hash='#/sales/quick-sales/'+row.id; }},
        {label:'Print',icon:'printer',primary:true,show:function (row) { return !!row.receipt_id; },onClick:function (row) { GT.receiptModule.print(receipt(row)); }}],
      onRowClick:function (row) { location.hash='#/sales/quick-sales/'+row.id; },emptyState:{message:'No quick sales match the current filters.'},
      exportName:'quick-sales.csv',onStateChange:updateCards});
    return '<section class="quick-sales-page">'+GT.components.pageHeader({title:'Quick Sales',description:'Walk-in sales of ready-made stock.',actions:GT.quickSales.canCreate()?[{label:'New quick sale',icon:'plus',route:'#/sales/quick-sale'}]:[]})+
      '<div id="quickSaleStats"></div><div id="quickSaleListMount"></div></section>';
  }
  function variantOptions(locationId) { return GT.finishedGoods.rows().filter(function (row) { return Number(row.location_id)===Number(locationId) && row.quantity>0; }).map(function (row) {
    return {id:row.id,label:row.product.name+' · '+row.size+' · '+row.colour+' · '+row.quantity+' left · '+money(row.product.price)};
  }); }
  function cartMarkup() { return cart.length?cart.map(function (line,index) { var variant=GT.store.find('product_variants',line.product_variant_id), product=GT.store.find('products',variant.product_id);
    return '<div class="quick-cart-line"><div><strong>'+esc(product.name)+'</strong><span>'+esc(variant.size)+' · '+esc(variant.colour)+'</span></div><label>Qty <input class="form-control" type="number" min="1" max="'+variant.quantity+'" step="1" value="'+line.quantity+'" data-cart-qty="'+index+'"></label><strong>'+money(line.quantity*product.price)+'</strong><button class="btn btn-outline-danger" type="button" data-cart-remove="'+index+'" aria-label="Remove '+esc(product.name)+'">Remove</button></div>';
  }).join(''):'<p class="empty-state">Choose an item to start this sale.</p>'; }
  function counter() {
    var locationId=GT.session.currentUser().location_id;
    return '<section class="quick-sales-page">'+GT.components.pageHeader({title:'Quick Sale',description:'Pick items, collect payment and issue an A4 receipt.',actions:[{label:'Sales list',icon:'list',route:'#/sales/quick-sales',className:'btn-outline-primary'}]})+
      '<div class="quick-sale-layout"><div class="detail-card"><h2>Add finished goods</h2><label class="form-label" for="quickSearch">Search item and size</label><input class="form-control" id="quickSearch" type="search" placeholder="Search ready-made stock" autocomplete="off"><label class="form-label" for="quickItem">Item and size</label><select class="form-select" id="quickItem"></select><label class="form-label" for="quickQuantity">Quantity</label><input class="form-control" id="quickQuantity" type="number" min="1" step="1" value="1"><button class="btn btn-outline-primary" id="quickAdd" type="button">Add item</button><p class="field-error" id="quickItemError" role="alert"></p><h2>Cart</h2><div id="quickCart"></div></div>'+
      '<div class="detail-card"><h2>Payment</h2><dl class="detail-grid"><div class="detail-row"><dt>Subtotal</dt><dd id="quickSubtotal"></dd></div><div class="detail-row"><dt>VAT 18%</dt><dd id="quickVat"></dd></div><div class="detail-row"><dt>Total</dt><dd id="quickTotal"></dd></div></dl>'+
      '<label class="form-label" for="quickDiscount">Discount (UGX)</label><input class="form-control" id="quickDiscount" type="number" min="0" step="1" value="0"><label class="form-label" for="quickDiscountReason">Discount reason</label><input class="form-control" id="quickDiscountReason" type="text">'+
      '<label class="form-label" for="quickMethod">Payment method</label><select class="form-select" id="quickMethod"><option value="cash">Cash</option><option value="mtn">MTN</option><option value="airtel">Airtel</option><option value="bank">Bank transfer</option><option value="cheque">Cheque</option></select>'+
      '<label class="form-label" for="quickReference">Payment reference</label><input class="form-control" id="quickReference" type="text"><label class="form-label" for="quickReceived">Amount received (UGX)</label><input class="form-control" id="quickReceived" type="number" min="0" step="1">'+
      '<p id="quickChange" aria-live="polite"></p><p class="field-error" id="quickSaleError" role="alert"></p><button class="btn btn-primary" id="quickComplete" type="button">Complete sale</button></div></div></section>';
  }
  function bindCounter() {
    cart=[];
    var locationId=GT.session.currentUser().location_id, item=document.getElementById('quickItem'), search=document.getElementById('quickSearch');
    function fillOptions() { var query=search.value.trim().toLowerCase(), choices=variantOptions(locationId).filter(function (row) { return row.label.toLowerCase().includes(query); });
      item.innerHTML=choices.length?choices.map(function (row) { return '<option value="'+row.id+'">'+esc(row.label)+'</option>'; }).join(''):'<option value="">No matching stock</option>'; }
    function totals() { var lines=cart.map(function (line) { var variant=GT.store.find('product_variants',line.product_variant_id); return {quantity:line.quantity,unit_price:GT.store.find('products',variant.product_id).price}; });
      return GT.quickSales.totals(lines,Number(document.getElementById('quickDiscount').value)||0); }
    function refresh() { document.getElementById('quickCart').innerHTML=cartMarkup(); var values=totals();
      document.getElementById('quickSubtotal').textContent=money(values.subtotal); document.getElementById('quickVat').textContent=money(values.vat);
      document.getElementById('quickTotal').textContent=money(values.total); document.getElementById('quickChange').textContent='Change due: '+money(Math.max(0,(Number(document.getElementById('quickReceived').value)||0)-values.total));
      document.querySelectorAll('[data-cart-qty]').forEach(function (field) { field.addEventListener('change',function () { var index=Number(field.dataset.cartQty), variant=GT.store.find('product_variants',cart[index].product_variant_id), count=Number(field.value);
        if (!Number.isSafeInteger(count) || count<1 || count>variant.quantity) { document.getElementById('quickItemError').textContent='Quantity exceeds stock on hand.'; field.value=cart[index].quantity; return; }
        cart[index].quantity=count; document.getElementById('quickItemError').textContent=''; refresh(); }); });
      document.querySelectorAll('[data-cart-remove]').forEach(function (button) { button.addEventListener('click',function () { cart.splice(Number(button.dataset.cartRemove),1); refresh(); }); });
    }
    search.addEventListener('input',fillOptions); fillOptions();
    document.getElementById('quickAdd').addEventListener('click',function () { var variant=GT.store.find('product_variants',item.value), count=Number(document.getElementById('quickQuantity').value);
      if (!variant || !Number.isSafeInteger(count) || count<=0) { document.getElementById('quickItemError').textContent='Choose an item and positive whole quantity.'; return; }
      var existing=cart.find(function (line) { return line.product_variant_id===variant.id; });
      if (count+(existing?existing.quantity:0)>variant.quantity) { document.getElementById('quickItemError').textContent='Quantity exceeds stock on hand.'; return; }
      if (existing) existing.quantity+=count; else cart.push({product_variant_id:variant.id,quantity:count});
      document.getElementById('quickItemError').textContent=''; document.getElementById('quickQuantity').value='1'; refresh(); });
    ['quickDiscount','quickReceived'].forEach(function (id) { document.getElementById(id).addEventListener('input',refresh); });
    document.getElementById('quickComplete').addEventListener('click',function () { try { var row=GT.quickSales.create({location_id:locationId,lines:cart,
      discount_amount:Number(document.getElementById('quickDiscount').value),discount_reason:document.getElementById('quickDiscountReason').value,
      payment_method:document.getElementById('quickMethod').value,reference:document.getElementById('quickReference').value,
      amount_received:Number(document.getElementById('quickReceived').value)});
      GT.components.showToast(row.status==='issued'?'Receipt issued.':'Discount approval requested.',row.status==='issued'?'success':'warning'); location.hash='#/sales/quick-sales/'+row.id;
    } catch(error) { document.getElementById('quickSaleError').textContent=error.message; } });
    refresh();
  }
  function detail(params) { var row=GT.store.find('quick_sales',params.id);
    if (!row || !GT.quickSales.canView(row)) return GT.components.pageHeader({title:'Quick sale unavailable',description:'This sale is unavailable to your role.'});
    var paper=receipt(row), role=GT.session.currentUser().role;
    var actions=[];
    if (paper) actions.push({label:'Print receipt',icon:'printer',name:'print'});
    if (row.status==='ready' && GT.quickSales.canCreate()) actions.push({label:'Complete sale',icon:'check',name:'complete'});
    if (row.status==='issued' && ['sales','general_manager','owner'].includes(role)) actions.push({label:'Request void',icon:'ban',name:'request-void',className:'btn-outline-danger'});
    if (row.status==='pending_discount' && ['owner','general_manager'].includes(role)) { actions.push({label:'Approve discount',icon:'check',name:'approve-discount'}); actions.push({label:'Reject discount',icon:'x',name:'reject-discount',className:'btn-outline-danger'}); }
    if (row.status==='void_pending' && role==='owner') { actions.push({label:'Approve void',icon:'check',name:'approve-void',className:'btn-outline-danger'}); actions.push({label:'Reject void',icon:'x',name:'reject-void',className:'btn-outline-secondary'}); }
    return '<section class="quick-sales-page">'+GT.components.pageHeader({title:'Quick sale '+(paper?'· receipt '+paper.number:'#'+row.id),description:GT.dates.formatDate(row.sale_date)+' · '+user(row.cashier_id),badge:status(row),actions:actions})+
      (row.status==='void'?'<p class="sales-void-banner">VOID · '+esc(row.void_reason)+'</p>':'')+
      '<div class="detail-card"><h2>Items</h2><div id="quickSaleItems"></div></div><div class="detail-card"><h2>Payment</h2><dl class="detail-grid">'+
      GT.components.detailRow('Subtotal',money(row.subtotal))+GT.components.detailRow('Discount',money(row.discount_amount))+
      GT.components.detailRow('VAT 18%',money(row.vat_amount))+GT.components.detailRow('Total',money(row.total))+
      GT.components.detailRow('Method',row.payment_method.toUpperCase())+GT.components.detailRow('Amount received',money(row.amount_received))+
      GT.components.detailRow('Change due',money(row.change_due))+GT.components.detailRow('Reference',row.reference||'—')+
      GT.components.detailRow('Receipt',paper?paper.number:'Awaiting completion')+'</dl></div></section>';
  }
  function decisionDialog(title,callback) { GT.components.openModal({title:title,content:'<label class="form-label" for="quickDecisionNote">Reason or decision note</label><textarea class="form-control" id="quickDecisionNote" required></textarea><p class="field-error" id="quickDecisionError" role="alert"></p><div class="gt-modal-actions"><button class="btn btn-primary" id="quickDecisionSave" type="button">Save decision</button></div>'});
    document.getElementById('quickDecisionSave').addEventListener('click',function () { try { callback(document.getElementById('quickDecisionNote').value); GT.components.closeModal(); GT.components.showToast('Decision recorded.','success'); GT.app.renderPage(); GT.app.refreshChrome(); } catch(error) { document.getElementById('quickDecisionError').textContent=error.message; } }); }
  function bindDetail(params) { var row=GT.store.find('quick_sales',params.id); if (!row || !document.getElementById('quickSaleItems')) return;
    GT.dataTable.create({id:'quickSaleItemTable',rows:function () { return GT.quickSales.items(row.id); },columns:[
      {label:'Item',field:'description',priority:1},{label:'Size',field:'size',priority:1},{label:'Colour',field:'colour',priority:2},
      {label:'Quantity',field:'quantity',priority:1,align:'right',numeric:true},{label:'Unit price',field:'unit_price',priority:2,align:'right',numeric:true,formatter:money},
      {label:'Amount',field:'amount',priority:1,align:'right',numeric:true,formatter:money}],emptyState:{message:'No sale lines.'},exportName:'quick-sale-items.csv'}).mount('#quickSaleItems');
    document.querySelectorAll('[data-page-action]').forEach(function (button) { button.addEventListener('click',function () { var action=button.dataset.pageAction;
      if (action==='print') GT.receiptModule.print(receipt(row));
      if (action==='complete') { try { GT.quickSales.complete(row.id); GT.components.showToast('Receipt issued.','success'); GT.app.renderPage(); } catch(error) { GT.components.showToast(error.message,'error'); } }
      if (action==='request-void') decisionDialog('Request quick sale void',function (note) { GT.quickSales.requestVoid(row.id,note); });
      if (action==='approve-discount') decisionDialog('Decide discount',function (note) { GT.quickSales.discountDecision(row.id,true,note); });
      if (action==='reject-discount') decisionDialog('Reject discount',function (note) { GT.quickSales.discountDecision(row.id,false,note); });
      if (action==='approve-void') decisionDialog('Approve quick sale void',function (note) { GT.quickSales.decideVoid(row.id,true,note); });
      if (action==='reject-void') decisionDialog('Reject quick sale void',function (note) { GT.quickSales.decideVoid(row.id,false,note); });
    }); });
  }
  var api={render:function (view,params) { return view==='counter'?counter():view==='list'?list():detail(params); },bind:function (view,params) { if (view==='counter') bindCounter(); else if (view==='list') { table.mount('#quickSaleListMount'); updateCards(); } else bindDetail(params); }};
  GT.router.register('#/sales/quick-sale',{module:api,view:'counter',title:'Quick Sale',permission:'quick_sale',action:'C',baseRoute:'#/sales/quick-sale'});
  GT.router.register('#/sales/quick-sales',{module:api,view:'list',title:'Quick Sales',permission:'quick_sale',baseRoute:'#/sales/quick-sales'});
  GT.router.register('#/sales/quick-sales/:id',{module:api,view:'detail',title:'Quick Sale',permission:'quick_sale',baseRoute:'#/sales/quick-sales'});
  return api;
}());
