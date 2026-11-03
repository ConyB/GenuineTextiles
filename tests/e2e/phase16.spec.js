const { test, expect } = require('@playwright/test');

async function start(page, role = 'owner', route = '#/reports/sales') {
  await page.goto('/login.html?today=2026-10-27');
  await page.evaluate(selected => { GT.store.reset(); GT.session.loginAsRole(selected); }, role);
  await page.goto('/index.html?today=2026-10-27' + route);
}

async function range(page, from, to) {
  await page.locator('[data-date-range-trigger]').click();
  await page.getByRole('option', { name:'Custom range' }).click();
  await page.locator('.date-range-popover input[data-date-from]').fill(from);
  await page.locator('.date-range-popover input[data-date-to]').fill(to);
  await page.getByRole('button', { name:'Apply' }).click();
}

test('Reports navigation and direct routes enforce money and quantity permissions', async ({ page }) => {
  for (const role of ['owner','general_manager','accountant']) {
    await start(page,role,'#/reports/debtors');
    await expect(page.locator('h1')).toHaveText('Debtors Report');
    await expect(page.locator('#appSidebar [href="#/reports/sales"]')).toHaveCount(1);
  }
  for (const role of ['store_keeper','workshop_supervisor']) {
    await start(page,role,'#/reports/stock');
    await expect(page.locator('h1')).toHaveText('Stock Report');
    await expect(page.locator('#appSidebar [href="#/reports/sales"]')).toHaveCount(0);
    await page.goto('/index.html#/finance/statements');
    await expect(page.locator('h1')).toHaveText('Access denied');
  }
  await start(page,'sales','#/reports/sales');
  await expect(page.locator('h1')).toHaveText('Access denied');
});

test('Sales grouping, date filtering and source totals use issued documents only once', async ({ page }) => {
  await start(page);
  const expected = await page.evaluate(() => GT.reports.salesTotals(GT.reports.sales()));
  await expect(page.locator('#salesReportStats')).toContainText(GTMoney(expected.collected));
  await page.locator('#salesReportSources [data-table-filter="group_by"]').selectOption('month');
  await expect(page.locator('#salesReportGroups tbody tr').first()).toContainText('2026-10');
  await page.locator('#salesReportSources [data-table-filter="group_by"]').selectOption('category');
  await expect(page.locator('#salesReportGroups')).toContainText('Unclassified');
  await page.locator('#salesReportSources [data-table-filter="group_by"]').selectOption('customer');
  await expect(page.locator('#salesReportGroups')).toContainText('Walk-in customer');
  await range(page,'2026-10-19','2026-10-20');
  const rows = await page.locator('#salesReportSources tbody tr').count();
  expect(rows).toBeGreaterThan(0);
  const filtered = await page.locator('#salesReportSources tbody tr').allTextContents();
  expect(filtered.every(text => /19 Oct 2026|20 Oct 2026/.test(text))).toBe(true);
  await page.locator('#salesReportSources tbody tr').first().click();
  await expect(page).toHaveURL(/#\/sales\/(invoices|receipts|quick-sales)\//);
});

function GTMoney(value) { return 'UGX ' + Number(value).toLocaleString('en-US'); }

test('Stock quantity report filters low stock and print and CSV omit money', async ({ page }) => {
  await start(page,'store_keeper','#/reports/stock');
  await page.locator('#stockReportTable [data-table-filter="status"]').selectOption('Low');
  await expect(page.locator('#stockReportTable tbody tr').first()).toContainText('Low');
  await range(page,'2026-10-01','2026-10-27');
  await expect(page.locator('#stockReportTable [data-date-range-trigger]')).toHaveAttribute('data-date-from','2026-10-01');
  await page.getByRole('button',{name:'Print'}).click();
  await expect(page.locator('.print-page')).toContainText('STOCK REPORT');
  expect(await page.locator('.print-page').innerText()).not.toMatch(/UGX|price|cost|payment/i);
  await page.locator('[data-print-back]').click();
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#stockReportTable [data-export-csv]').click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe('stock-quantities.csv');
  expect(await page.locator('#stockReportTable').innerText()).not.toMatch(/UGX|price|cost|payment/i);
});

test('Debtors report reuses outstanding ageing figures and date filter has an empty state', async ({ page }) => {
  await start(page,'accountant','#/reports/debtors');
  await expect(page.locator('#pageContent')).toContainText('balance as at today');
  const figures=await page.evaluate(() => ({ report:GT.reports.debtorRows('', ''), ageing:GT.debtors.ageingTotals() }));
  expect(figures.report.reduce((n,r) => n+r.balance,0)).toBe(figures.ageing.total);
  expect(figures.report.reduce((n,r) => n+r.b0_30+r.b31_60+r.b61_plus,0)).toBe(figures.ageing.total);
  await range(page,'2027-01-01','2027-01-31');
  await expect(page.locator('#debtReportTable')).toContainText('No open debtor invoices match this date range.');
});

test('Monthly statement reconciles with cash book and exposes a source mismatch', async ({ page }) => {
  await start(page,'owner','#/finance/statements');
  await expect(page.locator('#statementCheck')).toContainText('PASS');
  const statement=await page.evaluate(() => GT.reports.financial('2026-10'));
  expect(statement.moneyIn).toBe(statement.expectedIn);
  expect(statement.moneyOut).toBe(statement.expectedOut);
  await page.evaluate(() => { const row=GT.store.all('ledger_entries').find(r => r.entry_date.startsWith('2026-10')); GT.store.update('ledger_entries',row.id,{debit:Number(row.debit)+1}); GT.app.renderPage(); });
  await expect(page.locator('#statementCheck')).toContainText('FAIL');
});

test('Statements and reports remain usable at 360px and print on A4', async ({ page }) => {
  await page.setViewportSize({width:360,height:800});
  await start(page,'owner','#/finance/statements');
  await expect(page.locator('#statementCashTable .shared-data-table tbody tr').first()).toBeVisible();
  expect(await page.locator('#statementCashTable .shared-data-table tbody tr').first().evaluate(node => getComputedStyle(node).display)).toBe('block');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByRole('button',{name:'Print'}).click();
  await expect(page.locator('.print-page')).toContainText('MONTHLY FINANCIAL STATEMENT');
  await expect(page.locator('.print-page')).toContainText('Cash-book reconciliation');
  const pageRule=await page.evaluate(() => Array.from(document.styleSheets).flatMap(sheet => { try { return Array.from(sheet.cssRules).map(rule => rule.cssText); } catch { return []; } }).find(text => text.includes('@page')));
  expect(pageRule.toLowerCase()).toContain('a4');
});

test('Report empty states and Sales and Debtors A4 previews are honest', async ({ page }) => {
  await start(page,'owner','#/reports/sales');
  await range(page,'2027-01-01','2027-01-31');
  await expect(page.locator('#salesReportSources')).toContainText('No sales records match this date range.');
  await page.getByRole('button',{name:'Print'}).click();
  await expect(page.locator('.print-page')).toContainText('No records in this period.');
  await page.locator('[data-print-back]').click();
  await page.goto('/index.html#/reports/stock');
  await page.locator('#stockReportTable [data-table-search]').fill('item that is not in stock');
  await expect(page.locator('#stockReportTable')).toContainText('No stock items match these filters.');
  await page.goto('/index.html#/reports/debtors');
  await page.getByRole('button',{name:'Print'}).click();
  await expect(page.locator('.print-page')).toContainText('DEBTORS REPORT');
  await expect(page.locator('.print-page')).toContainText('balance as at today');
  await page.locator('[data-print-back]').click();
  await page.goto('/index.html#/finance/statements');
  await page.locator('#statementCashTable [data-table-filter="month"]').selectOption('2027-01');
  await expect(page.locator('#statementCashTable')).toContainText('No cash-book movements in this month and date range.');
  await expect(page.locator('#statementSummary')).toContainText('Pending opening balances');
});
