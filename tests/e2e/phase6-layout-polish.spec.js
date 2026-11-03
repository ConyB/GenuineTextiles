// Phase 6.3 shared filter, priority-column, action, account-menu and sidebar checks.
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

test('filter rows remain equal and partial rows stretch instead of orphaning controls', async ({ page }) => {
  await loginOwner(page);
  for (const width of [1440, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const item of lists) {
      await openList(page, item);
      const filters = page.locator('.table-filters');
      if (!await filters.count()) continue;
      const metrics = await filters.evaluate((row) => {
        const rowBox = row.getBoundingClientRect();
        const controls = Array.from(row.querySelectorAll('.table-filter select, .date-range-trigger')).map((control) => {
          const box = control.getBoundingClientRect();
          return { top: Math.round(box.top), height: Math.round(box.height), width: box.width };
        });
        return { width: rowBox.width, controls };
      });
      metrics.controls.forEach((control) => expect(control.height, item.name + ' at ' + width).toBe(40));
      const rows = [...new Set(metrics.controls.map((control) => control.top))];
      for (const top of rows) {
        const controls = metrics.controls.filter((control) => control.top === top);
        if (controls.length === 1 && metrics.controls.length > 1) {
          expect(controls[0].width, item.name + ' orphan width at ' + width).toBeGreaterThan(metrics.width * 0.75);
        }
      }
      if (item.name === 'stock-adjustments' && width === 1440) expect(rows).toHaveLength(1);
    }
  }
});

test('priority columns prevent desktop overflow and preserve the left edge on smaller screens', async ({ page }) => {
  await loginOwner(page);
  for (const width of [1440, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const item of lists) {
      await openList(page, item);
      const size = await page.locator('.table-wrapper').evaluate((wrapper) => ({ client: wrapper.clientWidth, scroll: wrapper.scrollWidth }));
      expect(size.scroll, item.name + ' horizontal overflow at ' + width).toBe(size.client);
    }
  }

  for (const width of [1024, 768]) {
    await page.setViewportSize({ width, height: 900 });
    for (const item of lists) {
      await openList(page, item);
      const wrapper = page.locator('.table-wrapper');
      await expect(wrapper).toBeVisible();
      expect(await wrapper.evaluate((element) => element.scrollLeft), item.name + ' left edge at ' + width).toBe(0);
      const priority2 = page.locator('.shared-data-table thead .table-priority-2');
      if (await priority2.count()) await expect(priority2.first(), item.name + ' priority 2 at ' + width).toBeHidden();
      if (width <= 1024) {
        const priority3 = page.locator('.shared-data-table thead .table-priority-3');
        if (await priority3.count()) await expect(priority3.first(), item.name + ' priority 3 at ' + width).toBeHidden();
      }
      const first = page.locator('.shared-data-table tbody tr').first().locator('td').first();
      if (await first.count()) await expect(first).toBeVisible();
    }
  }
});

test('View and More occupy adjacent fixed action slots', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginOwner(page);
  for (const item of lists) {
    await openList(page, item);
    const rows = page.locator('.shared-data-table tbody tr');
    const viewPositions = [];
    for (let index = 0; index < Math.min(await rows.count(), 5); index += 1) {
      const row = rows.nth(index);
      const view = row.getByRole('button', { name: /^(View|View changes)$/ });
      if (!await view.count()) continue;
      const viewBox = await view.boundingBox();
      viewPositions.push(Math.round(viewBox.x));
      const more = row.getByRole('button', { name: 'More actions' });
      if (await more.count()) {
        const moreBox = await more.boundingBox();
        expect(moreBox.x - (viewBox.x + viewBox.width), item.name + ' View/More gap').toBeLessThanOrEqual(16);
      }
      const cell = row.locator('.actions-column');
      await expect(cell).toHaveCSS('width', '96px');
    }
    if (viewPositions.length > 1) expect(new Set(viewPositions).size, item.name + ' View alignment').toBe(1);
  }
});

test('account menu initials, icons and keyboard behaviour follow the menu pattern', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginOwner(page, '#/dashboard');
  const roles = [
    { role: 'owner', initials: 'KE' },
    { role: 'general_manager', initials: 'GN' },
    { role: 'store_keeper', initials: 'MO' }
  ];
  for (const entry of roles) {
    await page.evaluate((role) => GT.session.loginAsRole(role), entry.role);
    await page.reload();
    await expect(page.locator('#userMenuButton .user-avatar')).toHaveText(entry.initials);
  }

  const trigger = page.locator('#userMenuButton');
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#userDropdown')).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const items = page.locator('#userDropdown [role="menuitem"]');
  await expect(items).toHaveCount(2);
  expect(await items.evaluateAll((buttons) => buttons.every((button) => Boolean(button.querySelector('svg, [data-lucide]'))))).toBeTruthy();
  await page.keyboard.press('ArrowDown');
  await expect(items.first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(items.last()).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('account-menu-open-1440x900.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await expect(page.locator('#userDropdown')).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('sidebar headings align with their menu icons at desktop and phone widths', async ({ page }) => {
  await loginOwner(page);
  for (const width of [1440, 360]) {
    await page.setViewportSize({ width, height: 800 });
    if (width === 360) await page.getByRole('button', { name: 'Open navigation' }).click();
    for (const button of await page.locator('.nav-group-title').all()) {
      if (await button.getAttribute('aria-expanded') === 'false') await button.click();
    }
    const offsets = await page.locator('.nav-group').evaluateAll((groups) => groups.filter((group) => group.querySelector('.nav-group-title') && group.querySelector('.nav-link svg')).map((group) => {
      const title = group.querySelector('.nav-group-label').getBoundingClientRect();
      const icon = group.querySelector('.nav-link svg').getBoundingClientRect();
      return Math.round(title.left - icon.left);
    }));
    offsets.forEach((offset) => expect(offset, 'sidebar alignment at ' + width).toBe(0));
  }
});

test('captures the requested Phase 6.3 layouts', async ({ page }, testInfo) => {
  await loginOwner(page);
  for (const width of [1440, 1280, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    for (const item of [
      { name: 'stock-adjustments', route: '#/inventory/adjustments' },
      { name: 'goods-received-notes', route: '#/inventory/grns' }
    ]) {
      await openList(page, item);
      await page.screenshot({ path: testInfo.outputPath(item.name + '-' + width + 'x900.png'), fullPage: true });
    }
  }
  await page.setViewportSize({ width: 360, height: 740 });
  await openList(page, { name: 'materials', route: '#/inventory/materials' });
  await page.screenshot({ path: testInfo.outputPath('materials-360x740.png'), fullPage: true });
});
