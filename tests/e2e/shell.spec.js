// Phase 1 shell and authentication flows, including the Phase 1.1 layout checks.
const { test, expect } = require('@playwright/test');

async function demoLogin(page, role) {
  await page.goto('/login.html');
  await page.locator('.demo-access').evaluate((element) => { element.open = true; });
  await page.getByRole('button', { name: 'Log in as ' + role }).click();
}

test('login works and bad credentials show an error', async ({ page }) => {
  await page.goto('/login.html');
  await page.locator('#email').fill('owner@genuinetextiles.demo');
  await page.locator('#password').fill('wrong');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.locator('#loginError')).toBeVisible();
  await page.locator('#password').fill('demo123');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/index.html#\/dashboard/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('Owner sees every menu group', async ({ page }) => {
  await demoLogin(page, 'Owner');
  for (const group of ['Sales', 'Customers', 'Orders and Production', 'Inventory', 'Debtors', 'Finance', 'People', 'Communication', 'Marketing', 'Administration']) await expect(page.getByText(group, { exact: true })).toBeVisible();
});

test('Store Keeper sees delivery under Sales and Workshop Supervisor cannot see Finance', async ({ page }) => {
  await demoLogin(page, 'Store Keeper');
  await expect(page.getByText('Sales', { exact: true })).toBeVisible();
  await expect(page.locator('#appSidebar a[href="#/delivery-notes"]')).toBeVisible();
  await expect(page.locator('#appSidebar a[href="#/sales/quotations"]')).toHaveCount(0);
  await demoLogin(page, 'Workshop Supervisor');
  await expect(page.getByText('Finance', { exact: true })).toHaveCount(0);
});

test('restricted URL shows access denied', async ({ page }) => {
  await demoLogin(page, 'Store Keeper');
  await page.goto('/index.html#/sales/invoices');
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
});

test('logout returns to login', async ({ page }) => {
  await demoLogin(page, 'Owner');
  await page.getByRole('button', { name: 'User menu' }).click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/login.html/);
});

test('desktop shell stays beside the sidebar and quick actions stay on one row', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await demoLogin(page, 'Owner');
  await expect(page.locator('#appSidebar')).toHaveCSS('width', '260px');
  const sidebar = await page.locator('#appSidebar').boundingBox();
  const topbar = await page.locator('#appTopbar').boundingBox();
  const quickActions = await page.locator('.quick-action').evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom };
  }));
  expect(sidebar.width).toBe(260);
  expect(topbar.x).toBe(260);
  expect(topbar.y).toBe(0);
  expect(await page.locator('.topbar-actions').evaluate((element) => getComputedStyle(element).flexWrap)).toBe('nowrap');
  for (const action of quickActions) expect(action.top >= topbar.y && action.bottom <= topbar.y + topbar.height).toBeTruthy();
});

test('login has no vertical scrollbar at 1366 by 768 and the password toggle works', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/login.html');
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBeTruthy();
  const passwordToggle = page.getByRole('button', { name: 'Show password' });
  await expect(passwordToggle).toHaveAttribute('aria-label', 'Show password');
  await passwordToggle.click();
  await expect(page.locator('#password')).toHaveAttribute('type', 'text');
  await expect(page.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-label', 'Hide password');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement, '::-webkit-scrollbar').width)).toBe('6px');
  await page.goto('/forgot-password.html');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement, '::-webkit-scrollbar').width)).toBe('6px');
});

test('mobile drawer opens and closes', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await demoLogin(page, 'Owner');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.locator('#appSidebar')).toHaveClass(/open/);
  await page.locator('#sidebarScrim').click({ position: { x: 300, y: 300 } });
  await expect(page.locator('#appSidebar')).not.toHaveClass(/open/);
});

test('sidebar scrolls inside its blue container and captures scrollbar views', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  await demoLogin(page, 'Owner');
  // Wait for the complete role-filtered navigation, not only the static sidebar shell.
  await expect(page.getByText('Administration', { exact: true })).toBeVisible();
  const sidebar = await page.locator('#appSidebar .sidebar-menu').evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    clientHeight: element.clientHeight,
    overflowY: getComputedStyle(element).overflowY,
    scrollHeight: element.scrollHeight
  }));
  expect(sidebar.background).toBe('rgb(46, 49, 146)');
  expect(sidebar.overflowY).toBe('auto');
  expect(sidebar.scrollHeight).toBeGreaterThan(sidebar.clientHeight);
  await page.screenshot({ path: testInfo.outputPath('scrollbar-owner-1440x700.png') });

  await page.setViewportSize({ width: 360, height: 740 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.locator('#appSidebar')).toHaveClass(/open/);
  await page.screenshot({ path: testInfo.outputPath('scrollbar-drawer-360x740.png') });
});

test('logo paths come from settings and retain the wordmark fallback when needed', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/login.html');
  await expect(page.locator('#authLogo')).toHaveAttribute('src', /assets\/images\/logo-large\.png$/);
  await expect(page.locator('#authLogo')).toHaveAttribute('alt', 'Genuine Textiles logo');
  const largeLogoIsAvailable = await page.locator('#authLogo').evaluate((image) => image.complete && image.naturalWidth > 0);
  if (largeLogoIsAvailable) await expect(page.locator('#authLogoFallback')).toBeHidden();
  else await expect(page.locator('#authLogoFallback')).toBeVisible();
  await demoLogin(page, 'Owner');
  await expect(page.locator('.sidebar-logo')).toHaveAttribute('src', /assets\/images\/logo\.png$/);
  await expect(page.locator('.sidebar-logo')).toHaveAttribute('alt', 'Genuine Textiles logo');
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', /assets\/images\/logo\.png$/);
});

test('captures login and shell layouts at each required width', async ({ page }, testInfo) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 900 }, { width: 360, height: 740 }]) {
    const name = viewport.width + 'x' + viewport.height;
    await page.setViewportSize(viewport);
    await page.goto('/login.html');
    await page.screenshot({ path: testInfo.outputPath('login-' + name + '.png'), fullPage: true });
    await page.locator('.demo-access').evaluate((element) => { element.open = true; });
    await page.getByRole('button', { name: 'Log in as Owner' }).click();
    await page.screenshot({ path: testInfo.outputPath('shell-' + name + '.png'), fullPage: true });
  }
});
