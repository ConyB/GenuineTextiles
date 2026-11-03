/* Phase 17 people records and gross wages. All persistence uses GT.store. */
window.GT.people = (function () {
  var GT = window.GT;
  var roles = ['tailor','cutter','finisher','sales','cleaner','supervisor','knitter','embroidery'];
  var tasks = ['cut','sew','finish','knit','embroider'];
  var statuses = ['present','absent','late','leave'];
  function role() { var user=GT.session.currentUser(); return user && user.role; }
  function manager() { return role()==='owner' || role()==='general_manager'; }
  function moneyRole() { return manager() || role()==='accountant'; }
  function operational() { return manager() || role()==='workshop_supervisor'; }
  function canRead() { return moneyRole() || role()==='workshop_supervisor'; }
  function requireRead() { if (!canRead()) throw new Error('People access denied.'); }
  function requireWrite() { if (!manager()) throw new Error('Only Owner or General Manager may change employees.'); }
  function employee(id) { return GT.store.find('employees',id); }
  function validDay(day) { return /^\d{4}-\d{2}-\d{2}$/.test(String(day)) && GT.dates.addDays(day,0)===day && day<=GT.dates.today(); }
  function validMonth(month) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(month)); }
  function locked(month) { return GT.store.where('payroll_runs',{month:month}).some(function (run) { return run.status==='finalised'; }); }
  function employeeRows() { requireRead(); return GT.store.all('employees').map(function (row) {
    if (manager()) return row;
    var safe={id:row.id,name:row.name,role:row.role,active:row.active,date_joined:row.date_joined};
    if (role()==='accountant') { safe.pay_type=row.pay_type; safe.monthly_salary=row.monthly_salary; }
    return safe;
  }); }
  function validateEmployee(values) { var errors={};
    if (!String(values.name||'').trim()) errors.name='Enter a name.';
    if (roles.indexOf(values.role)<0) errors.role='Choose an employee role.';
    if (['salary','piece'].indexOf(values.pay_type)<0) errors.pay_type='Choose a pay type.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date_of_birth||'') || GT.dates.addDays(values.date_of_birth,0)!==values.date_of_birth || values.date_of_birth>=GT.dates.today()) errors.date_of_birth='Enter a valid birth date.';
    if (!validDay(values.date_joined)) errors.date_joined='Enter a valid joined date through today.';
    if (values.pay_type==='salary' && (!Number.isSafeInteger(Number(values.monthly_salary)) || Number(values.monthly_salary)<1)) errors.monthly_salary='Enter a positive whole UGX salary.';
    if (values.pay_type==='piece' && values.monthly_salary && Number(values.monthly_salary)!==0) errors.monthly_salary='Per-piece employees have no monthly salary.';
    return errors; }
  function saveEmployee(values,id) { requireWrite(); var errors=validateEmployee(values);
    if (Object.keys(errors).length) { var failure=new Error('Correct the employee fields.'); failure.fields=errors; throw failure; }
    var before=id?employee(id):null; if (id && !before) throw new Error('Employee unavailable.');
    var record={name:String(values.name).trim(),phone:String(values.phone||'').trim(),nin:String(values.nin||'').trim(),
      address:String(values.address||'').trim(),next_of_kin_name:String(values.next_of_kin_name||'').trim(),
      next_of_kin_phone:String(values.next_of_kin_phone||'').trim(),date_of_birth:values.date_of_birth,
      date_joined:values.date_joined,role:values.role,pay_type:values.pay_type,
      monthly_salary:values.pay_type==='salary'?Number(values.monthly_salary):0,active:before?before.active:true,
      date_left:before?before.date_left||null:null};
    var after=id?GT.store.update('employees',id,record):GT.store.create('employees',record);
    GT.audit.log(id?'update':'create','employees',after.id,before,after); return after; }
  function setActive(id,active) { requireWrite(); var before=employee(id); if (!before) throw new Error('Employee unavailable.');
    var after=GT.store.update('employees',id,{active:Boolean(active),date_left:active?null:GT.dates.today()}); GT.audit.log(active?'reactivate':'deactivate','employees',id,before,after); return after; }
  function attendanceSummary(month) { requireRead(); if (!validMonth(month)) throw new Error('Choose a valid month.');
    return GT.store.all('employees').map(function (person) { var result={employee_id:person.id,name:person.name,present:0,absent:0,late:0,leave:0};
      GT.store.where('attendance',function (row) { return row.employee_id===person.id && row.work_date.slice(0,7)===month; }).forEach(function (row) { if (statuses.indexOf(row.status)>=0) result[row.status]++; }); return result; }); }
  function takeAttendance(day,entries) { if (!operational()) throw new Error('Attendance entry denied.'); if (!validDay(day)) throw new Error('Choose a valid date through today.');
    if (locked(day.slice(0,7))) throw new Error('This month has finalised pay.');
    return GT.store.transaction(function () { entries.forEach(function (entry) { var person=employee(entry.employee_id);
      if (!person || !person.active || statuses.indexOf(entry.status)<0) throw new Error('Choose an active employee and valid attendance status.');
      var before=GT.store.where('attendance',{employee_id:person.id,work_date:day})[0];
      var after=before?GT.store.update('attendance',before.id,{status:entry.status}):GT.store.create('attendance',{employee_id:person.id,work_date:day,status:entry.status});
      GT.audit.log(before?'update':'create','attendance',after.id,before||null,after);
    }); }); }
  function orderItems() { requireRead(); var orders=GT.store.all('orders'), variants=GT.store.all('product_variants'), products=GT.store.all('products');
    return GT.store.all('order_items').map(function (item) { var order=orders.find(function (row) { return row.id===item.order_id; });
      if (!order || order.status==='draft' || order.status==='cancelled') return null;
      var label=order.is_for_stock?'Stock order '+(order.number||order.id):'Order '+(order.number||order.id);
      if (order.is_for_stock) { var variant=variants.find(function (row) { return row.id===order.product_variant_id; }); var product=variant&&products.find(function (row) { return row.id===variant.product_id; }); if (product) label+=' · '+product.name; }
      return {id:item.id,order_id:order.id,label:label+' · '+item.description,quantity:Number(item.quantity),description:item.description};
    }).filter(Boolean); }
  function pieceRate(garment,task) { return GT.store.where('piece_rates',{garment_type:garment,task:task})[0]||null; }
  function productionQuantityWarning(values) {
    // A-93: several employees may log the same item, so compare one task's cumulative pieces without capping pay.
    var item=orderItems().find(function (row) { return row.id===Number(values.order_item_id); });
    var count=Number(values.quantity);
    if (!item || tasks.indexOf(values.task)<0 || !Number.isSafeInteger(count) || count<1) return '';
    var logged=GT.store.where('production_logs',function (row) {
      return row.order_item_id===item.id && row.task===values.task;
    }).reduce(function (sum,row) { return sum+Number(row.quantity); },0);
    return logged+count>item.quantity ? 'This task will have '+(logged+count)+' logged pieces for '+item.quantity+' ordered. Review the quantity; logging is still allowed (A-93).' : '';
  }
  function productionRows() { requireRead(); var items=orderItems(), employees=GT.store.all('employees');
    return GT.store.all('production_logs').map(function (row) { var person=employees.find(function (item) { return item.id===row.employee_id; }); var item=items.find(function (entry) { return entry.id===row.order_item_id; });
      var safe={id:row.id,work_date:row.work_date,employee_id:row.employee_id,employee_name:person?person.name:'Unknown',order_item_id:row.order_item_id,
        order_label:item?item.label:'Order item '+row.order_item_id,task:row.task,garment_type:row.garment_type,quantity:row.quantity};
      if (moneyRole()) { safe.piece_rate=row.piece_rate; safe.amount=row.amount; } return safe;
    }).sort(function (a,b) { return b.work_date.localeCompare(a.work_date)||b.id-a.id; }); }
  function logProduction(values) { if (!operational()) throw new Error('Production entry denied.'); var person=employee(values.employee_id), item=orderItems().find(function (row) { return row.id===Number(values.order_item_id); });
    var count=Number(values.quantity), rate=pieceRate(values.garment_type,values.task);
    if (!validDay(values.work_date) || !person || !person.active || !item || tasks.indexOf(values.task)<0 || !rate || !Number.isSafeInteger(count) || count<1) throw new Error('Choose a date, active employee, order item, task, rate and positive whole quantity.');
    if (locked(values.work_date.slice(0,7))) throw new Error('This month has finalised pay.');
    // BUSINESS_RULES.md section 11, A-12: piece earnings use the garment/task rate snapshot.
    var row=GT.store.create('production_logs',{work_date:values.work_date,employee_id:person.id,order_item_id:item.id,
      garment_type:values.garment_type,task:values.task,quantity:count,piece_rate:rate.rate,amount:count*rate.rate});
    GT.audit.log('create','production_logs',row.id,null,row); return row; }
  function logQuality(values) { if (!operational()) throw new Error('Quality entry denied.'); var person=employee(values.employee_id);
    if (!person || !orderItems().some(function (item) { return item.id===Number(values.order_item_id); }) || !String(values.description||'').trim()) throw new Error('Choose an employee, order item and description.');
    var row=GT.store.create('quality_issues',{order_item_id:Number(values.order_item_id),employee_id:person.id,description:String(values.description).trim(),
      rework_needed:Boolean(values.rework_needed),logged_by:GT.session.currentUser().id,logged_at:new Date().toISOString()});
    GT.audit.log('create','quality_issues',row.id,null,row); return row; }
  function qualityRows() { requireRead(); return GT.store.all('quality_issues'); }
  function targetRows(day) { requireRead(); var start=GT.dates.startOfWeek(day), end=GT.dates.addDays(start,6);
    return GT.store.all('production_targets').map(function (row) { var actual=GT.store.where('production_logs',function (log) {
      return log.task===row.section && (row.period==='daily'?log.work_date===day:log.work_date>=start&&log.work_date<=end);
    }).reduce(function (sum,log) { return sum+Number(log.quantity); },0);
      return {id:row.id,section:row.section,period:row.period,target_quantity:row.target_quantity,actual:actual,difference:actual-Number(row.target_quantity)}; }); }
  function saveTarget(values) { if (!manager()) throw new Error('Only Owner or General Manager may set targets.'); var count=Number(values.target_quantity);
    if (tasks.indexOf(values.section)<0 || ['daily','weekly'].indexOf(values.period)<0 || !Number.isSafeInteger(count) || count<1) throw new Error('Choose a section, period and positive whole target.');
    var before=GT.store.where('production_targets',{section:values.section,period:values.period})[0];
    var after=before?GT.store.update('production_targets',before.id,{target_quantity:count}):GT.store.create('production_targets',{section:values.section,period:values.period,target_quantity:count});
    GT.audit.log(before?'update':'create','production_targets',after.id,before||null,after); return after; }
  function paySummary(month) { if (!moneyRole()) throw new Error('Pay access denied.'); if (!validMonth(month)) throw new Error('Choose a valid month.');
    var runs=GT.store.where('payroll_runs',{month:month}), run=runs.find(function (row) { return row.status==='finalised'; });
    var previousRun=runs.filter(function (row) { return row.status==='reopened'; }).slice(-1)[0]||null;
    var lines=run&&run.status==='finalised'?GT.store.where('payroll_lines',{payroll_run_id:run.id}):GT.store.all('employees').filter(function (person) {
      return person.date_joined.slice(0,7)<=month && (!person.date_left || person.date_left.slice(0,7)>=month);
    }).map(function (person) {
      var pieces=GT.store.where('production_logs',function (log) { return log.employee_id===person.id && log.work_date.slice(0,7)===month; });
      var basic=person.pay_type==='salary'?Number(person.monthly_salary||0):0;
      var piece=person.pay_type==='piece'?pieces.reduce(function (sum,log) { return sum+Number(log.quantity)*Number(log.piece_rate); },0):0;
      return {employee_id:person.id,basic_pay:basic,piece_pay:piece,allowances:0,gross_pay:basic+piece};
    });
    var people=GT.store.all('employees'); return {month:month,run:run,previousRun:previousRun,lines:lines.map(function (line) { var person=people.find(function (row) { return row.id===line.employee_id; });
      return Object.assign({},line,{employee_name:person?person.name:'Unknown',pay_type:person?person.pay_type:''}); }),total:lines.reduce(function (sum,line) { return sum+Number(line.gross_pay); },0)}; }
  function finalise(month,paymentMethod) { if (!moneyRole() || !GT.permissions.can('expenses','C')) throw new Error('Pay finalisation denied.');
    if (!validMonth(month) || month>GT.dates.today().slice(0,7)) throw new Error('Choose a current or past month.');
    if (locked(month)) throw new Error('This month is already finalised.');
    if (['cash','bank'].indexOf(paymentMethod)<0) throw new Error('Choose cash or bank for the expense request.');
    var summary=paySummary(month); if (!summary.total) throw new Error('There is no pay to finalise.');
    var category=GT.store.where('expense_categories',function (row) { return row.name.toLowerCase()==='salaries'; })[0];
    if (!category) throw new Error('Salaries expense category is missing.');
    return GT.store.transaction(function () {
      // BUSINESS_RULES.md section 12, A-08 and A-83: one pending expense follows existing Owner approval.
      var expense=GT.expenses.save({expense_date:GT.dates.today(),category_id:category.id,amount:summary.total,
        payee:'Workshop payroll',payment_method:paymentMethod,description:'Gross wages for '+month},true);
      var run=GT.store.create('payroll_runs',{month:month,status:'finalised',expense_id:expense.id,finalised_by:GT.session.currentUser().id,finalised_at:new Date().toISOString()});
      summary.lines.forEach(function (line) { GT.store.create('payroll_lines',{payroll_run_id:run.id,employee_id:line.employee_id,
        basic_pay:line.basic_pay,piece_pay:line.piece_pay,allowances:0,gross_pay:line.gross_pay}); });
      GT.audit.log('finalise','payroll_runs',run.id,null,run); return run;
    }); }
  function reopenRejectedExpense(expenseId) {
    if (role()!=='owner' || (GT.store.find('expenses',expenseId)||{}).status!=='rejected') throw new Error('Only an Owner-rejected Salaries expense can reopen pay.');
    var run=GT.store.where('payroll_runs',function (row) { return row.expense_id===Number(expenseId) && row.status==='finalised'; })[0];
    if (!run) return null;
    // A-101: rejection leaves the expense and pay snapshot in history, but unlocks the month for correction.
    var after=GT.store.update('payroll_runs',run.id,{status:'reopened',reopened_by:GT.session.currentUser().id,reopened_at:new Date().toISOString()});
    GT.audit.log('reopen','payroll_runs',run.id,run,after); return after;
  }
  return {roles:roles,tasks:tasks,statuses:statuses,manager:manager,moneyRole:moneyRole,operational:operational,
    employeeRows:employeeRows,validateEmployee:validateEmployee,saveEmployee:saveEmployee,setActive:setActive,
    attendanceSummary:attendanceSummary,takeAttendance:takeAttendance,orderItems:orderItems,pieceRate:pieceRate,
    productionRows:productionRows,productionQuantityWarning:productionQuantityWarning,logProduction:logProduction,logQuality:logQuality,qualityRows:qualityRows,
    targetRows:targetRows,saveTarget:saveTarget,paySummary:paySummary,finalise:finalise,reopenRejectedExpense:reopenRejectedExpense};
}());
