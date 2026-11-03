/* Role-safe dashboard figures from existing services, not page markup. */
window.GT.dashboard = (function () {
  var GT = window.GT;
  function today() { return GT.dates.today(); }
  function takings() { return GT.receipts.collectedOn(today()); }
  function monthMoney() { return GT.cashBook.monthly(today()); }
  function debtorsTotal() { return GT.debtors.list().reduce(function (sum, row) { return sum + Number(row.balance); }, 0); }
  function stageCounts() { return GT.orders.stages().map(function (stage) { return {
    name:stage.name, count:GT.orders.list({status:'active'}).filter(function (row) { return GT.orders.summary(row.id).currentStage === stage.name; }).length
  }; }); }
  function awaitingPayment() { return GT.orders.list({status:'active'}).filter(function (row) {
    return !GT.orders.summary(row.id).depositMet && !GT.orders.approvalFor(row.id,'approved');
  }).length; }
  function pendingApprovalRows() { return GT.store.where('approvals',function (row) {
    return ['requested','pending'].indexOf(row.status) !== -1 && ['expense','void','stock_adjustment'].indexOf(row.type) !== -1;
  }).map(function (row) {
    var route, label, permission;
    if (row.type === 'expense') { route='#/finance/expenses/'+row.entity_id; label='Expense request '+row.entity_id; permission='expenses'; }
    else if (row.type === 'void' && row.entity_type === 'quick_sales') { route='#/sales/quick-sales/'+row.entity_id; label='Quick sale void '+row.entity_id; permission='quick_sale'; }
    else if (row.entity_type === 'finished_good_adjustments') { var adjustment=GT.store.find('finished_good_adjustments',row.entity_id);
      route=adjustment?'#/inventory/finished-goods/'+adjustment.product_variant_id:''; label='Finished goods adjustment '+row.entity_id; permission='materials_stock'; }
    else if (row.entity_type === 'stock_adjustments') { route='#/inventory/adjustments/'+row.entity_id; label='Stock adjustment '+row.entity_id; permission='stock_adjustment'; }
    return route && GT.permissions.can(permission,'V') ? {id:row.id,label:label,route:route,status:'Pending',requested_at:String(row.created_at||'').slice(0,10)} : null;
  }).filter(Boolean); }
  function pendingApprovals() { return pendingApprovalRows().length; }
  function dueOrders() { return GT.orders.list({status:'active'}).filter(function (row) {
    return GT.orders.summary(row.id).daysToDue <= 7;
  }).sort(function (a,b) { return (a.priority === 'urgent' ? -1 : 0) - (b.priority === 'urgent' ? -1 : 0) || a.due_date.localeCompare(b.due_date); }); }
  function quickCount() { var user = GT.session.currentUser(); return GT.quickSales.list().filter(function (row) {
    return row.status === 'issued' && row.sale_date === today() && (!user || user.role !== 'sales' || Number(row.cashier_id) === Number(user.id));
  }).length; }
  function userName(id) { var user=GT.store.find('users',id); return user ? user.name : 'System'; }
  function activity(type,stamp,route,label,actor,amount) {
    return {type:type,stamp:stamp,date:String(stamp).slice(0,10),route:route,label:label,actor:userName(actor),amount:amount};
  }
  function recentActivity() {
    // A-87: source records cover events seeded before the audit log. Keep one of each available event kind visible.
    var showMoney=['owner','general_manager','accountant'].indexOf(GT.session.currentUser().role)>=0;
    var groups=[];
    if (GT.permissions.can('receipts','V')) groups.push(GT.store.where('receipts',function (row) { return row.status==='issued' && row.invoice_id; }).map(function (row) {
      return activity('receipt',row.received_at,'#/sales/receipts/'+row.id,'Receipt '+row.number+' from '+row.customer_name,row.received_by,showMoney?Number(row.amount):null);
    }));
    if (GT.permissions.can('quick_sale','V')) groups.push(GT.quickSales.list().filter(function (row) { return row.status==='issued'; }).map(function (row) {
      return activity('quick_sale',row.sale_date,'#/sales/quick-sales/'+row.id,'Quick sale '+row.id+' completed',row.cashier_id,showMoney?Number(row.total):null);
    }));
    if (GT.permissions.can('orders','V')) { var visible=GT.orders.list().map(function (row) { return Number(row.id); });
      groups.push(GT.store.where('order_stage_history',function (row) { return visible.indexOf(Number(row.order_id))!==-1; }).map(function (row) {
        var order=GT.store.find('orders',row.order_id);
        return activity('order',row.changed_at,'#/orders/'+row.order_id,'Order '+(order.number||row.order_id)+' moved to '+row.stage,row.changed_by,null);
      })); }
    if (GT.permissions.can('expenses','V')) groups.push(GT.expenses.list().filter(function (row) { return row.status==='approved'; }).map(function (row) {
      return activity('expense',row.approved_at||row.expense_date,'#/finance/expenses/'+row.id,
        'Expense voucher '+row.voucher_number+' approved',row.approved_by,showMoney?Number(row.amount):null);
    }));
    if (GT.permissions.can('dashboard_full','V')) groups.push(pendingApprovalRows().map(function (row) {
      var request=GT.store.find('approvals',row.id);
      return activity('approval',request.created_at,row.route,'Approval requested: '+row.label,request.requested_by,null);
    }));
    groups.forEach(function (group) { group.sort(function (a,b) { return b.stamp.localeCompare(a.stamp); }); });
    var chosen=groups.filter(function (group) { return group.length; }).map(function (group) { return group[0]; });
    var rest=groups.reduce(function (all,group) { return all.concat(group.slice(1)); },[]);
    return chosen.concat(rest.sort(function (a,b) { return b.stamp.localeCompare(a.stamp); })).slice(0,8).sort(function (a,b) { return b.stamp.localeCompare(a.stamp); });
  }
  return {takings:takings,monthMoney:monthMoney,debtorsTotal:debtorsTotal,stageCounts:stageCounts,
    awaitingPayment:awaitingPayment,pendingApprovals:pendingApprovals,pendingApprovalRows:pendingApprovalRows,
    dueOrders:dueOrders,quickCount:quickCount,recentActivity:recentActivity};
}());
