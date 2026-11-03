/* Counter sales use the receipt ledger and controlled finished goods movements. */
window.GT.quickSales = (function () {
  var GT = window.GT;
  function actor() { return GT.session.currentUser(); }
  function manager() { return actor() && ['owner','general_manager'].includes(actor().role); }
  function canCreate() { return actor() && ['general_manager','sales'].includes(actor().role); }
  function canView(row) { return GT.permissions.can('quick_sale','V') && (actor().role !== 'sales' || Number(row.cashier_id) === actor().id); }
  function items(id) { return GT.store.where('quick_sale_items',{quick_sale_id:Number(id)}); }
  function list() { return GT.store.all('quick_sales').filter(canView).sort(function (a,b) { return b.id-a.id; }); }
  function totals(lines, discount) { return GT.calc.calcTotals(lines.map(function (line) { return {quantity:Number(line.quantity),unit_price:Number(line.unit_price)}; }),discount,GT.settings.vatRate); }
  function validateLines(lines, locationId) {
    if (!Array.isArray(lines) || !lines.length) throw new Error('Add at least one finished good.');
    var requested = {};
    return lines.map(function (line) {
      var variant = GT.store.find('product_variants',line.product_variant_id), quantity = Number(line.quantity);
      if (!variant || Number(variant.location_id) !== Number(locationId) || !Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('Choose an available item and a whole quantity.');
      requested[variant.id] = (requested[variant.id] || 0) + quantity;
      if (requested[variant.id] > Number(variant.quantity)) throw new Error('Quantity exceeds stock on hand.');
      var product = GT.store.find('products',variant.product_id);
      return {product_variant_id:variant.id,description:product.name,size:variant.size,colour:variant.colour,
        quantity:quantity,unit_price:Number(product.price),amount:quantity*Number(product.price)};
    });
  }
  function validatePayment(method, reference, amount, total) {
    if (!['cash','mtn','airtel','bank','cheque'].includes(method)) throw new Error('Choose a payment method.');
    if (!Number.isSafeInteger(Number(amount)) || Number(amount) < total) throw new Error('Amount received must cover the total.');
    var text = String(reference || '').trim();
    if (['mtn','airtel'].includes(method) && !/^[A-Za-z0-9][A-Za-z0-9.\/-]{5,}$/.test(text)) throw new Error('Enter a Mobile Money transaction ID of at least six characters.');
    if (method === 'bank' && !text) throw new Error('Enter a bank reference.');
    if (method === 'cheque' && !/^\d{4,12}$/.test(text)) throw new Error('Enter a cheque number of 4 to 12 digits.');
    if (method !== 'cash' && GT.store.where('receipts',function (row) { return row.status !== 'void' && row.payment_method === method && String(row.reference || '').toLowerCase() === text.toLowerCase(); }).length)
      throw new Error('This payment reference is already used.');
  }
  function create(input) {
    if (!canCreate()) throw new Error('You cannot create quick sales.');
    var locationId = Number(input.location_id || actor().location_id), lines = validateLines(input.lines,locationId);
    if (actor().role === 'sales' && locationId !== Number(actor().location_id)) throw new Error('Sales can sell only from their assigned location.');
    var discount = Number(input.discount_amount || 0), reason = String(input.discount_reason || '').trim();
    var amounts = totals(lines,discount);
    if (!Number.isSafeInteger(discount) || discount < 0 || discount >= amounts.subtotal) throw new Error('Discount must be below the subtotal.');
    if (discount && !reason) throw new Error('Explain the discount request.');
    validatePayment(input.payment_method,input.reference,input.amount_received,amounts.total);
    return GT.store.transaction(function () {
      var instant = !discount || manager();
      var sale = GT.store.create('quick_sales',{receipt_id:null,location_id:locationId,cashier_id:actor().id,
        sale_date:GT.dates.today(),status:instant?'ready':'pending_discount',subtotal:amounts.subtotal,
        discount_amount:discount,discount_reason:reason,discount_status:discount?(instant?'approved':'requested'):'none',
        vat_rate:GT.settings.vatRate,vat_amount:amounts.vat,total:amounts.total,
        payment_method:input.payment_method,reference:String(input.reference || '').trim(),amount_received:Number(input.amount_received),
        change_due:Number(input.amount_received)-amounts.total,void_reason:null,voided_by:null,voided_at:null});
      lines.forEach(function (line) { GT.store.create('quick_sale_items',Object.assign({quick_sale_id:sale.id},line)); });
      if (discount) GT.store.create('approvals',{type:'discount',entity_type:'quick_sales',entity_id:sale.id,
        requested_by:actor().id,approved_by:instant?actor().id:null,status:instant?'approved':'requested',reason:reason});
      GT.audit.log('create','quick_sales',sale.id,null,sale);
      return instant ? complete(sale.id) : sale;
    });
  }
  function discountDecision(id, approve, note) {
    if (!GT.permissions.can('discounts','A')) throw new Error('Only Owner or General Manager may decide discounts.');
    var before = GT.store.find('quick_sales',id);
    if (!before || before.status !== 'pending_discount' || !String(note || '').trim()) throw new Error('A pending discount and decision note are required.');
    return GT.store.transaction(function () {
      var after = GT.store.update('quick_sales',id,{status:approve?'ready':'rejected',discount_status:approve?'approved':'rejected'});
      var approval = GT.store.where('approvals',function (row) { return row.type==='discount' && row.entity_type==='quick_sales' && Number(row.entity_id)===Number(id); })[0];
      GT.store.update('approvals',approval.id,{approved_by:actor().id,status:approve?'approved':'rejected',reason:String(note).trim()});
      GT.audit.log(approve?'approve_discount':'reject_discount','quick_sales',id,before,after);
      return after;
    });
  }
  function complete(id) {
    var before = GT.store.find('quick_sales',id);
    if (!before || before.status !== 'ready' || !canView(before) || !canCreate()) throw new Error('This sale cannot be completed.');
    return GT.store.transaction(function () {
      var lines = validateLines(items(id),before.location_id);
      validatePayment(before.payment_method,before.reference,before.amount_received,before.total);
      // BUSINESS_RULES.md sections 1, 2 and 6: a paid sale consumes one receipt number and posts each stock line atomically.
      var receipt = GT.store.create('receipts',{number:GT.numbering.next('receipt'),customer_id:null,customer_name:'Walk-in customer',
        invoice_id:null,amount:before.total,payment_method:before.payment_method,reference:before.payment_method==='cash'?'':before.reference,
        description:'Quick sale '+id,balance_after:0,received_by:before.cashier_id,
        received_at:GT.dates.today()+'T12:00:00+03:00',status:'issued',void_reason:null,voided_by:null,voided_at:null});
      lines.forEach(function (line) { GT.finishedGoods.move(line.product_variant_id,-line.quantity,'sale','quick_sale',id,'Quick sale receipt '+receipt.number); });
      var after = GT.store.update('quick_sales',id,{status:'issued',receipt_id:receipt.id});
      GT.audit.log('issue','quick_sales',id,before,after);
      GT.audit.log('issue','receipts',receipt.id,null,receipt);
      GT.cashBook.receipt(receipt,false);
      window.dispatchEvent(new Event('gt:receipt-changed'));
      return after;
    });
  }
  function requestVoid(id, reason) {
    var before = GT.store.find('quick_sales',id);
    if (!before || before.status !== 'issued' || !canView(before) || !String(reason || '').trim()) throw new Error('An issued sale and reason are required.');
    if (!['owner','general_manager','sales'].includes(actor().role)) throw new Error('You cannot request a void.');
    return GT.store.transaction(function () {
      var after = GT.store.update('quick_sales',id,{status:'void_pending',void_reason:String(reason).trim()});
      GT.store.create('approvals',{type:'void',entity_type:'quick_sales',entity_id:id,requested_by:actor().id,approved_by:null,status:'requested',reason:String(reason).trim()});
      GT.audit.log('request_void','quick_sales',id,before,after);
      return after;
    });
  }
  function decideVoid(id, approve, note) {
    // ROLE_PERMISSION_MATRIX.md hard rule 5: Owner approval precedes reversal.
    if (!actor() || actor().role !== 'owner') throw new Error('Only Owner may decide a quick sale void.');
    var before = GT.store.find('quick_sales',id);
    if (!before || before.status !== 'void_pending' || !String(note || '').trim()) throw new Error('A pending void and decision note are required.');
    return GT.store.transaction(function () {
      if (approve) items(id).forEach(function (line) { GT.finishedGoods.move(line.product_variant_id,line.quantity,'return','quick_sale_void',id,'Void receipt '+GT.store.find('receipts',before.receipt_id).number); });
      var after = GT.store.update('quick_sales',id,{status:approve?'void':'issued',voided_by:approve?actor().id:null,voided_at:approve?new Date().toISOString():null});
      if (approve) GT.store.update('receipts',before.receipt_id,{status:'void',void_reason:before.void_reason,voided_by:actor().id,voided_at:after.voided_at});
      if (approve) GT.cashBook.receipt(GT.store.find('receipts',before.receipt_id),true);
      var approval = GT.store.where('approvals',function (row) { return row.type==='void' && row.entity_type==='quick_sales' && Number(row.entity_id)===Number(id) && row.status==='requested'; })[0];
      GT.store.update('approvals',approval.id,{approved_by:actor().id,status:approve?'approved':'rejected',reason:String(note).trim()});
      GT.audit.log(approve?'void':'reject_void','quick_sales',id,before,after);
      window.dispatchEvent(new Event('gt:receipt-changed'));
      return after;
    });
  }
  return {list:list,items:items,canView:canView,canCreate:canCreate,totals:totals,create:create,complete:complete,
    discountDecision:discountDecision,requestVoid:requestVoid,decideVoid:decideVoid};
}());
