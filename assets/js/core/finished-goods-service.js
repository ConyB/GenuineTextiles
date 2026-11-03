/* Finished goods ledger: BUSINESS_RULES.md section 6, A-55 and Phase 14 assumptions. */
window.GT.finishedGoods = (function () {
  var GT = window.GT;
  function actor() { return GT.session.currentUser(); }
  function manager() { return actor() && ['owner','general_manager'].indexOf(actor().role) !== -1; }
  function variant(id) { var row = GT.store.find('product_variants', id); if (!row) throw new Error('Finished good not found.'); return row; }
  function product(id) { return GT.store.find('products', id); }
  function status(row) {
    if (!Number(row.quantity)) return 'Out';
    // BUSINESS_RULES.md section 6 (A-04): low is at or below a quarter of full stock.
    return Number(row.full_stock_level) && Number(row.quantity) <= Number(row.full_stock_level) * .25 ? 'Low' : 'In stock';
  }
  function rows() { return GT.store.all('product_variants').map(function (row) {
    return Object.assign({}, row, { product:product(row.product_id), stock_status:status(row) });
  }); }
  function movements(id) { return GT.store.where('stock_movements', function (row) { return row.item_type === 'product_variant' && Number(row.item_id) === Number(id); }); }
  function move(id, quantity, type, referenceType, referenceId, note, userId) {
    var role=actor() && actor().role;
    var allowed=type==='sale' ? ['general_manager','sales'] : type==='return' || type==='adjustment' || type==='opening' ? ['owner'] :
      type==='received_from_production' || type==='transfer_out' || type==='transfer_in' ? ['owner','general_manager','store_keeper'] : [];
    if (!allowed.includes(role)) throw new Error('You cannot post this finished goods movement.');
    var before = variant(id), change = Number(quantity), after = Number(before.quantity) + change;
    if (!Number.isSafeInteger(change) || !change || after < 0) throw new Error('Stock movement must be whole pieces and cannot make stock negative.');
    var saved = GT.store.update('product_variants', id, { quantity:after });
    var movement = GT.store.create('stock_movements', { item_type:'product_variant', item_id:Number(id), location_id:before.location_id,
      movement_type:type, quantity:change, before_qty:Number(before.quantity), after_qty:after,
      reference_type:referenceType, reference_id:referenceId || null, user_id:userId || actor().id, note:String(note || '').trim() });
    GT.audit.log('create','stock_movements',movement.id,null,movement);
    window.dispatchEvent(new Event('gt:finished-goods-changed'));
    return { variant:saved, movement:movement };
  }
  function approvalFor(id, type) { return GT.store.where('approvals', function (row) { return row.type === type && row.entity_type === 'finished_good_adjustments' && Number(row.entity_id) === Number(id); })[0]; }
  function openingStock(id, quantity, reason) {
    // BUSINESS_RULES.md section 6 (A-28/A-73): opening is a one-time controlled movement, not an editable balance.
    if (!actor() || actor().role !== 'owner') throw new Error('Only Owner may record opening stock.');
    var item=variant(id), count=Number(quantity);
    if (Number(item.quantity) !== 0 || movements(id).length || !Number.isSafeInteger(count) || count <= 0 || !String(reason || '').trim())
      throw new Error('Opening stock needs an unused zero-balance variant, a whole quantity and a reason.');
    return GT.store.transaction(function () { return move(id,count,'opening','opening_balance',null,String(reason).trim()); });
  }
  function adjust(input) {
    if (!['owner','general_manager','store_keeper'].includes(actor().role)) throw new Error('You cannot request an adjustment.');
    variant(input.product_variant_id);
    var quantity = Number(input.quantity), direction = input.direction, reason = String(input.reason || '').trim();
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || !['increase','decrease'].includes(direction) || !reason) throw new Error('Enter a positive whole quantity, direction and reason.');
    if (direction === 'decrease' && quantity > Number(variant(input.product_variant_id).quantity)) throw new Error('Decrease exceeds stock on hand.');
    return GT.store.transaction(function () { var row = GT.store.create('finished_good_adjustments', { product_variant_id:Number(input.product_variant_id), direction:direction,
      quantity:quantity, reason:reason, status:'pending', requested_by:actor().id, requested_at:new Date().toISOString(),
      decided_by:null, decided_at:null, decision_note:'', movement_id:null });
    GT.store.create('approvals', { type:'stock_adjustment', entity_type:'finished_good_adjustments', entity_id:row.id,
      requested_by:actor().id, approved_by:null, status:'pending', reason:reason });
    GT.audit.log('request','finished_good_adjustments',row.id,null,row);
    if (actor().role === 'owner') return decide(row.id, true, 'Created and approved by Owner.');
    window.dispatchEvent(new Event('gt:finished-goods-changed'));
    return row; });
  }
  function decide(id, approve, note) {
    // BUSINESS_RULES.md section 6 (A-08/A-33): only Owner decides and only approval posts stock.
    if (!actor() || actor().role !== 'owner') throw new Error('Only Owner may decide stock adjustments.');
    var before = GT.store.find('finished_good_adjustments', id);
    if (!before || before.status !== 'pending') throw new Error('Only a pending adjustment can be decided.');
    if (!String(note || '').trim()) throw new Error('A decision note is required.');
    return GT.store.transaction(function () {
      var movement = approve ? move(before.product_variant_id, before.direction === 'increase' ? before.quantity : -before.quantity,
        'adjustment','finished_good_adjustment',id,before.reason).movement : null;
      var after = GT.store.update('finished_good_adjustments', id, { status:approve ? 'approved' : 'rejected',
        decided_by:actor().id, decided_at:new Date().toISOString(), decision_note:String(note).trim(), movement_id:movement ? movement.id : null });
      var approval = approvalFor(id,'stock_adjustment');
      GT.store.update('approvals',approval.id,{ approved_by:actor().id,status:after.status,reason:String(note).trim() });
      GT.audit.log(approve ? 'approve' : 'reject','finished_good_adjustments',id,before,after);
      window.dispatchEvent(new Event('gt:finished-goods-changed'));
      return after;
    });
  }
  function createStockOrder(id, quantity, dueDate) {
    if (!manager() || !GT.permissions.can('orders','C')) throw new Error('Only Owner or General Manager may create a stock production order.');
    var item = variant(id), count = Number(quantity), date = String(dueDate || '');
    if (!Number.isSafeInteger(count) || count <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < GT.dates.today()) throw new Error('Enter a whole quantity and a due date from today onward.');
    return GT.store.transaction(function () {
      var first = GT.orders.stages()[0];
      var order = GT.store.create('orders', { number:GT.numbering.next('order'), customer_id:null, source_document_id:null, invoice_id:null,
        order_date:GT.dates.today(), due_date:date, priority:'normal', description:product(item.product_id).name,
        notes:'For ready-made stock.', created_by:actor().id, location_id:item.location_id, status:'active', current_stage:first.name,
        stage_id:first.id, is_for_stock:true, product_variant_id:item.id, cancellation_reason:null });
      GT.store.create('order_items', { order_id:order.id, description:product(item.product_id).name, size:item.size,
        quantity:count, unit:'pcs', unit_price:0, product_variant_id:item.id });
      GT.store.create('order_stage_history', { order_id:order.id, stage_id:first.id, stage:first.name, changed_by:actor().id,
        changed_at:new Date().toISOString(), note:'Stock production order confirmed.' });
      GT.audit.log('confirm','orders',order.id,null,order);
      return order;
    });
  }
  function stockOrders(id) { return GT.store.where('orders', function (row) { return row.is_for_stock === true && Number(row.product_variant_id) === Number(id) && row.status === 'active'; }); }
  function advanceStockOrder(id) {
    var order = GT.store.find('orders',id);
    if (!order || !order.is_for_stock || order.status !== 'active') throw new Error('Stock production order is unavailable.');
    if (!['owner','general_manager','workshop_supervisor'].includes(actor().role)) throw new Error('You cannot move production stages.');
    var stages = GT.orders.stages(), current = stages.findIndex(function (row) { return row.name === order.current_stage; }), next = stages[current + 1];
    if (!next || next.name === 'Delivered') throw new Error('This order is already ready for stock receipt.');
    return GT.store.transaction(function () {
      var after = GT.store.update('orders',id,{current_stage:next.name,stage_id:next.id});
      GT.store.create('order_stage_history',{order_id:id,stage_id:next.id,stage:next.name,changed_by:actor().id,
        changed_at:new Date().toISOString(),note:'Stock production progressed.'});
      GT.audit.log('move_stage','orders',id,order,after);
      return after;
    });
  }
  function receive(id, quantity) {
    if (!['owner','general_manager','store_keeper'].includes(actor().role)) throw new Error('You cannot receive finished goods.');
    var order = GT.store.find('orders',id), count = Number(quantity);
    if (!order || !order.is_for_stock || order.status !== 'active' || order.current_stage !== 'Ready for delivery' || order.customer_id)
      throw new Error('Choose a stock order at Ready for delivery.');
    var ordered = GT.store.where('order_items',{order_id:order.id}).reduce(function (sum,row) { return sum + Number(row.quantity); },0);
    var received = GT.store.where('stock_movements',function (row) { return row.reference_type === 'stock_order' && Number(row.reference_id) === order.id && row.quantity > 0; })
      .reduce(function (sum,row) { return sum + Number(row.quantity); },0);
    if (!Number.isSafeInteger(count) || count <= 0 || count > ordered - received) throw new Error('Quantity exceeds the unreceived stock order balance.');
    return GT.store.transaction(function () { return move(order.product_variant_id,count,'received_from_production','stock_order',id,'Received from production order '+order.number); });
  }
  function transfer(id, quantity, destinationId) {
    if (!['owner','general_manager','store_keeper'].includes(actor().role)) throw new Error('You cannot transfer stock.');
    var source = variant(id), count = Number(quantity), location = GT.store.find('locations',destinationId);
    if (!location || Number(location.id) === Number(source.location_id) || !Number.isSafeInteger(count) || count <= 0 || count > Number(source.quantity)) throw new Error('Choose another location and an available whole quantity.');
    return GT.store.transaction(function () {
      var target = GT.store.where('product_variants',function (row) { return row.product_id === source.product_id && row.size === source.size && row.colour === source.colour && Number(row.location_id) === location.id; })[0];
      if (!target) target = GT.store.create('product_variants',{product_id:source.product_id,size:source.size,colour:source.colour,quantity:0,location_id:location.id,full_stock_level:source.full_stock_level});
      var out = move(id,-count,'transfer_out','product_variant',target.id,'Transfer to '+location.name);
      var into = move(target.id,count,'transfer_in','product_variant',id,'Transfer from location '+source.location_id);
      return { out:out, into:into };
    });
  }
  return { rows:rows, status:status, movements:movements, move:move, openingStock:openingStock, adjust:adjust, decide:decide,
    createStockOrder:createStockOrder, stockOrders:stockOrders, advanceStockOrder:advanceStockOrder, receive:receive, transfer:transfer };
}());
