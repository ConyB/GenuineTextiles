// Phase 6.2 shared date-range popover and unclipped filter-value coverage.
const { test, expect } = require('@playwright/test');
const fs = require('fs');

const lists = [
  { name: 'Customers', route: '#/customers' },
  { name: 'Customer Groups', route: '#/customers/groups' },
  { name: 'Suppliers', route: '#/inventory/suppliers' },
  { name: 'Materials', route: '#/inventory/materials' },
  { name: 'Stock Movements', route: '#/inventory/movements' },
  { name: 'Stock Alerts', route: '#/inventory/alerts' },
  { name: 'Stock Adjustments', route: '#/inventory/adjustments' },
  { name: 'Goods Received Notes', route: '#/inventory/grns' },
  { name: 'Audit Log', route: '#/admin/audit-log' },
  { name: 'Data Browser', route: '#/admin/data-browser', table: 'materials' }
];

async function loginOwner(page, route) {
  await page.goto('/login.html');
  await page.evaluate(() => { GT.store.reset(); GT.session.loginAsRole('owner'); });
  await page.goto('/index.html' + (route || '#/inventory/adjustments'));
  await expect(page.locator('.gt-data-table')).toBeVisible();
}

async function openList(page, item) {
  await page.goto('/index.html' + item.route);
  if (item.table) await page.locator('[data-table-name="' + item.table + '"]').click();
  await expect(page.locator('.gt-data-table')).toBeVisible();
}

async function applyCustomRange(page, from, to) {
  await page.locator('[data-date-range-trigger]').click();
  await page.getByRole('option', { name: 'Custom range' }).click();
  await page.locator('.date-range-popover input[data-date-from]').fill(from);
  await page.locator('.date-range-popover input[data-date-to]').fill(to);
  await page.getByRole('button', { name: 'Apply' }).click();
}

test('presets, validation, summary, keyboard closing and viewport placement work', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  await loginOwner(page);
  await page.evaluate(() => { GT.dates.today = function () { return '2026-11-07'; }; });

  const expectedPresets = [
    ['Today', '2026-11-07', '2026-11-07'],
    ['This week', '2026-11-02', '2026-11-08'],
    ['This month', '2026-11-01', '2026-11-30'],
    ['Last 30 days', '2026-10-09', '2026-11-07']
  ];
  for (const [label, from, to] of expectedPresets) {
    await page.locator('[data-date-range-trigger]').click();
    await page.getByRole('option', { name: label, exact: true }).click();
    const trigger = page.locator('[data-date-range-trigger]');
    await expect(trigger).toHaveAttribute('data-date-from', from);
    await expect(trigger).toHaveAttribute('data-date-to', to);
    await expect(trigger).toContainText(label);
  }

  await page.locator('[data-date-range-trigger]').click();
  await page.getByRole('option', { name: 'Any date', exact: true }).click();
  await expect(page.locator('[data-date-range-trigger]')).toContainText('Any date');

  await page.locator('[data-date-range-trigger]').click();
  await page.getByRole('option', { name: 'Custom range' }).click();
  await page.locator('.date-range-popover input[data-date-from]').fill('2026-11-07');
  await page.locator('.date-range-popover input[data-date-to]').fill('2026-10-13');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.locator('[data-date-error]')).toHaveText('From date must not be after To date.');
  await expect(page.locator('.date-range-popover')).toBeVisible();

  await page.locator('.date-range-popover input[data-date-from]').fill('2026-10-13');
  await page.locator('.date-range-popover input[data-date-to]').fill('2026-11-07');
  await expect(page.locator('[data-date-summary]')).toHaveText('13 Oct – 7 Nov 2026');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.locator('[data-date-range-trigger]')).toContainText('13 Oct – 7 Nov 2026');

  const trigger = page.locator('[data-date-range-trigger]');
  await trigger.click();
  await page.locator('[data-date-apply]').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-date-close]')).toBeFocused();
  await page.getByRole('option', { name: 'Custom range' }).focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('.date-range-popover')).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await trigger.evaluate((button) => button.scrollIntoView({ block: 'end' }));
  await trigger.click();
  const bounds = await page.locator('.date-range-popover').boundingBox();
  expect(bounds.y, 'popover top is inside the viewport').toBeGreaterThanOrEqual(12);
  expect(bounds.y + bounds.height, 'popover bottom is inside the viewport').toBeLessThanOrEqual(688);
  await expect(page.locator('.date-range-popover')).toHaveAttribute('data-placement', 'top');
  await page.screenshot({ path: testInfo.outputPath('stock-adjustments-date-popover-1440x700.png') });
  await page.keyboard.press('Escape');

  await trigger.click();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(page.locator('[data-date-range-trigger]')).toContainText('Any date');
});

test('date ranges filter all dated ledgers and CSV export uses the range', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginOwner(page);
  const from = '2026-10-18';
  const to = '2026-10-20';
  const ledgers = [
    { route: '#/inventory/adjustments', table: 'stock_adjustments', field: 'requested_at' },
    { route: '#/inventory/movements', table: 'stock_movements', field: 'created_at', materialOnly: true },
    { route: '#/inventory/grns', table: 'goods_received_notes', field: 'received_at' },
    { route: '#/admin/audit-log', table: 'audit_logs', field: 'created_at' }
  ];

  for (const ledger of ledgers) {
    await page.goto('/index.html' + ledger.route);
    const expected = await page.evaluate(({ table, field, materialOnly, fromDate, toDate }) => GT.store.all(table).filter((row) => {
      if (materialOnly && row.item_type !== 'material') return false;
      const date = String(row[field]).slice(0, 10);
      return date >= fromDate && date <= toDate;
    }).length, { table: ledger.table, field: ledger.field, materialOnly: ledger.materialOnly, fromDate: from, toDate: to });
    await applyCustomRange(page, from, to);
    await expect(page.locator('.table-result-count'), ledger.route).toContainText(expected ? 'of ' + expected + ' results' : '0 results');

    if (ledger.route === '#/inventory/movements') {
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Export CSV' }).click();
      const download = await downloadPromise;
      const csv = fs.readFileSync(await download.path(), 'utf8').trim();
      expect(csv.split(/\r?\n/).length - 1).toBe(expected);
    }
  }
});

for (const width of [1440, 1024, 768]) {
  test('filter values keep their full title on every list at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await loginOwner(page, '#/customers');
    for (const item of lists) {
      await openList(page, item);
      const labels = await page.locator('.table-filter select').evaluateAll((selects) => selects.map((select) => select.getAttribute('aria-label')));
      for (const label of labels) {
        const select = page.locator('.table-filter select[aria-label="' + label + '"]');
        const longestValue = await select.evaluate((element) => {
          const context = document.createElement('canvas').getContext('2d');
          context.font = getComputedStyle(element).font;
          return Array.from(element.options).reduce((widest, option) => context.measureText(option.textContent).width > context.measureText(widest.textContent).width ? option : widest).value;
        });
        await select.selectOption(longestValue);
      }

      const selectMetrics = await page.locator('.table-filter select').evaluateAll((selects) => selects.map((select) => {
        const style = getComputedStyle(select);
        const context = document.createElement('canvas').getContext('2d');
        context.font = style.font;
        const text = select.options[select.selectedIndex].textContent.trim();
        return {
          label: select.getAttribute('aria-label'),
          text: text,
          title: select.title,
          textWidth: context.measureText(text).width,
          available: select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
          contained: select.clientWidth <= select.closest('.table-filter').clientWidth,
          textOverflow: style.textOverflow
        };
      }));
      selectMetrics.forEach((metric) => {
        expect(metric.title, item.name + ': ' + metric.label + ' is missing its full title').toBe(metric.text);
        expect(metric.contained, item.name + ': ' + metric.label + ' exceeds its equal-width filter track').toBeTruthy();
        if (metric.textWidth > metric.available + 1) expect(metric.textOverflow, item.name + ': ' + metric.label + ' must ellipsize its long value').toBe('ellipsis');
      });

      const searchFits = await page.locator('[data-table-search]').evaluate((input) => {
        const style = getComputedStyle(input);
        const context = document.createElement('canvas').getContext('2d');
        context.font = style.font;
        return context.measureText(input.placeholder).width <= input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      });
      expect(searchFits, item.name + ': search placeholder is clipped').toBeTruthy();
      if (await page.locator('[data-date-range-trigger]').count()) {
        const dateFits = await page.locator('[data-date-range-trigger] > span').evaluate((span) => span.scrollWidth <= span.clientWidth);
        expect(dateFits, item.name + ': date button text is clipped').toBeTruthy();
      }

      await page.locator('[data-table-search]').fill('a');
      const clear = page.getByRole('button', { name: 'Clear filters' });
      await expect(clear, item.name + ': Clear filters is missing').toBeVisible();
      expect(await clear.evaluate((button) => button.scrollWidth <= button.clientWidth), item.name + ': Clear filters is clipped').toBeTruthy();
      await clear.click();
    }
  });
}

test('phone date filter is a usable bottom sheet without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await loginOwner(page);
  await page.locator('[data-date-range-trigger]').click();
  const sheet = await page.locator('.date-range-popover').boundingBox();
  expect(Math.round(sheet.x)).toBe(0);
  expect(Math.round(sheet.width)).toBe(360);
  expect(Math.round(sheet.y + sheet.height)).toBe(740);
  const targets = page.locator('.date-range-popover button:visible');
  for (let index = 0; index < await targets.count(); index += 1) {
    const box = await targets.nth(index).boundingBox();
    expect(box.height, 'mobile date-filter touch target ' + index).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('option', { name: 'Custom range' }).click();
  const dateInputs = page.locator('.date-range-popover input[type="date"]');
  for (let index = 0; index < await dateInputs.count(); index += 1) {
    const box = await dateInputs.nth(index).boundingBox();
    expect(box.height, 'mobile custom-date input ' + index).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test('captures Stock Adjustments with applied filters at each requested width', async ({ page }, testInfo) => {
  await loginOwner(page);
  for (const width of [1440, 1024, 360]) {
    await page.setViewportSize({ width, height: width === 360 ? 740 : 900 });
    await page.goto('/index.html#/inventory/adjustments');
    await page.locator('[data-table-filter="status"]').selectOption('pending');
    await page.locator('[data-table-filter="location"]').selectOption('1');
    await applyCustomRange(page, '2026-10-13', '2026-10-22');
    await page.screenshot({ path: testInfo.outputPath('stock-adjustments-filters-' + width + '.png'), fullPage: width !== 360 });
  }
});

