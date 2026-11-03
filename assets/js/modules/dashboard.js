/* Landing page. Each role receives only figures permitted by the matrix. */
window.GT.dashboardModule = (function () {
  var GT=window.GT, cards=[], approvalTable;
  function esc(value) { return GT.components.escapeHtml(value); }
  function card(label,value,icon,tone,route,helper) { return {label:label,value:value,icon:icon,tone:tone,helper:helper,
    onClick:function () { location.hash=route; }}; }
  function financeCards() { var today=GT.dates.today(), month=GT.dashboard.monthMoney();
    return [card("Today's takings",GT.format.formatMoney(GT.dashboard.takings()),'wallet','brand','#/sales/receipts'),
      card('Money in this month',GT.format.formatMoney(month.in),'arrow-down-left','success','#/finance/cash-book'),
      card('Money out this month',GT.format.formatMoney(month.out),'arrow-up-right','warning','#/finance/cash-book'),
      card('Outstanding debtors',GT.format.formatMoney(GT.dashboard.debtorsTotal()),'users','info','#/debtors'),
      card('Awaiting payment',GT.dashboard.awaitingPayment(),'clock-3','warning','#/orders'),
      card('Low stock materials',GT.inventory.lowStockItems().length,'triangle-alert','danger','#/inventory/alerts'),
      card('Pending Owner approvals',GT.dashboard.pendingApprovals(),'shield-check','warning','#/dashboard/approvals'),targetCard(false)]; }
  function targetCard(own) { var totals=GT.salesTargets.summary(GT.dates.today().slice(0,7));
    return card(own?'My target progress':'Team target progress',totals.target?totals.percent+'%':'Not started','target','info','#/marketing/targets',
      totals.target?GT.format.formatMoney(totals.actual)+' of '+GT.format.formatMoney(totals.target):'No target set'); }
  function stageBars() { var rows=GT.dashboard.stageCounts(), max=Math.max(1,...rows.map(function (row) { return row.count; }));
    return '<section class="detail-card dashboard-section"><h2>Orders by stage</h2><div class="dashboard-bars">'+rows.map(function (row) {
      return '<a href="#/production-board"><span>'+esc(row.name)+'</span><span class="dashboard-bar-track"><span style="width:'+Math.round(row.count/max*100)+'%"></span></span><strong>'+row.count+'</strong></a>';
    }).join('')+'</div></section>'; }
  function linkedList(title,items,empty) { return '<section class="detail-card dashboard-section"><h2>'+esc(title)+'</h2>'+
    (items.length?GT.components.linkedList(items):
      '<p class="empty-state">'+esc(empty)+'</p>')+'</section>'; }
  function recentActivity() { return linkedList('Recent activity',GT.dashboard.recentActivity().map(function (row) {
    return {route:row.route,label:row.label,meta:row.actor+' · '+GT.dates.formatDate(row.date),
      amount:row.amount===null?null:GT.format.formatMoney(row.amount)};
  }),'No recent activity.'); }
  function workshop() { cards=[card('Orders awaiting payment',GT.dashboard.awaitingPayment(),'clock-3','warning','#/orders'),
    card('Ready for delivery',GT.orders.list({status:'active'}).filter(function (row) { return GT.orders.summary(row.id).currentStage==='Ready for delivery'; }).length,'truck','success','#/production-board')];
    var due=GT.dashboard.dueOrders().slice(0,6).map(function (row) { return {route:'#/orders/'+row.id,
      label:(row.priority==='urgent'?'Rush · ':'')+(row.number||row.id)+' · due '+GT.dates.formatDate(row.due_date)}; });
    return stageBars()+linkedList('Rush and due soon',due,'No orders due within seven days.'); }
  function store() { var grns=GT.store.all('goods_received_notes').filter(function (row) { return row.status!=='void'; }).slice(-5).reverse();
    cards=[card('Low stock materials',GT.inventory.lowStockItems().length,'triangle-alert','danger','#/inventory/alerts'),
      card('Pending material issues',GT.materialIssues.pendingCount(),'package-check','warning','#/material-issues'),
      card('Finished goods low or out',GT.finishedGoods.rows().filter(function (row) { return row.stock_status==='Low'||row.stock_status==='Out'; }).length,'boxes','warning','#/inventory/finished-goods')];
    return linkedList('Recent goods received',grns.map(function (row) { return {route:'#/inventory/grns/'+row.id,label:'GRN '+row.number+' · '+GT.dates.formatDate(String(row.received_at||row.grn_date||row.created_at).slice(0,10))}; }),
      'No goods received yet.'); }
  function sales() { cards=[card('Quick sales today',GT.dashboard.quickCount(),'shopping-cart','brand','#/sales/quick-sales'),
    card('Orders awaiting payment',GT.dashboard.awaitingPayment(),'clock-3','warning','#/orders'),targetCard(true)];
    return linkedList('Shortcuts',[{route:'#/sales/quick-sale',label:'New quick sale'},{route:'#/sales/receipts',label:'Receipts'}],''); }
  function render() { var role=GT.session.currentUser().role, body='';
    if (['owner','general_manager','accountant'].indexOf(role)>=0) { cards=financeCards(); body=stageBars()+recentActivity(); }
    else if (role==='workshop_supervisor') body=workshop();
    else if (role==='store_keeper') body=store();
    else if (role==='sales') body=sales();
    else { cards=[]; body=linkedList('Your work',[{route:'#/marketing/campaigns',label:'Campaigns'}],''); }
    return '<section class="dashboard-page">'+GT.components.pageHeader({title:'Dashboard',description:'Your current business summary.'})+
      (cards.length?'<div id="dashboardStats">'+GT.statCards.render(cards)+'</div>':'')+body+'</section>'; }
  function approvals() { approvalTable=GT.dataTable.create({id:'dashboardApprovals',rows:GT.dashboard.pendingApprovalRows,
    columns:[{label:'Request',field:'label'},{label:'Date',field:'requested_at',formatter:GT.dates.formatDate},
      {label:'Status',field:'status'}],onRowClick:function (row) { location.hash=row.route; },
    actions:[{label:'View',icon:'eye',primary:true,onClick:function (row) { location.hash=row.route; }}],
    emptyState:{message:'No Owner approvals are waiting in pages you can view.'},exportName:'pending-approvals.csv'});
    return '<section class="dashboard-page">'+GT.components.pageHeader({title:'Pending approvals',description:'Requests waiting for the Owner.',
      actions:[{label:'Dashboard',icon:'arrow-left',route:'#/dashboard',className:'btn-outline-secondary'}]})+
      '<div id="dashboardApprovalMount"></div></section>'; }
  var api={render:function (view) { return view==='approvals'?approvals():render(); },
    bind:function (view) { if (view==='approvals') approvalTable.mount('#dashboardApprovalMount'); else GT.statCards.bind('#dashboardStats',cards); }};
  GT.router.register('#/dashboard',{module:api,view:'home',title:'Dashboard',permission:'dashboard_role'});
  GT.router.register('#/dashboard/approvals',{module:api,view:'approvals',title:'Pending Approvals',permission:'dashboard_full',baseRoute:'#/dashboard'});
  return api;
}());
