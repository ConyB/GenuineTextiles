// Phase 6.4 shared KPI interaction and requested visual checkpoints.
const { test, expect } = require('@playwright/test');

async function loginOwner(page, route) {
  await page.goto('/login.html');
  await page.evaluate(() => { GT.store.reset(); GT.session.loginAsRole('owner'); });
  await page.goto('/index.html' + route);
}

async function waitForSettledIcons(page) {
  // Lucide replaces data attributes after each route render; wait so visual
  // checkpoints show the finished controls rather than placeholder glyphs.
  await expect(page.locator('#appTopbar svg')).not.toHaveCount(0);
  await expect(page.locator('.page-content svg').first()).toBeVisible();
}

test('Stock Alert KPI cards toggle the shared status filter', async ({ page }) => {
  await loginOwner(page, '#/inventory/alerts');
  const out = page.locator('#stockAlertStats [data-stat-card="0"]');
  await expect(out).toHaveAttribute('aria-pressed', 'false');
  await out.click();
  await expect(out).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.shared-data-table tbody tr')).toHaveCount(2);
  await expect(page.locator('.shared-data-table tbody tr .status-error')).toHaveCount(2);
  await out.click();
  await expect(out).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.shared-data-table tbody tr')).toHaveCount(8);

  const low = page.locator('#stockAlertStats [data-stat-card="1"]');
  await low.click();
  await expect(low).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(low).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.shared-data-table tbody tr')).toHaveCount(8);
});

test('captures the Phase 6.4 polished pages', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginOwner(page, '#/inventory/alerts');
  await waitForSettledIcons(page);
  await page.screenshot({ path: testInfo.outputPath('stock-alerts-1440x900.png'), fullPage: true });
  for (const item of [
    { name: 'goods-received-notes', route: '#/inventory/grns' },
    { name: 'stock-adjustments', route: '#/inventory/adjustments' }
  ]) {
    await page.goto('/index.html' + item.route);
    await waitForSettledIcons(page);
    await page.screenshot({ path: testInfo.outputPath(item.name + '-1440x900.png'), fullPage: true });
  }
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/index.html#/inventory/alerts');
  await waitForSettledIcons(page);
  await page.screenshot({ path: testInfo.outputPath('stock-alerts-360x740.png'), fullPage: true });
});
