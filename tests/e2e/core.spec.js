// Phase 2 store, service, authentication and Administration proof flows.
const { test, expect } = require('@playwright/test');

async function demoLogin(page, role) {
  await page.goto('/login.html');
  await page.locator('.demo-access').evaluate((element) => { element.open = true; });
  await page.getByRole('button', { name: 'Log in as ' + role, exact: true }).click();
  await expect(page).toHaveURL(/index.html#\/dashboard/);
  await expect(page.locator('.app-shell')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.GT && GT.store && GT.app));
}

test('browser unit assertions all pass', async ({ page }) => {
  await page.goto('/tests/unit.html');
  await expect(page.locator('#summary')).toHaveAttribute('data-status', 'pass');
  await expect(page.locator('#results .fail')).toHaveCount(0);
  await expect(page.locator('#results .pass')).toHaveCount(191);
});

test('first load seeds reference counts and every schema table', async ({ page }) => {
  await page.goto('/tests/unit.html');
  const result = await page.evaluate(() => ({
    schemaTables: GT.schema.tables.length,
    storedTables: GT.schema.tables.filter((table) => Array.isArray(GT.store.all(table.name))).length,
    roles: GT.store.count('roles'), users: GT.store.count('users'), locations: GT.store.count('locations'),
    businessSettings: GT.store.count('business_settings'), sequences: GT.store.count('document_sequences'),
    customerGroups: GT.store.count('customer_groups'), customers: GT.store.count('customers'),
    suppliers: GT.store.count('suppliers'), materials: GT.store.count('materials'), materialStock: GT.store.count('material_stock'), stockMovements: GT.store.count('stock_movements'), grns: GT.store.count('goods_received_notes'), grnItems: GT.store.count('grn_items'), stockAdjustments: GT.store.count('stock_adjustments'), employees: GT.store.count('employees'), stages: GT.store.count('order_stages'),
    expenseCategories: GT.store.count('expense_categories'), leadSources: GT.store.count('lead_sources'),
    messageTemplates: GT.store.count('message_templates'), accounts: GT.store.count('accounts'),
    expenses: GT.store.count('expenses'), ledgerEntries: GT.store.count('ledger_entries')
  }));
  expect(result).toEqual({
    schemaTables: 65, storedTables: 65, roles: 7, users: 8, locations: 2, businessSettings: 24, sequences: 9,
    customerGroups: 4, customers: 25, suppliers: 6, materials: 40, materialStock: 80, stockMovements: 135, grns: 8, grnItems: 12, stockAdjustments: 5, employees: 26, stages: 7, expenseCategories: 11,
    leadSources: 5, messageTemplates: 6, accounts: 20, expenses: 15, ledgerEntries: 63
  });
});

test('created records survive reload and protected records cannot be removed', async ({ page }) => {
  await page.goto('/login.html');
  await page.evaluate(() => { GT.store.reset(); GT.store.create('customer_groups', { name: 'Reload proof' }); });
  await page.reload();
  expect(await page.evaluate(() => GT.store.where('customer_groups', { name: 'Reload proof' }).length)).toBe(1);

  const message = await page.evaluate(() => {
    const record = GT.store.create('sales_documents', { type: 'invoice', number: 'TEST' });
    try { GT.store.remove('sales_documents', record.id); } catch (error) { return error.message; }
    return '';
  });
  expect(message).toContain('void it instead');
});

test('login reads the seeded store user', async ({ page }) => {
  await page.goto('/login.html');
  await page.locator('#email').fill('owner@genuinetextiles.demo');
  await page.locator('#password').fill('demo123');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/index.html#\/dashboard/);
  await expect(page.locator('.app-shell')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.GT && GT.session));
  expect(await page.evaluate(() => GT.session.currentUser().id)).toBe(1);
});

test('Owner can browse tables and reset the seed', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await demoLogin(page, 'Owner');
  await page.evaluate(() => GT.store.create('customer_groups', { name: 'Reset proof' }));
  await page.locator('.nav-group[data-group="Administration"] .nav-group-title').click();
  await page.getByRole('link', { name: 'Data Browser (prototype only)' }).click();
  await page.getByRole('button', { name: /Customer Groups/ }).click();
  await expect(page.getByRole('heading', { name: 'Customer Groups' })).toBeVisible();
  await expect(page.locator('#dataBrowserRows')).toContainText('Reset proof');
  await page.screenshot({ path: testInfo.outputPath('data-browser-1440x900.png') });
  await page.setViewportSize({ width: 360, height: 740 });
  await page.screenshot({ path: testInfo.outputPath('data-browser-360x740.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: /Audit Logs/ }).click();
  await expect(page.locator('#dataBrowserRows')).toContainText('Showing 20 of 31 rows');

  await page.getByRole('link', { name: 'Reset Demo Data' }).click();
  await page.getByRole('button', { name: 'Reset demo data' }).click();
  await page.locator('[data-confirm]').click();
  await expect(page.locator('.gt-toast')).toContainText('Demo data restored');
  expect(await page.evaluate(() => GT.store.count('customer_groups'))).toBe(4);
});

test('Data Browser is denied to the Store Keeper', async ({ page }) => {
  await demoLogin(page, 'Store Keeper');
  await page.goto('/index.html#/admin/data-browser');
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Data Browser (prototype only)' })).toHaveCount(0);
});
