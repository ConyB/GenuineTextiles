/* Cash-book style monthly statement: A-10, A-11, A-85 and A-88. */
window.GT.financialStatementsModule = (function () {
  var GT=window.GT, table, money=GT.format.formatMoney, safe=GT.components.escapeHtml;
  function monthOptions() {
    var months=[...new Set(GT.cashBook.entries().map(function (row) { return row.entry_date.slice(0,7); }).concat(['2027-01']))].sort().reverse();
    return months.map(function (month) { return {value:month,label:month}; });
  }
  function sourceRoute(row) {
    var type=row.reference_type.replace('_reversal','');
    if (type==='expense') return '#/finance/expenses/'+row.reference_id;
    var receipt=GT.store.find('receipts',row.reference_id);
    if (!receipt) return '#/finance/cash-book';
    if (receipt.invoice_id) return '#/sales/receipts/'+receipt.id;
    var sale=GT.store.where('quick_sales',{receipt_id:receipt.id})[0];
    return sale ? '#/sales/quick-sales/'+sale.id : '#/sales/receipts/'+receipt.id;
  }
  function rows() { return GT.cashBook.entries().map(function (row) { var account=GT.store.find('accounts',row.account_id); return Object.assign({},row,{account_name:account ? account.name : 'Unknown',route:sourceRoute(row)}); }); }
  function current() { var f=table.state.filters, month=f.month || monthOptions()[0].value; return GT.reports.financial(month,f.date_from,f.date_to); }
  function cards(statement) { return GT.statCards.render([
    {label:'Money in',value:money(statement.moneyIn),icon:'arrow-down-left',tone:'success'},
    {label:'Money out',value:money(statement.moneyOut),icon:'arrow-up-right',tone:'warning'},
    {label:'Net cash movement',value:money(statement.movement),icon:'book-open',tone:'brand'},
    {label:'Cash-book check',value:statement.reconciled?'Matched':'Mismatch',icon:statement.reconciled?'circle-check':'triangle-alert',tone:statement.reconciled?'success':'danger'}
  ]); }
  function incomeRows(statement) {
    return Object.keys(statement.expenseByCategory).sort().map(function (label) { return '<li><a href="#/finance/expenses">'+safe(label)+'</a><strong>'+money(statement.expenseByCategory[label])+'</strong></li>'; }).join('');
  }
  function summaryMarkup(statement) {
    var empty=statement.ledger.length===0;
    return cards(statement)+'<div class="report-statement-grid"><section class="detail-card"><h2>Income and expenditure</h2><p class="report-note">Cash basis: collected receipts less approved expenditure. Invoice billing is shown separately.</p><ul class="report-line-list">'+
      '<li><a href="#/sales/receipts">Collected receipts, net of reversals</a><strong>'+money(statement.receiptIncome)+'</strong></li>'+
      (incomeRows(statement) || '<li><span>Approved expenses</span><span>None in this period</span></li>')+
      '<li class="report-line-total"><a href="#/finance/cash-book">Net cash movement</a><strong>'+money(statement.movement)+'</strong></li></ul>'+ (empty?'<p>No cash-book movements in this period.</p>':'')+'</section>'+
      '<section class="detail-card"><h2>Cash position</h2><p>Opening balances as at 01/01/2027: <strong>Pending owner confirmation</strong> (A-88).</p><p><a href="#/finance/cash-book">Cash movement: '+money(statement.accountMovement.Cash)+'</a>; <a href="#/finance/cash-book">bank movement: '+money(statement.accountMovement.Bank)+'</a>.</p><p>Net movement: <strong>'+money(statement.movement)+'</strong>.</p><p>Closing cash and bank position: <strong>Pending opening balances</strong>.</p><p>Year to date from go-live: '+(statement.month>='2027-01' ? money(statement.ytdIn-statement.ytdOut)+' net movement' : 'starts 01/01/2027')+'.</p><p><a href="#/sales/invoices">Invoices billed: '+money(statement.billed)+'</a> (not added to cash receipts).</p></section></div>'+
      '<div class="detail-card"><h2>Reconciliation</h2><p id="statementCheck" class="'+(statement.reconciled?'report-check-ok':'report-check-fail')+'">'+(statement.reconciled?'PASS':'FAIL')+': statement money in '+money(statement.moneyIn)+' and money out '+money(statement.moneyOut)+'; cash-book source check '+money(statement.expectedIn)+' in and '+money(statement.expectedOut)+' out.</p><p><a href="#/finance/cash-book">Open Cash Book</a> to inspect each movement.</p></div>';
  }
  function updateSummary() { var mount=document.getElementById('statementSummary'); if (!mount || !table) return; mount.innerHTML=summaryMarkup(current()); GT.components.refreshIcons(); }
  function render() {
    table=GT.dataTable.create({id:'statementCashTable',caption:'Cash book source movements',rows:rows,searchFields:['narration','account_name'],filters:[
      {name:'date_from',label:'From date',type:'date',test:function (row,v) { return row.entry_date>=v; }},
      {name:'date_to',label:'To date',type:'date',test:function (row,v) { return row.entry_date<=v; }},
      {name:'month',label:'Month',options:monthOptions(),test:function (row,v) { return row.entry_date.slice(0,7)===v; }}
    ],columns:[{label:'Date',field:'entry_date',formatter:GT.dates.formatDate,sortable:true},{label:'Account',field:'account_name'},
      {label:'Source',field:'narration',minWidth:160},{label:'Money in',field:'debit',align:'right',numeric:true,formatter:money},
      {label:'Money out',field:'credit',align:'right',numeric:true,formatter:money}],onRowClick:function (row) { location.hash=row.route; },
      emptyState:{message:'No cash-book movements in this month and date range.'},exportName:'monthly-statement-sources.csv',onStateChange:updateSummary});
    table.state.filters.month=(GT.cashBook.entries()[0] || {entry_date:'2027-01-01'}).entry_date.slice(0,7);
    return '<section>'+GT.components.pageHeader({title:'Monthly Financial Statements',description:'Cash-book style monthly income, expenditure and cash position.',actions:[{label:'Print',name:'print',icon:'printer'}]})+
      '<div id="statementSummary"></div><div class="detail-card"><h2>Source movements</h2><div id="statementCashMount"></div></div></section>';
  }
  function printStatement() {
    var statement=current(), ledger=statement.ledger, from=table.state.filters.date_from, to=table.state.filters.date_to;
    var period=statement.month+(from || to ? ' | '+GT.dates.formatRange(from || '',to || '') : '');
    var html=GT.print.letterhead()+'<h2>MONTHLY FINANCIAL STATEMENT</h2><p>'+safe(period)+'</p><table class="report-print-table"><tbody>'+[
      ['Collected receipts, net',money(statement.receiptIncome)],['Approved expenditure, net',money(statement.expenseSpending)],
      ['Cash-book money in',money(statement.moneyIn)],['Cash-book money out',money(statement.moneyOut)],['Net cash movement',money(statement.movement)],
      ['Opening cash and bank','Pending confirmation (A-88)'],['Closing cash and bank','Pending opening balances'],
      ['Invoices billed (memo)',money(statement.billed)],['Cash-book reconciliation',statement.reconciled?'PASS':'FAIL']
    ].map(function (line) { return '<tr><th>'+safe(line[0])+'</th><td>'+safe(line[1])+'</td></tr>'; }).join('')+'</tbody></table><h3>Cash-book sources</h3><table class="report-print-table"><thead><tr><th>Date</th><th>Source</th><th>In</th><th>Out</th></tr></thead><tbody>'+ledger.map(function (row) { return '<tr><td>'+safe(GT.dates.formatDate(row.entry_date))+'</td><td>'+safe(row.narration)+'</td><td>'+safe(money(row.debit))+'</td><td>'+safe(money(row.credit))+'</td></tr>'; }).join('')+'</tbody></table>';
    GT.print.open(html,'Monthly Financial Statement');
  }
  var api={render:render,bind:function () { table.mount('#statementCashMount'); document.querySelector('[data-page-action="print"]').addEventListener('click',printStatement); }};
  GT.router.register('#/finance/statements',{module:api,view:'list',title:'Financial Statements',permission:'financial_statements'});
  return api;
}());
