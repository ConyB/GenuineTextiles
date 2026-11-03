/* Owner fabric estimator and editable illustration tables (BUSINESS_RULES.md section 10). */
window.GT.fabricCalculatorModule = (function () {
  var GT = window.GT;
  var service = GT.fabricCalculator;
  var tableInstances = [];
  var latestResult = null;
  var ruleTypes = [
    {table:'fabric_rules',title:'Base metres by design and size',field:'base_metres',label:'Base metres'},
    {table:'fabric_width_adjustments',title:'Width adjustments',field:'adjustment_metres',label:'Adjustment (m)'},
    {table:'fabric_rule_adjustments',title:'Style add-ons',field:'extra_metres',label:'Extra metres'},
    {table:'fabric_wastage_rules',title:'Wastage by design',field:'wastage_metres',label:'Wastage (m)'},
    {table:'fabric_markup_rules',title:'Markup',field:'markup_percent',label:'Markup (%)'}
  ];
  function safe(value) { return GT.components.escapeHtml(value); }
  function fmt(value) { return Number(value).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:3}) + ' m'; }
  function ruleType(table) { return ruleTypes.find(function (item) { return item.table === table; }); }
  function designName(id) { var row=GT.store.find('designs',id); return row ? row.name : 'Unknown design'; }
  function sourceColumn() { return {label:'Source',field:'source',priority:1,minWidth:150}; }
  function numberColumn(label,field) { return {label:label,field:field,align:'right',numeric:true,priority:1,minWidth:100}; }

  function calculatorSections() {
    var designs = service.designs();
    var widths = service.rules('fabric_width_adjustments').map(function (row) { return {value:row.width_inches,label:row.width_inches+' inch'}; });
    var fabrics = service.fabrics().map(function (row) { return {value:row.id,label:row.name}; });
    return [{title:'Calculate fabric',description:'Choose a design, width, options and whole-piece quantity.',fields:[
      {name:'design_id',label:'Design',type:'select',valueType:'number',required:true,options:designs.map(function (row) { return {value:row.id,label:row.name}; })},
      {name:'size',label:'Size',type:'select',required:true,options:['Small','Medium','Large'].map(function (v) { return {value:v,label:v}; })},
      {name:'fabric_id',label:'Fabric from stock (optional)',type:'select',valueType:'number',options:fabrics},
      {name:'width_inches',label:'Fabric width',type:'select',valueType:'number',required:true,options:widths},
      {name:'quantity',label:'Quantity (pieces)',type:'number',required:true},
      {name:'note',label:'Note to save with this calculation',type:'textarea',fullWidth:true,rows:2,placeholder:'Optional until you save'}
    ]}];
  }

  function styleMarkup() {
    var rows=service.rules('fabric_rule_adjustments');
    if (!rows.length) return '<p>No style add-ons are defined.</p>';
    return '<fieldset class="form-section fabric-style-section"><legend>Style options</legend><div class="fabric-options">'+rows.map(function (row) {
      return '<label class="fabric-option" data-design-id="'+row.design_id+'"><input type="checkbox" name="style_'+row.id+'" value="'+row.id+'"><span>'+safe(row.option_name)+' (+'+fmt(row.extra_metres)+')</span></label>';
    }).join('')+'</div></fieldset>';
  }

  function resultMarkup(result) {
    if (!result) return '<p class="fabric-result-empty">Choose valid rules to see a calculation.</p>';
    var lines=[
      GT.components.detailRow('Base at '+result.reference_width_inches+' inch reference',fmt(result.base_metres)),
      GT.components.detailRow('Width adjustment',fmt(result.width_adjustment_metres)),
      GT.components.detailRow('Style add-ons',fmt(result.style_metres)),
      GT.components.detailRow('Wastage allowance',fmt(result.wastage_metres)),
      GT.components.detailRow('Metres per piece',fmt(result.metres_per_piece)),
      GT.components.detailRow('Total for '+result.quantity+' piece'+(result.quantity===1?'':'s'),fmt(result.total_metres))
    ];
    if (result.fabric) {
      lines.push(GT.components.detailRow('On-hand stock',fmt(result.on_hand_metres)));
      lines.push(GT.components.detailRow('Stock check',result.stock_enough?'Enough stock':'Not enough stock'));
      lines.push(GT.components.detailRow('Material cost',GT.format.formatMoney(result.material_cost)));
      lines.push(GT.components.detailRow('Suggested price ('+result.markup_percent+'% markup)',GT.format.formatMoney(result.suggested_price)));
    } else lines.push(GT.components.detailRow('Material cost and suggested price','Choose a stock fabric to calculate.'));
    return '<dl class="detail-grid">'+lines.join('')+'</dl>';
  }

  function notesTable() {
    var table=GT.dataTable.create({id:'fabricNotesTable',caption:'Saved calculation notes',rows:function () { return service.notes().map(function (row) {
      return Object.assign({},row,{design:designName(row.design_id),fabric:row.fabric_id ? (GT.store.find('materials',row.fabric_id)||{}).name : 'No fabric',total_display:fmt(row.total_metres)});
    }); },searchFields:['note','design','fabric'],columns:[
      {label:'Design',field:'design',minWidth:150},{label:'Size',field:'size'},
      {label:'Fabric',field:'fabric',priority:2},{label:'Total metres',field:'total_display',align:'right',numeric:true},
      {label:'Note',field:'note',minWidth:180}
    ],emptyState:{message:'No calculation notes saved yet.'},exportName:'fabric-calculation-notes.csv'});
    tableInstances.push({table:table,mount:'#fabricNotesMount'});
  }

  function ruleTable(type) {
    var columns=[];
    if (type.table !== 'fabric_width_adjustments' && type.table !== 'fabric_markup_rules') columns.push({label:'Design',field:'design_name',minWidth:150});
    if (type.table === 'fabric_rules') columns.push({label:'Size',field:'size'},{label:'Reference width',field:'reference_width_inches',align:'right',numeric:true});
    if (type.table === 'fabric_width_adjustments') columns.push(numberColumn('Reference width','reference_width_inches'),numberColumn('Chosen width','width_inches'));
    if (type.table === 'fabric_rule_adjustments') columns.push({label:'Option',field:'option_name'});
    columns.push(numberColumn(type.label,type.field),sourceColumn());
    var table=GT.dataTable.create({id:type.table+'Table',caption:type.title,rows:function () { return service.rules(type.table).map(function (row) {
      return Object.assign({},row,{design_name:row.design_id ? designName(row.design_id) : ''});
    }); },columns:columns,actions:[{label:'Edit',icon:'pencil',primary:true,onClick:function (row) {
      location.hash='#/production/fabric-calculator/rules/'+type.table+'/'+row.id;
    }}],emptyState:{message:'No '+type.title.toLowerCase()+' are defined.'},exportName:type.table+'.csv'});
    tableInstances.push({table:table,mount:'#'+type.table+'Mount'});
  }

  function renderCalculator() {
    tableInstances=[]; latestResult=null;
    ruleTypes.forEach(ruleTable); notesTable();
    var form=GT.forms.render({id:'fabricCalculatorForm',sections:calculatorSections(),values:{design_id:1,size:'Large',width_inches:60,quantity:1},submitLabel:'Save calculation note',cancelRoute:'#/dashboard'});
    form=form.replace('<div class="form-actions">',styleMarkup()+'<div class="form-actions">');
    return '<section class="fabric-calculator-page">'+GT.components.pageHeader({title:'Fabric Calculator',description:'Owner-only estimate from editable fabric rules.',actions:[{label:'Print calculation',icon:'printer',name:'print'}]})+
      '<p class="fabric-rule-notice">Rules are illustrations until the owner confirms them (A-06).</p>'+form+
      '<section class="detail-card" aria-live="polite"><h2>Calculation result</h2><div id="fabricResult"></div><p class="field-help">Stock shown here is read only. Calculations do not post or reserve stock. Costs and suggested prices use mock values and are not quotations.</p></section>'+
      '<section class="detail-card"><h2>Saved calculation notes</h2><div id="fabricNotesMount"></div></section>'+
      '<section class="fabric-rules"><h2>Calculation rules</h2><p>All figures below can be edited by the Owner. Source labels describe the seeded values.</p>'+
      ruleTypes.map(function (type) { return '<section class="detail-card"><h3>'+safe(type.title)+'</h3><div id="'+type.table+'Mount"></div></section>'; }).join('')+'</section></section>';
  }

  function readCalculation(form) {
    var values=GT.forms.read(form,calculatorSections());
    values.option_ids=Array.from(form.querySelectorAll('.fabric-option input:checked')).map(function (input) { return Number(input.value); });
    return values;
  }
  function showStyles(form) {
    var designId=Number(form.elements.design_id.value);
    form.querySelectorAll('.fabric-option').forEach(function (label) {
      var show=Number(label.dataset.designId)===designId;
      label.hidden=!show;
      if (!show) label.querySelector('input').checked=false;
    });
  }
  function calculateLive(form) {
    try {
      latestResult=service.calculate(readCalculation(form));
      document.getElementById('fabricResult').innerHTML=resultMarkup(latestResult);
    } catch(error) {
      latestResult=null;
      document.getElementById('fabricResult').innerHTML='<p class="fabric-result-empty">'+safe(error.message)+'</p>';
    }
  }

  function printReport(result) {
    var rows=[['Design',result.design.name],['Size',result.size],['Fabric width',result.width_inches+' inch'],
      ['Fabric',result.fabric?result.fabric.name:'No fabric selected'],['Quantity',result.quantity+' pieces'],
      ['Base metres',fmt(result.base_metres)],['Width adjustment',fmt(result.width_adjustment_metres)],
      ['Style add-ons',fmt(result.style_metres)],['Wastage',fmt(result.wastage_metres)],
      ['Metres per piece',fmt(result.metres_per_piece)],['Total metres',fmt(result.total_metres)]];
    if (result.fabric) rows.push(['On-hand stock',fmt(result.on_hand_metres)],['Stock check',result.stock_enough?'Enough stock':'Not enough stock'],
      ['Material cost',GT.format.formatMoneyPrint(result.material_cost)],['Suggested price ('+result.markup_percent+'% markup)',GT.format.formatMoneyPrint(result.suggested_price)]);
    var html=GT.print.letterhead()+'<h1 class="fabric-print-title">FABRIC CALCULATION REPORT</h1><p>Rules are illustrations until the owner confirms them (A-06).</p>'+
      '<table><tbody>'+rows.map(function (row) { return '<tr><th scope="row">'+safe(row[0])+'</th><td>'+safe(row[1])+'</td></tr>'; }).join('')+'</tbody></table>'+
      '<p class="fabric-print-note">Stock is shown for reference only. No stock was posted or reserved. Costs and suggested prices use mock values and are not quotations.</p>';
    GT.print.open(html,'Fabric calculation report');
  }

  function bindCalculator() {
    tableInstances.forEach(function (item) { item.table.mount(item.mount); });
    var form=document.getElementById('fabricCalculatorForm');
    var tracker=GT.forms.trackDirty(form);
    showStyles(form); calculateLive(form);
    form.addEventListener('input',function () { calculateLive(form); });
    form.addEventListener('change',function (event) {
      if (event.target.name==='design_id') showStyles(form);
      if (event.target.name==='fabric_id' && event.target.value) {
        var fabric=GT.store.find('materials',event.target.value);
        if (fabric) form.elements.width_inches.value=String(fabric.width_inches);
      }
      calculateLive(form);
    });
    form.addEventListener('submit',function (event) {
      event.preventDefault();
      try {
        var input=readCalculation(form);
        var result=service.calculate(input);
        service.saveNote(input,result);
        tracker.markSaved();
        form.elements.note.value='';
        tableInstances.find(function (item) { return item.mount==='#fabricNotesMount'; }).table.refresh();
        GT.components.showToast('Calculation note saved.','success');
      } catch(error) { GT.components.showToast(error.message,'error'); }
    });
    document.querySelector('[data-page-action="print"]').addEventListener('click',function () {
      if (latestResult) printReport(latestResult);
      else GT.components.showToast('Complete a valid calculation before printing.','warning');
    });
  }

  function editSections(type) {
    return [{title:type.title,fields:[{name:type.field,label:type.label,type:'number',step:type.field==='markup_percent'?'0.01':'0.001',required:true,
      help:'Source changes to ASSUMED illustration if you change the supplied value.'}]}];
  }
  function renderEdit(params) {
    var type=ruleType(params.table),row=type&&GT.store.find(type.table,params.id);
    if (!row) return GT.components.pageHeader({title:'Rule unavailable'});
    return '<section class="fabric-calculator-page">'+GT.components.pageHeader({title:'Edit '+type.title,description:'Owner-only fabric calculation rule.'})+
      '<p class="fabric-rule-notice">Rules are illustrations until the owner confirms them (A-06).</p>'+
      '<p>Source: '+safe(row.source)+'</p>'+GT.forms.render({id:'fabricRuleForm',sections:editSections(type),values:row,submitLabel:'Save rule',cancelRoute:'#/production/fabric-calculator'})+'</section>';
  }
  function bindEdit(params) {
    var type=ruleType(params.table),row=type&&GT.store.find(type.table,params.id);
    if (!row) return;
    var form=document.getElementById('fabricRuleForm'),tracker=GT.forms.trackDirty(form);
    form.addEventListener('submit',function (event) {
      event.preventDefault();
      try { service.saveRule(type.table,row.id,GT.forms.read(form,editSections(type))); tracker.markSaved();
        GT.components.showToast('Fabric rule saved.','success'); location.hash='#/production/fabric-calculator';
      } catch(error) { GT.forms.showErrors(form,{[type.field]:error.message}); }
    });
  }
  var api={render:function (view,params) { return view==='edit'?renderEdit(params):renderCalculator(); },
    bind:function (view,params) { if (view==='edit') bindEdit(params); else bindCalculator(); }};
  GT.router.register('#/production/fabric-calculator',{module:api,view:'calculator',title:'Fabric Calculator',permission:'fabric_calculator'});
  GT.router.register('#/production/fabric-calculator/rules/:table/:id',{module:api,view:'edit',title:'Edit Fabric Rule',
    permission:'fabric_calculator',action:'E',baseRoute:'#/production/fabric-calculator'});
  return api;
}());
