/* Monthly target screens use the invoice target service for all calculations. */
window.GT.salesTargetModule = (function () {
  var GT = window.GT, safe = GT.components.escapeHtml, money = GT.format.formatMoney;
  var month = GT.dates.today().slice(0,7), table, historyTable, sections;
  function own() { return GT.session.currentUser().role === 'sales'; }
  function targetText(row) { return row.has_target ? money(row.target) : 'Not set'; }
  function differenceText(row) {
    if (!row.has_target) return 'No target set';
    return row.difference < 0 ? 'Shortfall ' + money(-row.difference) : 'Surplus ' + money(row.difference);
  }
  function statusText(row) { return row.status + (row.has_target ? ' · ' + row.percent + '%' : ' · No target set'); }
  function progress(row) { return GT.components.progressBar(row.percent,statusText(row)); }
  function checkText(rows) { return GT.salesTargets.reconcile(month,rows) ? 'PASS — actual sales match the Sales Report.' : 'FAIL — actual sales differ from the Sales Report. Review the source invoices.'; }
  function renderSummary() {
    var rows = GT.salesTargets.rows(month), summary = GT.salesTargets.summary(month,rows);
    var cards = own() && rows.length ? [
      {label:'My target',value:targetText(rows[0]),icon:'target',tone:'brand'},
      {label:'My actual sales',value:money(rows[0].actual),icon:'file-text',tone:'info'}
    ] : [
      {label:'Team target',value:summary.assigned ? money(summary.target) : 'Not set',icon:'target',tone:'brand'},
      {label:'Team actual sales',value:money(summary.actual),icon:'file-text',tone:'info'},
      {label:'Targets assigned',value:summary.assigned + ' of ' + summary.people,icon:'users',tone:'neutral'}
    ];
    document.getElementById('targetSummary').innerHTML = GT.statCards.render(cards) + (own() && rows.length ? '<div class="detail-card">' + progress(rows[0]) + '</div>' : '');
    var check = document.getElementById('targetReconciliation');
    check.textContent = checkText(rows);
    check.className = GT.salesTargets.reconcile(month,rows) ? 'report-check-ok' : 'report-check-fail';
    GT.components.refreshIcons();
  }
  function render() {
    table = GT.dataTable.create({id:'salesTargetsTable',rows:function () { return GT.salesTargets.rows(month); },searchFields:['name'],columns:[
      {label:'Salesperson',field:'name'}, {label:'Target',field:'target',numeric:true,align:'right',formatter:function (value,row) { return targetText(row); },exportValue:targetText},
      {label:'Actual',field:'actual',numeric:true,align:'right',formatter:money},
      {label:'Shortfall / surplus',field:'difference',numeric:true,align:'right',priority:2,formatter:function (value,row) { return differenceText(row); },exportValue:differenceText},
      {label:'Progress',field:'status',html:true,formatter:function (value,row) { return progress(row); },exportValue:statusText}
    ],emptyState:{message:'No salespeople are available.'},exportName:'sales-targets.csv'});
    historyTable = GT.dataTable.create({id:'targetHistoryTable',rows:function () { return GT.salesTargets.history(month); },searchFields:['name','changed_by_name'],columns:[
      {label:'Salesperson',field:'name'}, {label:'Changed at',field:'changed_at',formatter:GT.dates.formatDateTime},
      {label:'Previous',field:'previous_amount',numeric:true,align:'right',priority:2,formatter:function (value) { return value === null ? 'Not set' : money(value); }},
      {label:'New target',field:'target_amount',numeric:true,align:'right',formatter:money}, {label:'Changed by',field:'changed_by_name',priority:2}
    ],emptyState:{message:'No target changes this month.'},exportName:'target-history.csv'});
    sections = [{title:'Set monthly target',fields:[
      {name:'user_id',label:'Salesperson',type:'select',valueType:'number',required:true,options:GT.salesTargets.salespeople().map(function (person) { return {value:person.id,label:person.name}; })},
      {name:'target_amount',label:'Target (UGX)',type:'money',required:true}
    ]}];
    return '<section>' + GT.components.pageHeader({title:own() ? 'My Target' : 'Sales Targets',description:'Issued, non-void invoice value by issuing salesperson and invoice date.',actions:[{label:'Print monthly report',name:'print',icon:'printer'}]}) +
      '<div class="detail-card">' + GT.forms.field({name:'targetMonth',label:'Month',type:'month'},{targetMonth:month}) + '</div><div id="targetSummary"></div><p id="targetReconciliation" role="status"></p><div id="targetMount"></div>' +
      (GT.salesTargets.canManage() ? '<div class="detail-card">' + GT.forms.render({id:'targetForm',sections:sections,values:{},submitLabel:'Set target',cancelRoute:'#/dashboard'}) +
      '</div><article class="detail-card"><h2>Change history</h2><div id="targetHistory"></div></article>' : '') + '</section>';
  }
  function refresh() { table.refresh(); historyTable.refresh(); renderSummary(); }
  function print() {
    var rows = GT.salesTargets.rows(month);
    GT.print.open(GT.print.letterhead() + '<h2>MONTHLY SALES TARGETS</h2><p>' + safe(GT.dates.formatMonth(month)) + '</p><p>' + safe(checkText(rows)) + '</p>' +
      GT.print.reportTable([{label:'Salesperson'},{label:'Target',numeric:true},{label:'Actual',numeric:true},{label:'Difference',numeric:true},{label:'Progress / status'}],rows.map(function (row) {
        return [row.name,targetText(row),money(row.actual),differenceText(row),statusText(row)];
      })), 'Monthly Sales Targets');
  }
  function bind() {
    table.mount('#targetMount'); historyTable.mount('#targetHistory'); renderSummary();
    document.getElementById('targetMonth').addEventListener('change',function () { if (this.value) { month = this.value; refresh(); } else this.value = month; });
    var form = document.getElementById('targetForm');
    if (form) {
      var dirty = GT.forms.trackDirty(form);
      form.addEventListener('submit',function (event) {
        event.preventDefault();
        try {
          var values = GT.forms.read(form,sections);
          if (!/^\d[\d,]*$/.test(form.elements.target_amount.value.trim())) values.target_amount = null;
          GT.salesTargets.save(values.user_id,month,values.target_amount);
          dirty.markSaved(); GT.forms.clearErrors(form); GT.components.showToast('Sales target saved.','success'); refresh();
        } catch (error) {
          if (error.fields) GT.forms.showErrors(form,error.fields);
          else GT.components.showToast(error.message,'error');
        }
      });
    }
    document.querySelector('[data-page-action="print"]').addEventListener('click',print);
  }
  var api = {render:render,bind:bind};
  GT.router.register('#/marketing/targets',{module:api,view:'list',title:'Sales Targets',permission:'sales_targets'});
  return api;
}());
