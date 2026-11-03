const { test, expect } = require('@playwright/test');
const fs = require('fs');

async function start(page, role = 'owner', route = '#/material-issues') {
  await page.goto('/login.html?today=2026-10-27');
  await page.evaluate((selected) => { GT.store.reset(); GT.session.loginAsRole(selected); }, role);
  await page.goto('/index.html?today=2026-10-27' + route);
}

test('create from order, issue, return and preserve the stage', async ({ page }) => {
  await start(page, 'store_keeper', '#/orders/3');
  await expect(page.getByRole('heading', {name:'Materials issued'})).toBeVisible();
  await page.getByRole('link', {name:'Request material'}).click();
  await expect(page.locator('#order_id')).toHaveValue('3');
  const before = await page.evaluate(() => GT.inventory.getStock(9,1));
  await page.locator('#location_id').selectOption('1');
  await page.locator('[data-line-field="material_id"]').fill(await page.evaluate(() => GT.store.find('materials',9).name));
  await page.locator('[data-line-field="quantity"]').fill('2');
  await page.getByRole('button', {name:'Create request'}).click();
  await expect(page.locator('h1')).toContainText('Material issue request');
  expect(await page.evaluate(() => GT.inventory.getStock(9,1))).toBe(before);
  await page.getByRole('button', {name:'Issue',exact:true}).click();
  await page.getByRole('dialog').getByRole('button', {name:'Issue',exact:true}).click();
  await expect(page.locator('h1')).toContainText('Material issue 7');
  const issued = await page.evaluate(() => ({stock:GT.inventory.getStock(9,1),stage:GT.store.find('orders',3).current_stage,
    number:GT.store.find('material_issues',9).number}));
  expect(issued).toEqual({stock:before-2,stage:'Sewing',number:'7'});
  await page.getByRole('button', {name:'Record return'}).click();
  await page.locator('[data-return-line]').fill('1');
  await page.getByRole('dialog').getByRole('button', {name:'Record return'}).click();
  expect(await page.evaluate(() => GT.inventory.getStock(9,1))).toBe(before-1);
  await expect(page.getByRole('button', {name:'Void',exact:true})).toHaveCount(0);
});

test('service blocks over-issue, excess return, reasonless decisions and number reuse', async ({ page }) => {
  await start(page);
  const result = await page.evaluate(() => {
    const blocked = (fn) => { try { fn(); return false; } catch { return true; } };
    const initial = GT.inventory.getStock(10,1);
    const request = GT.materialIssues.createRequest({order_id:4,location_id:1,lines:[{material_id:10,quantity:initial+1}]});
    const overIssue = blocked(() => GT.materialIssues.issue(request.id));
    const numberAfterFailure = GT.numbering.peek('material_issue');
    const noReason = blocked(() => GT.materialIssues.reject(request.id,''));
    GT.materialIssues.reject(request.id,'Insufficient material');
    const afterReject = GT.inventory.getStock(10,1);
    const cancelled = GT.materialIssues.createRequest({order_id:4,location_id:1,lines:[{material_id:10,quantity:1}]});
    GT.materialIssues.cancelRequest(cancelled.id);
    const cancelTwice = blocked(() => GT.materialIssues.cancelRequest(cancelled.id));
    const fresh = GT.materialIssues.createRequest({order_id:4,location_id:1,lines:[{material_id:10,quantity:1}]});
    const issued = GT.materialIssues.issue(fresh.id);
    GT.materialIssues.void(issued.id,'Wrong order allocation');
    return {overIssue,noReason,cancelTwice,numberAfterFailure,afterReject,initial,
      afterVoid:GT.inventory.getStock(10,1),voidNumber:GT.store.find('material_issues',issued.id).number,next:GT.numbering.peek('material_issue'),
      activeOrderBlocked:blocked(() => GT.materialIssues.createRequest({order_id:1,location_id:1,lines:[{material_id:10,quantity:1}]}))};
  });
  expect(result).toMatchObject({overIssue:true,noReason:true,cancelTwice:true,numberAfterFailure:'7',
    afterReject:result.initial,afterVoid:result.initial,voidNumber:'7',next:'8',activeOrderBlocked:true});
});

test('form stock warning follows role and Workshop Supervisor sees only own requests', async ({ page }) => {
  await start(page,'store_keeper','#/material-issues/new?order=3');
  await page.locator('#location_id').selectOption('1');
  await page.locator('[data-line-field="material_id"]').fill(await page.evaluate(() => GT.store.find('materials',1).name));
  await page.locator('[data-line-field="quantity"]').fill('1');
  await page.getByRole('button',{name:'Create request'}).click();
  await expect(page.locator('#issueLineError')).toContainText('Not enough in stock');
  expect(await page.evaluate(() => GT.store.count('material_issues'))).toBe(8);
  const foreignId = await page.evaluate(() => GT.materialIssues.createRequest({order_id:3,location_id:1,lines:[{material_id:9,quantity:1}]}).id);
  await page.evaluate(() => { GT.forms.clearDirty(); GT.session.loginAsRole('workshop_supervisor'); });
  await page.reload();
  await expect(page.locator('#materialIssueForm')).toBeVisible();
  await page.locator('[data-line-field="material_id"]').fill(await page.evaluate(() => GT.store.find('materials',1).name));
  await page.locator('[data-line-field="quantity"]').fill('1');
  await expect(page.locator('#issueStockNote')).toContainText('Not enough in stock');
  await page.getByRole('button',{name:'Create request'}).click();
  await expect(page.locator('h1')).toContainText('Material issue request');
  expect(await page.evaluate(() => GT.materialIssues.list().length)).toBe(9);
  await page.goto('/index.html?today=2026-10-27#/material-issues/' + foreignId);
  await expect(page.locator('h1')).toHaveText('Material issue unavailable');
});

test('roles, quantities only, navigation badge and 360px list', async ({ page }) => {
  await start(page, 'workshop_supervisor');
  await expect(page.locator('h1')).toHaveText('Material Issues');
  await expect(page.locator('.shared-data-table tbody tr')).toHaveCount(8);
  await expect(page.getByRole('button', {name:'Issue',exact:true})).toHaveCount(0);
  await page.goto('/index.html?today=2026-10-27#/material-issues/1');
  await expect(page.locator('h1')).toContainText('Material issue 1');
  await expect(page.locator('#pageContent')).not.toContainText(/UGX|price|cost/i);
  await page.goto('/index.html?today=2026-10-27#/material-issues/new');
  await expect(page.locator('#materialIssueForm')).toBeVisible();
  await page.setViewportSize({width:360,height:800});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1)).toBeTruthy();
  await page.goto('/index.html?today=2026-10-27#/material-issues/1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1)).toBeTruthy();
  await page.goto('/index.html?today=2026-10-27#/material-issues');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1)).toBeTruthy();
  await page.evaluate(() => GT.session.loginAsRole('store_keeper'));
  await page.reload();
  await expect(page.locator('#appSidebar a[href="#/material-issues"] .nav-count-badge')).toHaveText('1');
  await page.evaluate(() => GT.session.loginAsRole('sales'));
  await page.reload();
  await expect(page.locator('h1')).toHaveText('Access denied');
});

test('slip print preview contains quantities and no monetary data', async ({ page }) => {
  await start(page, 'store_keeper', '#/material-issues/1');
  await page.getByRole('button', {name:'Print slip'}).click();
  await expect(page.locator('.print-page h1')).toHaveText('MATERIAL ISSUE SLIP');
  await expect(page.locator('.print-page')).not.toContainText(/UGX|price|cost/i);
  const pdf = await page.pdf({format:'A4'});
  expect(pdf.length).toBeGreaterThan(1000);
});

test('list, form, detail, slip and CSV omit money for every permitted role', async ({ page }) => {
  await start(page);
  for (const role of ['owner','general_manager','store_keeper','workshop_supervisor','accountant']) {
    await page.evaluate((selected) => GT.session.loginAsRole(selected),role);
    await page.goto('/index.html?today=2026-10-27#/material-issues');
    await page.reload();
    await expect(page.locator('#pageContent')).not.toContainText(/UGX|price|cost/i);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button',{name:'Export CSV'}).click();
    const download = await downloadPromise;
    const csv = fs.readFileSync(await download.path(),'utf8');
    expect(csv).not.toMatch(/UGX|price|cost/i);
    await page.goto('/index.html?today=2026-10-27#/material-issues/1');
    await expect(page.locator('#pageContent')).not.toContainText(/UGX|price|cost/i);
    await page.getByRole('button',{name:'Print slip'}).click();
    await expect(page.locator('.print-page')).not.toContainText(/UGX|price|cost/i);
    await page.locator('[data-print-back]').click();
    if (role !== 'accountant') {
      await page.goto('/index.html?today=2026-10-27#/material-issues/new');
      await expect(page.locator('#pageContent')).not.toContainText(/UGX|price|cost/i);
    }
  }
});

test('capture Phase 13 list, form, detail, order section, slip and phone layouts', async ({ page }) => {
  async function capture(name) { await page.waitForTimeout(550); await page.screenshot({path:'tests/screenshots/' + name,fullPage:true}); }
  await page.setViewportSize({width:1440,height:900});
  await start(page,'store_keeper');
  await capture('phase13-list-store.png');
  await page.goto('/index.html?today=2026-10-27#/material-issues/new?order=3');
  await capture('phase13-form-store.png');
  await page.goto('/index.html?today=2026-10-27#/material-issues/1');
  await capture('phase13-detail-store.png');
  await page.getByRole('button',{name:'Print slip'}).click();
  await capture('phase13-slip-preview.png');
  await page.pdf({format:'A4',printBackground:true,path:'tests/screenshots/phase13-slip-a4.pdf'});
  await page.locator('[data-print-back]').click();
  await page.goto('/index.html?today=2026-10-27#/orders/3');
  await capture('phase13-order-materials.png');
  await page.evaluate(() => GT.session.loginAsRole('workshop_supervisor'));
  await page.goto('/index.html?today=2026-10-27#/material-issues');
  await page.reload();
  await capture('phase13-list-workshop.png');
  await page.goto('/index.html?today=2026-10-27#/material-issues/new?order=3');
  await capture('phase13-form-workshop.png');
  await page.goto('/index.html?today=2026-10-27#/material-issues/1');
  await capture('phase13-detail-workshop.png');
  await page.setViewportSize({width:360,height:800});
  await page.goto('/index.html?today=2026-10-27#/material-issues');
  await capture('phase13-list-360.png');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1)).toBeTruthy();
});
