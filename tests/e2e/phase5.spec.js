// Phase 5 materials, controlled stock, ledger, alerts and role visibility flows.
const { test, expect } = require('@playwright/test');
const fs = require('fs');

async function loginAsRole(page, role, route = '#/inventory/materials', reset = true) {
  await page.goto('/login.html');
  await page.evaluate(({ roleName, shouldReset }) => { if (shouldReset) GT.store.reset(); GT.session.loginAsRole(roleName); }, { roleName: role, shouldReset: reset });
  await page.goto('/index.html' + route);
}

async function closeToasts(page) {
  await page.locator('.gt-toast-close').evaluateAll((buttons) => buttons.forEach((button) => button.click()));
  await expect(page.locator('.gt-toast')).toHaveCount(0);
}

async function fillFabric(page, name) {
  await page.getByLabel('Material name').fill(name);
  await page.getByLabel('Category').selectOption('fabric');
  await page.getByLabel('Base unit').selectOption('metre');
  await page.getByLabel('Colour').fill('Teal');
  await page.getByLabel('Fabric type').selectOption('cotton');
  await page.getByLabel('Primary supplier').selectOption('2');
  await page.getByLabel('Full stock level').fill('200');
  await page.getByLabel('Roll length (metres)').fill('40');
  await page.getByLabel('Cost per unit (UGX)').fill('19000');
}

test('Owner validates and completes the audited material lifecycle with controlled opening stock', async ({ page }, testInfo) => {
  test.setTimeout(50000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsRole(page, 'owner', '#/inventory/materials/new');
  await fillFabric(page, 'Phase Five Teal Cotton');
  await page.getByLabel('Location 1 (placeholder)').fill('-1');
  await page.getByRole('button', { name: 'Create material' }).click();
  await expect(page.locator('#width_inchesError')).toContainText('required');
  await expect(page.locator('#opening_1Error')).toContainText('cannot be negative');

  await page.getByLabel('Width (inches)').fill('60');
  await page.getByLabel('Location 1 (placeholder)').fill('100');
  await page.getByLabel('Location 2 (placeholder)').fill('50');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('material-form-1440x900.png'), fullPage: true });
  await page.getByRole('button', { name: 'Create material' }).click();
  await expect(page).toHaveURL(/#\/inventory\/materials\/\d+$/);
  const materialId = Number(await page.locator('.material-detail-page').getAttribute('data-material-id'));
  expect(await page.evaluate((id) => GT.inventory.totalStock(id), materialId)).toBe(150);
  expect(await page.evaluate((id) => GT.store.where('stock_movements', (row) => row.item_id === id && row.movement_type === 'opening').length, materialId)).toBe(2);
  await closeToasts(page);

  await page.getByRole('tab', { name: 'Stock by location' }).click();
  await expect(page.locator('#material-stock')).toContainText('100 m');
  await expect(page.locator('#material-stock')).toContainText('50 m');
  await page.screenshot({ path: testInfo.outputPath('material-detail-stock-1440x900.png') });

  await page.goto('/index.html#/inventory/materials/new');
  await fillFabric(page, 'phase five teal cotton');
  await page.getByLabel('Width (inches)').fill('60');
  await page.getByRole('button', { name: 'Create material' }).click();
  await expect(page.locator('#nameError')).toContainText('already exists');
  await page.evaluate(() => GT.forms.clearDirty());

  await page.goto('/index.html#/inventory/materials/' + materialId + '/edit');
  await expect(page.locator('[name^="opening_"]')).toHaveCount(0);
  await expect(page.getByText('Stock changes only through received goods, material issues or approved adjustments.')).toBeVisible();
  await page.getByLabel('Notes').fill('Updated in the Phase 5 lifecycle test.');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('#material-overview')).toContainText('Updated in the Phase 5 lifecycle test.');

  await page.getByRole('button', { name: 'Deactivate' }).click();
  await page.locator('[data-confirm]').click();
  await expect(page.locator('.module-title-line')).toContainText('Inactive');
  await page.getByRole('button', { name: 'Activate' }).click();
  await expect(page.locator('.module-title-line')).toContainText('Active');
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);

  await page.goto('/index.html#/inventory/movements');
  await page.locator('[data-table-filter="material"]').selectOption(String(materialId));
  await expect(page.locator('.table-result-count')).toContainText('of 2 results');
  const auditActions = await page.evaluate((id) => GT.store.where('audit_logs', (row) => row.entity_type === 'materials' && row.entity_id === id).map((row) => row.action), materialId);
  expect(auditActions).toEqual(expect.arrayContaining(['create', 'update', 'deactivate', 'activate']));
});

test('Materials list searches, filters, sorts, paginates, exports and becomes cards', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsRole(page, 'owner');
  await expect(page.locator('.table-result-count')).toContainText('of 40 results');
  await page.screenshot({ path: testInfo.outputPath('materials-list-1440x900.png') });
  const search = page.locator('[data-table-search]');
  await search.fill('Cotton Poplin');
  await expect(page.locator('.table-result-count')).toContainText('of 4 results');
  await search.fill('No material can match this text');
  await expect(page.locator('.table-empty-state')).toContainText('No materials match');
  await search.fill('');
  await page.locator('[data-table-filter="category"]').selectOption('fabric');
  await expect(page.locator('.shared-data-table tbody tr').first()).toContainText('Fabric');
  await page.locator('[data-table-filter="category"]').selectOption('');
  await page.locator('[data-table-filter="status"]').selectOption('out');
  await expect(page.locator('.table-result-count')).toContainText('of 2 results');
  await page.locator('[data-table-filter="status"]').selectOption('');
  await page.locator('[data-table-filter="supplier"]').selectOption('1');
  await expect(page.locator('.shared-data-table tbody tr').first()).toContainText('Nytil');
  await page.locator('[data-table-filter="supplier"]').selectOption('');
  await page.locator('[data-table-filter="active"]').selectOption('inactive');
  await expect(page.locator('.table-result-count')).toContainText('of 2 results');
  await page.locator('[data-table-filter="active"]').selectOption('');
  await page.getByRole('button', { name: 'Sort by Name' }).click();
  await page.getByRole('button', { name: 'Sort by Name' }).click();
  await expect(page.locator('.table-pagination')).toContainText('Page 1 of 4');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('.table-pagination')).toContainText('Page 2 of 4');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const csv = fs.readFileSync(await (await downloadPromise).path(), 'utf8');
  expect(csv).toContain('Cost per unit');

  await page.getByRole('button', { name: 'Previous' }).click();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#appSidebar')).toHaveCSS('display', 'none');
  await expect(page.locator('#appTopbar')).toHaveCSS('display', 'none');
  await page.emulateMedia({ media: 'screen' });
  await page.setViewportSize({ width: 360, height: 740 });
  await expect(page.locator('.shared-data-table thead')).toHaveCSS('display', 'none');
  await expect(page.locator('.shared-data-table tbody tr').first()).toHaveCSS('display', 'block');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath('materials-list-360x740.png') });
});

test('Material and cost permissions match the matrix, including CSV', async ({ page }) => {
  await loginAsRole(page, 'store_keeper');
  await expect(page.getByRole('link', { name: 'New material' })).toBeVisible();
  await page.getByRole('button', { name: 'More actions' }).first().click();
  await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('columnheader', { name: 'Cost per unit' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const csv = fs.readFileSync(await (await downloadPromise).path(), 'utf8');
  expect(csv).not.toContain('Cost per unit');
  expect(csv).not.toContain('18000');
  await page.goto('/index.html#/inventory/materials/new');
  await expect(page.getByLabel('Cost per unit (UGX)')).toHaveCount(0);

  await loginAsRole(page, 'workshop_supervisor', '#/inventory/materials');
  await expect(page.getByRole('link', { name: 'New material' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Cost per unit' })).toHaveCount(0);
  await page.goto('/index.html#/inventory/materials/1');
  await expect(page.locator('#material-overview')).not.toContainText('Cost per unit');

  for (const role of ['general_manager', 'accountant']) {
    await loginAsRole(page, role, '#/inventory/materials');
    await expect(page.getByRole('columnheader', { name: 'Cost per unit' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
  }
  for (const role of ['sales', 'marketing_manager']) {
    await loginAsRole(page, role, '#/inventory/materials');
    await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Materials', exact: true })).toHaveCount(0);
    await expect(page.locator('#notificationsButton')).toHaveCount(0);
  }
});

test('Stock Movements is a filterable read-only ledger linked to materials', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsRole(page, 'owner', '#/inventory/movements');
  await expect(page.locator('.table-result-count')).toContainText('of 113 results');
  await page.locator('[data-table-filter="material"]').selectOption('1');
  await expect(page.locator('.shared-data-table tbody tr')).toHaveCount(4);
  await page.locator('[data-table-filter="location"]').selectOption('1');
  await page.locator('[data-table-filter="type"]').selectOption('issue');
  await expect(page.locator('.table-result-count')).toContainText('of 1 results');
  await page.locator('[data-date-range-trigger]').click();
  await page.getByRole('option', { name: 'Custom range' }).click();
  await page.locator('.date-range-popover input[data-date-from]').fill('2026-10-01');
  await page.locator('.date-range-popover input[data-date-to]').fill('2026-10-31');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.locator('.shared-data-table tbody tr').first()).toContainText('Issue');
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('stock-movements-1440x900.png') });
  await page.locator('.shared-data-table tbody tr').first().click();
  await expect(page).toHaveURL(/#\/inventory\/materials\/1$/);
});

test('Stock Alerts, sidebar badge and topbar notifications update after a movement', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsRole(page, 'owner', '#/inventory/alerts');
  await expect(page.locator('[data-stat-card="0"]')).toContainText('2');
  await expect(page.locator('[data-stat-card="1"]')).toContainText('6');
  await expect(page.locator('[data-stat-card="2"]')).toContainText('8');
  await expect(page.locator('[data-route="#/inventory/alerts"] .nav-count-badge')).toHaveText('8');
  // Phase 15 adds two pending expense approvals to eight stock alerts and eight overdue debtors.
  await expect(page.locator('.notification-count')).toHaveText('18');
  await page.locator('[data-table-filter="status"]').selectOption('out');
  await expect(page.locator('.table-result-count')).toContainText('of 2 results');
  await page.locator('[data-table-filter="status"]').selectOption('');
  await page.locator('[data-table-filter="supplier"]').selectOption('1');
  await expect(page.locator('.table-result-count')).toContainText('of 2 results');
  await page.locator('[data-table-filter="supplier"]').selectOption('');
  await page.locator('[data-table-filter="category"]').selectOption('accessory');
  await expect(page.locator('.table-empty-state')).toContainText('No active materials');
  await page.locator('[data-table-filter="category"]').selectOption('');
  await page.locator('#notificationsButton').click();
  await expect(page.locator('.notification-list li')).toHaveCount(7);
  // Phase 6 connects this previously-disabled action to the GRN receiving flow.
  await expect(page.getByRole('button', { name: 'Receive stock' }).first()).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Receive stock' }).first()).toHaveAttribute('title', 'Receive stock');
  await page.locator('#notificationsButton').click();
  await page.screenshot({ path: testInfo.outputPath('stock-alerts-1440x900.png') });

  await page.evaluate(() => GT.inventory.recordMovement({ materialId:3, locationId:1, type:'grn', quantity:30, referenceType:'test', referenceId:1, note:'Raise above alert threshold' }));
  await expect(page.locator('.table-result-count')).toContainText('of 7 results');
  await expect(page.locator('[data-route="#/inventory/alerts"] .nav-count-badge')).toHaveText('7');
  await expect(page.locator('.notification-count')).toHaveText('17');
  await expect(page.locator('.shared-data-table')).not.toContainText('Polyester Grey 60 inch');
});
