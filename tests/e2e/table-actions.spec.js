// Phase 5.1 shared compact actions, portal menu, row-click and mobile-card coverage.
const { test, expect } = require('@playwright/test');

async function loginAsRole(page, role, route = '#/customers', reset = true) {
  await page.goto('/login.html');
  await page.evaluate(({ roleName, shouldReset }) => { if (shouldReset) GT.store.reset(); GT.session.loginAsRole(roleName); }, { roleName: role, shouldReset: reset });
  await page.goto('/index.html' + route);
}

async function expectCompactActions(page) {
  const row = page.locator('.shared-data-table tbody tr').first();
  const cell = row.locator('.actions-column');
  if (!await cell.count()) return;
  const metrics = await cell.evaluate((element) => {
    const actions = element.querySelector('.table-row-actions');
    const buttons = Array.from(actions.querySelectorAll('button'));
    const tops = buttons.map((button) => Math.round(button.getBoundingClientRect().top));
    return {
      whiteSpace: getComputedStyle(element).whiteSpace,
      actionHeight: Math.round(actions.getBoundingClientRect().height),
      oneLine: tops.length < 2 || Math.max(...tops) === Math.min(...tops)
    };
  });
  expect(metrics.whiteSpace).toBe('nowrap');
  expect(metrics.actionHeight).toBeLessThanOrEqual(34);
  expect(metrics.oneLine).toBeTruthy();
  await expect(page.getByRole('columnheader', { name: 'Actions' })).toHaveCSS('text-align', 'right');
}

test('shared Actions cells stay compact across every current list', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsRole(page, 'owner');
  const actionLists = ['#/customers', '#/customers/groups', '#/inventory/suppliers', '#/inventory/materials', '#/inventory/alerts', '#/admin/audit-log', '#/admin/numbering'];
  for (const route of actionLists) {
    await page.goto('/index.html' + route);
    await expect(page.locator('.shared-data-table tbody tr').first()).toBeVisible();
    await expectCompactActions(page);
  }
  for (const route of ['#/inventory/movements', '#/admin/data-browser']) {
    await page.goto('/index.html' + route);
    if (route.endsWith('data-browser')) await page.locator('[data-table-name="customers"]').click();
    await expect(page.getByRole('columnheader', { name: 'Actions' })).toHaveCount(0);
  }
});

test('More menu is a viewport-safe keyboard menu and destructive actions still confirm', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  await loginAsRole(page, 'owner');
  const lastMore = page.locator('.shared-data-table tbody tr').last().getByRole('button', { name: 'More actions' });
  await lastMore.evaluate((button) => button.scrollIntoView({ block: 'end' }));
  await lastMore.focus();
  // Let the deliberate focus/scroll finish before checking close-on-scroll.
  await page.waitForTimeout(100);
  await page.keyboard.press('Enter');
  const menu = page.locator('#gtTableActionMenu');
  await expect(menu).toBeVisible();
  await expect(lastMore).toHaveAttribute('aria-expanded', 'true');
  const bounds = await menu.boundingBox();
  const buttonBounds = await lastMore.boundingBox();
  expect(bounds.y).toBeGreaterThanOrEqual(8);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(692);
  expect(Math.abs(bounds.x + bounds.width - buttonBounds.x - buttonBounds.width)).toBeLessThanOrEqual(1);
  await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Deactivate' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeFocused();
  await expect(page.locator('.table-action-menu-divider')).toHaveCount(1);
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveClass(/destructive/);
  await page.screenshot({ path: testInfo.outputPath('customers-more-menu-1440x700.png') });
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(lastMore).toBeFocused();

  await page.keyboard.press('Space');
  await expect(menu).toBeVisible();
  await page.locator('.topbar-title').click();
  await expect(menu).toBeHidden();

  const firstMore = page.locator('.shared-data-table tbody tr').first().getByRole('button', { name: 'More actions' });
  await firstMore.click();
  await page.getByRole('menuitem', { name: 'Deactivate' }).click();
  await expect(page.getByRole('heading', { name: 'Deactivate customer?' })).toBeVisible();
  await page.locator('[data-cancel]').click();
  // Phase 7 document seed links Pearl Dairy Farms; use an unreferenced customer for deletion.
  await page.locator('[data-table-search]').fill('City Stitch Reseller');
  await page.locator('.shared-data-table tbody tr').first().getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await expect(page.getByRole('heading', { name: 'Delete unused customer?' })).toBeVisible();
  await page.locator('[data-cancel]').click();
});

test('row click and Enter open View while Edit remains independent', async ({ page }) => {
  await loginAsRole(page, 'owner');
  const firstRow = page.locator('.shared-data-table tbody tr').first();
  const customerId = await firstRow.getAttribute('data-record-id');
  await firstRow.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('#/customers/' + customerId + '/edit$'));

  await page.goto('/index.html#/customers');
  await page.locator('.shared-data-table tbody tr').first().click({ position: { x: 20, y: 20 } });
  await expect(page).toHaveURL(new RegExp('#/customers/' + customerId + '$'));

  await page.goto('/index.html#/customers');
  await page.locator('.shared-data-table tbody tr').first().focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp('#/customers/' + customerId + '$'));
});

test('view-only roles get one View action and no More menu', async ({ page }) => {
  await loginAsRole(page, 'sales');
  const firstRow = page.locator('.shared-data-table tbody tr').first();
  await expect(firstRow.getByRole('button', { name: 'View', exact: true })).toBeVisible();
  await expect(firstRow.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
  await expect(firstRow.getByRole('button', { name: 'More actions' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0);
});

test('Materials and Stock Alerts use compact columns and mobile touch actions', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsRole(page, 'owner', '#/inventory/materials');
  await expect(page.getByRole('columnheader', { name: 'Unit', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => GT.store.all('suppliers').every((supplier) => !/\bDemo\b/i.test(supplier.name)))).toBeTruthy();
  await page.locator('[data-table-filter="active"]').selectOption('inactive');
  await expect(page.locator('.shared-data-table tbody tr')).toHaveCount(2);
  await expect(page.locator('.shared-data-table tbody tr .status-neutral')).toHaveCount(2);
  await page.locator('[data-table-filter="active"]').selectOption('active');
  await expect(page.locator('.shared-data-table tbody tr .status-neutral')).toHaveCount(0);
  await page.locator('[data-table-filter="active"]').selectOption('');
  await page.screenshot({ path: testInfo.outputPath('materials-compact-actions-1440x900.png') });

  await page.goto('/index.html#/inventory/alerts');
  const receive = page.getByRole('button', { name: 'Receive stock' }).first();
  // Phase 6 connects this primary action to the GRN form for receiving roles.
  await expect(receive).toBeEnabled();
  await expect(receive).toHaveAttribute('title', 'Receive stock');
  await page.screenshot({ path: testInfo.outputPath('stock-alerts-compact-actions-1440x900.png') });

  await page.goto('/index.html#/inventory/materials');
  await page.setViewportSize({ width: 360, height: 740 });
  const actions = page.locator('.shared-data-table tbody tr').first().locator('.table-action-button');
  await expect(actions).toHaveCount(2);
  for (let index = 0; index < await actions.count(); index += 1) {
    const box = await actions.nth(index).boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x + box.width).toBeLessThanOrEqual(348);
  }
  await expect(page.locator('.shared-data-table tbody tr').first().getByText('View', { exact: true })).toBeVisible();
  await expect(page.locator('.shared-data-table tbody tr').first().getByText('More', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await actions.first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('materials-compact-actions-360x740.png') });
});
