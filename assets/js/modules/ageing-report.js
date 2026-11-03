/* Receipt-derived ageing report: BUSINESS_RULES.md section 4 and PAGE_PATTERNS.md. */
window.GT = window.GT || {};
window.GT.ageingModule = (function () {
  var GT=window.GT,table;
  function money(value) { return GT.format.formatMoney(value); }
  function show(value) { return value?money(value):'—'; }
  function rows() { return GT.debtors.list().map(function (row) { var group=GT.store.find('customer_groups',row.group_id); return Object.assign({},row,{group_name:group?group.name:'Unassigned'}); }); }
  function strip() {
    var totals=GT.debtors.ageingTotals(), definitions=[['b0_30','0–30 days','success'],['b31_60','31–60 days','warning'],['b61_plus','61+ days','danger']];
    var cards=definitions.map(function (entry) { var value=totals[entry[0]],pct=totals.total?Math.round(value*100/totals.total):0; return {label:entry[1],value:money(value),helper:totals.customers[entry[0]]+' customers · '+pct+'%',icon:'clock-3',tone:entry[2]}; });
    var bar='<div class="ageing-bar" role="img" aria-label="Ageing proportions">'+definitions.map(function (entry) { var pct=totals.total?totals[entry[0]]*100/totals.total:0; return '<span class="ageing-bar-'+entry[0]+'" style="width:'+pct+'%" title="'+entry[1]+' '+Math.round(pct)+'%"></span>'; }).join('')+'</div>';
    return GT.statCards.render(cards)+bar;
  }
  function printReport() {
    var result=table.filteredRows(),totals={b0_30:0,b31_60:0,b61_plus:0,total:0};
    var body=result.map(function (row) { ['b0_30','b31_60','b61_plus','total'].forEach(function (key) { totals[key]+=key==='total'?row.balance:row[key]; }); return '<tr><td>'+GT.components.escapeHtml(row.name)+'</td><td>'+show(row.b0_30)+'</td><td>'+show(row.b31_60)+'</td><td>'+show(row.b61_plus)+'</td><td>'+show(row.balance)+'</td><td>'+row.oldest_age+' days</td></tr>'; }).join('');
    GT.print.open(GT.print.letterhead()+'<h2>AGEING REPORT</h2><p>As at '+GT.dates.formatDate(GT.dates.today())+'</p><table class="ageing-print-table"><thead><tr><th>Customer</th><th>0–30</th><th>31–60</th><th>61+</th><th>Total</th><th>Oldest age</th></tr></thead><tbody>'+body+'</tbody><tfoot><tr><th>Total</th><th>'+show(totals.b0_30)+'</th><th>'+show(totals.b31_60)+'</th><th>'+show(totals.b61_plus)+'</th><th>'+show(totals.total)+'</th><th></th></tr></tfoot></table>','AGEING REPORT',{orientation:'landscape'});
  }
  function render() {
    table=GT.dataTable.create({id:'ageingTable',rows:rows,searchFields:['name'],
      filters:[{name:'group',label:'Group',field:'group_id',options:GT.store.all('customer_groups').map(function (row) { return {value:row.id,label:row.name}; })},
        {name:'minimum',label:'Minimum amount',options:[{value:'1000000',label:'UGX 1,000,000+'},{value:'5000000',label:'UGX 5,000,000+'},{value:'10000000',label:'UGX 10,000,000+'}],test:function (row,value) { return row.balance>=Number(value); }}],
      columns:[{label:'Customer',field:'name',sortable:true,minWidth:160,priority:1},
        {label:'0–30',field:'b0_30',align:'right',numeric:true,sortable:true,formatter:show,priority:1},
        {label:'31–60',field:'b31_60',align:'right',numeric:true,sortable:true,formatter:show,priority:1},
        {label:'61+',field:'b61_plus',align:'right',numeric:true,sortable:true,formatter:show,priority:1},
        {label:'Total',field:'balance',align:'right',numeric:true,sortable:true,formatter:show,priority:1,exportValue:function (row) { return row.balance; }},
        {label:'Oldest age',field:'oldest_age',formatter:function (value) { return value+' days'; },priority:2}],
      footer:function (filtered) { var sums={b0_30:0,b31_60:0,b61_plus:0,balance:0}; filtered.forEach(function (row) { Object.keys(sums).forEach(function (key) { sums[key]+=row[key]; }); }); return '<tr><th scope="row">Total</th><td class="table-align-right">'+show(sums.b0_30)+'</td><td class="table-align-right">'+show(sums.b31_60)+'</td><td class="table-align-right">'+show(sums.b61_plus)+'</td><td class="table-align-right">'+show(sums.balance)+'</td><td></td></tr>'; },
      onRowClick:function (row) { location.hash='#/debtors/'+row.id; },emptyState:{message:'No debtors match the filters.'},exportName:'ageing-report.csv'});
    table.state.pageSize=25;
    return '<section class="debtors-page">'+GT.components.pageHeader({title:'Ageing Report',description:'Balances by invoice age as at '+GT.dates.formatDate(GT.dates.today())+'.',actions:[{label:'Print',name:'print',icon:'printer'}]})+'<div id="ageingSummary">'+strip()+'</div><div id="ageingMount"></div></section>';
  }
  function bind() { table.mount('#ageingMount'); document.querySelector('[data-page-action="print"]').addEventListener('click',printReport); }
  var api={render:render,bind:bind,print:printReport};
  GT.router.register('#/ageing',{module:api,view:'list',title:'Ageing Report',permission:'debtors',baseRoute:'#/ageing'});
  return api;
}());
