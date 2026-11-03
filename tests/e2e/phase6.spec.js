// Phase 6 GRNs, stock adjustments, shared line editor and print foundation.
const { test, expect } = require('@playwright/test');
const fs = require('fs');

async function loginAsRole(page, role, route = '#/inventory/grns', reset = true) {
  await page.goto('/login.html');
  await page.evaluate(({ roleName, shouldReset }) => { if (shouldReset) GT.store.reset(); GT.session.loginAsRole(roleName); }, { roleName: role, shouldReset: reset });
  await page.goto('/index.html' + route);
}

async function fillFirstGrnLine(page, materialLabel, received, rejected = 0) {
  const row = page.locator('[data-line-row="0"]');
  await row.getByLabel('Material').fill(materialLabel);
  await row.getByLabel('Received').fill(String(received));
  await row.getByLabel('Rejected').fill(String(rejected));
}

test('shared Phase 6 helpers expose line, print and photo contracts', async ({ page }) => {
  await page.goto('/tests/unit.html');
  const result = await page.evaluate(() => ({
    editor: typeof GT.lineEditor.create,
    letterhead: GT.print.letterhead().includes(GT.settings.businessName),
    signatures: GT.print.signatureBlock(['Received by']).includes('Received by'),
    watermark: GT.print.watermark('VOID').includes('VOID'),
    photoLimit: GT.files.MAX_BYTES
  }));
  expect(result).toEqual({ editor: 'function', letterhead: true, signatures: true, watermark: true, photoLimit: 307200 });
});

test('Store Keeper posts accepted GRN stock without seeing cost', async ({ page }) => {
  await loginAsRole(page, 'store_keeper', '#/inventory/grns/new');
  await expect(page.getByRole('heading', { name: 'New Goods Received Note' })).toBeVisible();
  await expect(page.getByText('Unit cost', { exact: true })).toHaveCount(0);
  const expectedNumber = await page.evaluate(() => GT.numbering.peek('grn'));
  const before = await page.evaluate(() => [GT.inventory.getStock(1, GT.session.currentUser().location_id), GT.inventory.getStock(2, GT.session.currentUser().location_id)]);
  await page.locator('#supplier_id').selectOption('2');
  await page.getByLabel('Supplier document number').fill('DN-6001');
  await fillFirstGrnLine(page, 'Cotton Poplin White 60 inch — White — 60 in', 12, 2);
  await page.getByRole('button', { name: 'Add material' }).click();
  const secondRow = page.locator('[data-line-row="1"]');
  await secondRow.getByLabel('Material').fill('Drill Navy 58 inch — Navy — 58 in');
  await secondRow.getByLabel('Received').fill('5');
  await secondRow.getByLabel('Rejected').fill('1');
  await page.getByRole('button', { name: 'Post GRN' }).click();
  await expect(page).toHaveURL(/#\/inventory\/grns\/\d+$/);
  await expect(page.getByRole('heading', { name: 'GRN ' + expectedNumber })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Unit cost' })).toHaveCount(0);
  const after = await page.evaluate(() => [GT.inventory.getStock(1, GT.session.currentUser().location_id), GT.inventory.getStock(2, GT.session.currentUser().location_id)]);
  expect(after[0] - before[0]).toBe(10);
  expect(after[1] - before[1]).toBe(4);
  const saved = await page.evaluate(() => { const grn = GT.store.all('goods_received_notes').at(-1); return { grn, movements:GT.store.where('stock_movements', { reference_type:'goods_received_note', reference_id:grn.id }), next: GT.numbering.peek('grn') }; });
  expect(saved.grn.status).toBe('ok');
  expect(saved.movements.map((row) => row.quantity)).toEqual([10, 4]);
  expect(Number(saved.next)).toBe(Number(expectedNumber) + 1);
  await page.getByRole('button', { name: 'Print' }).click();
  await expect(page.locator('.print-preview-shell')).toBeVisible();
  await expect(page.locator('.print-page')).not.toContainText('Unit cost');
  await page.getByRole('button', { name: 'Back' }).click();
  await page.goto('/index.html#/inventory/grns');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]);
  expect(fs.readFileSync(await download.path(), 'utf8')).not.toContain('Accepted cost');
});

test('Store Keeper requests and Owner approves a protected stock adjustment', async ({ page }) => {
  await loginAsRole(page, 'store_keeper', '#/inventory/adjustments/new');
  const before = await page.evaluate(() => GT.inventory.getStock(3, 2));
  await page.locator('#material_id').selectOption('3');
  await page.locator('#direction').selectOption('increase');
  await page.locator('#quantity').fill('5');
  await page.locator('#reason').selectOption('found');
  await page.locator('#note').fill('Found during the morning stock count.');
  await page.getByRole('button', { name: 'Send request' }).click();
  await expect(page).toHaveURL(/#\/inventory\/adjustments\/\d+$/);
  expect(await page.evaluate(() => GT.inventory.getStock(3, 2))).toBe(before);
  const adjustmentId = await page.evaluate(() => GT.store.all('stock_adjustments').at(-1).id);

  await loginAsRole(page, 'owner', '#/inventory/adjustments', false);
  await expect(page.getByRole('link', { name: /Stock Adjustments/ })).toContainText('3');
  const row = page.locator('.shared-data-table tbody tr', { hasText: 'Polyester Grey 60 inch' });
  await row.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Approve' }).click();
  await page.locator('[data-confirm]').click();
  await expect(row).toContainText('Approved');
  expect(await page.evaluate(() => GT.inventory.getStock(3, 2))).toBe(before + 5);
  const saved = await page.evaluate((id) => ({ adjustment: GT.store.find('stock_adjustments', id), approvals: GT.store.where('approvals', { type: 'stock_adjustment' }) }), adjustmentId);
  expect(saved.adjustment.movement_id).toBeTruthy();
  expect(saved.approvals.some((approval) => approval.entity_id === adjustmentId && approval.status === 'approved')).toBeTruthy();
});

test('Stock Alerts prefill GRNs and supplier/material tabs show receipts', async ({ page }) => {
  await loginAsRole(page, 'owner', '#/inventory/alerts');
  await page.getByRole('button', { name: 'Receive stock' }).first().click();
  await expect(page).toHaveURL(/#\/inventory\/grns\/new\?material=1&supplier=2$/);
  await expect(page.locator('#supplier_id')).toHaveValue('2');
  await expect(page.locator('[data-line-row="0"]').getByLabel('Material')).toHaveValue('Cotton Poplin White 60 inch — White — 60 in');

  const grn = await page.evaluate(() => GT.grns.post({ supplier_id: 2, received_at: GT.dates.today(), location_id: 1, supplier_doc_no: 'LINK-1', supplier_doc_missing: false, received_by: 1, quantity_ok: true, quality_ok: true, damage_ok: true, colour_ok: true, notes: '', photo_data: '', items: [{ material_id: 1, entry_unit: 'base', quantity_received: 4, quantity_rejected: 0, unit_cost: 18000 }] }));
  await page.goto('/index.html#/inventory/suppliers/2');
  await page.getByRole('tab', { name: 'Goods Received and Purchases' }).click();
  await expect(page.getByRole('link', { name: grn.number })).toBeVisible();
  await page.goto('/index.html#/inventory/materials/1');
  await page.getByRole('tab', { name: 'Suppliers and purchases' }).click();
  await expect(page.getByRole('link', { name: grn.number })).toBeVisible();
  await page.goto('/index.html#/admin/numbering');
  const numberRow = page.locator('.shared-data-table tbody tr', { hasText: 'Grn' });
  await expect(numberRow).toContainText(grn.number);
});

test('Owner GRN workflow shows costs and produces the required visual checkpoints', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsRole(page, 'owner');
  await expect(page.getByRole('heading', { name: 'Goods Received Notes' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('grn-list-1440x900.png'), fullPage: true });

  await page.getByRole('link', { name: 'New GRN' }).click();
  await page.locator('#supplier_id').selectOption('2');
  await page.getByLabel('Supplier document number').fill('OWNER-DN-01');
  await fillFirstGrnLine(page, 'Cotton Poplin White 60 inch — White — 60 in', 12, 2);
  await page.locator('[data-line-row="0"]').getByLabel('Unit cost').fill('18000');
  await page.getByRole('button', { name: 'Add material' }).click();
  const second = page.locator('[data-line-row="1"]');
  await second.getByLabel('Material').fill('Drill Navy 58 inch — Navy — 58 in');
  await second.getByLabel('Received').fill('5');
  await second.getByLabel('Rejected').fill('0');
  await second.getByLabel('Unit cost').fill('22000');
  await expect(page.locator('[data-line-footer]')).toContainText('UGX 290,000');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('grn-form-line-editor-1440x900.png'), fullPage: true });
  await page.getByRole('button', { name: 'Post GRN' }).click();
  await expect(page).toHaveURL(/#\/inventory\/grns\/\d+$/);
  await expect(page.getByRole('columnheader', { name: 'Unit cost' })).toBeVisible();
  await expect(page.locator('.grn-items-table')).toContainText('UGX 18,000');
  await page.locator('.gt-toast-close').click();
  await expect(page.locator('.gt-toast')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('grn-detail-1440x900.png'), fullPage: true });

  await page.getByRole('button', { name: 'Print' }).click();
  await expect(page.locator('.print-preview-shell')).toBeVisible();
  await expect(page.locator('.print-page')).toContainText('18,000/=');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath('grn-print-preview-1440x900.png'), fullPage: true });
  await page.getByRole('button', { name: 'Back' }).click();

  await page.goto('/index.html#/inventory/grns/3');
  await page.getByRole('button', { name: 'Prepare supplier notice' }).click();
  await expect(page.locator('#supplierNoticeText')).toHaveValue(/GRN|goods received note 0003/i);
  await expect(page.locator('#supplierNoticeText')).toHaveValue(/Quantity, Damage/);
  await page.screenshot({ path: testInfo.outputPath('supplier-notice-modal-1440x900.png'), fullPage: true });
  await page.getByRole('button', { name: 'Mark as notified' }).click();
  await expect(page.getByText('Yes', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => GT.store.where('audit_logs', (row) => row.entity_type === 'goods_received_notes' && row.entity_id === 3 && row.action === 'update').length)).toBeGreaterThan(0);

  await page.goto('/index.html#/inventory/adjustments');
  await expect(page.getByRole('heading', { name: 'Stock Adjustments' })).toBeVisible();
  await page.locator('.gt-toast-close').click();
  await expect(page.locator('.gt-toast')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('stock-adjustments-list-1440x900.png'), fullPage: true });

  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/index.html#/inventory/grns/new');
  await expect(page.locator('.line-editor')).toBeVisible();
  await page.evaluate(() => { document.querySelectorAll('.gt-toast-close').forEach((button) => button.click()); window.scrollTo(0, 0); });
  await expect(page.locator('.gt-toast')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath('grn-form-360x740.png'), fullPage: true });
});

test('GRN validation covers delivery, lines, duplicates and discrepancies', async ({ page }) => {
  await loginAsRole(page, 'owner');
  const errors = await page.evaluate(() => {
    const base = { supplier_id:2, received_at:GT.dates.today(), location_id:1, received_by:1, supplier_doc_no:'DN-1', supplier_doc_missing:false, quantity_ok:true, quality_ok:true, damage_ok:true, colour_ok:true, notes:'', items:[{ material_id:1, quantity_received:10, quantity_rejected:0, unit_cost:18000 }] };
    const check = (changes) => GT.grns.validateDraft(Object.assign({}, base, changes));
    return {
      supplier:check({ supplier_id:null }).supplier_id,
      future:check({ received_at:'2099-01-01' }).received_at,
      noLines:check({ items:[] }).items,
      rejected:check({ items:[{ material_id:1, quantity_received:2, quantity_rejected:3 }] }).items,
      duplicate:check({ items:[base.items[0], Object.assign({}, base.items[0])] }).items,
      discrepancy:check({ damage_ok:false, notes:'short' }).notes,
      supplierDocument:check({ supplier_doc_no:'' }).supplier_doc_no
    };
  });
  Object.values(errors).forEach((message) => expect(message).toBeTruthy());
  expect(errors.future).toContain('future');
  expect(errors.duplicate).toContain('more than once');
  expect(errors.discrepancy).toContain('10 characters');
});

test('posted GRNs lock quantities, Owner can edit notes, and void safely reverses stock', async ({ page }) => {
  await loginAsRole(page, 'owner');
  const created = await page.evaluate(() => GT.grns.post({ supplier_id:2, received_at:GT.dates.today(), location_id:1, supplier_doc_no:'VOID-TEST', supplier_doc_missing:false, received_by:1, quantity_ok:true, quality_ok:true, damage_ok:true, colour_ok:true, notes:'Initial owner note', photo_data:'', items:[{ material_id:9, entry_unit:'base', quantity_received:2, quantity_rejected:0, unit_cost:17500 }] }));
  await page.goto('/index.html#/inventory/grns/' + created.id + '/edit');
  await expect(page.getByText('Quantities are locked once posted.')).toBeVisible();
  await expect(page.locator('[data-line-field]')).toHaveCount(0);
  await page.locator('#editNotes').fill('Owner updated this posted note.');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Owner updated this posted note.')).toBeVisible();
  const beforeVoid = await page.evaluate(() => GT.inventory.getStock(9, 1));
  await page.getByRole('button', { name: 'Void' }).click();
  await page.locator('#grnVoidReason').fill('Duplicate supplier delivery entry.');
  await page.getByRole('button', { name: 'Void GRN' }).click();
  await expect(page.getByText('Void', { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => GT.inventory.getStock(9, 1))).toBe(beforeVoid - 2);
  const reversal = await page.evaluate((id) => GT.store.where('stock_movements', (row) => row.reference_type === 'goods_received_note' && row.reference_id === id && row.note === 'GRN void')[0], created.id);
  expect(reversal.quantity).toBe(-2);
  await page.getByRole('button', { name: 'Print' }).click();
  await expect(page.locator('.print-watermark')).toContainText('VOID');

  const refused = await page.evaluate(() => {
    GT.print.close && GT.print.close();
    const item = GT.store.create('materials', { name:'Void Refusal Material', category:'thread', subtype:'', unit:'cone', colour:'White', fabric_type:'', width_inches:null, supplier_id:3, cost_per_unit:1000, full_stock_level:10, roll_length_m:null, notes:'', active:true });
    const grn = GT.grns.post({ supplier_id:3, received_at:GT.dates.today(), location_id:1, supplier_doc_no:'USED-UP', supplier_doc_missing:false, received_by:1, quantity_ok:true, quality_ok:true, damage_ok:true, colour_ok:true, notes:'', photo_data:'', items:[{ material_id:item.id, entry_unit:'base', quantity_received:2, quantity_rejected:0, unit_cost:1000 }] });
    GT.inventory.recordMovement({ materialId:item.id, locationId:1, type:'issue', quantity:-2, referenceType:'test', referenceId:1, note:'Used before attempted void' });
    try { GT.grns.voidNote(grn.id, 'Try to reverse used goods'); } catch (error) { return { message:error.message, status:GT.store.find('goods_received_notes', grn.id).status }; }
    return { message:'', status:'' };
  });
  expect(refused.message).toContain('already been used');
  expect(refused.status).toBe('ok');
});

test('adjustment decisions enforce ownership, current stock and direct Owner approval', async ({ page }) => {
  await loginAsRole(page, 'store_keeper', '#/inventory/adjustments');
  await expect(page.locator('.shared-data-table tbody tr')).toHaveCount(3);
  await expect(page.locator('[data-route="#/inventory/adjustments"] .nav-count-badge')).toHaveCount(0);

  await loginAsRole(page, 'owner', '#/inventory/adjustments', false);
  await expect(page.locator('[data-route="#/inventory/adjustments"] .nav-count-badge')).toHaveText('2');
  const rejectedStock = await page.evaluate(() => GT.inventory.getStock(7, 1));
  await page.goto('/index.html#/inventory/adjustments/2');
  await page.getByRole('button', { name: 'Reject' }).click();
  await page.locator('#confirmAdjustmentReject').click();
  await expect(page.locator('#adjustmentDecisionError')).toContainText('required');
  await page.locator('#adjustmentDecisionNote').fill('Damage report did not include a witness.');
  await page.locator('#confirmAdjustmentReject').click();
  expect(await page.evaluate(() => GT.store.find('stock_adjustments', 2).decision_note)).toContain('witness');
  expect(await page.evaluate(() => GT.inventory.getStock(7, 1))).toBe(rejectedStock);

  const ownerResult = await page.evaluate(() => {
    const before = GT.inventory.getStock(8, 1);
    const record = GT.adjustments.create({ material_id:8, location_id:1, direction:'increase', quantity:3, reason:'found', note:'Owner confirmed stock count.' });
    return { status:record.status, movementId:record.movement_id, delta:GT.inventory.getStock(8, 1)-before };
  });
  expect(ownerResult).toEqual({ status:'approved', movementId:expect.any(Number), delta:3 });

  const refusal = await page.evaluate(() => {
    const item = GT.store.create('materials', { name:'Adjustment Refusal Material', category:'thread', subtype:'', unit:'cone', colour:'Black', fabric_type:'', width_inches:null, supplier_id:3, cost_per_unit:1000, full_stock_level:10, roll_length_m:null, notes:'', active:true });
    GT.inventory.recordMovement({ materialId:item.id, locationId:1, type:'opening', quantity:5, note:'Test opening' });
    GT.session.loginAsRole('store_keeper');
    const request = GT.adjustments.create({ material_id:item.id, location_id:1, direction:'decrease', quantity:5, reason:'lost', note:'Stock Keeper count requested decrease.' });
    GT.session.loginAsRole('owner');
    GT.inventory.recordMovement({ materialId:item.id, locationId:1, type:'issue', quantity:-5, note:'Used after request' });
    try { GT.adjustments.approve(request.id, 'Approve'); } catch (error) { return { message:error.message, status:GT.store.find('stock_adjustments', request.id).status }; }
    return { message:'', status:'' };
  });
  expect(refusal.message).toContain('now larger than current stock');
  expect(refusal.status).toBe('pending');
});

test('GRN and adjustment routes preserve the permission matrix', async ({ page }) => {
  await loginAsRole(page, 'general_manager', '#/inventory/grns/new');
  await expect(page.getByText('Unit cost', { exact: true })).toBeVisible();
  await page.goto('/index.html#/inventory/grns/1');
  await expect(page.getByRole('button', { name: 'Void' })).toHaveCount(0);

  await loginAsRole(page, 'accountant', '#/inventory/grns/1');
  await expect(page.getByRole('columnheader', { name: 'Unit cost' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prepare supplier notice' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'New GRN' })).toHaveCount(0);
  await page.goto('/index.html#/inventory/grns/new');
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();

  for (const role of ['sales', 'workshop_supervisor', 'marketing_manager']) {
    await loginAsRole(page, role, '#/inventory/grns');
    await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
    await page.goto('/index.html#/inventory/adjustments');
    await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
  }
});
