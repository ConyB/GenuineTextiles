const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

async function start(page, role='owner', route='#/people/employees') {
  await page.goto('/login.html?today=2026-10-28');
  await page.evaluate(selected => { GT.store.reset(); GT.session.loginAsRole(selected); }, role);
  await page.goto('/index.html?today=2026-10-28'+route);
}

test('People routes and sensitive fields respect each role', async ({ page }) => {
  await start(page,'owner','#/people/employees/1');
  await expect(page.locator('#pageContent')).toContainText('PROTO-NIN-001');
  await expect(page.locator('#pageContent')).toContainText('Per piece');
  await start(page,'general_manager','#/people/employees/1');
  await expect(page.locator('#pageContent')).toContainText('PROTO-NIN-001');
  await start(page,'accountant','#/people/employees/18');
  await expect(page.locator('#pageContent')).toContainText('UGX 900,000');
  await expect(page.locator('#pageContent')).not.toContainText('PROTO-NIN');
  await page.goto('/index.html#/people/wages');
  await expect(page.locator('#pieceRatesMount')).toContainText('UGX 2,400');
  await expect(page.locator('#pieceRatesMount')).toContainText('ASSUMED');
  await start(page,'workshop_supervisor','#/people/employees/1');
  const text=await page.locator('#pageContent').innerText();
  expect(text).not.toMatch(/\b(?:UGX|NIN|Phone|pay|rate|salary)\b|Next of kin/i);
  await page.goto('/index.html#/people/wages');
  await expect(page.locator('h1')).toHaveText('Access denied');
  await page.goto('/index.html#/people/employees/1/edit');
  await expect(page.locator('h1')).toHaveText('Access denied');
  await page.goto('/index.html#/people/piece-rate-log');
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export CSV'}).click();
  const exportText=fs.readFileSync(await (await downloadPromise).path(),'utf8');
  expect(exportText).not.toMatch(/\b(?:UGX|rate|pay|amount|salary)\b|NIN|Next of kin|Phone/i);
  for (const role of ['store_keeper','sales','marketing_manager']) {
    await start(page,role,'#/people/attendance');
    await expect(page.locator('h1')).toHaveText('Access denied');
    await expect(page.locator('#appSidebar [href^="#/people/"]')).toHaveCount(0);
  }
});

test('Employee create, edit and deactivate preserve the record', async ({ page }) => {
  await start(page,'owner','#/people/employees/new');
  await page.locator('#employeeForm [name="name"]').fill('Amina Test');
  await page.locator('#employeeForm [name="nin"]').fill('PROTO-NIN-999');
  await page.locator('#employeeForm [name="date_of_birth"]').fill('1995-02-12');
  await page.locator('#employeeForm [name="date_joined"]').fill('2026-10-01');
  await page.locator('#employeeForm [name="role"]').selectOption('tailor');
  await page.locator('#employeeForm [name="pay_type"]').selectOption('piece');
  await page.locator('#employeeForm [name="monthly_salary"]').fill('0');
  await page.locator('#employeeForm button[type="submit"]').click();
  await expect(page.locator('h1')).toHaveText('Amina Test');
  const id=await page.evaluate(() => GT.store.all('employees').find(e => e.name==='Amina Test').id);
  await page.goto('/index.html#/people/employees/'+id+'/edit');
  await page.locator('#employeeForm [name="name"]').fill('Amina Tailor');
  await page.locator('#employeeForm button[type="submit"]').click();
  await expect(page.locator('h1')).toHaveText('Amina Tailor');
  await page.getByRole('button',{name:'Deactivate'}).click();
  await page.getByRole('button',{name:'Deactivate',exact:true}).last().click();
  await expect(page.locator('#pageContent')).toContainText('Inactive');
  expect(await page.evaluate(id => GT.store.find('employees',id).active,id)).toBe(false);
});

test('Attendance daily upsert and monthly summary count known statuses', async ({ page }) => {
  await start(page,'workshop_supervisor','#/people/attendance');
  const seed=await page.evaluate(() => GT.people.attendanceSummary('2026-10').find(r => r.employee_id===1));
  expect(seed).toMatchObject({present:11,late:1,absent:0,leave:0});
  await page.locator('#attendanceForm [name="work_date"]').fill('2026-10-28');
  await page.locator('#attendanceForm [name="employee_id"]').selectOption('1');
  await page.locator('#attendanceForm [name="status"]').selectOption('present');
  await page.locator('#attendanceForm button[type="submit"]').click();
  expect(await page.evaluate(() => GT.people.attendanceSummary('2026-10').find(r => r.employee_id===1).present)).toBe(12);
  await page.locator('#attendanceForm [name="work_date"]').fill('2026-10-28');
  await page.locator('#attendanceForm [name="employee_id"]').selectOption('1');
  await page.locator('#attendanceForm [name="status"]').selectOption('leave');
  await page.locator('#attendanceForm button[type="submit"]').click();
  expect(await page.evaluate(() => GT.people.attendanceSummary('2026-10').find(r => r.employee_id===1))).toMatchObject({present:11,leave:1});
});

test('Production log links an order item, snapshots rate, records quality and updates targets', async ({ page }) => {
  await start(page,'workshop_supervisor','#/people/piece-rate-log');
  const first=await page.locator('#productionForm [name="order_item_id"] option').nth(1).getAttribute('value');
  await page.locator('#productionForm [name="work_date"]').fill('2026-10-28');
  await page.locator('#productionForm [name="employee_id"]').selectOption('1');
  await page.locator('#productionForm [name="order_item_id"]').selectOption(first);
  await page.locator('#productionForm [name="garment_type"]').selectOption('Shirt');
  await page.locator('#productionForm [name="task"]').selectOption('sew');
  await page.locator('#productionForm [name="quantity"]').fill('5');
  await page.locator('#productionForm button[type="submit"]').click();
  const log=await page.evaluate(() => GT.store.all('production_logs').at(-1));
  expect(log).toMatchObject({employee_id:1,order_item_id:Number(first),quantity:5,piece_rate:2400,amount:12000});
  expect(await page.locator('#pageContent').innerText()).not.toMatch(/\b(?:UGX|rate|pay|amount|salary)\b/i);
  await page.locator('#qualityForm [name="employee_id"]').selectOption('1');
  await page.locator('#qualityForm [name="order_item_id"]').selectOption(first);
  await page.locator('#qualityForm [name="description"]').fill('Hem needs rework');
  await page.locator('#qualityForm [name="rework_needed"]').check();
  await page.locator('#qualityForm button[type="submit"]').click();
  expect(await page.evaluate(() => GT.store.all('quality_issues').at(-1).rework_needed)).toBe(true);
  await page.goto('/index.html#/people/targets');
  const actual=await page.evaluate(() => GT.people.targetRows('2026-10-28').find(r => r.section==='sew'&&r.period==='daily').actual);
  expect(actual).toBe(5);
  await expect(page.locator('#targetForm')).toHaveCount(0);
});

test('Stock production order items can be logged without changing order logic', async ({ page }) => {
  await start(page,'owner','#/people/piece-rate-log');
  const item=await page.evaluate(() => { const order=GT.finishedGoods.createStockOrder(1,10,'2026-10-30'); return GT.store.where('order_items',{order_id:order.id})[0]; });
  await page.reload();
  await expect(page.locator('#productionForm [name="order_item_id"]')).toContainText('Stock order');
  await page.evaluate(id => GT.people.logProduction({work_date:'2026-10-28',employee_id:1,order_item_id:id,garment_type:'Shirt',task:'sew',quantity:2}),item.id);
  expect(await page.evaluate(id => GT.store.find('order_items',id).quantity,item.id)).toBe(10);
});

test('Production over the ordered quantity warns but still records pieces', async ({ page }) => {
  await start(page,'workshop_supervisor','#/people/piece-rate-log');
  const item=await page.locator('#productionForm [name="order_item_id"] option').nth(1).getAttribute('value');
  const ordered=await page.evaluate(id => GT.store.find('order_items',Number(id)).quantity,item);
  await page.locator('#productionForm [name="employee_id"]').selectOption('1');
  await page.locator('#productionForm [name="order_item_id"]').selectOption(item);
  await page.locator('#productionForm [name="garment_type"]').selectOption('Shirt');
  await page.locator('#productionForm [name="task"]').selectOption('sew');
  await page.locator('#productionForm [name="quantity"]').fill(String(ordered+1));
  await expect(page.locator('#productionQuantityWarning')).toContainText('logged pieces for '+ordered+' ordered');
  await page.locator('#productionForm button[type="submit"]').click();
  await expect(page.locator('.gt-toast.warning')).toContainText('logged pieces for '+ordered+' ordered');
  expect(await page.evaluate(id => GT.store.all('production_logs').at(-1).order_item_id===Number(id),item)).toBe(true);
});

test('Both production forms warn before abandoning unsaved work', async ({ page }) => {
  await start(page,'workshop_supervisor','#/people/piece-rate-log');
  page.on('dialog',dialog => dialog.dismiss());
  await page.locator('#qualityForm [name="description"]').fill('Unfinished seam');
  await page.evaluate(() => { location.hash='#/people/targets'; });
  await expect(page.locator('h1')).toHaveText('Daily Production Log');
  const workPage=await page.context().newPage();
  await start(workPage,'workshop_supervisor','#/people/piece-rate-log');
  workPage.on('dialog',dialog => dialog.dismiss());
  await workPage.locator('#productionForm [name="quantity"]').fill('4');
  await workPage.evaluate(() => { location.hash='#/people/targets'; });
  await expect(workPage.locator('h1')).toHaveText('Daily Production Log');
  await workPage.close();
});

test('Known salary and piece gross, one pending Salaries expense and Owner approval', async ({ page }) => {
  await start(page,'accountant','#/people/wages');
  const summary=await page.evaluate(() => GT.people.paySummary('2026-10'));
  expect(summary.lines.find(r => r.employee_id===18)).toMatchObject({basic_pay:900000,piece_pay:0,gross_pay:900000});
  expect(summary.lines.find(r => r.employee_id===1)).toMatchObject({basic_pay:0,piece_pay:43200,gross_pay:43200});
  await page.locator('#wagesMethod').selectOption('bank');
  await page.locator('#finaliseWages').click();
  await page.getByRole('button',{name:'Finalise',exact:true}).click();
  const state=await page.evaluate(() => { const run=GT.store.where('payroll_runs',{month:'2026-10'})[0]; const expense=GT.store.find('expenses',run.expense_id); return {run,expense,cash:GT.store.where('ledger_entries',r => r.reference_type==='expense'&&r.reference_id===expense.id).length}; });
  expect(state.expense).toMatchObject({status:'pending',category_id:4,payment_method:'bank',voucher_number:null,amount:summary.total});
  expect(state.cash).toBe(0);
  expect(await page.evaluate(() => GT.store.where('expenses',e => e.description==='Gross wages for 2026-10').length)).toBe(1);
  await expect(page.locator('#finaliseWages')).toBeHidden();
  await page.evaluate(() => GT.session.loginAsRole('owner'));
  await page.reload();
  expect(await page.evaluate(() => { try { GT.people.takeAttendance('2026-10-28',[{employee_id:1,status:'present'}]); return false; } catch (error) { return /finalised/.test(error.message); } })).toBe(true);
  await page.evaluate(id => GT.expenses.decide(id,true,''),state.expense.id);
  expect(await page.evaluate(id => GT.store.find('expenses',id).status,state.expense.id)).toBe('approved');
  expect(await page.evaluate(id => GT.store.where('ledger_entries',r => r.reference_type==='expense'&&r.reference_id===id).length,state.expense.id)).toBe(1);
});

test('Rejected Salaries expense reopens the month and keeps its pay history', async ({ page }) => {
  await start(page,'accountant','#/people/wages');
  const first=await page.evaluate(() => GT.people.finalise('2026-10','bank'));
  const originalLines=await page.evaluate(id => GT.store.where('payroll_lines',{payroll_run_id:id}).length,first.id);
  await page.evaluate(() => GT.session.loginAsRole('owner'));
  await page.evaluate(id => GT.expenses.decide(id,false,'Correct the piece count'),first.expense_id);
  const reopened=await page.evaluate(id => ({run:GT.store.find('payroll_runs',id),expense:GT.store.find('expenses',GT.store.find('payroll_runs',id).expense_id),
    lines:GT.store.where('payroll_lines',{payroll_run_id:id}).length,summary:GT.people.paySummary('2026-10'),
    ledger:GT.store.where('ledger_entries',{reference_type:'expense',reference_id:GT.store.find('payroll_runs',id).expense_id}).length}),first.id);
  expect(reopened.run.status).toBe('reopened');
  expect(reopened.expense.status).toBe('rejected');
  expect(reopened.lines).toBe(originalLines);
  expect(reopened.summary.run).toBeUndefined();
  expect(reopened.ledger).toBe(0);
  const item=await page.evaluate(() => GT.people.orderItems()[0].id);
  await page.evaluate(id => GT.people.logProduction({work_date:'2026-10-28',employee_id:1,order_item_id:id,garment_type:'Shirt',task:'sew',quantity:1}),item);
  await page.reload();
  await expect(page.locator('#wagesStatus')).toContainText('Reopened after rejected');
  await expect(page.locator('#finaliseWages')).toBeVisible();
  const second=await page.evaluate(() => GT.people.finalise('2026-10','bank'));
  expect(second.id).not.toBe(first.id);
  expect(await page.evaluate(() => GT.store.where('payroll_runs',{month:'2026-10'}).length)).toBe(2);
});

test('Targets edit, empty production state, 360px and A4 gross report', async ({ page }) => {
  await start(page,'owner','#/people/targets');
  await page.locator('#targetForm [name="section"]').selectOption('sew');
  await page.locator('#targetForm [name="period"]').selectOption('daily');
  await page.locator('#targetForm [name="target_quantity"]').fill('20');
  await page.locator('#targetForm button[type="submit"]').click();
  expect(await page.evaluate(() => GT.people.targetRows('2026-10-28').find(r => r.section==='sew'&&r.period==='daily').target_quantity)).toBe(20);
  await page.setViewportSize({width:360,height:800});
  for (const route of ['#/people/employees','#/people/attendance','#/people/piece-rate-log','#/people/targets','#/people/wages']) {
    await page.goto('/index.html'+route);
    expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1),route).toBe(true);
  }
  await page.getByRole('button',{name:'Print A4 summary'}).click();
  await expect(page.locator('.print-page')).toContainText('MONTHLY GROSS PAY SUMMARY');
  await expect(page.locator('.print-page')).toContainText('NSSF and PAYE');
  await expect(page.locator('.print-page')).not.toContainText('No.');
  const pdf=await page.pdf({format:'A4',printBackground:true});
  expect(pdf.length).toBeGreaterThan(1000);
  await page.locator('[data-print-back]').click();
  await page.goto('/index.html#/people/piece-rate-log');
  await page.evaluate(() => GT.store.reset());
  await page.locator('[data-table-search]').fill('zzzz-no-entry');
  await expect(page.locator('#peopleTableMount')).toContainText('No production entries match these filters.');
});
