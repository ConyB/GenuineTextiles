/* Read-only dispatch register: BUSINESS_RULES.md section 9 (A-49, A-52). */
window.GT = window.GT || {};
window.GT.dispatchLogModule = (function () {
  var GT=window.GT, table;
  var methods={delivered_by_us:'Delivered by us',collected_by_customer:'Collected by customer',courier:'Courier'};
  function esc(value) { return GT.components.escapeHtml(value); }
  function rows() {
    return GT.deliveries.list().filter(function (row) { return row.status==='issued'||row.status==='delivered'; }).map(function (row) {
      var client=GT.store.find('customers',row.customer_id), doc=GT.store.find('sales_documents',row.invoice_id), carrier=GT.store.find('users',row.dispatched_by);
      return Object.assign({},row,{customer_name:client?client.name:'Unknown',invoice_number:doc?doc.number:'',
        method_label:methods[row.delivery_method]||'—',dispatched_name:carrier?carrier.name:'—',
        items_count:GT.deliveries.noteLines(row.id).filter(function (item) { return Number(item.qty_dispatched)>0; }).length,
        unconfirmed_over_3:row.status==='issued' && GT.dates.daysBetween(row.delivery_date,GT.dates.today())>3});
    }).sort(function (a,b) { return b.delivery_date.localeCompare(a.delivery_date)||b.id-a.id; });
  }
  function printLog() {
    var selected=table.filteredRows(), body=selected.map(function (row) { return '<tr><td>'+esc(row.number)+'</td><td>'+esc(GT.dates.formatDate(row.delivery_date))+'</td><td>'+esc(row.customer_name)+'</td><td>'+esc(row.invoice_number)+'</td><td>'+esc(row.method_label)+'</td><td>'+esc(row.items_count)+'</td><td>'+esc(row.status)+'</td><td>'+esc(row.dispatched_name)+'</td></tr>'; }).join('');
    GT.print.open(GT.print.letterhead()+'<h2>DISPATCH LOG</h2><p>Printed '+esc(GT.dates.formatDate(GT.dates.today()))+' · '+selected.length+' notes</p>'+
      '<table class="delivery-print-table dispatch-print-table"><thead><tr><th>Note</th><th>Date</th><th>Customer</th><th>Invoice</th><th>Method</th><th>Items</th><th>Status</th><th>Dispatched by</th></tr></thead><tbody>'+body+'</tbody></table>','Dispatch Log',{orientation:'landscape'});
  }
  function render() {
    table=GT.dataTable.create({id:'dispatchLogTable',caption:'Dispatch log',rows:rows,searchFields:['number','customer_name','invoice_number'],
      searchPlaceholder:'Search note, customer or invoice',filters:[
        {name:'method',label:'Method',field:'delivery_method',options:Object.keys(methods).map(function (key) { return {value:key,label:methods[key]}; })},
        {name:'status',label:'Status',field:'status',options:[{value:'issued',label:'Issued'},{value:'delivered',label:'Delivered'}]},
        {name:'age',label:'Confirmation',options:[{value:'late',label:'Not confirmed for more than 3 days'}],test:function (row) { return row.unconfirmed_over_3; }},
        {name:'date_from',label:'From date',type:'date',test:function (row,value) { return row.delivery_date>=value; }},
        {name:'date_to',label:'To date',type:'date',test:function (row,value) { return row.delivery_date<=value; }}],
      columns:[{label:'Note',field:'number',priority:1,sortable:true},
        {label:'Date',field:'delivery_date',priority:1,sortable:true,formatter:GT.dates.formatDate},
        {label:'Customer',field:'customer_name',priority:1,minWidth:160},
        {label:'Invoice',field:'invoice_number',priority:2},
        {label:'Method',field:'method_label',priority:2},
        {label:'Items',field:'items_count',priority:2,align:'right',numeric:true},
        {label:'Status',field:'status',priority:1,html:true,formatter:function (value) { return GT.components.statusBadge(value==='delivered'?'Delivered':'Issued',value==='delivered'?'success':'info'); },exportValue:function (row) { return row.status; }},
        {label:'Dispatched by',field:'dispatched_name',priority:3}],
      onRowClick:function (row) { location.hash='#/delivery-notes/'+row.id; },
      emptyState:{message:'No dispatches match the current filters.'},exportName:'dispatch-log.csv'});
    table.state.pageSize=25;
    return '<section class="delivery-page">'+GT.components.pageHeader({title:'Dispatch Log',description:'Issued and confirmed notes by dispatch date.',actions:[{label:'Print log',icon:'printer',name:'print',className:'btn-outline-primary'}]})+
      '<div id="dispatchLogMount"></div></section>';
  }
  function bind() { table.mount('#dispatchLogMount'); document.querySelector('[data-page-action="print"]').addEventListener('click',printLog); }
  var api={render:render,bind:bind,print:printLog};
  GT.router.register('#/dispatch-log',{module:api,view:'list',title:'Dispatch Log',permission:'delivery_notes',baseRoute:'#/dispatch-log'});
  return api;
}());
