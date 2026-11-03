/* Read-only production board, BUSINESS_RULES.md section 8 (A-57). */
window.GT = window.GT || {};
window.GT.productionBoardModule = (function () {
  var GT = window.GT;
  function esc(value) { return GT.components.escapeHtml(value); }
  function card(order) { var info = GT.orders.summary(order.id), customer = GT.store.find('customers', order.customer_id);
    return '<a class="production-order-card" href="#/orders/' + order.id + '"><strong>' + esc(order.number || 'Draft') + '</strong><span>' + esc(customer ? customer.name : 'Unknown customer') + '</span><span>Due ' + esc(GT.dates.formatDate(order.due_date)) + '</span>' +
      (info.isLate ? GT.components.statusBadge('Late','danger') : '') +
      (order.priority === 'urgent' ? GT.components.statusBadge('Urgent','danger') : '') + '</a>'; }
  function board() { var priority = document.getElementById('boardPriority'), late = document.getElementById('boardLate');
    var items = GT.orders.list({priority:priority ? priority.value : '',late_only:late ? late.checked : false}).filter(function (order) {
      return ['active','completed'].indexOf(GT.orders.summary(order.id).status) !== -1;
    });
    return '<div class="production-board">' + GT.orders.stages().map(function (stage) {
      var grouped = items.filter(function (order) { return GT.orders.summary(order.id).currentStage === stage.name; });
      return '<section class="production-stage-column"><h2>' + esc(stage.name) + ' <span>' + grouped.length + '</span></h2>' +
        (grouped.length ? grouped.map(card).join('') : '<p class="production-empty">No orders at this stage.</p>') + '</section>';
    }).join('') + '</div>'; }
  function render() { return '<section class="orders-page production-page">' + GT.components.pageHeader({title:'Production Board',description:'Current position of confirmed orders.'}) +
    '<div class="production-filters"><label for="boardPriority">Priority</label><select id="boardPriority" class="form-select"><option value="">All priorities</option><option value="urgent">Urgent</option><option value="normal">Normal</option></select><label class="production-late-filter"><input type="checkbox" id="boardLate"> Late only</label></div><div id="productionBoardMount"></div></section>'; }
  function bind() { var mount = document.getElementById('productionBoardMount');
    function refresh() { mount.innerHTML = board(); GT.components.refreshIcons(); }
    document.getElementById('boardPriority').addEventListener('change', refresh);
    document.getElementById('boardLate').addEventListener('change', refresh); refresh(); }
  var api = {render:render,bind:bind};
  GT.router.register('#/production-board',{module:api,view:'board',title:'Production Board',permission:'orders',baseRoute:'#/production-board'});
  return api;
}());
