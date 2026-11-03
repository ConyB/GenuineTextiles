// Phase 10 debtor, reminder, ageing and statement journeys.
const { test, expect } = require('@playwright/test');

async function login(page, role='owner', route='#/debtors') {
  await page.goto('/login.html?today=2026-10-26');
  await page.evaluate((wanted) => { GT.store.reset(); GT.session.loginAsRole(wanted); }, role);
  await page.goto('/index.html?today=2026-10-26'+route);
}

test('debtor balances, filters, detail and mobile layout', async ({ page }) => {
  await login(page);
  await expect(page.locator('#debtorsTable tbody tr')).toHaveCount(13);
  await expect(page.locator('#debtorStats .stat-card-value').nth(2)).toHaveText('13');
  await expect(page.locator('#appSidebar a[href="#/debtors"] .nav-count-badge')).toHaveText('8');
  await expect(page.locator('#debtorsTable')).toContainText('Pearl Dairy Farms');
  await expect(page.locator('#debtorsTable')).toContainText('Unity Gate College');
  await page.waitForFunction(() => !!document.querySelector('#debtorStats .stat-card-icon svg'));
  await page.screenshot({path:'tests/screenshots/phase10-debtors-list.png',fullPage:true});
  await page.locator('#debtorStats .stat-card').nth(1).click();
  await expect(page.locator('#debtorsTable tbody tr')).toHaveCount(8);
  await page.locator('#debtorStats .stat-card').nth(0).click();
  await page.locator('[data-table-filter="age"]').selectOption('b61_plus');
  await expect(page.locator('#debtorsTable tbody tr').count()).resolves.toBeGreaterThan(0);
  await page.goto('/index.html?today=2026-10-26#/debtors/1');
  await expect(page.locator('#pageContent h1')).toHaveText('Pearl Dairy Farms');
  await expect(page.locator('#debtorOpenMount .shared-data-table')).toContainText('640');
  await page.screenshot({path:'tests/screenshots/phase10-debtor-detail.png',fullPage:true});
  await page.setViewportSize({width:360,height:800});
  await page.goto('/index.html?today=2026-10-26#/debtors');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1)).toBeTruthy();
  await page.screenshot({path:'tests/screenshots/phase10-debtors-360.png',fullPage:true});
});

test('simulated reminder, spacing gate, call and bulk preview', async ({ page }) => {
  await login(page,'accountant');
  const before=await page.evaluate(() => ({reminders:GT.store.count('debt_reminders'),messages:GT.store.count('messages'),sms:GT.debtors.smsCountThisMonth()}));
  await page.locator('#debtorsTable tr[data-record-id="13"] [aria-label="Remind"]').click();
  await expect(page.locator('#reminderText')).toHaveValue(/Acacia Heights Academy/);
  await page.screenshot({path:'tests/screenshots/phase10-reminder-modal.png'});
  await page.locator('#reminderSend').click();
  await expect.poll(() => page.evaluate(() => GT.store.count('debt_reminders'))).toBe(before.reminders+1);
  expect(await page.evaluate(() => GT.store.count('messages'))).toBe(before.messages+1);
  expect(await page.evaluate(() => GT.debtors.smsCountThisMonth())).toBeGreaterThan(before.sms);
  await page.locator('#debtorsTable tr[data-record-id="13"] [aria-label="Remind"]').click();
  await expect(page.locator('#reminderSend')).toBeDisabled();
  await page.evaluate(() => GT.session.loginAsRole('general_manager'));
  await page.reload();
  await page.locator('#debtorsTable tr[data-record-id="13"] [aria-label="Remind"]').click();
  await expect(page.locator('#reminderOverride')).toBeVisible();
  await page.locator('#reminderReason').fill('Customer requested another copy');
  await page.locator('#reminderSend').click();
  await page.getByRole('button',{name:'Send reminder',exact:true}).last().click();
  await expect.poll(() => page.evaluate(() => GT.store.count('debt_reminders'))).toBe(before.reminders+2);
  await page.goto('/index.html?today=2026-10-26#/reminders');
  await expect(page.locator('#remindersTable')).toContainText('Acacia Heights Academy');
  await page.screenshot({path:'tests/screenshots/phase10-reminders.png',fullPage:true});
  await page.locator('[data-page-action="bulk"]').click();
  await expect(page.locator('#bulkCount')).toContainText('Total SMS segments:');
  await expect(page.locator('#bulkCustomers [data-bulk-id]')).not.toHaveCount(0);
  const selected=await page.locator('#bulkCustomers [data-bulk-id]:checked').count();
  const bulkBefore=await page.evaluate(() => GT.store.count('debt_reminders'));
  await page.locator('#bulkSend').click();
  await expect.poll(() => page.evaluate(() => GT.store.count('debt_reminders'))).toBe(bulkBefore+selected);
});

test('ageing report and Pearl statement print and void', async ({ page }) => {
  await login(page,'general_manager','#/ageing');
  await expect(page.locator('#ageingSummary .stat-card')).toHaveCount(3);
  const totals=await page.evaluate(() => GT.debtors.ageingTotals());
  await expect(page.locator('#ageingTable tfoot')).toContainText(GTMoney(totals.total));
  await page.screenshot({path:'tests/screenshots/phase10-ageing.png',fullPage:true});
  await page.locator('[data-page-action="print"]').click();
  await expect(page.locator('.print-preview-shell.print-landscape')).toBeVisible();
  await page.locator('[data-print-back]').click();
  await page.goto('/index.html?today=2026-10-26#/statements/new?customer=1');
  await expect(page.locator('#statementLivePage')).toContainText('1253652875875');
  await page.locator('#statementForm [name="statement_date"]').fill('2026-05-25');
  await page.locator('[data-statement-date]').first().fill('2026-05-05');
  await page.locator('[data-statement-particulars]').first().fill('400 pcs of Rain Coats');
  await page.screenshot({path:'tests/screenshots/phase10-statement-form.png',fullPage:true});
  await page.locator('#statementSavePrint').click();
  await expect(page.locator('.print-preview-shell')).toBeVisible();
  await expect(page.locator('.print-preview-shell')).toContainText('21,240,000');
  await page.screenshot({path:'tests/screenshots/phase10-pearl-print.png'});
  await page.locator('.print-preview-shell .print-page').screenshot({path:'tests/screenshots/phase10-pearl-letter.png'});
  await page.locator('[data-print-back]').click();
  await page.locator('[data-page-action="void"]').click();
  await page.locator('#statementVoidReason').fill('Corrected delivery date');
  await page.locator('#statementVoidSave').click();
  await page.getByRole('button',{name:'Void',exact:true}).last().click();
  await expect(page.locator('.statement-detail-page')).toContainText('VOID');
});

function GTMoney(value) { return 'UGX '+Number(value).toLocaleString('en-US'); }

test('a full payment removes a debtor and updates the badge', async ({ page }) => {
  await login(page,'owner');
  await page.locator('#debtorsTable tr[data-record-id="13"] [aria-label="More actions"]').click();
  await page.getByRole('menuitem',{name:'Record payment'}).click();
  await expect(page.locator('#receiptForm [name="customer_id"]')).toHaveValue('13');
  const invoice=await page.evaluate(() => GT.debtors.openInvoices(13)[0]);
  await page.locator('#receiptForm [name="invoice_id"]').selectOption(String(invoice.id));
  await page.locator('#receiptForm [name="amount"]').fill(String(invoice.balance));
  await page.locator('#receiptForm button[type="submit"]').click();
  await expect.poll(() => page.evaluate(() => GT.debtors.list().length)).toBe(12);
  await page.goto('/index.html?today=2026-10-26#/debtors');
  await expect(page.locator('#debtorStats .stat-card-value').nth(2)).toHaveText('12');
  await expect(page.locator('#appSidebar a[href="#/debtors"] .nav-count-badge')).toHaveText('7');
});

test('logged call shows pending and missed promise states', async ({ page }) => {
  await login(page,'general_manager');
  await page.locator('#debtorsTable tr[data-record-id="13"] [aria-label="More actions"]').click();
  await page.getByRole('menuitem',{name:'Log a call'}).click();
  // Keep the simulated call inside this test's 26 Oct as-at date as the real calendar advances.
  await page.locator('#callAt').fill('2026-10-26T11:00');
  await page.locator('#callOutcome').selectOption('promised');
  await page.locator('#promiseDate').fill('2026-11-05');
  await page.locator('#promiseAmount').fill('500000');
  await page.locator('#callNotes').fill('Promised a bank transfer.');
  await page.locator('#saveCall').click();
  await expect(page.locator('#debtorsTable tr[data-record-id="13"]')).toContainText('Promise to pay 5 Nov');
  expect(await page.evaluate(() => GT.debtors.promiseStatus(13,'2026-11-06').status)).toBe('missed');
});

test('owner reminder actions and receipt-based promise result', async ({ page }) => {
  await login(page,'owner');
  const row=page.locator('#debtorsTable tr[data-record-id="13"]');
  await expect(row.locator('[aria-label="Remind"]')).toHaveCount(1);
  await row.locator('[aria-label="More actions"]').click();
  await expect(page.getByRole('menuitem').first()).toHaveText('View');
  await page.getByRole('menuitem',{name:'Log a call'}).click();
  await expect(page.locator('#callOutcome')).toBeVisible();
  await page.locator('#callAt').fill('2026-10-26T11:00');
  await page.locator('#callOutcome').selectOption('other');
  await page.locator('#saveCall').click();
  await page.goto('/index.html?today=2026-10-26#/reminders');
  await expect(page.locator('[data-page-action="bulk"]')).toBeVisible();
  await page.locator('[data-page-action="bulk"]').click();
  await expect(page.locator('#bulkCustomers')).toBeVisible();

  const result=await page.evaluate(() => {
    const before=GT.debtors.promiseStatus(2,'2026-10-26').status;
    const invoice=GT.store.create('sales_documents',{type:'invoice',customer_id:2,status:'issued',total:900000,issue_date:'2026-10-22'});
    const afterInvoice=GT.debtors.promiseStatus(2,'2026-10-26').status;
    const receipt=GT.store.create('receipts',{customer_id:2,invoice_id:invoice.id,amount:500000,status:'issued',received_at:'2026-10-21T11:00:00+03:00'});
    const afterReceipt=GT.debtors.promiseStatus(2,'2026-10-26').status;
    GT.store.update('receipts',receipt.id,{status:'void'});
    return {before,afterInvoice,afterReceipt,afterVoid:GT.debtors.promiseStatus(2,'2026-10-26').status};
  });
  expect(result).toEqual({before:'missed',afterInvoice:'missed',afterReceipt:'kept',afterVoid:'missed'});
});

test('role permissions and five Phase 10 routes at 360px', async ({ page }) => {
  for (const role of ['sales','store_keeper','workshop_supervisor','marketing_manager']) {
    await login(page,role);
    await expect(page.locator('#pageContent')).toContainText('Access denied');
    await expect(page.locator('#appSidebar a[href="#/debtors"]')).toHaveCount(0);
  }
  await login(page,'accountant','#/statements');
  await expect(page.locator('[data-page-action="void"]')).toHaveCount(0);
  await page.setViewportSize({width:360,height:800});
  for (const route of ['#/debtors','#/debtors/1','#/reminders','#/ageing','#/statements','#/statements/new?customer=1']) {
    await page.goto('/index.html?today=2026-10-26'+route);
    await expect(page.locator('#pageContent h1')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1),route).toBeTruthy();
  }
});
