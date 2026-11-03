const { test, expect } = require('@playwright/test');

test('every navigation page opens for every role without console or script errors', async ({ page }) => {
  test.setTimeout(600000);
  const problems = [];
  let destination = '';
  page.on('console', entry => { if (entry.type() === 'error') problems.push(destination + ': console: ' + entry.text()); });
  page.on('pageerror', error => problems.push(destination + ': page error: ' + error.message));
  page.on('response', response => {
    if (response.request().resourceType() === 'script' && response.status() >= 400)
      problems.push(destination + ': script HTTP ' + response.status() + ': ' + response.url());
  });
  page.on('requestfailed', request => {
    if (request.resourceType() === 'script') problems.push(destination + ': script request failed: ' + request.url());
  });

  destination = 'login';
  await page.goto('/login.html');
  await expect(page.locator('#loginHeading')).toHaveText('Welcome back');
  const loginScripts = await page.locator('body > script[src]').evaluateAll(items => items.map(item => item.getAttribute('src')));
  expect(loginScripts).toEqual([
    'assets/vendor/vendor.js', 'assets/js/core/namespace.js', 'assets/js/core/schema.js',
    'assets/js/core/format.js', 'assets/js/core/dates.js', 'assets/js/core/calc.js',
    'assets/js/core/mock-data.js', 'assets/js/core/store.js', 'assets/js/core/settings.js',
    'assets/js/core/session.js', 'assets/js/core/auth-page.js'
  ]);
  destination = 'forgot password';
  await page.goto('/forgot-password.html');
  await expect(page.locator('#resetHeading')).toHaveText('Reset your password');
  const resetScripts = await page.locator('body > script[src]').evaluateAll(items => items.map(item => item.getAttribute('src')));
  expect(resetScripts).toEqual(loginScripts.slice(0, -1).concat([
    'assets/js/core/audit.js', 'assets/js/core/reset-request-service.js', 'assets/js/core/auth-page.js'
  ]));

  destination = 'route inventory';
  await page.goto('/login.html');
  await page.evaluate(() => GT.session.loginAsRole('owner'));
  await page.goto('/index.html#/dashboard');
  const routes = await page.evaluate(() => [...new Set(GT.navigation.groups.flatMap(group => group.items.map(item => item.route)).concat('#/communication/bulk'))]);
  for (const role of ['owner', 'general_manager', 'store_keeper', 'sales', 'workshop_supervisor', 'accountant', 'marketing_manager']) {
    destination = role + ' login';
    await page.goto('/login.html');
    await page.evaluate(selected => GT.session.loginAsRole(selected), role);
    for (const route of routes) {
      destination = role + ' ' + route;
      await page.goto('/index.html' + route);
      await expect(page.locator('#pageContent h1'), destination).toHaveCount(1);
    }
  }
  expect(problems).toEqual([]);
});
