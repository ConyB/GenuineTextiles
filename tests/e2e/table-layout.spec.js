// Phase 6.1 shared toolbar, alignment, scrolling and responsive-layout coverage.
const { test, expect } = require('@playwright/test');

const lists = [
  { name: 'customers', route: '#/customers' },
  { name: 'customer-groups', route: '#/customers/groups' },
  { name: 'suppliers', route: '#/inventory/suppliers' },
  { name: 'materials', route: '#/inventory/materials' },
  { name: 'stock-movements', route: '#/inventory/movements' },
  { name: 'stock-alerts', route: '#/inventory/alerts' },
  { name: 'stock-adjustments', route: '#/inventory/adjustments' },
  { name: 'goods-received-notes', route: '#/inventory/grns' },
  { name: 'audit-log', route: '#/admin/audit-log' },
  { name: 'data-browser', route: '#/admin/data-browser', table: 'materials' }
];

async function loginOwner(page, route = '#/customers') {
  await page.goto('/login.html');
  await page.evaluate(() => { GT.store.reset(); GT.session.loginAsRole('owner'); });
  await page.goto('/index.html' + route);
}

async function openList(page, item) {
  await page.goto('/index.html' + item.route);
  if (item.table) await page.locator('[data-table-name="' + item.table + '"]').click();
  await expect(page.locator('.gt-data-table')).toBeVisible();
}

async function expectToolbarAlignment(page) {
  const primary = await page.locator('.table-toolbar-primary').evaluate((row) => {
    const search = row.querySelector('.table-search').getBoundingClientRect();
    const button = row.querySelector('.table-export').getBoundingClientRect();
    return { searchTop: search.top, exportTop: button.top, searchHeight: search.height, exportHeight: button.height };
  });
  expect(Math.abs(primary.searchTop - primary.exportTop)).toBeLessThanOrEqual(1);
  expect(primary.searchHeight).toBe(40);
  expect(primary.exportHeight).toBe(40);

  const controls = page.locator('.table-filters > .table-filter select, .table-filters > .date-range-trigger');
  if (await controls.count()) {
    const boxes = await controls.evaluateAll((elements) => elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { top: Math.round(box.top), height: Math.round(box.height) };
    }));
    boxes.forEach((box) => expect(box.height).toBe(40));
    // Controls may occupy multiple grid rows, but controls on each row share one top edge.
    [...new Set(boxes.map((box) => box.top))].forEach((top) => {
      boxes.filter((box) => box.top === top).forEach((box) => expect(box.top).toBe(top));
    });
  }
  await expect(page.locator('.table-filter > span:not(.visually-hidden)')).toHaveCount(0);
}

async function expectHeadersAndScrolling(page) {
  const distances = await page.locator('th .table-sort').evaluateAll((buttons) => buttons.map((button) => {
    const label = button.querySelector('span').getBoundingClientRect();
    const icon = button.querySelector('svg, [data-lucide]').getBoundingClientRect();
    return Math.round(icon.left - label.right);
  }));
  distances.forEach((distance) => {
    expect(distance).toBeGreaterThanOrEqual(0);
    expect(distance).toBeLessThan(12);
  });

  const numericAlignment = await page.locator('th[data-align="right"]').evaluateAll((headers) => headers.map((header) => {
    const index = Array.from(header.parentElement.children).indexOf(header) + 1;
    const cell = header.closest('table').querySelector('tbody tr td:nth-child(' + index + ')');
    return cell ? [getComputedStyle(header).textAlign, getComputedStyle(cell).textAlign] : null;
  }).filter(Boolean));
  numericAlignment.forEach(([header, cell]) => expect(header).toBe(cell));

  const verticalOverflow = await page.locator('.table-wrapper').evaluate((wrapper) => ({
    clientHeight: wrapper.clientHeight,
    scrollHeight: wrapper.scrollHeight,
    overflowY: getComputedStyle(wrapper).overflowY
  }));
  expect(verticalOverflow.scrollHeight).toBe(verticalOverflow.clientHeight);
  expect(['clip', 'hidden', 'visible']).toContain(verticalOverflow.overflowY);
}

for (const width of [1440, 1024]) {
  test('shared table layout is aligned on every list at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await loginOwner(page);
    for (const item of lists) {
      await openList(page, item);
      await expectToolbarAlignment(page);
      await expectHeadersAndScrolling(page);
    }
  });
}

test('View icons keep one x position in mixed-action rows', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginOwner(page, '#/inventory/adjustments');
  for (const route of ['#/inventory/adjustments', '#/customers']) {
    await page.goto('/index.html' + route);
    const positions = await page.getByRole('button', { name: 'View', exact: true }).evaluateAll((buttons) => buttons.map((button) => Math.round(button.getBoundingClientRect().x)));
    expect(positions.length).toBeGreaterThan(1);
    expect(new Set(positions).size).toBe(1);
  }
});

test('sidebar headings align at desktop widths and in the mobile drawer', async ({ page }) => {
  await loginOwner(page);
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 800 });
    const xs = await page.locator('.nav-group-title').evaluateAll((titles) => titles.map((title) => Math.round(title.getBoundingClientRect().x)));
    expect(new Set(xs).size).toBe(1);
  }
  await page.setViewportSize({ width: 360, height: 740 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  const mobileXs = await page.locator('.nav-group-title').evaluateAll((titles) => titles.map((title) => Math.round(title.getBoundingClientRect().x)));
  expect(new Set(mobileXs).size).toBe(1);
  await expect(page.locator('.sidebar-menu')).toHaveCSS('overflow-x', 'hidden');
});

test('mobile toolbar follows the two-column rules without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await loginOwner(page, '#/inventory/movements');
  const row = await page.locator('.table-toolbar-primary').evaluate((element) => {
    const search = element.querySelector('.table-search').getBoundingClientRect();
    const button = element.querySelector('.table-export').getBoundingClientRect();
    const text = element.querySelector('.table-export span');
    return { sameTop: Math.round(search.top) === Math.round(button.top), buttonWidth: Math.round(button.width), textDisplay: getComputedStyle(text).display };
  });
  expect(row).toEqual({ sameTop: true, buttonWidth: 40, textDisplay: 'none' });
  const dateRange = await page.locator('.date-range-trigger').boundingBox();
  const filters = await page.locator('.table-filters').boundingBox();
  expect(Math.abs(dateRange.width - filters.width)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test('captures every requested desktop and mobile list', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginOwner(page);
  // Screenshot only after the CDN-backed Lucide set has replaced its local fallback glyphs.
  await page.waitForFunction(() => Boolean(window.lucide), null, { timeout: 5000 });
  await page.evaluate(() => GT.components.refreshIcons());
  for (const item of lists) {
    await openList(page, item);
    await page.screenshot({ path: testInfo.outputPath(item.name + '-1440x900.png'), fullPage: true });
  }
  await page.setViewportSize({ width: 360, height: 740 });
  for (const item of lists.filter((entry) => ['stock-movements', 'stock-adjustments', 'materials'].includes(entry.name))) {
    await openList(page, item);
    await page.screenshot({ path: testInfo.outputPath(item.name + '-360x740.png'), fullPage: true });
  }
});

