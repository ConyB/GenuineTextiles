/* Read-only cash-book register and monthly money figures. */
window.GT.cashBookModule = (function () {
  var GT = window.GT, table;
  function rows() { return GT.cashBook.entries().map(function (row) { var account=GT.store.find('accounts',row.account_id);
    return Object.assign({},row,{account_name:account?account.name:'Unknown',in_amount:Number(row.debit||0),out_amount:Number(row.credit||0)}); }); }
  function render() { var month=GT.cashBook.monthly(GT.dates.today());
    table=GT.dataTable.create({id:'cashBookTable',rows:rows,caption:'Cash book',searchFields:['narration','reference_type','account_name'],
      filters:[{name:'date_from',label:'From date',type:'date',test:function (row,value) { return row.entry_date>=value; }},
        {name:'date_to',label:'To date',type:'date',test:function (row,value) { return row.entry_date<=value; }},
        {name:'account',label:'Account',field:'account_name',options:[{value:'Cash',label:'Cash'},{value:'Bank',label:'Bank'}]}],
      columns:[{label:'Date',field:'entry_date',sortable:true,formatter:GT.dates.formatDate,exportValue:function (row) { return row.entry_date; }},
        {label:'Account',field:'account_name'},{label:'Narration',field:'narration'},
        {label:'Money in',field:'in_amount',align:'right',numeric:true,formatter:GT.format.formatMoney},
        {label:'Money out',field:'out_amount',align:'right',numeric:true,formatter:GT.format.formatMoney}],
      onRowClick:function (row) { var type=row.reference_type.replace('_reversal','');
        if (type==='expense') location.hash='#/finance/expenses/'+row.reference_id;
        else if (type==='receipt') { var receipt=GT.store.find('receipts',row.reference_id);
          if (receipt && !receipt.invoice_id) { var sale=GT.store.where('quick_sales',{receipt_id:receipt.id})[0];
            if (sale) location.hash='#/sales/quick-sales/'+sale.id;
          } else location.hash='#/sales/receipts/'+row.reference_id;
        } },
      emptyState:{message:'No cash-book movements match these filters.'},exportName:'cash-book.csv'});
    return '<section>'+GT.components.pageHeader({title:'Cash Book',description:'Receipts and Owner-approved expenditure movements.'})+
      '<div id="cashBookStats">'+GT.statCards.render([{label:'Money in this month',value:GT.format.formatMoney(month.in),icon:'arrow-down-left',tone:'success'},
        {label:'Money out this month',value:GT.format.formatMoney(month.out),icon:'arrow-up-right',tone:'warning'}])+'</div><div id="cashBookMount"></div></section>'; }
  var api={render:render,bind:function () { table.mount('#cashBookMount'); }};
  GT.router.register('#/finance/cash-book',{module:api,view:'list',title:'Cash Book',permission:'expenses'});
  return api;
}());
