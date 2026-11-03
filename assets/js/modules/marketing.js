/* Campaign screens reuse the shared form, table and unnumbered A4 report components. */
window.GT.marketingModule = (function () {
  var GT = window.GT, safe = GT.components.escapeHtml, money = GT.format.formatMoney;
  var table, linksTable, sections;
  var budgetNote = 'Planned budget is a plan only. Actual spend is recorded through Expenses; saving a campaign does not create an expense, voucher or cash-book entry.';
  function dateText(value) { return value ? GT.dates.formatDate(value) : '—'; }
  function titleCase(value) { return value.replace(/_/g,' ').replace(/^./,function (letter) { return letter.toUpperCase(); }); }
  function options(values) { return values.map(function (value) { return {value:value,label:titleCase(value)}; }); }
  function header(title, description, actions) { return GT.components.pageHeader({title:title,description:description,actions:actions || []}); }
  function renderList() {
    table = GT.dataTable.create({id:'campaignsTable', rows:GT.marketing.campaignRows, searchFields:['name','channel','target_audience'],
      filters:[
        {name:'status',label:'Status',field:'status',options:options(GT.marketing.statuses)},
        {name:'channel',label:'Channel',field:'channel',options:options([...new Set(GT.marketing.campaignRows().map(function (row) { return row.channel; }))])},
        {name:'date_from',label:'From date',type:'date',test:function (row,value) { return row.start_date >= value; }},
        {name:'date_to',label:'To date',type:'date',test:function (row,value) { return row.start_date <= value; }}
      ], columns:[
        {label:'Campaign',field:'name',sortable:true}, {label:'Channel',field:'channel'},
        {label:'Starts',field:'start_date',formatter:dateText,sortable:true}, {label:'Ends',field:'end_date',formatter:dateText,priority:2},
        {label:'Status',field:'status'}, {label:'Planned budget',field:'budget',numeric:true,align:'right',formatter:money,priority:2}
      ], actions:[{label:'View',icon:'eye',primary:true,onClick:function (row) { location.hash = '#/marketing/campaigns/' + row.id; }},
        {label:'Edit',icon:'pencil',primary:true,show:GT.marketing.canEditCampaign,onClick:function (row) { location.hash = '#/marketing/campaigns/' + row.id + '/edit'; }}],
      emptyState:{message:'No campaigns match these filters.'}, exportName:'campaigns.csv'});
    var actions = GT.marketing.canEditCampaign() ? [{label:'New campaign',icon:'plus',route:'#/marketing/campaigns/new'}] : [];
    return '<section>' + header('Campaigns','Plan and record marketing activity. Date filters use the campaign start date.',actions) +
      '<p class="detail-card">' + safe(budgetNote) + '</p><div id="campaignMount"></div></section>';
  }
  function formSections() {
    return [{title:'Campaign plan',fields:[
      {name:'name',label:'Name',required:true}, {name:'type',label:'Type',type:'select',required:true,options:options(GT.marketing.types)},
      {name:'channel',label:'Channel',required:true}, {name:'status',label:'Status',type:'select',required:true,options:options(GT.marketing.statuses)},
      {name:'start_date',label:'Start date',type:'date',required:true}, {name:'end_date',label:'End date',type:'date',required:true},
      {name:'budget',label:'Planned budget (UGX)',type:'money',required:true}, {name:'target_audience',label:'Target audience'},
      {name:'notes',label:'Notes',type:'textarea',fullWidth:true}
    ]}, {title:'Results entered by hand',fields:[
      {name:'leads_gained',label:'Leads gained',type:'number',required:true}, {name:'orders_won',label:'Orders won',type:'number',required:true},
      {name:'sales_value',label:'Sales value (UGX)',type:'money',required:true}, {name:'result_notes',label:'Outcome note',type:'textarea',fullWidth:true}
    ]}, {title:'Existing communication',description:'Select sent marketing messages and saved posters.',fields:[
      {name:'message_ids',label:'Sent messages',type:'multiselect',fullWidth:true,options:GT.marketing.eligibleMessages().map(function (message) {
        return {value:message.id,label:(GT.store.find('message_templates',message.template_id) || {}).name + ' · ' + message.recipient_name + ' · ' + message.channel + ' · ' + dateText(message.sent_at)};
      })},
      {name:'poster_ids',label:'Saved posters',type:'multiselect',fullWidth:true,options:GT.store.all('posters').map(function (poster) { return {value:poster.id,label:poster.title}; })}
    ]}];
  }
  function renderForm(params) {
    var row = params.id ? GT.marketing.campaign(params.id) : null;
    if (params.id && !row) return header('Campaign not found','This campaign is unavailable.');
    sections = formSections();
    var values = Object.assign({type:'promotion',status:'Planned',budget:0,leads_gained:0,orders_won:0,sales_value:0,message_ids:[],poster_ids:[]},row || {});
    return '<section>' + header(row ? 'Edit campaign' : 'New campaign',budgetNote) + GT.forms.render({id:'campaignForm',sections:sections,values:values,
      submitLabel:'Save campaign',cancelRoute:row ? '#/marketing/campaigns/' + row.id : '#/marketing/campaigns'}) + '</section>';
  }
  function bindForm(params) {
    var form = document.getElementById('campaignForm');
    if (!form) return;
    var dirty = GT.forms.trackDirty(form);
    form.addEventListener('submit',function (event) {
      event.preventDefault();
      try {
        var values = GT.forms.read(form,sections);
        ['budget','sales_value'].forEach(function (field) {
          if (!/^\d[\d,]*$/.test(form.elements[field].value.trim())) values[field] = null;
        });
        var row = GT.marketing.saveCampaign(params.id,values);
        dirty.markSaved(); GT.components.showToast('Campaign saved.','success');
        location.hash = '#/marketing/campaigns/' + row.id;
      } catch (error) {
        if (error.fields) GT.forms.showErrors(form,error.fields);
        else GT.components.showToast(error.message,'error');
      }
    });
  }
  function plan(row) {
    return '<dl class="detail-grid">' + GT.components.detailRow('Type',titleCase(row.type)) + GT.components.detailRow('Channel',row.channel) +
      GT.components.detailRow('Start',dateText(row.start_date)) + GT.components.detailRow('End',dateText(row.end_date)) +
      GT.components.detailRow('Status',row.status) + GT.components.detailRow('Target audience',row.target_audience || '—') + '</dl>';
  }
  function renderDetail(params) {
    var row = GT.marketing.campaign(params.id);
    if (!row) return header('Campaign not found','This campaign is unavailable.');
    var actions = [{label:'Print summary',name:'print',icon:'printer'}];
    if (GT.marketing.canEditCampaign()) actions.unshift({label:'Edit campaign',icon:'pencil',route:'#/marketing/campaigns/' + row.id + '/edit'});
    linksTable = GT.dataTable.create({id:'campaignLinks',rows:function () { return GT.marketing.linkedRecords(row); },searchFields:['label'],columns:[
      {label:'Record',field:'label'}, {label:'Type',field:'kind'}, {label:'Channel / size',field:'channel',priority:2}, {label:'Date',field:'date',formatter:dateText}
    ],emptyState:{message:'No messages or posters linked.'},exportName:'campaign-links.csv'});
    return '<section>' + header(row.name,'Campaign plan and manually entered results.',actions) + GT.statCards.render([
      {label:'Planned budget',value:money(row.budget),icon:'wallet',tone:'info'},
      {label:'Leads gained',value:row.leads_gained,icon:'users',tone:'brand'},
      {label:'Orders won',value:row.orders_won,icon:'shopping-bag',tone:'success'},
      {label:'Reported sales',value:money(row.sales_value),icon:'chart-column',tone:'info'}]) +
      '<article class="detail-card"><h2>Plan</h2>' + plan(row) + '<p>' + safe(budgetNote) + '</p><h2>Notes</h2><p>' + safe(row.notes || 'No notes recorded.') +
      '</p><h2>Outcome</h2><p>' + safe(row.result_notes || 'No outcome recorded.') + '</p></article><article class="detail-card"><h2>Linked messages and posters</h2><div id="campaignLinksMount"></div></article></section>';
  }
  function printSummary(row) {
    var links = GT.marketing.linkedRecords(row);
    var html = GT.print.letterhead() + '<h2>CAMPAIGN SUMMARY</h2><h3>' + safe(row.name) + '</h3>' + plan(row) +
      GT.print.reportTable([{label:'Planned budget',numeric:true},{label:'Leads gained',numeric:true},{label:'Orders won',numeric:true},{label:'Reported sales',numeric:true}],
        [[money(row.budget),row.leads_gained,row.orders_won,money(row.sales_value)]]) +
      '<p>' + safe(budgetNote) + '</p><h3>Notes</h3><p>' + safe(row.notes || 'No notes recorded.') + '</p><h3>Outcome</h3><p>' + safe(row.result_notes || 'No outcome recorded.') + '</p><h3>Linked messages and posters</h3>' +
      GT.print.reportTable([{label:'Record'},{label:'Type'},{label:'Channel / size'},{label:'Date'}],links.map(function (link) { return [link.label,link.kind,link.channel,dateText(link.date)]; }));
    GT.print.open(html,'Campaign summary');
  }
  var api = {
    render:function (view,params) { return view === 'list' ? renderList() : view === 'form' ? renderForm(params) : renderDetail(params); },
    bind:function (view,params) {
      if (view === 'list') table.mount('#campaignMount');
      else if (view === 'form') bindForm(params);
      else if (document.getElementById('campaignLinksMount')) {
        linksTable.mount('#campaignLinksMount');
        document.querySelector('[data-page-action="print"]').addEventListener('click',function () { printSummary(GT.marketing.campaign(params.id)); });
      }
    }
  };
  GT.router.register('#/marketing/campaigns',{module:api,view:'list',title:'Campaigns',permission:'marketing_campaigns'});
  GT.router.register('#/marketing/campaigns/new',{module:api,view:'form',title:'New Campaign',permission:'marketing_campaigns',action:'C',baseRoute:'#/marketing/campaigns'});
  GT.router.register('#/marketing/campaigns/:id/edit',{module:api,view:'form',title:'Edit Campaign',permission:'marketing_campaigns',action:'E',baseRoute:'#/marketing/campaigns'});
  GT.router.register('#/marketing/campaigns/:id',{module:api,view:'detail',title:'Campaign Details',permission:'campaign_details',baseRoute:'#/marketing/campaigns'});
  return api;
}());
