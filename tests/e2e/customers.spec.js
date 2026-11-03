// Phase 3 Customers flows and the shared list, form and detail page patterns.
const { test, expect } = require('@playwright/test');
const fs = require('fs');

async function loginAsRole(page, role, route = '#/customers', reset = true) {
  await page.goto('/login.html');
  await page.evaluate(({ roleName, shouldReset }) => {
    if (shouldReset) GT.store.reset();
    GT.session.loginAsRole(roleName);
  }, { roleName: role, shouldReset: reset });
  await page.goto('/index.html' + route);
}

async function selectIndividual(page) {
  await page.getByLabel('Customer group').selectOption({ label: 'Individual' });
}

async function closeToasts(page) {
  await page.locator('.gt-toast-close').evaluateAll((buttons) => buttons.forEach((button) => button.click()));
  await expect(page.locator('.gt-toast')).toHaveCount(0);
}

async function createCustomer(page, values) {
  await page.goto('/index.html#/customers/new');
  await page.getByLabel('Customer name').fill(values.name);
  await selectIndividual(page);
  await page.getByLabel('Phone').fill(values.phone || '0700 111 222');
  if (values.credit) {
    await page.getByLabel('Allow this customer to buy on credit').check();
    if (values.limit) await page.getByLabel('Credit limit (UGX)').fill(String(values.limit));
  }
  await page.getByRole('button', { name: 'Create customer' }).click();
  await expect(page).toHaveURL(/#\/customers\/\d+$/);
  return Number((await page.locator('.customer-detail-page').getAttribute('data-customer-id')));
}

test('Owner validates, creates, edits, deactivates, activates and safely deletes customers', async ({ page }, testInfo) => {
  test.setTimeout(45000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsRole(page, 'owner', '#/customers/new');

  await page.getByRole('button', { name: 'Create customer' }).click();
  await expect(page.locator('#nameError')).toContainText('required');
  await expect(page.locator('#phoneError')).toContainText('required');

  await page.getByLabel('Customer name').fill('Phase Three Cash Customer');
  await selectIndividual(page);
  await page.getByLabel('Phone').fill('12345');
  await page.getByRole('button', { name: 'Create customer' }).click();
  await expect(page.locator('#phoneError')).toContainText('+2567XXXXXXXX');
  await page.getByLabel('Phone').fill('0700 111 222');
  await page.evaluate(() => GT.forms.clearErrors(document.getElementById('customerForm')));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  await page.screenshot({ path: testInfo.outputPath('customer-form-1440x900.png') });
  await page.getByRole('button', { name: 'Create customer' }).click();
  await expect(page.getByRole('heading', { name: 'Phase Three Cash Customer' })).toBeVisible();
  const cashId = Number(await page.locator('.customer-detail-page').getAttribute('data-customer-id'));
  await closeToasts(page);
  await page.screenshot({ path: testInfo.outputPath('customer-detail-1440x900.png') });

  await page.goto('/index.html#/customers/new');
  await page.getByLabel('Customer name').fill('Phase Three Cash Customer');
  await selectIndividual(page);
  await page.getByLabel('Phone').fill('+256 700 222 333');
  await page.getByRole('button', { name: 'Create customer' }).click();
  await expect(page.locator('#nameError')).toContainText('already exists');
  await page.evaluate(() => GT.forms.clearDirty());

  await page.goto('/index.html#/customers/new');
  await page.getByLabel('Customer name').fill('Phase Three Credit Customer');
  await selectIndividual(page);
  await page.getByLabel('Phone').fill('+256 700 333 444');
  await page.getByLabel('Allow this customer to buy on credit').check();
  await page.getByRole('button', { name: 'Create customer' }).click();
  await expect(page.locator('#credit_limitError')).toContainText('greater than 0');
  await page.getByLabel('Credit limit (UGX)').fill('2500000');
  await page.getByRole('button', { name: 'Create customer' }).click();
  const creditId = Number(await page.locator('.customer-detail-page').getAttribute('data-customer-id'));

  await page.getByRole('link', { name: 'Edit customer' }).click();
  await page.getByLabel('Contact person').fill('Updated Contact');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('#overview .detail-grid')).toContainText('Updated Contact');

  await page.getByRole('button', { name: 'Deactivate' }).click();
  await page.locator('[data-confirm]').click();
  await expect(page.locator('.module-title-line .status-badge')).toHaveText('Inactive');
  await page.getByRole('button', { name: 'Activate' }).click();
  await expect(page.locator('.module-title-line .status-badge')).toHaveText('Active');
  await closeToasts(page);

  await page.evaluate((id) => GT.store.create('sales_documents', { type: 'invoice', number: 'PHASE3-RELATED', customer_id: id, status: 'issued', total: 100000 }), creditId);
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('.gt-toast.error')).toContainText('Deactivate the customer instead');
  expect(await page.evaluate((id) => Boolean(GT.store.find('customers', id)), creditId)).toBeTruthy();
  await closeToasts(page);

  await page.goto('/index.html#/customers/' + cashId);
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.locator('[data-confirm]').click();
  await expect(page).toHaveURL(/#\/customers$/);
  expect(await page.evaluate((id) => GT.store.find('customers', id), cashId)).toBeNull();

  const audit = await page.evaluate(() => GT.store.where('audit_logs', { entity_type: 'customers' }).map((row) => ({ action: row.action, user_id: row.user_id, entity_id: row.entity_id })));
  expect(audit.filter((row) => row.action === 'create' && [cashId, creditId].includes(row.entity_id))).toHaveLength(2);
  for (const action of ['update', 'deactivate', 'activate', 'delete']) expect(audit.some((row) => row.action === action && row.user_id === 1)).toBeTruthy();
});

test('customer list searches, filters, sorts, paginates, exports and becomes cards', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsRole(page, 'owner');
  await expect(page.locator('.table-result-count')).toContainText('of 25 results');
  await page.waitForTimeout(600);
  await page.screenshot({ path: testInfo.outputPath('customer-list-1440x900.png') });

  const search = page.locator('[data-table-search]');
  await search.fill('Pearl Dairy');
  await expect(page.locator('.table-result-count')).toHaveText('Showing 1–1 of 1 results');
  await expect(page.locator('.shared-data-table tbody tr')).toHaveCount(1);
  await search.fill('');
  await search.fill('No customer can match this text');
  await expect(page.locator('.table-empty-state')).toContainText('No customers match');
  await search.fill('');

  await page.locator('[data-table-filter="group"]').selectOption({ label: 'School' });
  await expect(page.locator('.shared-data-table tbody tr').first()).toContainText('School');
  await page.locator('[data-table-filter="group"]').selectOption('');
  await page.getByLabel('Credit type').selectOption('credit');
  await expect(page.locator('.shared-data-table tbody tr').first()).toContainText('Credit');
  await page.getByLabel('Credit type').selectOption('');
  await page.locator('[data-table-filter="status"]').selectOption('inactive');
  await expect(page.locator('.table-result-count')).toContainText('of 2 results');
  await expect(page.locator('.shared-data-table tbody tr')).toHaveCount(2);
  await page.locator('[data-table-filter="status"]').selectOption('');

  await page.getByRole('button', { name: 'Sort by Name' }).click();
  const ascendingFirst = await page.locator('.shared-data-table tbody tr').first().locator('td').first().textContent();
  await page.getByRole('button', { name: 'Sort by Name' }).click();
  const descendingFirst = await page.locator('.shared-data-table tbody tr').first().locator('td').first().textContent();
  expect(ascendingFirst).not.toBe(descendingFirst);

  await expect(page.locator('.table-pagination')).toContainText('Page 1 of 3');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('.table-pagination')).toContainText('Page 2 of 3');
  await page.getByLabel('Rows per page').selectOption('25');
  await expect(page.locator('.shared-data-table tbody tr')).toHaveCount(25);

  await search.fill('School');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloadPromise;
  const csv = fs.readFileSync(await download.path(), 'utf8');
  expect(csv).toContain('Kampala Horizon School');
  expect(csv).not.toContain('Pearl Dairy Farms');

  await search.fill('');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#appSidebar')).toHaveCSS('display', 'none');
  await page.emulateMedia({ media: 'screen' });
  await page.setViewportSize({ width: 360, height: 740 });
  await expect(page.locator('.shared-data-table thead')).toHaveCSS('display', 'none');
  await expect(page.locator('.shared-data-table tbody tr').first()).toHaveCSS('display', 'block');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath('customer-list-mobile-360x740.png') });
});

test('customer permissions match the role matrix', async ({ page }) => {
  await loginAsRole(page, 'sales');
  await expect(page.getByRole('link', { name: 'New customer' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Deactivate' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
  await page.goto('/index.html#/customers/new');
  await expect(page.getByRole('heading', { name: 'New customer' })).toBeVisible();

  await loginAsRole(page, 'general_manager', '#/customers', false);
  await page.getByRole('button', { name: 'More actions' }).first().click();
  await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Deactivate' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  for (const role of ['workshop_supervisor', 'accountant', 'marketing_manager']) {
    await loginAsRole(page, role, '#/customers', false);
    await expect(page.getByRole('link', { name: 'New customer' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Deactivate' })).toHaveCount(0);
  }

  await loginAsRole(page, 'store_keeper', '#/customers', false);
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Customer List' })).toHaveCount(0);
});

test('customer groups use modal actions and protect groups that are in use', async ({ page }) => {
  await loginAsRole(page, 'owner', '#/customers/groups');
  await page.getByRole('button', { name: 'Add group' }).click();
  await page.locator('#groupName').fill('Government');
  await page.locator('#customerGroupForm').getByRole('button', { name: 'Add group', exact: true }).click();
  await expect(page.locator('.shared-data-table')).toContainText('Government');

  const groupRow = page.locator('.shared-data-table tbody tr', { hasText: 'Government' });
  await groupRow.getByRole('button', { name: 'Rename' }).click();
  await page.locator('#groupName').fill('Public Sector');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.locator('.shared-data-table')).toContainText('Public Sector');

  await page.locator('.shared-data-table tbody tr', { hasText: 'Public Sector' }).getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.locator('[data-confirm]').click();
  await expect(page.locator('.shared-data-table')).not.toContainText('Public Sector');

  await page.locator('.shared-data-table tbody tr', { hasText: 'School' }).getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await expect(page.locator('.gt-toast.error')).toContainText('before deleting it');
  const groupActions = await page.evaluate(() => GT.store.where('audit_logs', { entity_type: 'customer_groups' }).map((row) => row.action));
  expect(groupActions).toEqual(expect.arrayContaining(['create', 'update', 'delete']));
});

test('customer service excludes inactive picker options and calculates balance', async ({ page }) => {
  await loginAsRole(page, 'owner');
  const result = await page.evaluate(() => {
    const customer = GT.store.find('customers', 14);
    const invoice = GT.store.create('sales_documents', { type: 'invoice', number: 'BAL-1', customer_id: customer.id, status: 'issued', total: 500000 });
    GT.store.create('receipts', { customer_id: customer.id, invoice_id: invoice.id, amount: 125000, status: 'issued' });
    return {
      balance: GT.customers.balance(customer.id),
      inactiveIncluded: GT.customers.options().some((option) => GT.store.find('customers', option.value).active === false),
      inactiveSeedCount: GT.store.where('customers', { active: false }).length
    };
  });
  expect(result).toEqual({ balance: 375000, inactiveIncluded: false, inactiveSeedCount: 2 });
});

test('dirty customer form warns before changing routes', async ({ page }) => {
  await loginAsRole(page, 'owner', '#/customers/new');
  await page.getByLabel('Customer name').fill('Unsaved Customer');
  const dismissPrompt = new Promise((resolve) => page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('unsaved changes');
    await dialog.dismiss();
    resolve();
  }));
  await page.getByRole('link', { name: 'Dashboard' }).click();
  await dismissPrompt;
  await expect(page).toHaveURL(/#\/customers\/new$/);

  const acceptPrompt = new Promise((resolve) => page.once('dialog', async (dialog) => {
    await dialog.accept();
    resolve();
  }));
  await page.getByRole('link', { name: 'Dashboard' }).click();
  await acceptPrompt;
  await expect(page).toHaveURL(/#\/dashboard$/);
});
