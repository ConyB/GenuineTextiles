// Phase 7 quotations and proformas, permissions, print, and screenshots.
const { test, expect } = require('@playwright/test');

async function login(page, role, route = '#/sales/quotations', reset = true) {
  await page.goto('/login.html');
  await page.evaluate(({ role, reset }) => { if (reset) GT.store.reset(); GT.session.loginAsRole(role); }, { role, reset });
  await page.goto('/index.html?today=2026-10-25' + route);
}

async function fillLine(page, index, description, quantity, price) {
  const row = page.locator(`[data-line-row="${index}"]`);
  await row.getByLabel('Description').fill(description);
  await row.getByLabel('Qty').fill(String(quantity));
  await row.getByLabel('Unit price').fill(String(price));
}

test('Sales drafts and issues a two-line quotation with the next number and own-only scope', async ({ page }) => {
  await login(page, 'sales', '#/sales/quotations/new');
  await page.locator('#customer_id').selectOption('1');
  await fillLine(page, 0, 'Raincoats', 200, 45000);
  await page.getByRole('button', { name:'Add item' }).click();
  await fillLine(page, 1, 'Safety vests', 2, 20000);
  await page.getByRole('button', { name:'Save draft' }).click();
  await expect(page).toHaveURL(/#\/sales\/quotations\/\d+$/);
  const id = await page.evaluate(() => GT.store.all('sales_documents').at(-1).id);
  expect(await page.evaluate((id) => GT.store.find('sales_documents',id).number,id)).toBeNull();
  await page.goto('/index.html?today=2026-10-25#/sales/quotations/' + id + '/edit');
  await page.getByRole('button', { name:'Issue', exact:true }).click();
  await expect(page.getByRole('dialog')).toContainText('099');
  await page.getByRole('dialog').getByRole('button', { name:'Issue document' }).click();
  await expect(page.getByRole('heading', { name:'Quotation 099' })).toBeVisible();
  await expect(page.getByRole('link', { name:'Edit' })).toHaveCount(0);
  await page.evaluate(() => GT.session.loginAsUser(5));
  await page.reload();
  await expect(page.getByRole('heading', { name:'Access denied' })).toBeVisible();
  await page.goto('/index.html?today=2026-10-25#/sales/quotations');
  await expect(page.locator('#pageContent')).not.toContainText('099');
});

test('sales validation and discount approval lifecycle', async ({ page }) => {
  await login(page, 'sales', '#/sales/quotations/new');
  await page.getByRole('button', { name:'Save draft' }).click();
  await expect(page.locator('#customer_idError')).toContainText('Choose');
  await page.locator('#customer_id').selectOption('1');
  await page.locator('#issue_date').fill('2026-10-26');
  await page.getByRole('button', { name:'Save draft' }).click();
  await expect(page.locator('#issue_dateError')).toContainText('future');
  await page.locator('#issue_date').fill('2026-10-25');
  await page.locator('#valid_until').fill('2026-10-24');
  await page.getByRole('button', { name:'Save draft' }).click();
  await expect(page.locator('#valid_untilError')).toContainText('on or after');
  await page.locator('#valid_until').fill('2026-11-08');
  await fillLine(page, 0, 'Uniforms', 10, 45000);
  await page.locator('#discount_amount').fill('50000');
  await page.locator('#discount_reason').fill('Volume order');
  await page.getByRole('button', { name:'Save draft' }).click();
  const id = await page.evaluate(() => GT.store.all('sales_documents').at(-1).id);
  expect(await page.evaluate((id) => GT.store.find('sales_documents',id).discount_status,id)).toBe('requested');
  await page.evaluate(() => GT.session.loginAsRole('general_manager'));
  await page.reload();
  await page.getByRole('button', { name:'Approve' }).click();
  expect(await page.evaluate((id) => GT.store.find('sales_documents',id).discount_status,id)).toBe('approved');
  await page.evaluate(() => GT.session.loginAsRole('sales'));
  await page.goto('/index.html?today=2026-10-25#/sales/quotations/' + id + '/edit');
  await page.getByRole('button', { name:'Issue', exact:true }).click();
  await page.getByRole('dialog').getByRole('button', { name:'Issue document' }).click();
  await expect(page.getByRole('heading', { name:'Quotation 099' })).toBeVisible();
});

test('document validation refuses empty lines, zero values and excess discount', async ({ page }) => {
  await login(page, 'owner', '#/sales/quotations/new');
  await page.locator('#customer_id').selectOption('1');
  await page.getByRole('button', { name:'Save draft' }).click();
  await expect(page.locator('#itemsError')).toContainText('at least one');
  await page.locator('[data-line-row="0"] [data-line-field="description"]').fill('Raincoats');
  await page.getByRole('button', { name:'Save draft' }).click();
  await expect(page.locator('#itemsError')).toContainText('quantity');
  await page.locator('[data-line-row="0"] [data-line-field="quantity"]').fill('1');
  await page.getByRole('button', { name:'Save draft' }).click();
  await expect(page.locator('#itemsError')).toContainText('unit price');
  await page.locator('[data-line-row="0"] [data-line-field="quantity"]').fill('0');
  await page.locator('[data-line-row="0"] [data-line-field="unit_price"]').fill('45000');
  await page.getByRole('button', { name:'Save draft' }).click();
  await expect(page.locator('#itemsError')).toContainText('quantity');
  await page.locator('[data-line-row="0"] [data-line-field="quantity"]').fill('2');
  await page.locator('#discount_amount').fill('100000');
  await page.locator('#discount_reason').fill('Test');
  await page.getByRole('button', { name:'Save draft' }).click();
  await expect(page.locator('#discount_amountError')).toContainText('cannot exceed');
  expect(await page.evaluate(() => GT.store.all('sales_documents').length)).toBe(54);
});

test('requested and rejected discounts block issue while Owner discounts approve immediately', async ({ page }) => {
  await login(page, 'sales', '#/sales/quotations/new');
  await page.locator('#customer_id').selectOption('1');
  await fillLine(page,0,'Raincoats',2,45000);
  await page.locator('#discount_amount').fill('1000');
  await page.locator('#discount_reason').fill('Volume order');
  await page.getByRole('button', { name:'Save draft' }).click();
  const id = await page.evaluate(() => GT.store.all('sales_documents').at(-1).id);
  await page.goto('/index.html?today=2026-10-25#/sales/quotations/' + id + '/edit');
  await page.getByRole('button', { name:'Issue', exact:true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.evaluate(() => GT.session.loginAsRole('general_manager'));
  await page.goto('/index.html?today=2026-10-25#/sales/quotations/' + id);
  await page.getByRole('button', { name:'Reject' }).click();
  await page.evaluate(() => GT.session.loginAsRole('sales'));
  await page.goto('/index.html?today=2026-10-25#/sales/quotations/' + id + '/edit');
  await page.getByRole('button', { name:'Issue', exact:true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.evaluate(() => GT.session.loginAsRole('owner'));
  await page.goto('/index.html?today=2026-10-25#/sales/quotations/new');
  await page.locator('#customer_id').selectOption('1');
  await fillLine(page,0,'Raincoats',2,45000);
  await page.locator('#discount_amount').fill('1000');
  await page.locator('#discount_reason').fill('Loyalty');
  await page.getByRole('button', { name:'Save draft' }).click();
  expect(await page.evaluate(() => GT.store.all('sales_documents').at(-1).discount_status)).toBe('approved');
});

test('seeded print previews reconcile and show placeholder warning outside the page', async ({ page }) => {
  await login(page, 'owner', '#/sales/quotations/10');
  await page.getByRole('button', { name:'Print' }).click();
  const quote = page.locator('.print-preview-shell');
  await expect(quote.locator('.print-page')).toContainText('NO: 098');
  await expect(quote.locator('.print-page')).toContainText('10,620,000/=');
  await expect(quote.locator('.print-page')).toContainText('Ten million six hundred twenty thousand shillings only.');
  await expect(quote.locator('.print-page .sales-print-table tbody tr')).toHaveCount(8);
  await expect(quote.locator('.sales-print-warning')).toBeVisible();
  await expect(quote.locator('.print-page')).not.toContainText('Business settings still contain placeholder');
  await page.getByRole('button', { name:'Back' }).click();
  await page.goto('/index.html?today=2026-10-25#/sales/proformas/21');
  await page.getByRole('button', { name:'Print' }).click();
  const proforma = page.locator('.print-preview-shell .print-page');
  await expect(proforma).toContainText('NO: 096');
  await expect(proforma).toContainText('10 SEP 2026');
  await expect(proforma).toContainText('5,416,200/=');
  await expect(proforma).toContainText('Five million four hundred sixteen thousand two hundred shillings only.');
  await expect(proforma.locator('.sales-print-table tbody tr')).toHaveCount(8);
});

test('roles, expiry and mobile form', async ({ page }) => {
  await login(page, 'accountant', '#/sales/quotations');
  await expect(page.getByRole('heading', { name:'Quotations' })).toBeVisible();
  await expect(page.getByRole('link', { name:'New Quotation' })).toHaveCount(0);
  await page.goto('/index.html?today=2026-11-07#/sales/quotations');
  await expect(page.getByText('Expired', { exact:true }).first()).toBeVisible();
  await page.evaluate(() => GT.session.loginAsRole('store_keeper'));
  await page.reload();
  await expect(page.getByRole('heading', { name:'Access denied' })).toBeVisible();
  for (const role of ['workshop_supervisor','marketing_manager']) {
    await page.evaluate((role) => GT.session.loginAsRole(role),role);
    await page.reload();
    await expect(page.getByRole('heading', { name:'Access denied' })).toBeVisible();
  }
  await page.evaluate(() => GT.session.loginAsRole('owner'));
  await page.setViewportSize({ width:360, height:740 });
  await page.goto('/index.html?today=2026-10-25#/sales/quotations/new');
  await expect(page.getByRole('button', { name:'Preview', exact:true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  await page.getByRole('button', { name:'Preview', exact:true }).click();
  await expect(page.locator('#salesLivePreview')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
});

test('duplicate, void, discard, quick add and customer snapshot', async ({ page }) => {
  await login(page, 'owner', '#/sales/quotations/10');
  await page.getByRole('button', { name:'Duplicate' }).click();
  await expect(page).toHaveURL(/\/edit$/);
  const draftId = await page.evaluate(() => GT.store.all('sales_documents').at(-1).id);
  expect(await page.evaluate((id) => GT.store.find('sales_documents',id).source_document_id,draftId)).toBe(10);
  await expect(page.locator('[data-line-row="0"] [data-line-field="description"]')).toHaveValue('Raincoats');
  await page.goto('/index.html?today=2026-10-25#/sales/quotations/' + draftId);
  await page.mouse.move(200, 400);
  await expect(page.locator('#toastContainer > *')).toHaveCount(0, { timeout:10000 });
  await page.getByRole('button', { name:'Discard draft' }).click();
  await page.getByRole('dialog').getByRole('button', { name:'Discard draft' }).click();
  expect(await page.evaluate((id) => GT.store.find('sales_documents',id).status,draftId)).toBe('discarded');
  await page.goto('/index.html?today=2026-10-25#/sales/quotations/10');
  await page.getByRole('button', { name:'Void' }).click();
  await page.locator('#salesVoidReason').fill('Superseded by corrected quotation');
  await page.locator('#salesVoidConfirm').click();
  await page.getByRole('dialog').getByRole('button', { name:'Void document' }).click();
  await expect(page.locator('.sales-void-banner')).toContainText('VOID');
  await page.getByRole('button', { name:'Print' }).click();
  await expect(page.locator('.print-watermark')).toContainText('VOID');
  await page.getByRole('button', { name:'Back' }).click();
  await page.goto('/index.html?today=2026-10-25#/sales/quotations/new');
  await page.getByRole('button', { name:'Quick add customer' }).click();
  await page.locator('#quickCustomerForm [name="name"]').fill('East Ridge School');
  await page.locator('#quickCustomerForm [name="phone"]').fill('0700123456');
  await page.locator('#quickCustomerForm [name="customer_group_id"]').selectOption('2');
  await page.getByRole('dialog').getByRole('button', { name:'Add customer' }).click();
  const quick = await page.evaluate(() => GT.store.all('customers').at(-1));
  expect(await page.locator('#customer_id').inputValue()).toBe(String(quick.id));
  expect(await page.evaluate((id) => GT.store.where('audit_logs', {entity_type:'customers',entity_id:id}).length,quick.id)).toBeGreaterThan(0);
  await fillLine(page,0,'School shirts',10,35000);
  await page.getByRole('button', { name:'Issue', exact:true }).click();
  await page.getByRole('dialog').getByRole('button', { name:'Issue document' }).click();
  const issuedId = await page.evaluate(() => GT.store.all('sales_documents').at(-1).id);
  await page.evaluate((id) => GT.store.update('customers',id,{name:'Renamed School'}),quick.id);
  await page.reload();
  await expect(page.locator('#pageContent')).toContainText('East Ridge School');
  await expect(page.locator('#pageContent')).not.toContainText('Renamed School');
});

test('capture Phase 7 layouts for visual review', async ({ page }) => {
  await login(page, 'owner', '#/sales/quotations');
  await page.setViewportSize({ width:1440, height:900 });
  await page.screenshot({path:'test-results/phase7-quotation-list.png',fullPage:true});
  await page.goto('/index.html?today=2026-10-25#/sales/quotations/new');
  await page.locator('#customer_id').selectOption('1');
  await fillLine(page,0,'Raincoats',200,45000);
  await page.screenshot({path:'test-results/phase7-form-live-preview.png',fullPage:true});
  await page.evaluate(() => GT.forms.clearDirty());
  await page.goto('/index.html?today=2026-10-25#/sales/quotations/10');
  await page.screenshot({path:'test-results/phase7-detail.png',fullPage:true});
  await page.setViewportSize({ width:1440, height:1250 });
  await page.getByRole('button', { name:'Print' }).click();
  await page.screenshot({path:'test-results/phase7-quotation-print.png'});
  await page.getByRole('button', { name:'Back' }).click();
  await page.goto('/index.html?today=2026-10-25#/sales/proformas/21');
  await page.getByRole('button', { name:'Print' }).click();
  await page.screenshot({path:'test-results/phase7-proforma-print.png'});
  await page.getByRole('button', { name:'Back' }).click();
  await page.setViewportSize({ width:360, height:740 });
  await page.goto('/index.html?today=2026-10-25#/sales/quotations/new');
  await page.screenshot({path:'test-results/phase7-form-360.png',fullPage:true});
});
