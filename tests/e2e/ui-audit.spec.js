// Intentional "Demo " exceptions: login prototype controls are outside this authenticated
// audit, the account menu is outside #pageContent, and Data Browser deliberately exposes raw
// prototype records. Add route-specific exceptions here only with a documented reason.
const DEMO_TEXT_ALLOWLIST = new Set(['#/admin/data-browser']);

const { test, expect } = require('@playwright/test');

async function loginOwner(page) {
  await page.goto('/login.html');
  await page.evaluate(() => { GT.store.reset(); GT.session.loginAsRole('owner'); });
  await page.goto('/index.html#/dashboard');
}

function message(route, rule, element) {
  return route + ' — rule ' + rule + ' — ' + element;
}

test('automatic UI audit covers every implemented Owner navigation route', async ({ page }) => {
  test.setTimeout(180000);
  await loginOwner(page);
  const routes = await page.evaluate(() => GT.navigation.visibleGroups().flatMap((group) => group.items.map((item) => item.route)));
  let consoleErrors = [];
  let failedRequests = [];
  page.on('console', (entry) => { if (entry.type() === 'error') consoleErrors.push(entry.text()); });
  page.on('requestfailed', (request) => failedRequests.push(request.url() + ': ' + (request.failure() || {}).errorText));

  for (const width of [1440, 1280, 360]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      consoleErrors = [];
      failedRequests = [];
      await page.goto('/index.html' + route);
      const currentLinks = page.locator('#appSidebar [aria-current="page"]');
      await expect(currentLinks, message(route, 25, 'one current sidebar item')).toHaveCount(1);
      const currentGroup = currentLinks.locator('xpath=ancestor::section[contains(@class,"nav-group")]');
      await expect(currentGroup, message(route, 25, 'current group open')).toHaveClass(/is-open/);
      const groupButton = currentGroup.locator('.nav-group-title');
      if (await groupButton.count()) await expect(groupButton, message(route, 25, 'expanded current group')).toHaveAttribute('aria-expanded', 'true');
      const content = page.locator('#pageContent');
      if ((await content.textContent()).includes('Built in a later phase')) continue;

      await expect(content.locator('h1'), message(route, 1, 'content H1 count')).toHaveCount(1);
      if (width >= 992) {
        await expect(page.locator('.topbar-breadcrumb'), message(route, 1, 'desktop topbar breadcrumb')).toBeVisible();
        await expect(page.locator('.topbar-mobile-title'), message(route, 1, 'duplicate topbar title')).toBeHidden();
      } else {
        await expect(page.locator('.topbar-breadcrumb'), message(route, 1, 'mobile breadcrumb')).toBeHidden();
        await expect(page.locator('.topbar-mobile-title'), message(route, 1, 'mobile page name')).toBeVisible();
      }

      if (width === 360 || width === 1280) {
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), message(route, 2, 'page horizontal overflow')).toBeTruthy();
      }
      for (const wrapper of await page.locator('.table-wrapper').all()) {
        const size = await wrapper.evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, scrollLeft: element.scrollLeft }));
        if (width >= 1280) expect(size.scrollWidth <= size.clientWidth + 1, message(route, 2, 'table horizontal overflow')).toBeTruthy();
        expect(size.scrollHeight <= size.clientHeight + 1, message(route, 2, 'inner vertical table scrollbar')).toBeTruthy();
        expect(size.scrollLeft, message(route, 5, 'table left edge')).toBe(0);
      }

      for (const toolbar of await page.locator('.table-filters').all()) {
        const controls = await toolbar.locator(':scope > .table-filter select, :scope > .date-range-trigger').evaluateAll((elements) => elements.filter((element) => element.offsetParent !== null).map((element) => {
          const box = element.getBoundingClientRect();
          return { top: Math.round(box.top), height: Math.round(box.height), width: Math.round(box.width) };
        }));
        const tops = [...new Set(controls.map((control) => control.top))];
        for (const top of tops) {
          const row = controls.filter((control) => control.top === top);
          expect(new Set(row.map((control) => control.height)).size, message(route, 3, 'filter heights at y=' + top)).toBeLessThanOrEqual(1);
        }
        if (width >= 1280) controls.forEach((control, index) => expect(control.width, message(route, 3, 'filter control ' + index + ' width')).toBeGreaterThanOrEqual(150));
        if (await toolbar.locator('.date-range-trigger').count()) await expect(toolbar.locator('.date-range-trigger'), message(route, 3, 'date control row group')).toBeVisible();
      }

      const clipped = await content.locator('button, .status-badge, select, input, th').evaluateAll((elements) => elements.filter((element) => {
        if (element.offsetParent === null || element.clientWidth === 0) return false;
        if (element.matches('select') && element.title) return false; // Ellipsis is documented; title preserves the complete option.
        return element.scrollWidth > element.clientWidth + 1;
      }).map((element) => element.getAttribute('aria-label') || element.id || element.textContent.trim().slice(0, 60) || element.tagName));
      expect(clipped, message(route, 4, 'width ' + width + ' clipped controls: ' + clipped.join(', '))).toEqual([]);

      for (const table of await page.locator('.shared-data-table').all()) {
        const alignmentErrors = await table.locator('thead th').evaluateAll((headers) => headers.filter((header) => header.offsetParent !== null).map((header) => {
          const index = Array.from(header.parentElement.children).indexOf(header) + 1;
          const cell = header.closest('table').querySelector('tbody tr td:nth-child(' + index + ')');
          return cell && cell.offsetParent !== null && getComputedStyle(header).textAlign !== getComputedStyle(cell).textAlign ? header.textContent.trim() : '';
        }).filter(Boolean));
        expect(alignmentErrors, message(route, 5, 'column alignment: ' + alignmentErrors.join(', '))).toEqual([]);
      }
      const actionCells = page.locator('.actions-column');
      if (await actionCells.count()) {
        const widthValue = await actionCells.first().evaluate((cell) => cell.getBoundingClientRect().width);
        expect(widthValue, message(route, 5, 'Actions width')).toBeLessThanOrEqual(112);
        const rows = page.locator('.shared-data-table tbody tr');
        const firstXs = [];
        for (let index = 0; index < Math.min(await rows.count(), 10); index += 1) {
          const buttons = rows.nth(index).locator('.table-row-actions button');
          if (!await buttons.count()) continue;
          const boxes = await buttons.evaluateAll((items) => items.map((item) => item.getBoundingClientRect()));
          firstXs.push(Math.round(boxes[0].x));
          if (boxes.length > 1) expect(boxes[1].x - (boxes[0].x + boxes[0].width), message(route, 5, 'action icon gap row ' + index)).toBeLessThanOrEqual(16);
        }
        if (firstXs.length > 1) expect(new Set(firstXs).size, message(route, 5, 'first action alignment')).toBe(1);
      }

      const statCards = page.locator('.stat-card');
      for (let index = 0; index < await statCards.count(); index += 1) {
        const card = statCards.nth(index);
        await expect(card.locator('.stat-card-icon'), message(route, 6, 'stat card ' + index + ' icon')).toBeVisible();
        await expect(card.locator('.stat-card-label'), message(route, 6, 'stat card ' + index + ' label')).not.toBeEmpty();
        await expect(card.locator('.stat-card-value'), message(route, 6, 'stat card ' + index + ' value')).not.toBeEmpty();
      }

      expect(consoleErrors, message(route, 7, 'console errors')).toEqual([]);
      expect(failedRequests, message(route, 7, 'failed requests')).toEqual([]);
      if (!DEMO_TEXT_ALLOWLIST.has(route)) {
        const demoText = await content.locator('.shared-data-table td, .stat-card').evaluateAll((elements) => elements.filter((element) => /Demo\s/i.test(element.textContent)).map((element) => element.textContent.trim().slice(0, 80)));
        expect(demoText, message(route, 8, 'business data containing Demo: ' + demoText.join(', '))).toEqual([]);
      }
    }
  }
});

test('shared cards and panels have computed padding on main pages at desktop and 360px', async ({ page }) => {
  test.setTimeout(180000);
  await loginOwner(page);
  const navigationRoutes=await page.evaluate(() => GT.navigation.visibleGroups().flatMap(group => group.items.map(item => item.route)));
  const detailRoutes=['#/customers/1','#/inventory/suppliers/1','#/inventory/materials/1',
    '#/inventory/grns/1','#/inventory/finished-goods/1','#/inventory/adjustments/1',
    '#/orders/3','#/material-issues/1','#/delivery-notes/1','#/debtors/1',
    '#/sales/quick-sales/1','#/sales/receipts/1','#/finance/expenses/11'];
  let checked=0;
  for (const width of [1440,360]) {
    await page.setViewportSize({width,height:900});
    for (const route of [...new Set([...navigationRoutes,...detailRoutes])]) {
      await page.goto('/index.html'+route);
      if (width===360) expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1),route+' at 360px overflow').toBe(true);
      const panels=await page.locator('#pageContent .detail-card, #pageContent .stat-card, #pageContent .detail-tab-panel, #pageContent .grn-check').evaluateAll(nodes =>
        nodes.filter(node => node.getClientRects().length && getComputedStyle(node).visibility!=='hidden').map(node => {
          const style=getComputedStyle(node);
          return {name:node.className,padding:[style.paddingTop,style.paddingRight,style.paddingBottom,style.paddingLeft].map(parseFloat)};
        }));
      checked+=panels.length;
      for (const panel of panels) {
        for (const side of panel.padding) expect(side,route+' at '+width+'px: '+panel.name+' padding').toBeGreaterThanOrEqual(12);
      }
    }
  }
  expect(checked).toBeGreaterThan(100);
});
