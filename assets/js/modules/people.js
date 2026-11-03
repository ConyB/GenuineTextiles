/* Phase 17 Employees, Attendance, Daily Production, Targets and Wages pages. */
window.GT.peopleModule = (function () {
  var GT=window.GT, table, ratesTable, sections;
  function esc(value) { return GT.components.escapeHtml(value); }
  function money(value) { return GT.format.formatMoney(value); }
  function options(values) { return values.map(function (value) { return {value:value,label:value.replace(/_/g,' ')}; }); }
  function notice(text) { GT.components.showToast(text,'success'); GT.app.renderPage(); }
  function panel(title,body) { return '<section class="detail-card"><h2>'+esc(title)+'</h2>'+body+'</section>'; }
  function mount() { if (table) table.mount('#peopleTableMount'); }
  function employeeList() { var rows=GT.people.employeeRows(), pay=GT.people.moneyRole(), manager=GT.people.manager();
    table=GT.dataTable.create({id:'employeesTable',caption:'Employees',rows:function () { return GT.people.employeeRows(); },
      searchFields:['name','role'],filters:[{name:'role',label:'Role',field:'role',options:options(GT.people.roles)},
        {name:'active',label:'Status',options:[{value:'active',label:'Active'},{value:'inactive',label:'Inactive'}],
          test:function (row,value) { return value==='active'?row.active:value==='inactive'?!row.active:true; }}],
      columns:[{label:'Name',field:'name',sortable:true},{label:'Role',field:'role',sortable:true},
        {label:'Joined',field:'date_joined',formatter:GT.dates.formatDate,exportValue:function (row) { return row.date_joined; },priority:2},
        {label:'Status',field:'active',formatter:function (value) { return value?'Active':'Inactive'; }}].concat(pay?[{label:'Pay type',field:'pay_type',priority:2}]:[]),
      actions:[{label:'View',icon:'eye',primary:true,onClick:function (row) { location.hash='#/people/employees/'+row.id; }}].concat(manager?[{label:'Edit',icon:'pencil',primary:true,onClick:function (row) { location.hash='#/people/employees/'+row.id+'/edit'; }}]:[]),
      emptyState:{message:'No employees match these filters.'},exportName:'employees.csv'});
    return GT.components.pageHeader({title:'Employees',description:'Workshop and business staff records.',actions:manager?[{label:'Add employee',icon:'plus',route:'#/people/employees/new'}]:[]})+
      '<div id="employeeStats"></div><div id="peopleTableMount"></div>'; }
  function bindEmployeeList() { mount(); var rows=GT.people.employeeRows(); var cards=[{label:'Active employees',value:rows.filter(function (r) { return r.active; }).length,icon:'users',tone:'brand'},
    {label:'Inactive employees',value:rows.filter(function (r) { return !r.active; }).length,icon:'user-x',tone:'neutral'}];
    var el=document.getElementById('employeeStats'); el.innerHTML=GT.statCards.render(cards); GT.statCards.bind(el,cards); GT.components.refreshIcons(); }
  function employeeForm(params) { var row=params&&params.id?GT.store.find('employees',params.id):null;
    sections=[{title:'Identity and contact',fields:[{name:'name',label:'Name',type:'text',required:true},{name:'phone',label:'Phone',type:'phone'},
      {name:'nin',label:'NIN',type:'text',help:'Use fake NINs in this prototype.'},{name:'address',label:'Address',type:'textarea',fullWidth:true},
      {name:'next_of_kin_name',label:'Next of kin',type:'text'},{name:'next_of_kin_phone',label:'Next of kin phone',type:'phone'},
      {name:'date_of_birth',label:'Date of birth',type:'date',required:true},{name:'date_joined',label:'Date joined',type:'date',required:true}]},
      {title:'Work and pay',fields:[{name:'role',label:'Role',type:'select',required:true,options:options(GT.people.roles)},
        {name:'pay_type',label:'Pay type',type:'select',required:true,options:[{value:'salary',label:'Monthly salary'},{value:'piece',label:'Per piece'}]},
        {name:'monthly_salary',label:'Monthly salary (UGX)',type:'money',help:'Leave zero for per-piece pay. Piece rates are in the assumed rate table.'}]}];
    return GT.components.pageHeader({title:row?'Edit employee':'Add employee',description:'Personal details are restricted to Owner and General Manager.'})+
      GT.forms.render({id:'employeeForm',sections:sections,values:row||{date_joined:GT.dates.today(),monthly_salary:0},submitLabel:'Save employee',cancelRoute:row?'#/people/employees/'+row.id:'#/people/employees'}); }
  function bindEmployeeForm(params) { var form=document.getElementById('employeeForm'), dirty=GT.forms.trackDirty(form);
    form.addEventListener('submit',function (event) { event.preventDefault(); try { var values=GT.forms.read(form,sections), errors=GT.people.validateEmployee(values);
      if (!GT.forms.showErrors(form,errors)) return; var row=GT.people.saveEmployee(values,params&&params.id); dirty.markSaved(); location.hash='#/people/employees/'+row.id;
    } catch (error) { if (error.fields) GT.forms.showErrors(form,error.fields); else GT.components.showToast(error.message,'error'); } }); }
  function employeeDetail(params) { var row=GT.people.employeeRows().find(function (item) { return item.id===Number(params.id); });
    if (!row) return GT.components.pageHeader({title:'Employee unavailable'}); var manager=GT.people.manager(),pay=GT.people.moneyRole();
    var actions=manager?[{label:'Edit',icon:'pencil',route:'#/people/employees/'+row.id+'/edit'},
      {label:row.active?'Deactivate':'Reactivate',name:'toggle',icon:row.active?'user-x':'user-check',className:'btn-outline-secondary'}]:[];
    return GT.components.pageHeader({title:row.name,description:row.role,badge:GT.components.statusBadge(row.active?'Active':'Inactive',row.active?'success':'neutral'),actions:actions})+
      panel('Employment','<dl class="detail-grid">'+GT.components.detailRow('Role',row.role)+GT.components.detailRow('Joined',GT.dates.formatDate(row.date_joined))+
        (pay?GT.components.detailRow('Pay type',row.pay_type==='salary'?'Monthly salary':'Per piece')+
          (row.pay_type==='salary'?GT.components.detailRow('Monthly salary',money(row.monthly_salary)):''):'')+'</dl>')+
      (manager?panel('Personal details','<dl class="detail-grid">'+GT.components.detailRow('Phone',row.phone)+GT.components.detailRow('NIN',row.nin)+
        GT.components.detailRow('Address',row.address)+GT.components.detailRow('Next of kin',row.next_of_kin_name)+
        GT.components.detailRow('Next of kin phone',row.next_of_kin_phone)+GT.components.detailRow('Date of birth',GT.dates.formatDate(row.date_of_birth))+'</dl>'):''); }
  function bindEmployeeDetail(params) { var button=document.querySelector('[data-page-action="toggle"]'); if (!button) return;
    button.addEventListener('click',async function () { var row=GT.store.find('employees',params.id), verb=row.active?'Deactivate':'Reactivate';
      if (await GT.components.confirmDialog({title:verb+' employee?',message:'The record stays in history.',confirmText:verb})) notice((GT.people.setActive(row.id,!row.active).active?'Employee reactivated.':'Employee deactivated.')); }); }
  function attendancePage() { var day=GT.dates.today(), month=day.slice(0,7), edit=GT.people.operational();
    sections=[{title:'Daily register',fields:[{name:'work_date',label:'Work date',type:'date',required:true},
      {name:'employee_id',label:'Employee',type:'select',valueType:'number',required:true,options:GT.people.employeeRows().filter(function (r) { return r.active; }).map(function (r) { return {value:r.id,label:r.name}; })},
      {name:'status',label:'Status',type:'select',required:true,options:options(GT.people.statuses)}]}];
    table=GT.dataTable.create({id:'attendanceTable',caption:'Monthly attendance',rows:function () { return GT.people.attendanceSummary(document.getElementById('attendanceMonth')?.value||month); },
      searchFields:['name'],columns:[{label:'Employee',field:'name',sortable:true},
        {label:'Present',field:'present',align:'right',numeric:true},{label:'Absent',field:'absent',align:'right',numeric:true},
        {label:'Late',field:'late',align:'right',numeric:true},{label:'Leave',field:'leave',align:'right',numeric:true}],
      emptyState:{message:'No employees in this month.'},exportName:'attendance.csv'});
    return GT.components.pageHeader({title:'Attendance',description:'Daily register and monthly employee totals.'})+
      (edit?GT.forms.render({id:'attendanceForm',sections:sections,values:{work_date:day},submitLabel:'Record status',cancelRoute:'#/people/employees'}):'')+
      panel('Monthly summary','<label class="form-label" for="attendanceMonth">Month</label><input class="form-control people-period" id="attendanceMonth" type="month" value="'+month+'"><div id="peopleTableMount"></div>'); }
  function bindAttendance() { mount(); document.getElementById('attendanceMonth').addEventListener('change',function () { table.refresh(); });
    var form=document.getElementById('attendanceForm'); if (!form) return; var dirty=GT.forms.trackDirty(form); form.addEventListener('submit',function (event) { event.preventDefault();
      try { var values=GT.forms.read(form,sections); GT.people.takeAttendance(values.work_date,[{employee_id:values.employee_id,status:values.status}]); dirty.markSaved(); notice('Attendance recorded.'); }
      catch (error) { GT.components.showToast(error.message,'error'); } }); }
  function productionPage() { var edit=GT.people.operational(), rates=GT.store.all('piece_rates'), items=GT.people.orderItems();
    sections=[{title:'Work completed',fields:[{name:'work_date',label:'Work date',type:'date',required:true},
      {name:'employee_id',label:'Employee',type:'select',valueType:'number',required:true,options:GT.people.employeeRows().filter(function (r) { return r.active; }).map(function (r) { return {value:r.id,label:r.name}; })},
      {name:'order_item_id',label:'Order item',type:'select',valueType:'number',required:true,options:items.map(function (r) { return {value:r.id,label:r.label}; })},
      {name:'garment_type',label:'Garment type',type:'select',required:true,options:options([...new Set(rates.map(function (r) { return r.garment_type; }))])},
      {name:'task',label:'Task',type:'select',required:true,options:options(GT.people.tasks)},
      {name:'quantity',label:'Pieces completed',type:'number',required:true}]}];
    table=GT.dataTable.create({id:'productionTable',caption:'Daily production log',rows:GT.people.productionRows,
      searchFields:['employee_name','order_label','task'],filters:[{name:'date_from',label:'From date',type:'date',test:function (r,v) { return r.work_date>=v; }},
        {name:'date_to',label:'To date',type:'date',test:function (r,v) { return r.work_date<=v; }}],
      columns:[{label:'Date',field:'work_date',formatter:GT.dates.formatDate,exportValue:function (r) { return r.work_date; }},
        {label:'Employee',field:'employee_name'},{label:'Order item',field:'order_label'},
        {label:'Task',field:'task'},{label:'Pieces',field:'quantity',align:'right',numeric:true}],
      emptyState:{message:'No production entries match these filters.'},exportName:'production-log.csv'});
    return GT.components.pageHeader({title:'Daily Production Log',description:'Completed pieces and quality problems linked to order items.'})+
      (edit?GT.forms.render({id:'productionForm',sections:sections,values:{work_date:GT.dates.today()},submitLabel:'Log completed pieces',cancelRoute:'#/people/employees'})+
        '<p id="productionQuantityWarning" class="alert alert-warning" role="status" hidden></p>':'')+
      panel('Production entries','<div id="peopleTableMount"></div>')+
      panel('Quality and rework',qualitySection(edit,items)); }
  function qualitySection(edit,items) { var rows=GT.people.qualityRows(), employees=GT.people.employeeRows();
    var list=rows.length?GT.components.linkedList(rows.map(function (r) { var person=employees.find(function (p) { return p.id===r.employee_id; }); return {route:'#/people/employees/'+r.employee_id,label:(person?person.name:'Employee')+' · '+r.description,meta:r.rework_needed?'Rework needed':'Quality issue'}; })):'<p>No quality problems logged.</p>';
    if (!edit) return list; var qualitySections=[{title:'Log quality issue',fields:[{name:'employee_id',label:'Responsible employee',type:'select',valueType:'number',required:true,options:employees.filter(function (r) { return r.active; }).map(function (r) { return {value:r.id,label:r.name}; })},
      {name:'order_item_id',label:'Order item',type:'select',valueType:'number',required:true,options:items.map(function (r) { return {value:r.id,label:r.label}; })},
      {name:'description',label:'Problem',type:'textarea',required:true,fullWidth:true},
      {name:'rework_needed',label:'Rework needed',type:'checkbox'}]}];
    return list+GT.forms.render({id:'qualityForm',sections:qualitySections,submitLabel:'Log quality issue',cancelRoute:'#/people/piece-rate-log'}); }
  function bindProduction() { mount(); var form=document.getElementById('productionForm'); if (form) { var workDirty=GT.forms.trackDirty(form);
    function updateQuantityWarning() { var warning=document.getElementById('productionQuantityWarning');
      warning.textContent=GT.people.productionQuantityWarning(GT.forms.read(form,sections)); warning.hidden=!warning.textContent; }
    form.addEventListener('input',updateQuantityWarning); form.addEventListener('change',updateQuantityWarning);
    form.addEventListener('submit',function (event) { event.preventDefault();
    try { var values=GT.forms.read(form,sections), warning=GT.people.productionQuantityWarning(values);
      GT.people.logProduction(values); workDirty.markSaved(); notice('Production recorded.');
      if (warning) GT.components.showToast(warning,'warning');
    } catch (error) { GT.components.showToast(error.message,'error'); } }); }
    var quality=document.getElementById('qualityForm'); if (quality) { var qualityDirty=GT.forms.trackDirty(quality); quality.addEventListener('submit',function (event) { event.preventDefault();
      try { GT.people.logQuality({employee_id:Number(quality.employee_id.value),order_item_id:Number(quality.order_item_id.value),
        description:quality.description.value,rework_needed:quality.rework_needed.checked}); qualityDirty.markSaved(); notice('Quality issue recorded.'); }
      catch (error) { GT.components.showToast(error.message,'error'); } }); } }
  function targetsPage() { var day=GT.dates.today(), edit=GT.people.manager();
    sections=[{title:'Production target',fields:[{name:'section',label:'Section',type:'select',required:true,options:options(GT.people.tasks)},
      {name:'period',label:'Period',type:'select',required:true,options:options(['daily','weekly'])},
      {name:'target_quantity',label:'Target pieces',type:'number',required:true}]}];
    table=GT.dataTable.create({id:'targetsTable',caption:'Production targets',rows:function () { return GT.people.targetRows(document.getElementById('targetDate')?.value||day); },
      searchFields:['section','period'],columns:[{label:'Section',field:'section'},{label:'Period',field:'period'},
        {label:'Target',field:'target_quantity',align:'right',numeric:true},{label:'Actual',field:'actual',align:'right',numeric:true},
        {label:'Difference',field:'difference',align:'right',numeric:true,formatter:function (value,row) { return row.actual-row.target_quantity; },exportValue:function (row) { return row.actual-row.target_quantity; }}],
      emptyState:{message:'No targets set.'},exportName:'production-targets.csv'});
    return GT.components.pageHeader({title:'Production Targets',description:'Daily and Monday-to-Sunday weekly actual versus target.'})+
      (edit?GT.forms.render({id:'targetForm',sections:sections,submitLabel:'Save target',cancelRoute:'#/people/piece-rate-log'}):'')+
      panel('Actual versus target','<label class="form-label" for="targetDate">Date</label><input class="form-control people-period" id="targetDate" type="date" value="'+day+'"><div id="peopleTableMount"></div>'); }
  function bindTargets() { mount(); document.getElementById('targetDate').addEventListener('change',function () { table.refresh(); });
    var form=document.getElementById('targetForm'); if (form) { var dirty=GT.forms.trackDirty(form); form.addEventListener('submit',function (event) { event.preventDefault();
      try { GT.people.saveTarget(GT.forms.read(form,sections)); dirty.markSaved(); notice('Target saved.'); } catch (error) { GT.components.showToast(error.message,'error'); } }); } }
  function wagesPage() { var month=GT.dates.today().slice(0,7), summary=GT.people.paySummary(month);
    table=GT.dataTable.create({id:'wagesTable',caption:'Gross pay summary',rows:function () { return GT.people.paySummary(document.getElementById('wagesMonth')?.value||month).lines; },
      searchFields:['employee_name','pay_type'],columns:[{label:'Employee',field:'employee_name'},
        {label:'Pay type',field:'pay_type'},{label:'Salary',field:'basic_pay',align:'right',numeric:true,formatter:money},
        {label:'Piece pay',field:'piece_pay',align:'right',numeric:true,formatter:money},
        {label:'Gross',field:'gross_pay',align:'right',numeric:true,formatter:money}],
      emptyState:{message:'No pay lines for this month.'},exportName:'gross-pay-summary.csv'});
    ratesTable=GT.dataTable.create({id:'pieceRatesTable',caption:'Assumed piece rates',rows:function () { return GT.store.all('piece_rates'); },
      searchFields:['garment_type','task'],columns:[{label:'Garment',field:'garment_type',sortable:true},{label:'Task',field:'task',sortable:true},
        {label:'Rate per piece',field:'rate',align:'right',numeric:true,formatter:money},
        {label:'Source',field:'assumed',formatter:function () { return 'ASSUMED'; }}],
      emptyState:{message:'No piece rates are available.'},exportName:'assumed-piece-rates.csv'});
    return GT.components.pageHeader({title:'Wages',description:'Gross monthly pay only. NSSF and PAYE deductions remain an open question.',
      actions:[{label:'Print A4 summary',icon:'printer',name:'print',className:'btn-outline-secondary'}]})+
      panel('Monthly pay summary','<label class="form-label" for="wagesMonth">Month</label><input class="form-control people-period" id="wagesMonth" type="month" value="'+month+'">'+
        '<div id="wagesStatus"></div><div id="peopleTableMount"></div><div id="wagesTotal"></div>'+ 
        (GT.permissions.can('expenses','C')?'<div class="people-finalise"><label class="form-label" for="wagesMethod">Expense source</label><select class="form-select people-period" id="wagesMethod"><option value="cash">Cash</option><option value="bank">Bank</option></select><button class="btn btn-primary" id="finaliseWages" type="button">Finalise and request approval</button></div>':'')+'</div>')+
      panel('ASSUMED piece rates','<p>Illustrative garment and task rates pending owner confirmation (A-92).</p><div id="pieceRatesMount"></div>'); }
  function updateWages() { var summary=GT.people.paySummary(document.getElementById('wagesMonth').value);
    document.getElementById('wagesStatus').innerHTML=summary.run?'<p>Finalised · <a href="#/finance/expenses/'+summary.run.expense_id+'">Pending or decided Salaries expense</a></p>':
      summary.previousRun?'<p>Reopened after rejected <a href="#/finance/expenses/'+summary.previousRun.expense_id+'">Salaries expense</a>. Rates and logs can change before finalisation.</p>':
      '<p>Draft calculation · rates and logs can change until finalisation.</p>';
    document.getElementById('wagesTotal').innerHTML='<strong>Total gross: '+esc(money(summary.total))+'</strong><p>Deductions (NSSF and PAYE) are an open question.</p>';
    var button=document.getElementById('finaliseWages'); if (button) button.hidden=Boolean(summary.run)||!summary.total; }
  function printWages() { var summary=GT.people.paySummary(document.getElementById('wagesMonth').value);
    var body=GT.print.letterhead()+'<div class="print-document-heading"><h2>MONTHLY GROSS PAY SUMMARY</h2><span>'+esc(summary.month)+'</span></div>'+ 
      '<table class="people-print-table"><thead><tr><th>Employee</th><th>Pay type</th><th>Salary</th><th>Piece pay</th><th>Gross</th></tr></thead><tbody>'+summary.lines.map(function (line) {
        return '<tr><td>'+esc(line.employee_name)+'</td><td>'+esc(line.pay_type)+'</td><td>'+esc(money(line.basic_pay))+'</td><td>'+esc(money(line.piece_pay))+'</td><td>'+esc(money(line.gross_pay))+'</td></tr>'; }).join('')+
      '</tbody></table><div class="print-keep-together"><p><strong>Total gross: '+esc(money(summary.total))+'</strong></p><p>NSSF and PAYE deductions are an open question.</p></div>';
    GT.print.open(body,'Gross pay summary '+summary.month); }
  function bindWages() { mount(); ratesTable.mount('#pieceRatesMount'); updateWages(); document.getElementById('wagesMonth').addEventListener('change',function () { table.refresh(); updateWages(); });
    document.querySelector('[data-page-action="print"]').addEventListener('click',printWages);
    var button=document.getElementById('finaliseWages'); if (button) button.addEventListener('click',async function () {
      var month=document.getElementById('wagesMonth').value;
      if (!await GT.components.confirmDialog({title:'Finalise gross pay?',message:'This locks the month and creates one pending Salaries expense for Owner approval.',confirmText:'Finalise'})) return;
      try { GT.people.finalise(month,document.getElementById('wagesMethod').value); notice('Pay finalised and expense requested.'); }
      catch (error) { GT.components.showToast(error.message,'error'); } }); }
  var api={render:function (view,params) { table=null; ratesTable=null;
      if (view==='employees') return employeeList(); if (view==='employee_new'||view==='employee_edit') return employeeForm(params);
      if (view==='employee_detail') return employeeDetail(params); if (view==='attendance') return attendancePage();
      if (view==='production') return productionPage(); if (view==='targets') return targetsPage(); return wagesPage(); },
    bind:function (view,params) { if (view==='employees') bindEmployeeList(); else if (view==='employee_new'||view==='employee_edit') bindEmployeeForm(params);
      else if (view==='employee_detail') bindEmployeeDetail(params); else if (view==='attendance') bindAttendance();
      else if (view==='production') bindProduction(); else if (view==='targets') bindTargets(); else bindWages(); }};
  GT.router.register('#/people/employees',{module:api,view:'employees',title:'Employees',permission:'employees'});
  GT.router.register('#/people/employees/new',{module:api,view:'employee_new',title:'Add Employee',permission:'people_admin',action:'C',baseRoute:'#/people/employees'});
  GT.router.register('#/people/employees/:id/edit',{module:api,view:'employee_edit',title:'Edit Employee',permission:'people_admin',action:'E',baseRoute:'#/people/employees'});
  GT.router.register('#/people/employees/:id',{module:api,view:'employee_detail',title:'Employee',permission:'employees',baseRoute:'#/people/employees'});
  GT.router.register('#/people/attendance',{module:api,view:'attendance',title:'Attendance',permission:'employees'});
  GT.router.register('#/people/piece-rate-log',{module:api,view:'production',title:'Daily Production Log',permission:'employees'});
  GT.router.register('#/people/targets',{module:api,view:'targets',title:'Production Targets',permission:'employees'});
  GT.router.register('#/people/wages',{module:api,view:'wages',title:'Wages',permission:'wages'});
  return api;
}());
