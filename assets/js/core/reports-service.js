/* Read-only Phase 16 calculations. BUSINESS_RULES.md sections 4, 6, 13 and 14. */
window.GT.reports = (function () {
  var GT = window.GT;
  function sum(rows, field) { return rows.reduce(function (total, row) { return total + Number(row[field] || 0); }, 0); }
  function inRange(date, from, to) { return (!from || date >= from) && (!to || date <= to); }
  function sourceForReceipt(row) {
    if (row.invoice_id) return '#/sales/receipts/' + row.id;
    var sale = GT.store.where('quick_sales', { receipt_id:row.id })[0];
    return sale ? '#/sales/quick-sales/' + sale.id : '#/sales/receipts/' + row.id;
  }
  function sales() {
    // A-76 and A-87: billing and cash collection are separate measures; quick sales appear once as cash.
    var invoices = GT.store.where('sales_documents', function (row) { return row.type === 'invoice' && row.status === 'issued'; }).map(function (row) {
      return { id:'i' + row.id, date:row.issue_date, kind:'Invoice', number:row.number, customer:row.customer_name || (GT.store.find('customers', row.customer_id) || {}).name || '', customer_id:row.customer_id, issued_by:row.issued_by, category:'Unclassified', billed:Number(row.total), collected:0, route:'#/sales/invoices/' + row.id };
    });
    var receipts = GT.store.where('receipts', function (row) { return row.status !== 'void'; }).map(function (row) {
      var sale = GT.store.where('quick_sales', { receipt_id:row.id })[0];
      var lines = sale ? GT.store.where('quick_sale_items', { quick_sale_id:sale.id }) : [];
      var categories = [...new Set(lines.map(function (line) { var variant=GT.store.find('product_variants',line.product_variant_id); var product=variant && GT.store.find('products',variant.product_id); return product ? product.category : 'Unclassified'; }))];
      return { id:'r' + row.id, date:row.received_at.slice(0,10), kind:sale ? 'Counter sale' : 'Receipt', number:row.number,
        customer:row.customer_name || 'Walk-in customer', category:categories.length === 1 ? categories[0] : categories.length ? 'Mixed' : 'Unclassified',
        billed:0, collected:Number(row.amount), route:sourceForReceipt(row) };
    });
    return invoices.concat(receipts).sort(function (a,b) { return b.date.localeCompare(a.date) || b.id.localeCompare(a.id); });
  }
  function salesTotals(rows) { return { billed:sum(rows,'billed'), collected:sum(rows,'collected'), invoices:rows.filter(function (row) { return row.kind === 'Invoice'; }).length }; }
  function salesByEmployee(from,to) {
    // BUSINESS_RULES.md section 14: invoice billing belongs to the issuing salesperson by invoice date.
    var totals={}; sales().filter(function (row) { return row.kind==='Invoice' && inRange(row.date,from,to); }).forEach(function (row) {
      totals[row.issued_by]=(totals[row.issued_by]||0)+row.billed;
    });
    return totals;
  }
  function bestCustomers(from,to) {
    var totals={}; sales().filter(function (row) { return row.kind==='Invoice' && inRange(row.date,from,to); }).forEach(function (row) {
      var key=row.customer_id; if (!totals[key]) totals[key]={id:key,name:row.customer,value:0,invoices:0,route:'#/customers/'+key};
      totals[key].value+=row.billed; totals[key].invoices++;
    });
    return Object.values(totals).sort(function (a,b) { return b.value-a.value; });
  }
  function bestItems(from,to) {
    // A-89: invoice items without a verified product link remain Unclassified.
    var totals={}; GT.store.where('sales_documents',function (doc) { return doc.type==='invoice' && doc.status==='issued' && inRange(doc.issue_date,from,to); }).forEach(function (doc) {
      GT.store.where('sales_document_items',function (line) { return line.sales_document_id===doc.id && line.active!==false; }).forEach(function (line) {
        var key=line.description+'|'+(line.unit||'');
        if (!totals[key]) totals[key]={id:key,name:line.description,category:'Unclassified',quantity:0,unit:line.unit||'',value:0};
        totals[key].quantity+=Number(line.quantity||0); totals[key].value+=Number(line.amount||0);
      });
    });
    // A-113: include completed counter-sale lines once; values are before document discount and VAT.
    GT.store.where('quick_sales',function (sale) { return ['issued','void_pending'].includes(sale.status) && inRange(sale.sale_date,from,to); }).forEach(function (sale) {
      var receipt = GT.store.find('receipts',sale.receipt_id);
      if (!receipt || receipt.status === 'void') return;
      GT.store.where('quick_sale_items',{quick_sale_id:sale.id}).forEach(function (line) {
        var variant = GT.store.find('product_variants',line.product_variant_id);
        var product = variant && GT.store.find('products',variant.product_id);
        var key = 'product-' + (product ? product.id : line.description);
        if (!totals[key]) totals[key] = {id:key,name:product ? product.name : line.description,category:product && product.category || 'Unclassified',quantity:0,unit:'pcs',value:0};
        totals[key].quantity += Number(line.quantity || 0); totals[key].value += Number(line.amount || 0);
      });
    });
    return Object.values(totals).sort(function (a,b) { return b.value-a.value; });
  }
  function stock() {
    var locations = GT.store.all('locations');
    var materialRows = GT.store.all('material_stock').map(function (balance) {
      var material=GT.store.find('materials',balance.material_id), location=locations.find(function (row) { return row.id === balance.location_id; });
      if (!material || material.active === false) return null;
      var quantity=Number(balance.quantity || 0), overallStatus=GT.inventory.status(material);
      return { id:'m' + balance.id, item_type:'material', item_id:material.id, name:material.name, category:material.category,
        size:'', colour:material.colour || '', location:location ? location.name : '', location_id:balance.location_id,
        quantity:quantity, unit:material.unit, status:overallStatus.charAt(0).toUpperCase()+overallStatus.slice(1), route:'#/inventory/materials/' + material.id };
    });
    var variants = GT.store.all('product_variants').map(function (variant) {
      var product=GT.store.find('products',variant.product_id), location=locations.find(function (row) { return row.id === variant.location_id; });
      if (!product || product.active === false) return null;
      var quantity=Number(variant.quantity || 0), level=Number(variant.full_stock_level || 0);
      return { id:'p' + variant.id, item_type:'product_variant', item_id:variant.id, name:product.name, category:product.category,
        size:variant.size, colour:variant.colour, location:location ? location.name : '', location_id:variant.location_id,
        quantity:quantity, unit:'pcs', status:quantity === 0 ? 'Out' : level && quantity <= level * .25 ? 'Low' : 'OK', route:'#/inventory/finished-goods/' + variant.id };
    });
    return materialRows.concat(variants).filter(Boolean);
  }
  function stockActivity(row, from, to) {
    return GT.store.where('stock_movements', function (move) { return move.item_type === row.item_type && Number(move.item_id) === row.item_id && Number(move.location_id) === row.location_id && inRange(String(move.created_at || '').slice(0,10),from,to); })
      .reduce(function (total, move) { return total + Number(move.quantity || 0); },0);
  }
  function debtors() { return GT.debtors.list(); }
  function debtorRows(from, to) {
    return debtors().map(function (row) {
      var docs=row.open_invoices.filter(function (doc) { return inRange(doc.issue_date,from,to); });
      return { id:row.id, name:row.name, invoice_count:docs.length, balance:sum(docs,'balance'),
        b0_30:sum(docs,'balance') ? docs.reduce(function (total,doc) { return total + (GT.debtors.bucket(doc.ageDays)==='b0_30' ? doc.balance : 0); },0) : 0,
        b31_60:docs.reduce(function (total,doc) { return total + (GT.debtors.bucket(doc.ageDays)==='b31_60' ? doc.balance : 0); },0),
        b61_plus:docs.reduce(function (total,doc) { return total + (GT.debtors.bucket(doc.ageDays)==='b61_plus' ? doc.balance : 0); },0),
        route:'#/debtors/' + row.id };
    }).filter(function (row) { return row.balance > 0; });
  }
  function financial(month, rangeFrom, rangeTo) {
    var from=rangeFrom && rangeFrom > month+'-01' ? rangeFrom : month+'-01';
    var end=GT.dates.endOfMonth(month+'-01'), to=rangeTo && rangeTo < end ? rangeTo : end;
    var ledger=GT.store.where('ledger_entries', function (row) { return inRange(row.entry_date,from,to); });
    var receipts=GT.store.where('receipts', function (row) { return row.status !== 'void' && inRange(row.received_at.slice(0,10),from,to); });
    var expenses=GT.store.where('expenses', function (row) { return row.status === 'approved' && inRange(row.expense_date,from,to); });
    var moneyIn=sum(ledger,'debit'), moneyOut=sum(ledger,'credit');
    var receiptIncome=ledger.reduce(function (n,row) { return n+(row.reference_type==='receipt' ? Number(row.debit || 0) : row.reference_type==='receipt_reversal' ? -Number(row.credit || 0) : 0); },0);
    var expenseSpending=ledger.reduce(function (n,row) { return n+(row.reference_type==='expense' ? Number(row.credit || 0) : row.reference_type==='expense_reversal' ? -Number(row.debit || 0) : 0); },0);
    var expenseByCategory={};
    ledger.forEach(function (entry) { if (entry.reference_type.indexOf('expense')!==0) return; var expense=GT.store.find('expenses',entry.reference_id);
      var category=expense && GT.store.find('expense_categories',expense.category_id), label=category ? category.name : 'Unclassified';
      expenseByCategory[label]=(expenseByCategory[label] || 0)+(entry.reference_type==='expense' ? Number(entry.credit || 0) : -Number(entry.debit || 0));
    });
    var accountMovement={Cash:0,Bank:0}; ledger.forEach(function (entry) { var account=GT.store.find('accounts',entry.account_id);
      if (account && Object.prototype.hasOwnProperty.call(accountMovement,account.name)) accountMovement[account.name]+=Number(entry.debit || 0)-Number(entry.credit || 0);
    });
    // A-85: cash-book reversals remain on their own dates; the independent source check includes those dates.
    var allEntries=GT.store.all('ledger_entries');
    var receiptPosts=GT.store.where('receipts', function (row) {
      return inRange(row.received_at.slice(0,10),from,to) && (row.status !== 'void' || allEntries.some(function (entry) { return entry.reference_type==='receipt' && entry.reference_id===row.id; }));
    });
    var expensePosts=GT.store.where('expenses', function (row) { return inRange(row.expense_date,from,to) && (row.status==='approved' || row.status==='cancelled'); });
    var reversalRows=ledger.filter(function (row) { return /_reversal$/.test(row.reference_type); });
    var expectedIn=sum(receiptPosts,'amount') + reversalRows.filter(function (row) { return row.reference_type==='expense_reversal' && (GT.store.find('expenses',row.reference_id) || {}).status==='cancelled'; }).reduce(function (n,row) { return n+Number((GT.store.find('expenses',row.reference_id) || {}).amount || 0); },0);
    var expectedOut=sum(expensePosts,'amount') + reversalRows.filter(function (row) { return row.reference_type==='receipt_reversal' && (GT.store.find('receipts',row.reference_id) || {}).status==='void'; }).reduce(function (n,row) { return n+Number((GT.store.find('receipts',row.reference_id) || {}).amount || 0); },0);
    var validEntries=ledger.every(function (entry) {
      var source=GT.store.find(entry.reference_type.indexOf('receipt')===0 ? 'receipts' : 'expenses',entry.reference_id);
      return source && Number(entry.debit || 0)+Number(entry.credit || 0)===Number(source.amount || 0) &&
        (entry.reference_type.indexOf('receipt')===0 || entry.reference_type.indexOf('expense')===0);
    });
    var openingKnown=false; // A-88: the 01/01/2027 verified opening figures have not been supplied.
    var ytdFrom=month >= '2027-01' ? '2027-01-01' : null;
    var ytd= ytdFrom ? GT.store.where('ledger_entries',function (row) { return inRange(row.entry_date,ytdFrom,to); }) : [];
    return { month:month, from:from, to:to, ledger:ledger, receipts:receipts, expenses:expenses,
      moneyIn:moneyIn, moneyOut:moneyOut, movement:moneyIn-moneyOut, billed:sum(GT.store.where('sales_documents',function (row) { return row.type==='invoice' && row.status==='issued' && inRange(row.issue_date,from,to); }),'total'),
      receiptIncome:receiptIncome, expenseSpending:expenseSpending, expenseByCategory:expenseByCategory, accountMovement:accountMovement,
      ytdIn:sum(ytd,'debit'), ytdOut:sum(ytd,'credit'), openingKnown:openingKnown,
      reconciled:validEntries && moneyIn===expectedIn && moneyOut===expectedOut,
      expectedIn:expectedIn, expectedOut:expectedOut };
  }
  return { sales:sales, salesTotals:salesTotals, salesByEmployee:salesByEmployee, bestCustomers:bestCustomers, bestItems:bestItems, stock:stock, stockActivity:stockActivity, debtorRows:debtorRows, financial:financial, inRange:inRange };
}());
