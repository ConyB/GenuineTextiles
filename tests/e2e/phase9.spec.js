// Phase 9 receipt lifecycle, roles, print and mobile checks.
const { test, expect } = require('@playwright/test');

async function login(page, role, route) {
  await page.goto('/login.html');
  await page.evaluate((name) => { GT.store.reset(); GT.session.loginAsRole(name); }, role);
  await page.goto('/index.html?today=2026-10-26' + (route || '#/receipts'));
}

test('Sales records deposit and balance from an unpaid invoice', async ({ page }) => {
  await login(page, 'sales', '#/invoices');
  const doc = await page.evaluate(() => GT.store.where('sales_documents', row => row.type==='invoice' && row.number==='633')[0]);
  await page.goto('/index.html?today=2026-10-26#/invoices/' + doc.id);
  await page.getByRole('link', { name:'Record payment' }).click();
  await expect(page.getByRole('heading', { name:'Record payment' })).toBeVisible();
  await page.getByRole('button', { name:'50% deposit' }).click();
  await page.screenshot({path:'tests/screenshots/phase9-form.png',fullPage:true});
  const before = await page.evaluate(id => GT.customers.balance(id), doc.customer_id);
  await page.getByRole('button', { name:'Save', exact:true }).click();
  await expect(page.getByRole('heading', { name:'Receipt 2081' })).toBeVisible();
  const first = await page.evaluate(id => ({row:GT.store.where('receipts',{number:'2081'})[0], summary:GT.invoices.summary(id)}),doc.id);
  expect(first.row.balance_after).toBe(first.summary.balance);
  expect(first.summary.paymentStatus).toBe('part_paid');
  expect(await page.evaluate(id => GT.customers.balance(id),doc.customer_id)).toBe(before-first.row.amount);
  await page.goto('/index.html?today=2026-10-26#/invoices');
  await page.locator('[data-table-search]').fill('633');
  await expect(page.locator('.shared-data-table tbody')).toContainText('Overdue 45 days');
  await page.goto('/index.html?today=2026-10-26#/receipts/new?invoice='+doc.id);
  await page.getByRole('button', { name:'Pay full balance' }).click();
  await page.getByRole('button', { name:'Save', exact:true }).click();
  expect(await page.evaluate(id => GT.invoices.summary(id).paymentStatus,doc.id)).toBe('paid');
});

test('validation, printing and two copies', async ({ page }) => {
  await login(page,'owner','#/receipts/new?invoice=51');
  const invoice = await page.evaluate(() => GT.store.where('sales_documents',row => row.type==='invoice' && row.number==='640')[0]);
  await page.goto('/index.html?today=2026-10-26#/receipts/new?invoice='+invoice.id);
  await page.locator('#amount').fill('0');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.locator('#amountError')).toContainText('above zero');
  await page.locator('#amount').fill(String(invoice.total+1));
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.locator('#amountError')).toContainText('exceed');
  await page.getByRole('button',{name:'Pay full balance'}).click();
  await page.getByRole('radio',{name:'Cheque'}).check();
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.locator('#referenceError')).toContainText('cheque number');
  await page.locator('#reference').fill('456789');
  const todayBefore=await page.evaluate(() => GT.receipts.collectedOn('2026-10-26'));
  await page.getByRole('button',{name:'Save and print'}).click();
  await expect(page.locator('.print-preview-shell')).toBeVisible();
  await expect(page.locator('.print-page')).toContainText('Company stamp');
  await expect(page.locator('.print-page')).toContainText('No. 2081');
  await page.addStyleTag({content:'#toastContainer { display:none !important; }'});
  await page.setViewportSize({width:1280,height:1200});
  await page.screenshot({path:'tests/screenshots/phase9-print-one-copy.png'});
  await page.locator('#receiptCopies').selectOption('two');
  await expect(page.locator('.print-page')).toContainText('Customer copy');
  await expect(page.locator('.print-page')).toContainText('Office copy');
  await expect(page.locator('.receipt-two-copy > div').last()).toBeVisible();
  await page.setViewportSize({width:1280,height:1800});
  await page.screenshot({path:'tests/screenshots/phase9-print-two-copies.png'});
  await page.emulateMedia({media:'print'});
  const printSizes=await page.evaluate(() => ({page:document.querySelector('.print-page').getBoundingClientRect().height,copy:document.querySelector('.receipt-two-copy').getBoundingClientRect().height,body:document.body.scrollHeight}));
  const pdf=await page.pdf({format:'A4',printBackground:true,path:'test-results/phase9-two-copies.pdf'});
  expect((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,JSON.stringify(printSizes)).toBe(1);
  await page.emulateMedia({media:'screen'});
  await page.getByRole('button',{name:'Back'}).click();
  await page.goto('/index.html?today=2026-10-26#/receipts');
  expect(await page.evaluate(() => GT.receipts.collectedOn('2026-10-26'))).toBe(todayBefore+invoice.total);
});

test('General Manager void restores invoice; roles and seed totals', async ({ page }) => {
  await login(page,'general_manager','#/receipts');
  const baseline=await page.evaluate(() => ({today:GT.receipts.collectedOn('2026-10-26'),month:GT.receipts.collectedInMonth('2026-10-26')}));
  expect(baseline.today).toBeGreaterThan(0);
  expect(baseline.month).toBeGreaterThan(0);
  await expect(page.locator('.stat-card-icon svg').first()).toBeVisible();
  await page.screenshot({path:'tests/screenshots/phase9-list.png',fullPage:true});
  const receipt=await page.evaluate(() => GT.store.where('receipts',row => row.status==='issued')[0]);
  const paidBefore=await page.evaluate(id => GT.invoices.summary(id).paid,receipt.invoice_id);
  const other=await page.evaluate(id => GT.receipts.listForInvoice(id).filter(row => row.status==='issued' && row.number==='2031')[0],receipt.invoice_id);
  await page.goto('/index.html?today=2026-10-26#/receipts/'+receipt.id);
  await page.screenshot({path:'tests/screenshots/phase9-detail.png',fullPage:true});
  await page.getByRole('button',{name:'Void'}).click();
  await page.locator('#receiptVoidReason').fill('Correcting payment');
  await page.getByRole('button',{name:'Continue'}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Void receipt'}).click();
  await expect(page.locator('.sales-void-banner')).toContainText('Correcting payment');
  expect(await page.evaluate(id => GT.invoices.summary(id).paid,receipt.invoice_id)).toBe(paidBefore-receipt.amount);
  if (other) expect(await page.evaluate(id => GT.store.find('receipts',id).balance_after,other.id)).toBe(other.balance_after);
  await page.getByRole('button',{name:'Print'}).click();
  await expect(page.locator('.print-watermark')).toContainText('VOID');
  await page.evaluate(() => GT.session.loginAsRole('accountant'));
  await page.goto('/index.html?today=2026-10-26#/receipts');
  await expect(page.getByRole('link',{name:'Record payment'})).toHaveCount(0);
  await page.goto('/index.html?today=2026-10-26#/receipts/new');
  await expect(page.getByRole('heading',{name:'Access denied'})).toBeVisible();
});

test('payment form works at 360px', async ({ page }) => {
  await login(page,'owner','#/receipts/new');
  await page.setViewportSize({width:360,height:800});
  await expect(page.getByRole('heading',{name:'Record payment'})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy();
  await page.screenshot({path:'tests/screenshots/phase9-form-360.png',fullPage:true});
  await page.getByRole('tab',{name:'Preview'}).click();
  await expect(page.locator('#receiptLivePreview')).toBeVisible();
  await page.goto('/index.html?today=2026-10-26#/receipts/45');
  expect(await page.evaluate(() => document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy();
  await page.getByRole('button',{name:'Print'}).click();
  await expect(page.locator('#receiptCopies')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy();
});

test('inline date and reference checks reject invalid payments', async ({ page }) => {
  await login(page,'owner','#/receipts/new');
  const invoice=await page.evaluate(() => GT.store.where('sales_documents',row => row.type==='invoice' && row.number==='640')[0]);
  await page.goto('/index.html?today=2026-10-26#/receipts/new?invoice='+invoice.id);
  await page.locator('#amount').fill('100.5');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.locator('#amountError')).toContainText('whole shillings');
  await page.locator('#amount').fill('1000');
  await page.locator('#received_at').fill('2026-10-27');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.locator('#received_atError')).toContainText('through today');
  await page.locator('#received_at').fill('2026-04-27');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.locator('#received_atError')).toContainText('through today');
  await page.locator('#received_at').fill('2026-10-26');
  await page.getByRole('radio',{name:'MTN'}).check();
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.locator('#referenceError')).toContainText('transaction ID');
  const used=await page.evaluate(() => GT.store.where('receipts',row => row.status==='issued' && row.payment_method==='mtn')[0].reference);
  await page.locator('#reference').fill(used);
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.locator('#referenceError')).toContainText('already used');
  expect(await page.evaluate(() => GT.receipts.openInvoicesFor().some(doc => doc.number==='615'||doc.number==='644'))).toBeFalsy();
});

test('voiding the last active receipt permits invoice void', async ({ page }) => {
  await login(page,'general_manager','#/receipts/new');
  const invoice=await page.evaluate(() => GT.store.where('sales_documents',row => row.type==='invoice' && row.number==='640')[0]);
  await page.goto('/index.html?today=2026-10-26#/receipts/new?invoice='+invoice.id);
  await page.locator('#amount').fill('1000');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await page.getByRole('button',{name:'Void'}).click();
  await page.locator('#receiptVoidReason').fill('Payment was reversed');
  await page.getByRole('button',{name:'Continue'}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Void receipt'}).click();
  await page.goto('/index.html?today=2026-10-26#/invoices/'+invoice.id);
  await page.getByRole('button',{name:'Void'}).click();
  await page.locator('#salesVoidReason').fill('Invoice cancelled after payment reversal');
  await page.locator('#salesVoidConfirm').click();
  await page.getByRole('dialog').getByRole('button',{name:'Void document'}).click();
  expect(await page.evaluate(id => GT.store.find('sales_documents',id).status,invoice.id)).toBe('void');
});

test('cards, search, CSV, customer history, topbar and seeded print', async ({ page }) => {
  await login(page,'owner','#/receipts');
  await page.getByRole('button',{name:/Cash this month/}).click();
  await expect(page.locator('[data-table-filter="method"]')).toHaveValue('cash');
  await page.getByRole('button',{name:/Collected this month/}).click();
  await expect(page.locator('[data-table-filter="method"]')).toHaveValue('');
  const receipt=await page.evaluate(() => GT.store.where('receipts',{number:'2073'})[0]);
  await page.locator('[data-table-search]').fill(receipt.reference);
  await expect(page.locator('.shared-data-table tbody')).toContainText('2073');
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export CSV'}).click();
  expect((await downloadPromise).suggestedFilename()).toContain('receipts.csv');
  await page.goto('/index.html?today=2026-10-26#/receipts/'+receipt.id);
  await page.getByRole('button',{name:'Print'}).click();
  await expect(page.locator('.print-page')).toContainText(GTformat(receipt.amount));
  await expect(page.locator('.print-page')).toContainText('Balance: UGX '+Number(receipt.balance_after).toLocaleString('en-US'));
  await page.getByRole('button',{name:'Back'}).click();
  await page.goto('/index.html?today=2026-10-26#/customers/'+receipt.customer_id);
  await page.getByRole('tab',{name:'Credit and Balance'}).click();
  await expect(page.getByRole('heading',{name:'Recent payments'})).toBeVisible();
  await expect(page.locator('#customerRecentPayments')).toContainText(receipt.number);
  await page.getByRole('link',{name:/View all receipts/}).click();
  await expect(page.locator('[data-table-filter="customer"]')).toHaveValue(String(receipt.customer_id));
  await page.getByRole('link',{name:'New Receipt'}).click();
  await expect(page.getByRole('heading',{name:'Record payment'})).toBeVisible();
  await page.evaluate(() => GT.session.loginAsRole('store_keeper'));
  await page.goto('/index.html?today=2026-10-26#/receipts');
  await expect(page.getByRole('heading',{name:'Access denied'})).toBeVisible();
});

function GTformat(amount) { return Number(amount).toLocaleString('en-US')+'/='; }
