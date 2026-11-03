/* Phase 16 read-only report screens. All arithmetic is in reports-service.js. */
window.GT.reportModules = (function () {
  var GT=window.GT, money=GT.format.formatMoney, safe=GT.components.escapeHtml;
  function dateFilters(field) { return [
    {name:'date_from',label:'From date',type:'date',test:function (row,value) { return !field || row[field]>=value; }},
    {name:'date_to',label:'To date',type:'date',test:function (row,value) { return !field || row[field]<=value; }}
  ]; }
  function title(name,description,print) { return GT.components.pageHeader({title:name,description:description,actions:[{label:'Print',name:'print',icon:'printer'}]}); }
  function bindPrint(callback) { document.querySelector('[data-page-action="print"]').addEventListener('click',callback); }
  function printTable(name,period,headers,rows,totals,extra) {
    var html=GT.print.letterhead()+'<h2>'+safe(name.toUpperCase())+'</h2><p>'+safe(period)+'</p><table class="report-print-table"><thead><tr>'+headers.map(function (label) { return '<th>'+safe(label)+'</th>'; }).join('')+'</tr></thead><tbody>'+
      (rows.length ? rows.map(function (cells) { return '<tr>'+cells.map(function (cell) { return '<td>'+safe(cell)+'</td>'; }).join('')+'</tr>'; }).join('') : '<tr><td colspan="'+headers.length+'">No records in this period.</td></tr>')+
      '</tbody></table>'+(totals ? '<p class="report-print-total">'+safe(totals)+'</p>' : '');
    GT.print.open(html+(extra||''),name);
  }
  function period(table) { var f=table.state.filters; return f.date_from || f.date_to ? GT.dates.formatRange(f.date_from || '',f.date_to || '') : 'All dates'; }
  function sourceRoute(row) { location.hash=row.route; }
  function salesGroupKey(row,mode) {
    if (mode==='customer') return row.customer;
    if (mode==='category') return row.category;
    if (mode==='week') { var day=new Date(row.date+'T12:00:00Z'), weekday=(day.getUTCDay()+6)%7; day.setUTCDate(day.getUTCDate()-weekday); return day.toISOString().slice(0,10); }
    return mode==='month' ? row.date.slice(0,7) : row.date;
  }
  function groupedSales(rows,mode) {
    var map={}; rows.forEach(function (row) { var key=salesGroupKey(row,mode); if (!map[key]) map[key]={id:key,label:key,billed:0,collected:0,count:0}; map[key].billed+=row.billed; map[key].collected+=row.collected; map[key].count+=1; });
    return Object.keys(map).sort().reverse().map(function (key) { return map[key]; });
  }
  var salesTable,groupTable,customerTable,itemTable,employeeTable;
  function reportPeriod() { var f=salesTable.state.filters; return [f.date_from||'',f.date_to||'']; }
  function employeeRows() { var period=reportPeriod(), totals=GT.reports.salesByEmployee(period[0],period[1]);
    return GT.session.users().filter(function (user) { return user.role==='sales' || totals[user.id]; }).map(function (user) { return {id:user.id,name:user.name,invoiced:totals[user.id]||0}; }); }
  function salesRender() {
    salesTable=GT.dataTable.create({id:'salesReportSources',caption:'Sales source records',rows:GT.reports.sales,searchFields:['customer','number','kind'],filters:dateFilters('date').concat([
      {name:'customer',label:'Customer',field:'customer',options:[...new Set(GT.reports.sales().map(function (row) { return row.customer; }))].sort().map(function (value) { return {value:value,label:value}; })},
      {name:'category',label:'Garment category',field:'category',options:[...new Set(GT.reports.sales().map(function (row) { return row.category; }))].sort().map(function (value) { return {value:value,label:value}; })},
      {name:'invoice_issuer',label:'Invoice issuer',options:GT.session.users().map(function (user) { return {value:user.id,label:user.name}; }),test:function (row,value) { return row.kind==='Invoice' && Number(row.issued_by)===Number(value); }},
      {name:'group_by',label:'Group by',options:['day','week','month','customer','category'].map(function (value) { return {value:value,label:value.charAt(0).toUpperCase()+value.slice(1)}; }),test:function () { return true; }}
    ]),columns:[
      {label:'Date',field:'date',formatter:GT.dates.formatDate,sortable:true}, {label:'Source',field:'kind'}, {label:'Number',field:'number'},
      {label:'Customer',field:'customer',priority:2}, {label:'Category',field:'category',priority:2},
      {label:'Invoiced',field:'billed',align:'right',numeric:true,formatter:money}, {label:'Collected',field:'collected',align:'right',numeric:true,formatter:money}
    ],onRowClick:sourceRoute,emptyState:{message:'No sales records match this date range.'},exportName:'sales-report-sources.csv',onStateChange:function () { if (groupTable) groupTable.refresh(); if (customerTable) customerTable.refresh(); if (itemTable) itemTable.refresh(); if (employeeTable) employeeTable.refresh(); updateSalesSummary(); }});
    groupTable=GT.dataTable.create({id:'salesReportGroups',caption:'Grouped sales totals',rows:function () { return groupedSales(salesTable.filteredRows(),salesTable.state.filters.group_by || 'day'); },searchFields:['label'],columns:[
      {label:'Period or group',field:'label'}, {label:'Records',field:'count',align:'right',numeric:true},
      {label:'Invoiced',field:'billed',align:'right',numeric:true,formatter:money}, {label:'Collected',field:'collected',align:'right',numeric:true,formatter:money}
    ],emptyState:{message:'No sales totals in this selection.'},exportName:'sales-report-groups.csv'});
    customerTable=GT.dataTable.create({id:'bestCustomers',rows:function () { var period=reportPeriod(); return GT.reports.bestCustomers(period[0],period[1]); },columns:[
      {label:'Customer',field:'name'},{label:'Invoices',field:'invoices',align:'right',numeric:true},{label:'Invoiced',field:'value',align:'right',numeric:true,formatter:money,sortable:true}],onRowClick:sourceRoute,emptyState:{message:'No invoiced customers in this period.'},exportName:'best-customers.csv'});
    itemTable=GT.dataTable.create({id:'bestItems',rows:function () { var period=reportPeriod(); return GT.reports.bestItems(period[0],period[1]); },columns:[
      {label:'Item',field:'name'},{label:'Category',field:'category',priority:2},{label:'Quantity',field:'quantity',align:'right',numeric:true,sortable:true,formatter:function (value,row) { return value+' '+row.unit; }},
      {label:'Line value',field:'value',align:'right',numeric:true,sortable:true,formatter:money}],emptyState:{message:'No sold items in this period.'},exportName:'best-items.csv'});
    employeeTable=GT.dataTable.create({id:'salesByEmployee',rows:employeeRows,columns:[{label:'Salesperson',field:'name'},{label:'Invoiced',field:'invoiced',align:'right',numeric:true,formatter:money}],emptyState:{message:'No salespeople recorded.'},exportName:'sales-by-employee.csv'});
    return '<section>'+title('Sales Report','Invoices, receipts and counter sales. Invoiced and collected are separate measures.')+'<div id="salesReportStats"></div><div class="detail-card"><h2>Grouped totals</h2><div id="salesGroupMount"></div></div><div class="detail-card"><h2>Source records</h2><p>Invoice garment categories are unclassified until line attribution is confirmed (A-89).</p><div id="salesSourceMount"></div></div><div class="detail-card"><h2>Best customers</h2><p>Rankings use the source date range. Customer value includes invoice totals; counter sales have no customer link.</p><div id="bestCustomersMount"></div></div><div class="detail-card"><h2>Best-selling items</h2><p>Invoice and counter-sale quantities and line values before document discount and VAT. Sort by quantity or value.</p><div id="bestItemsMount"></div></div><div class="detail-card"><h2>Sales by employee</h2><div id="salesByEmployeeMount"></div></div></section>';
  }
  function updateSalesSummary() { var mount=document.getElementById('salesReportStats'); if (!mount || !salesTable) return; var totals=GT.reports.salesTotals(salesTable.filteredRows()); mount.innerHTML=GT.statCards.render([
    {label:'Invoices issued',value:totals.invoices,icon:'receipt-text',tone:'brand'},
    {label:'Invoiced',value:money(totals.billed),icon:'file-text',tone:'info'},
    {label:'Collected',value:money(totals.collected),icon:'wallet-cards',tone:'success'}]); GT.components.refreshIcons(); }
  function salesPrint() { var rows=groupedSales(salesTable.filteredRows(),salesTable.state.filters.group_by || 'day'), totals=GT.reports.salesTotals(salesTable.filteredRows());
    var dates=reportPeriod(), extra='<h3>Best customers in the date range</h3>'+GT.print.reportTable([{label:'Customer'},{label:'Invoiced',numeric:true}],GT.reports.bestCustomers(dates[0],dates[1]).map(function (row) { return [row.name,money(row.value)]; }))+
      '<h3>Best-selling items in the date range</h3><p>Line values before document discount and VAT.</p>'+GT.print.reportTable([{label:'Item'},{label:'Category'},{label:'Quantity',numeric:true},{label:'Value',numeric:true}],GT.reports.bestItems(dates[0],dates[1]).map(function (row) { return [row.name,row.category,row.quantity+' '+row.unit,money(row.value)]; }))+
      '<h3>Sales by employee in the date range</h3>'+GT.print.reportTable([{label:'Invoice issuer'},{label:'Invoiced',numeric:true}],employeeRows().map(function (row) { return [row.name,money(row.invoiced)]; }));
    printTable('Sales Report',period(salesTable),['Period or group','Records','Invoiced','Collected'],rows.map(function (r) { return [r.label,r.count,money(r.billed),money(r.collected)]; }),
      'Invoiced '+money(totals.billed)+' | Collected '+money(totals.collected),extra); }
  var sales={render:salesRender,bind:function () { salesTable.mount('#salesSourceMount'); groupTable.mount('#salesGroupMount'); customerTable.mount('#bestCustomersMount'); itemTable.mount('#bestItemsMount'); employeeTable.mount('#salesByEmployeeMount'); updateSalesSummary(); bindPrint(salesPrint); }};
  GT.router.register('#/reports/sales',{module:sales,view:'list',title:'Sales Report',permission:'financial_statements'});
  GT.router.register('#/sales/reports',{module:sales,view:'list',title:'Sales Report',permission:'financial_statements',baseRoute:'#/reports/sales'});

  var stockTable;
  function stockRows() { return GT.reports.stock().map(function (row) { return Object.assign({},row,{activity:GT.reports.stockActivity(row,stockTable.state.filters.date_from,stockTable.state.filters.date_to),activity_date:''}); }); }
  function stockRender() {
    stockTable=GT.dataTable.create({id:'stockReportTable',caption:'Stock quantities',rows:stockRows,searchFields:['name','colour','size','location'],filters:dateFilters(null).concat([
      {name:'type',label:'Stock type',field:'item_type',options:[{value:'material',label:'Fabric and accessories'},{value:'product_variant',label:'Finished goods'}]},
      {name:'status',label:'Stock status',field:'status',options:[{value:'Low',label:'Low'},{value:'Out',label:'Out'},{value:'OK',label:'OK'}]},
      {name:'location',label:'Location',field:'location_id',options:GT.store.all('locations').map(function (r) { return {value:r.id,label:r.name}; })}
    ]),columns:[{label:'Item',field:'name',sortable:true,minWidth:160},{label:'Type',field:'item_type',formatter:function (v) { return v==='material'?'Material':'Finished goods'; },priority:2},
      {label:'Size',field:'size',priority:2},{label:'Colour',field:'colour',priority:2},{label:'Location',field:'location',priority:2},
      {label:'On hand',field:'quantity',align:'right',numeric:true,formatter:function (v,row) { return v+' '+row.unit; }},
      {label:'Movement in range',field:'activity',align:'right',numeric:true,formatter:function (v,row) { return v+' '+row.unit; }},{label:'Status',field:'status'}],
      onRowClick:sourceRoute,emptyState:{message:'No stock items match these filters.'},exportName:'stock-quantities.csv',onStateChange:updateStockSummary});
    return '<section>'+title('Stock Report','Current quantities by location; movement is filtered by date. Material alert status follows total stock across locations.')+'<div id="stockReportStats"></div><div id="stockReportMount"></div></section>';
  }
  function updateStockSummary() { var mount=document.getElementById('stockReportStats'); if (!mount || !stockTable) return; var rows=stockTable.filteredRows(); mount.innerHTML=GT.statCards.render([
    {label:'Stock lines',value:rows.length,icon:'boxes',tone:'brand'}, {label:'Low stock lines',value:rows.filter(function (r) { return r.status==='Low'; }).length,icon:'triangle-alert',tone:'warning'},
    {label:'Out of stock lines',value:rows.filter(function (r) { return r.status==='Out'; }).length,icon:'package-x',tone:'danger'}]); GT.components.refreshIcons(); }
  function stockPrint() { printTable('Stock Report',period(stockTable),['Item','Size','Colour','Location','On hand','Movement','Status'],stockTable.filteredRows().map(function (r) { return [r.name,r.size,r.colour,r.location,r.quantity+' '+r.unit,r.activity+' '+r.unit,r.status]; })); }
  var stock={render:stockRender,bind:function () { stockTable.mount('#stockReportMount'); bindPrint(stockPrint); }};
  GT.router.register('#/reports/stock',{module:stock,view:'list',title:'Stock Report',permission:'materials_stock'});

  var debtTable;
  function debtRows() { return GT.reports.debtorRows(debtTable.state.filters.date_from,debtTable.state.filters.date_to).map(function (r) { return Object.assign({},r,{invoice_date:''}); }); }
  function debtRender() {
    debtTable=GT.dataTable.create({id:'debtReportTable',caption:'Debtors by invoice date',rows:debtRows,searchFields:['name'],filters:dateFilters(null),columns:[
      {label:'Customer',field:'name',sortable:true,minWidth:160},{label:'Invoices',field:'invoice_count',align:'right',numeric:true},
      {label:'0â€“30 days',field:'b0_30',align:'right',numeric:true,formatter:money}, {label:'31â€“60 days',field:'b31_60',align:'right',numeric:true,formatter:money},
      {label:'61+ days',field:'b61_plus',align:'right',numeric:true,formatter:money},{label:'Balance',field:'balance',align:'right',numeric:true,formatter:money}
    ],onRowClick:sourceRoute,emptyState:{message:'No open debtor invoices match this date range.'},exportName:'debtors-report.csv',onStateChange:updateDebtSummary});
    return '<section>'+title('Debtors Report','The date range selects invoice issue dates; balance as at today.')+'<div id="debtReportStats"></div><div id="debtReportMount"></div><p><a href="#/ageing">Open the full Ageing Report</a></p></section>';
  }
  function updateDebtSummary() { var mount=document.getElementById('debtReportStats'); if (!mount || !debtTable) return; var rows=debtTable.filteredRows(); mount.innerHTML=GT.statCards.render([
    {label:'Debtors',value:rows.length,icon:'users',tone:'brand'}, {label:'Balance due',value:money(rows.reduce(function (n,r) { return n+r.balance; },0)),icon:'wallet',tone:'warning'}]); GT.components.refreshIcons(); }
  function debtPrint() { printTable('Debtors Report','Invoice issue dates: '+period(debtTable)+'; balance as at today',['Customer','0â€“30','31â€“60','61+','Balance'],debtTable.filteredRows().map(function (r) { return [r.name,money(r.b0_30),money(r.b31_60),money(r.b61_plus),money(r.balance)]; })); }
  var debt={render:debtRender,bind:function () { debtTable.mount('#debtReportMount'); bindPrint(debtPrint); }};
  GT.router.register('#/reports/debtors',{module:debt,view:'list',title:'Debtors Report',permission:'financial_statements'});
  return {sales:sales,stock:stock,debtors:debt};
}());

