const { test, expect } = require('@playwright/test');

async function loginOwner(page, route = '#/dashboard') {
  await page.goto('/login.html');
  await page.evaluate(() => { GT.store.reset(); GT.session.loginAsRole('owner'); });
  await page.goto('/index.html' + route);
}

async function groupButton(page, label) {
  return page.locator('.nav-group[data-group="' + label + '"] .nav-group-title');
}

test('one active item per route and hover stays distinct from active', async ({ page }) => {
  await loginOwner(page);
  const routes = await page.evaluate(() => GT.navigation.visibleGroups().flatMap((group) => group.items.map((item) => item.route)));
  for (const route of routes) {
    await page.goto('/index.html' + route);
    await expect(page.locator('#appSidebar [aria-current="page"]')).toHaveCount(1);
    await expect(page.locator('#appSidebar [aria-current="page"]')).toHaveAttribute('data-route', route);
    await expect(page.locator('#appSidebar [aria-current="page"]').locator('xpath=ancestor::section')).toHaveClass(/is-open/);
  }
  await page.goto('/index.html#/dashboard');
  const active = page.locator('#appSidebar [aria-current="page"]');
  const other = page.locator('#appSidebar [data-route="#/sales/quotations"]');
  await other.hover();
  await page.waitForTimeout(180);
  const looks = await page.evaluate(() => {
    const active = document.querySelector('#appSidebar [aria-current="page"]');
    const other = document.querySelector('#appSidebar [data-route="#/sales/quotations"]');
    return {
      activeBg: getComputedStyle(active).backgroundColor,
      otherBg: getComputedStyle(other).backgroundColor,
      activeBar: getComputedStyle(active, '::before').opacity,
      otherBar: getComputedStyle(other, '::before').opacity,
      activeWeight: getComputedStyle(active).fontWeight
    };
  });
  expect(looks.activeBg).not.toBe(looks.otherBg);
  expect(looks.activeBar).toBe('1');
  expect(looks.otherBar).toBe('0');
  expect(Number(looks.activeWeight)).toBe(600);
  await active.hover();
  await expect(active).toHaveCSS('background-color', looks.activeBg);
});

test('Dashboard shares item geometry, and focus is visible', async ({ page }) => {
  await loginOwner(page);
  const geometry = await page.locator('#appSidebar .nav-link').evaluateAll((links) => links.map((link) => {
    const icon = link.querySelector('svg, i').getBoundingClientRect();
    const label = link.querySelector('.nav-link-label').getBoundingClientRect();
    return { height: link.getBoundingClientRect().height, iconX: icon.x, labelX: label.x, iconWidth: icon.width, fontSize: getComputedStyle(link).fontSize, paddingLeft: getComputedStyle(link).paddingLeft };
  }));
  expect(new Set(geometry.map((item) => item.height))).toEqual(new Set([44]));
  expect(new Set(geometry.map((item) => item.iconX)).size).toBe(1);
  expect(new Set(geometry.map((item) => item.labelX)).size).toBe(1);
  expect(new Set(geometry.map((item) => item.iconWidth))).toEqual(new Set([20]));
  expect(new Set(geometry.map((item) => item.fontSize))).toEqual(new Set(['14.5px']));
  expect(new Set(geometry.map((item) => item.paddingLeft))).toEqual(new Set(['12px']));
  const dashboard = page.locator('#appSidebar [data-route="#/dashboard"]');
  await dashboard.focus();
  await expect(dashboard).toHaveCSS('outline-width', '2px');
  await expect(dashboard).toHaveCSS('outline-offset', '-3px');
});

test('groups toggle with mouse and keyboard, persist, reveal routes and badge totals', async ({ page }) => {
  await loginOwner(page);
  const inventory = await groupButton(page, 'Inventory');
  await expect(inventory).toHaveAttribute('aria-expanded', 'false');
  await expect(inventory.locator('.nav-group-badge')).not.toBeEmpty();
  const itemBadges = await page.locator('.nav-group[data-group="Inventory"] .nav-count-badge').allTextContents();
  expect(Number(await inventory.locator('.nav-group-badge').textContent())).toBe(itemBadges.reduce((sum, value) => sum + Number(value), 0));
  const badgeInset = await page.locator('.nav-group[data-group="Inventory"] .nav-count-badge').first().evaluate((badge) => badge.closest('.nav-link').getBoundingClientRect().right - badge.getBoundingClientRect().right);
  expect(badgeInset).toBe(8);
  const badgeSizes = await page.locator('#appSidebar .nav-count-badge').evaluateAll((badges) => badges.map((badge) => ({ width: badge.getBoundingClientRect().width, height: badge.getBoundingClientRect().height })));
  expect(badgeSizes.every((size) => size.width === 20 && size.height === 20)).toBeTruthy();
  await inventory.click();
  await expect(inventory).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('[data-route="#/inventory/alerts"]')).toBeVisible();
  await inventory.focus();
  await page.keyboard.press('Space');
  await expect(inventory).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Enter');
  await expect(inventory).toHaveAttribute('aria-expanded', 'true');
  await page.reload();
  await expect(await groupButton(page, 'Inventory')).toHaveAttribute('aria-expanded', 'true');
  await (await groupButton(page, 'Inventory')).click();
  await page.goto('/index.html#/inventory/alerts');
  await expect(await groupButton(page, 'Inventory')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#appSidebar [aria-current="page"]')).toHaveAttribute('data-route', '#/inventory/alerts');
});

test('360px drawer keeps group states and closes after choosing an item', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await loginOwner(page);
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.locator('#appSidebar')).toHaveClass(/open/);
  const inventory = await groupButton(page, 'Inventory');
  await inventory.click();
  await expect(inventory).toHaveAttribute('aria-expanded', 'true');
  await page.locator('#appSidebar [data-route="#/inventory/alerts"]').click();
  await expect(page.locator('#appSidebar')).not.toHaveClass(/open/);
  await expect(page.locator('#appSidebar [aria-current="page"]')).toHaveAttribute('data-route', '#/inventory/alerts');
});

test('capture Owner sidebar at desktop and phone widths', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginOwner(page);
  for (const button of await page.locator('.nav-group-title').all()) {
    const label = await button.locator('.nav-group-label').textContent();
    if (label !== 'Customers' && label !== 'Inventory' && await button.getAttribute('aria-expanded') === 'false') await button.click();
  }
  await (await groupButton(page, 'Customers')).click();
  // Keep two named groups collapsed so their heading and badge treatments are visible.
  if (await (await groupButton(page, 'Customers')).getAttribute('aria-expanded') === 'true') await (await groupButton(page, 'Customers')).click();
  if (await (await groupButton(page, 'Inventory')).getAttribute('aria-expanded') === 'true') await (await groupButton(page, 'Inventory')).click();
  await page.screenshot({ path: 'tests/screenshots/phase9-1-sidebar-owner-1440.png' });
  const headerY = await page.locator('.sidebar-header').evaluate((header) => header.getBoundingClientRect().y);
  await page.locator('.sidebar-menu').evaluate((menu) => { menu.scrollTop = 600; });
  expect(await page.locator('.sidebar-header').evaluate((header) => header.getBoundingClientRect().y)).toBe(headerY);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.locator('.sidebar-menu').evaluate((menu) => { menu.scrollTop = 0; });
  await page.screenshot({ path: 'tests/screenshots/phase9-1-sidebar-owner-360.png' });
});
