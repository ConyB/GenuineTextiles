/* Customer signup cohorts with period totals and monthly breakdown. */
window.GT.leadSourceModule = (function () {
  var GT = window.GT, table, monthlyTable;
  function period() { return table.state.filters; }
  function rows(monthly) { var filters = period(); return GT.marketing.leadReport(filters.date_from || '',filters.date_to || '',monthly); }
  function columns(monthly) {
    var values = [{label:'Lead source',field:'name'}, {label:'Customers',field:'customers',numeric:true,align:'right'},
      {label:'Invoiced in period',field:'invoiced',numeric:true,align:'right',formatter:GT.format.formatMoney}];
    if (monthly) values.unshift({label:'Signup month',field:'month',formatter:function (value) { return value === 'Unknown date' ? value : GT.dates.formatMonth(value); }});
    return values;
  }
  function syncMonth() {
    var input = document.getElementById('leadMonth'), filters = period();
    if (input) input.value = filters.date_from && filters.date_from.slice(-2) === '01' && filters.date_to === GT.dates.endOfMonth(filters.date_from) ? filters.date_from.slice(0,7) : '';
    if (monthlyTable) monthlyTable.refresh();
  }
  function render() {
    table = GT.dataTable.create({id:'leadSourceReport',rows:function () { return rows(false); },searchFields:['name'],filters:[
      {name:'date_from',label:'From date',type:'date',test:function () { return true; }},
      {name:'date_to',label:'To date',type:'date',test:function () { return true; }}
    ],columns:columns(false),onStateChange:syncMonth,emptyState:{message:'No customers were recorded in this period.'},exportName:'lead-sources.csv'});
    monthlyTable = GT.dataTable.create({id:'monthlyLeadSources',rows:function () { return rows(true); },searchFields:['name','month'],columns:columns(true),
      emptyState:{message:'No customers were recorded in this period.'},exportName:'monthly-lead-sources.csv'});
    return '<section>' + GT.components.pageHeader({title:'Lead Source Report',description:'Customers first recorded in the selected period, with their non-void invoice value in that same period.',
      actions:[{label:'Print',name:'print',icon:'printer'}]}) + '<div class="detail-card">' +
      GT.forms.field({name:'leadMonth',label:'Show one month',type:'month'}, {}) + '</div><div id="leadMount"></div>' +
      '<article class="detail-card"><h2>By signup month</h2><div id="monthlyLeadMount"></div></article></section>';
  }
  function print() {
    var filters = period(), title = 'Lead Source Report';
    var html = GT.print.letterhead() + '<h2>LEAD SOURCE REPORT</h2><p>' + GT.components.escapeHtml(GT.dates.formatRange(filters.date_from || '',filters.date_to || '')) + '</p>' +
      '<p>Customers first recorded in the selected period; invoice values use that same period and exclude voids.</p>' +
      GT.print.reportTable([{label:'Lead source'},{label:'Customers',numeric:true},{label:'Invoiced',numeric:true}], rows(false).map(function (row) {
        return [row.name,row.customers,GT.format.formatMoney(row.invoiced)];
      })) + '<h3>By signup month</h3>' +
      GT.print.reportTable([{label:'Signup month'},{label:'Source'},{label:'Customers',numeric:true},{label:'Invoiced',numeric:true}], rows(true).map(function (row) {
        return [row.month === 'Unknown date' ? row.month : GT.dates.formatMonth(row.month),row.name,row.customers,GT.format.formatMoney(row.invoiced)];
      }));
    GT.print.open(html,title);
  }
  function bind() {
    table.mount('#leadMount'); monthlyTable.mount('#monthlyLeadMount');
    document.getElementById('leadMonth').addEventListener('change',function () {
      table.state.filters.date_from = this.value ? this.value + '-01' : '';
      table.state.datePreset = this.value ? 'custom' : 'any';
      table.setFilter('date_to',this.value ? GT.dates.endOfMonth(this.value + '-01') : '');
    });
    document.querySelector('[data-page-action="print"]').addEventListener('click',print);
  }
  var api = {render:render,bind:bind};
  GT.router.register('#/marketing/lead-sources',{module:api,view:'list',title:'Lead Source Report',permission:'lead_source_report'});
  return api;
}());
