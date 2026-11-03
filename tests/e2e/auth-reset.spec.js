const { test, expect } = require('@playwright/test');

test('forgot-password request stays readable and gives neutral feedback', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/login.html');
  await page.getByRole('link', { name: 'Forgot password?' }).click();

  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
  await expect(page.getByText('Enter your username or email and the Owner or General Manager will be notified.')).toBeVisible();
  const input = page.getByRole('textbox', { name: 'Username or email' });
  await expect(page.locator('#resetIdentifierLabel')).toBeVisible();
  await expect(input).toBeVisible();
  await expect(input).toHaveAttribute('placeholder', 'Enter your username or email');
  await expect(page.getByRole('button', { name: 'Send reset request' })).toBeVisible();
  const back = page.getByRole('link', { name: 'Back to login' });
  await expect(back).toBeVisible();

  for (const width of [1440, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('.auth-card')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const contrasts = await page.evaluate(() => {
      function luminance(color) {
        const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number);
        return channels.map((value) => {
          const channel = value / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
      }
      function ratio(foreground, background) {
        const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
        return (values[0] + 0.05) / (values[1] + 0.05);
      }
      const card = getComputedStyle(document.querySelector('.auth-card'));
      const text = ['#resetHeading', '#resetIntro', '#resetIdentifierLabel', '#resetButton', '#returnToLogin'].map((selector) => {
        const style = getComputedStyle(document.querySelector(selector));
        return { selector, contrast: ratio(style.color, selector === '#resetButton' ? style.backgroundColor : card.backgroundColor) };
      });
      const placeholder = getComputedStyle(document.querySelector('#resetIdentifier'), '::placeholder');
      text.push({ selector: 'input placeholder', contrast: ratio(placeholder.color, card.backgroundColor) });
      return text;
    });
    for (const item of contrasts) expect(item.contrast, `${item.selector} contrast at ${width}px`).toBeGreaterThanOrEqual(4.5);
  }

  await page.getByRole('button', { name: 'Send reset request' }).click();
  await expect(page.getByRole('alert')).toHaveText('Enter your username or email.');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(await page.evaluate(() => GT.store.where('audit_logs', { action: 'password_reset_requested' }).length)).toBe(0);

  await input.fill('someone@example.com');
  await page.getByRole('button', { name: 'Send reset request' }).click();
  await expect(page.getByRole('status')).toHaveText('If this account exists, a reset request has been recorded.');
  const requests = await page.evaluate(() => GT.store.where('audit_logs', { action: 'password_reset_requested' }));
  expect(requests).toHaveLength(1);
  expect(requests[0].user_id).toBeNull();
  expect(JSON.parse(requests[0].after_json).identifier).toBe('someone@example.com');
  expect(errors).toEqual([]);

  await back.click();
  await expect(page).toHaveURL(/\/login\.html$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('reset requests cap stored input and escape it in the audit detail', async ({ page }) => {
  await page.goto('/forgot-password.html');
  await page.evaluate(() => GT.store.reset());
  const input = page.locator('#resetIdentifier');
  await expect(input).toHaveAttribute('maxlength', '100');
  const attack = '<img src=x onerror="window.resetXss=true">';
  await input.evaluate((element, value) => { element.value = value + 'A'.repeat(100); }, attack);
  await page.locator('#resetButton').click();
  await expect(page.getByRole('status')).toHaveText('If this account exists, a reset request has been recorded.');
  const stored = await page.evaluate(() => JSON.parse(GT.store.where('audit_logs', { action: 'password_reset_requested' })[0].after_json).identifier);
  expect(stored).toBe((attack + 'A'.repeat(100)).slice(0, 100));
  expect(stored).toHaveLength(100);

  await page.evaluate(() => GT.session.loginAsRole('owner'));
  await page.goto('/index.html#/admin/audit-log');
  await page.locator('#auditLogTable [data-row-action]').first().click();
  await expect(page.locator('.audit-changes-modal')).toContainText(stored);
  await expect(page.locator('.audit-changes-modal img')).toHaveCount(0);
  expect(await page.evaluate(() => window.resetXss === true)).toBe(false);
});

test('repeat reset requests for one identifier within a minute leave one audit entry', async ({ page }) => {
  await page.goto('/forgot-password.html');
  await page.evaluate(() => GT.store.reset());
  const input = page.locator('#resetIdentifier');
  const submit = page.locator('#resetButton');
  await input.fill('Person@example.com');
  await submit.click();
  await input.fill('person@EXAMPLE.com');
  await submit.click();
  await expect(page.getByRole('status')).toHaveText('If this account exists, a reset request has been recorded.');
  expect(await page.evaluate(() => GT.store.where('audit_logs', { action: 'password_reset_requested' }).length)).toBe(1);
  await input.fill('another@example.com');
  await submit.click();
  expect(await page.evaluate(() => GT.store.where('audit_logs', { action: 'password_reset_requested' }).length)).toBe(2);
  await page.evaluate(() => {
    const first = GT.store.where('audit_logs', { action: 'password_reset_requested' })[0];
    GT.store.update('audit_logs', first.id, { created_at: new Date(Date.now() - 61000).toISOString() });
  });
  await input.fill('PERSON@example.com');
  await submit.click();
  expect(await page.evaluate(() => GT.store.where('audit_logs', { action: 'password_reset_requested' }).length)).toBe(3);
});
