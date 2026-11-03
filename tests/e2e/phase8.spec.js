// Phase 8 invoice flows, credit decisions, conversion, print and visual records.
const { test, expect } = require('@playwright/test');

async function login(page, role, route) {
  await page.goto('/login.html');
  await page.evaluate((name) => { GT.store.reset(); GT.session.loginAsRole(name); }, role);
  await page.goto('/index.html?today=2026-10-26' + (route || '#/invoices'));
}
async function switchRole(page, role, route) {
  await page.evaluate((name) => GT.session.loginAsRole(name), role);
  await page.goto('/index.html?today=2026-10-26' + route);
  await page.reload();
}
async function fillLine(page, description, quantity, price) {
  const row=page.locator('[data-line-row="0"]');
  await row.getByLabel('Description').fill(description);
  await row.getByLabel('Qty').fill(String(quantity));
  await row.getByLabel('Unit price').fill(String(price));
}

test('Sales issues a numbered credit invoice and sees only own invoices', async ({page}) => {
  await login(page,'sales','#/invoices/new');
  await page.locator('#customer_id').selectOption('3');
  await fillLine(page,'School shirts',1,30000);
  await page.getByRole('button',{name:'Save draft'}).click();
  const id=await page.evaluate(() => GT.store.all('sales_documents').at(-1).id);
  expect(await page.evaluate((value) => GT.store.find('sales_documents',value).number,id)).toBeNull();
  await page.goto('/index.html?today=2026-10-26#/invoices/'+id+'/edit');
  await page.getByRole('button',{name:'Issue',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Issue document'}).click();
  await expect(page.getByRole('heading',{name:'Invoice 645'})).toBeVisible();
  await page.goto('/index.html?today=2026-10-26#/invoices');
  const visible=await page.evaluate(() => GT.salesDocs.list('invoice').every((doc) => doc.created_by===GT.session.currentUser().id));
  expect(visible).toBeTruthy();
});

test('Sales credit approval and Owner override are audited', async ({page}) => {
  await login(page,'sales','#/invoices/new');
  await page.locator('#customer_id').selectOption('1');
  await fillLine(page,'Raincoats',1,45000);
  await expect(page.locator('.sales-credit-warning')).toBeVisible();
  await page.getByRole('button',{name:'Issue',exact:true}).click();
  const id=await page.evaluate(() => GT.store.all('sales_documents').at(-1).id);
  expect(await page.evaluate((value) => GT.store.find('sales_documents',value).status,id)).toBe('draft');
  expect(await page.evaluate((value) => GT.store.where('approvals',row => row.type==='credit_limit' && row.entity_id===value).length,id)).toBe(1);
  await switchRole(page,'general_manager','#/invoices/'+id);
  await page.getByRole('button',{name:'Approve credit override'}).click();
  expect(await page.evaluate((value) => GT.store.find('sales_documents',value).credit_override_approved_by,id)).toBe(2);
  await switchRole(page,'sales','#/invoices/'+id+'/edit');
  await page.getByRole('button',{name:'Issue',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Issue document'}).click();
  expect(await page.evaluate((value) => GT.store.find('sales_documents',value).status,id)).toBe('issued');
  await switchRole(page,'owner','#/invoices/new');
  await page.locator('#customer_id').selectOption('1');
  await fillLine(page,'Raincoats',1,45000);
  await page.getByRole('button',{name:'Issue',exact:true}).click();
  await page.locator('#creditOverrideReason').fill('Owner authorised urgent order');
  await page.getByRole('button',{name:'Continue'}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Issue document'}).click();
  const ownerId=await page.evaluate(() => GT.store.all('sales_documents').at(-1).id);
  expect(await page.evaluate((value) => GT.store.where('audit_logs',row => row.entity_type==='sales_documents' && row.entity_id===value && row.action==='approve_credit_limit').length,ownerId)).toBe(1);
});

test('conversion, void guard and fiscal edit', async ({page}) => {
  await login(page,'owner','#/sales/quotations/10');
  await page.getByRole('button',{name:'Convert to invoice'}).click();
  const draftId=await page.evaluate(() => GT.store.all('sales_documents').at(-1).id);
  expect(await page.evaluate((id) => GT.store.find('sales_documents',id).source_document_id,draftId)).toBe(10);
  expect(await page.evaluate((id) => GT.store.find('sales_documents',id).total,draftId)).toBe(10620000);
  await page.goto('/index.html?today=2026-10-26#/sales/quotations/10');
  await page.getByRole('button',{name:'Convert to invoice'}).click();
  await expect(page.locator('#toastContainer')).toContainText('active invoice');
  const paid=await page.evaluate(() => GT.store.where('sales_documents',{type:'invoice',number:'641'})[0].id);
  await page.goto('/index.html?today=2026-10-26#/invoices/'+paid);
  await page.getByRole('button',{name:'Void'}).click();
  await page.locator('#salesVoidReason').fill('Correction');
  await page.locator('#salesVoidConfirm').click();
  await page.getByRole('dialog').getByRole('button',{name:'Void document'}).click();
  await expect(page.getByRole('dialog')).toContainText('Void its active receipts before voiding this invoice.');
  await expect(page.getByRole('dialog').getByRole('link',{name:'View the invoice receipts'})).toHaveAttribute('href',/^#\/receipts\?invoice=/);
  await switchRole(page,'accountant','#/invoices/'+paid);
  await page.getByRole('button',{name:'Edit',exact:true}).click();
  await page.locator('#fiscalNoEdit').fill('EFRIS-TEST-641');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  expect(await page.evaluate((id) => GT.store.find('sales_documents',id).fiscal_document_no,paid)).toBe('EFRIS-TEST-641');
  await switchRole(page,'sales','#/invoices/'+paid);
  await expect(page.getByRole('button',{name:'Edit',exact:true})).toHaveCount(0);
});

test('invoice list, customer account, print and 360px screenshots', async ({page}) => {
  await login(page,'owner','#/invoices');
  await page.setViewportSize({width:1440,height:900});
  await expect(page.getByRole('heading',{name:'Invoices'})).toBeVisible();
  await expect(page.locator('.stat-card')).toHaveCount(4);
  await page.screenshot({path:'test-results/phase8-invoice-list.png',fullPage:true});
  await page.goto('/index.html?today=2026-10-26#/invoices/new');
  await page.locator('#customer_id').selectOption('1');
  await fillLine(page,'Raincoats',400,45000);
  await expect(page.locator('.sales-credit-warning')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0,0));
  await page.screenshot({path:'test-results/phase8-invoice-form-credit.png',fullPage:true});
  await page.evaluate(() => GT.forms.clearDirty());
  const invoice640=await page.evaluate(() => GT.store.where('sales_documents',{type:'invoice',number:'640'})[0].id);
  await page.goto('/index.html?today=2026-10-26#/invoices/'+invoice640);
  await expect(page.locator('.detail-card').last()).toContainText('Payment');
  await page.evaluate(() => window.scrollTo(0,0));
  await page.screenshot({path:'test-results/phase8-invoice-detail.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1400});
  await page.getByRole('button',{name:'Print'}).click();
  await expect(page.locator('.sales-invoice-table tbody tr')).toHaveCount(12);
  await expect(page.locator('.print-page')).toContainText('21,240,000/=');
  await page.screenshot({path:'test-results/phase8-invoice-640-print.png'});
  await page.getByRole('button',{name:'Back'}).click();
  await page.setViewportSize({width:360,height:740});
  await page.goto('/index.html?today=2026-10-26#/invoices/new');
  await page.screenshot({path:'test-results/phase8-invoice-form-360.png',fullPage:true});
  expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
  await page.goto('/index.html?today=2026-10-26#/invoices/'+invoice640);
  expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
});

test('payment filters, fiscal search, CSV, customer balances and invoice print terms', async ({page}) => {
  await login(page,'owner','#/invoices');
  await expect(page.locator('.shared-data-table')).toContainText('Paid');
  await page.getByRole('button',{name:/Outstanding/}).first().click();
  await expect(page.getByRole('button',{name:/Outstanding/}).first()).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:/Issued this month/}).first().click();
  await expect(page.getByRole('button',{name:/Outstanding/}).first()).toHaveAttribute('aria-pressed','false');
  await page.locator('[data-table-search]').fill('1253652875875');
  await expect(page.locator('.shared-data-table tbody')).toContainText('640');
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export CSV'}).click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toContain('invoices');
  await page.goto('/index.html?today=2026-10-26#/customers');
  await expect(page.locator('.shared-data-table')).toContainText('Over limit');
  await page.goto('/index.html?today=2026-10-26#/customers/1');
  await page.getByRole('tab',{name:'Credit and Balance'}).click();
  await expect(page.locator('#credit')).toContainText('UGX 21,240,000');
  await page.getByRole('tab',{name:'Documents'}).click();
  await expect(page.locator('#documents')).toContainText('invoice 640');
  const id=await page.evaluate(() => GT.store.where('sales_documents',{type:'invoice',number:'641'})[0].id);
  await page.goto('/index.html?today=2026-10-26#/invoices/'+id);
  await page.getByRole('button',{name:'Print'}).click();
  await expect(page.locator('.print-page')).toContainText('5,416,200/=');
  await expect(page.locator('.print-page')).toContainText('Five million four hundred sixteen thousand two hundred shillings only.');
  await expect(page.locator('.print-page')).toContainText('Due 12 Oct 2026');
});

test('invoice access follows the role matrix and expired conversion warns', async ({page}) => {
  await login(page,'accountant','#/invoices');
  await expect(page.getByRole('heading',{name:'Invoices'})).toBeVisible();
  await expect(page.getByRole('link',{name:'New Invoice'})).toHaveCount(0);
  for (const role of ['store_keeper','workshop_supervisor','marketing_manager']) {
    await switchRole(page,role,'#/invoices');
    await expect(page.getByRole('heading',{name:'Access denied'})).toBeVisible();
  }
  await switchRole(page,'owner','#/sales/quotations/10');
  await page.goto('/index.html?today=2026-11-07#/sales/quotations/10');
  await page.getByRole('button',{name:'Convert to invoice'}).click();
  await expect(page.getByRole('dialog')).toContainText('Prices may have changed');
});

test('conversion issues 645, links its source, and void removes the new balance', async ({page}) => {
  await login(page,'owner','#/dashboard');
  await page.getByRole('link',{name:'New Invoice'}).click();
  await expect(page.getByRole('heading',{name:'New Invoice'})).toBeVisible();
  await page.goto('/index.html?today=2026-10-26#/invoices/new?from=quotation:98');
  await expect(page.locator('[data-line-row="0"] [data-line-field="description"]')).toHaveValue('Raincoats');
  await page.evaluate(() => GT.forms.clearDirty());
  await page.goto('/index.html?today=2026-10-26#/sales/quotations/10');
  await page.getByRole('button',{name:'Convert to invoice'}).click();
  const id=await page.evaluate(() => GT.store.all('sales_documents').at(-1).id);
  await page.getByRole('button',{name:'Issue',exact:true}).click();
  await page.locator('#creditOverrideReason').fill('Owner accepted quoted price');
  await page.getByRole('button',{name:'Continue'}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Issue document'}).click();
  await expect(page.getByRole('heading',{name:'Invoice 645'})).toBeVisible();
  expect(await page.evaluate(() => GT.customers.balance(1))).toBe(31860000);
  await page.goto('/index.html?today=2026-10-26#/sales/quotations/10');
  await expect(page.locator('.sales-convert').locator('xpath=preceding-sibling::p[1]')).toContainText('Converted to invoice 645');
  await page.goto('/index.html?today=2026-10-26#/invoices/'+id);
  await page.getByRole('button',{name:'Void'}).click();
  await page.locator('#salesVoidReason').fill('Quoted order cancelled');
  await page.locator('#salesVoidConfirm').click();
  await page.getByRole('dialog').getByRole('button',{name:'Void document'}).click();
  await expect(page.locator('.sales-void-banner')).toContainText('VOID');
  expect(await page.evaluate(() => GT.customers.balance(1))).toBe(21240000);
  await page.getByRole('button',{name:'Print'}).click();
  await expect(page.locator('.print-watermark')).toContainText('VOID');
});
