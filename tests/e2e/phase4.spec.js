// Phase 4 Suppliers, Business Settings, Document Numbering and Audit Log flows.
const { test, expect } = require('@playwright/test');

async function loginAsRole(page, role, route, reset = true) {
  await page.goto('/login.html');
  await page.evaluate(({ roleName, shouldReset }) => { if (shouldReset) GT.store.reset(); GT.session.loginAsRole(roleName); }, { roleName: role, shouldReset: reset });
  await page.goto('/index.html' + route);
}

async function closeToasts(page) {
  await page.locator('.gt-toast-close').evaluateAll((buttons) => buttons.forEach((button) => button.click()));
  await expect(page.locator('.gt-toast')).toHaveCount(0);
}

async function fillSupplier(page, values) {
  await page.getByLabel('Supplier name').fill(values.name);
  await page.getByLabel('Supplier type').selectOption(values.type);
  await page.getByLabel('Phone').fill(values.phone);
  await page.getByLabel('Contact person').fill(values.contact || 'Supplier Contact');
  await page.getByLabel('Email').fill(values.email || 'supplier@example.demo');
  await page.getByLabel('Location').fill(values.location || 'Kampala');
  await page.getByLabel('What they supply').fill(values.supplies || 'Uniform fabric');
}

test('Suppliers validate formats and support audited lifecycle without hard delete', async ({ page }, testInfo) => {
  test.setTimeout(45000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsRole(page, 'owner', '#/inventory/suppliers/new');
  await fillSupplier(page, { name: 'Phase Four Local Supplier', type: 'local', phone: '+254700123456' });
  await page.getByRole('button', { name: 'Create supplier' }).click();
  await expect(page.locator('#phoneError')).toContainText('Local suppliers');
  await page.getByLabel('Phone').fill('0700 444 111');
  await page.getByLabel('Fabric', { exact: true }).check();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('suppliers-form-1440x900.png') });
  await page.getByRole('button', { name: 'Create supplier' }).click();
  const localId = Number(await page.locator('.supplier-detail-page').getAttribute('data-supplier-id'));
  await closeToasts(page);

  await page.goto('/index.html#/inventory/suppliers/new');
  await fillSupplier(page, { name: 'Phase Four Import Supplier', type: 'import', phone: '0700 444 222', location: 'Nairobi, Kenya' });
  await page.getByRole('button', { name: 'Create supplier' }).click();
  await expect(page.locator('#phoneError')).toContainText('Import suppliers');
  await page.getByLabel('Phone').fill('+254 700 444 222');
  await page.getByRole('button', { name: 'Create supplier' }).click();
  const importId = Number(await page.locator('.supplier-detail-page').getAttribute('data-supplier-id'));
  await closeToasts(page);

  await page.goto('/index.html#/inventory/suppliers/new');
  await fillSupplier(page, { name: 'phase four local supplier', type: 'local', phone: '0700 555 333' });
  await page.getByRole('button', { name: 'Create supplier' }).click();
  await expect(page.locator('#nameError')).toContainText('already exists');
  await page.evaluate(() => GT.forms.clearDirty());

  await page.goto('/index.html#/inventory/suppliers/' + localId + '/edit');
  await page.getByLabel('Contact person').fill('Updated Supplier Contact');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('#supplier-overview')).toContainText('Updated Supplier Contact');
  await page.getByRole('button', { name: 'Deactivate' }).click();
  await page.locator('[data-confirm]').click();
  await expect(page.locator('.module-title-line .status-badge')).toHaveText('Inactive');
  await page.getByRole('button', { name: 'Activate' }).click();
  await expect(page.locator('.module-title-line .status-badge')).toHaveText('Active');
  await closeToasts(page);

  await page.goto('/index.html#/inventory/suppliers');
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
  await page.waitForTimeout(600);
  await page.screenshot({ path: testInfo.outputPath('suppliers-list-1440x900.png') });
  const audit = await page.evaluate(({ first, second }) => GT.store.where('audit_logs', (row) => row.entity_type === 'suppliers' && [first, second].includes(row.entity_id)).map((row) => row.action), { first: localId, second: importId });
  expect(audit).toEqual(expect.arrayContaining(['create', 'update', 'deactivate', 'activate']));
});

test('Supplier permissions match the matrix', async ({ page }) => {
  await loginAsRole(page, 'store_keeper', '#/inventory/suppliers');
  await expect(page.getByRole('link', { name: 'New supplier' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
  await page.goto('/index.html#/inventory/suppliers/1/edit');
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
  await loginAsRole(page, 'workshop_supervisor', '#/inventory/suppliers', false);
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
});

test('Business Settings validates, previews, saves live and audits', async ({ page }, testInfo) => {
  test.setTimeout(45000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsRole(page, 'owner', '#/admin/settings');
  await page.getByLabel('Business name').fill('Genuine Textiles Updated');
  await expect(page.locator('#previewBusinessName')).toHaveText('Genuine Textiles Updated');
  await page.waitForTimeout(500);
  await page.screenshot({ path: testInfo.outputPath('business-settings-preview-1440x900.png') });

  await page.getByLabel('Business name').fill('');
  await page.getByLabel('Tagline').fill('');
  await page.getByLabel('General email').fill('wrong@');
  await page.getByLabel('VAT rate (%)').fill('101');
  await page.getByLabel('Quotation validity (days)').fill('0');
  await page.evaluate(() => document.querySelectorAll('[name^="phone_"]').forEach((input) => { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); }));
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.locator('#nameError')).toContainText('required');
  await expect(page.locator('#phone_1Error')).toContainText('at least one');
  await expect(page.locator('#vat_rateError')).toContainText('between 0 and 100');

  await page.getByLabel('Business name').fill('Genuine Textiles Updated');
  await page.getByLabel('Tagline').fill('Quality Uniforms, Made Well');
  await page.getByLabel('General email').fill('office@genuinetextiles.demo');
  await page.getByLabel('VAT rate (%)').fill('18');
  await page.getByLabel('Quotation validity (days)').fill('14');
  await page.getByLabel('Phone number 1').fill('+256 700 111 222');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.locator('.sidebar-wordmark')).toContainText('GENUINE TEXTILES UPDATED');
  expect(await page.evaluate(() => GT.settings.businessName)).toBe('Genuine Textiles Updated');
  expect(await page.evaluate(() => GT.store.where('audit_logs', { entity_type: 'business_settings' }).some((row) => row.user_id === 1))).toBeTruthy();

  await page.evaluate(() => GT.session.logout());
  await page.goto('/login.html');
  await expect(page.locator('.auth-brand-name')).toHaveText('GENUINE TEXTILES UPDATED');
  await expect(page.locator('.auth-brand-tagline')).toHaveText('Quality Uniforms, Made Well');
});

test('Business Settings roles and mobile preview are correct', async ({ page }, testInfo) => {
  await loginAsRole(page, 'general_manager', '#/admin/settings');
  await expect(page.getByRole('button', { name: 'Save settings' })).toHaveCount(0);
  await expect(page.getByLabel('Business name')).toBeDisabled();
  await loginAsRole(page, 'sales', '#/admin/settings', false);
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();

  await loginAsRole(page, 'owner', '#/admin/settings', false);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.locator('[data-settings-panel="preview"]')).toHaveClass(/mobile-active/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath('business-settings-360x740.png') });
});

test('Document Numbering enforces issued numbers and shared numbering service', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsRole(page, 'owner', '#/admin/numbering');
  await page.waitForTimeout(500);
  await page.screenshot({ path: testInfo.outputPath('document-numbering-1440x900.png') });
  const invoiceRow = page.locator('.shared-data-table tbody tr', { hasText: 'Invoice' });
  await invoiceRow.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('#sequenceNext').fill('700');
  await expect(page.locator('#numberPreview')).toHaveText('700');
  await page.getByRole('button', { name: 'Review change' }).click();
  await page.locator('[data-confirm]').click();
  expect(await page.evaluate(() => GT.numbering.next('invoice'))).toBe('700');
  expect(await page.evaluate(() => GT.numbering.peek('quotation'))).toBe('099');

  await page.evaluate(() => GT.store.create('sales_documents', { type: 'invoice', number: '800', status: 'issued' }));
  await page.evaluate(() => GT.app.renderPage());
  await page.locator('.shared-data-table tbody tr', { hasText: 'Invoice' }).getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('#sequenceNext').fill('799');
  await page.getByRole('button', { name: 'Review change' }).click();
  await expect(page.locator('#sequenceNextError')).toContainText('higher than the last issued number');

  await windowCloseModal(page);
  await loginAsRole(page, 'general_manager', '#/admin/numbering', false);
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
  await expect(page.locator('.status-badge')).toHaveText('Read only');
});

async function windowCloseModal(page) {
  const close = page.locator('[data-modal-close]');
  if (await close.count()) await close.click();
}

test('Audit Log filters and compares a customer change for permitted roles', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsRole(page, 'owner', '#/dashboard');
  await page.evaluate(() => { const before = GT.store.find('customers', 1); const after = GT.store.update('customers', 1, { address: 'Updated audit address' }); GT.audit.log('update', 'customers', 1, before, after); });
  await page.goto('/index.html#/admin/audit-log');
  await expect(page.locator('.table-result-count')).toContainText('of 32 results');
  await page.locator('[data-date-range-trigger]').click();
  await page.getByRole('option', { name: 'Custom range' }).click();
  await page.locator('.date-range-popover input[data-date-from]').fill('2026-10-21');
  await page.locator('.date-range-popover input[data-date-to]').fill('2026-10-21');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.locator('.table-result-count')).toContainText('of 2 results');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.locator('[data-table-filter="action"]').selectOption('update');
  await page.locator('[data-table-filter="entity"]').selectOption('customers');
  await page.locator('[data-table-filter="user"]').selectOption('1');
  await expect(page.locator('.shared-data-table tbody tr').first()).toContainText('Update Customers #1');
  await page.locator('.shared-data-table tbody tr').first().getByRole('button', { name: 'View changes' }).click();
  await expect(page.locator('.audit-change-table')).toContainText('Address');
  await expect(page.locator('.audit-change-table')).toContainText('Updated audit address');
  await page.screenshot({ path: testInfo.outputPath('audit-log-changes-1440x900.png') });
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
  await windowCloseModal(page);

  await loginAsRole(page, 'accountant', '#/admin/audit-log', false);
  await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible();
  await loginAsRole(page, 'store_keeper', '#/admin/audit-log', false);
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
});
