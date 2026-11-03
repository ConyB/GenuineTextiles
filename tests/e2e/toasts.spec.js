// Phase 2.1 shared toast appearance, positioning, timing and dismissal checks.
const { test, expect } = require('@playwright/test');

async function ownerLogin(page) {
  await page.goto('/login.html');
  await page.locator('.demo-access').evaluate((element) => { element.open = true; });
  await page.getByRole('button', { name: 'Log in as Owner', exact: true }).click();
  await expect(page).toHaveURL(/index.html#\/dashboard/);
  await page.waitForFunction(() => Boolean(window.GT && GT.components));
}

async function showToast(page, type, message) {
  await page.evaluate(({ toastType, toastMessage }) => {
    GT.components.showToast(toastMessage, toastType);
  }, { toastType: type, toastMessage: message });
}

test('toast types use the top-right layout and responsive width', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await ownerLogin(page);

  const types = ['success', 'warning', 'error', 'info'];
  for (const type of types) {
    await showToast(page, type, type + ' notification message');
    const toast = page.locator('.gt-toast');
    await expect(toast).toHaveCount(1);
    await expect(toast).toHaveAttribute('data-toast-type', type);
    await page.waitForTimeout(300);
    await page.screenshot({ path: testInfo.outputPath('toast-' + type + '-1440x900.png') });
    await toast.getByRole('button', { name: 'Close notification' }).click();
    await expect(toast).toHaveCount(0);
  }

  for (const type of types) await showToast(page, type, type + ' stacked message');
  await page.waitForTimeout(300);
  const topbar = await page.locator('#appTopbar').boundingBox();
  const desktopToast = await page.locator('.gt-toast').first().boundingBox();
  expect(desktopToast.y).toBeGreaterThan(topbar.y + topbar.height);
  expect(await page.locator('#toastContainer').evaluate((element) => getComputedStyle(element).right)).toBe('24px');
  expect(1440 - desktopToast.x - desktopToast.width).toBeLessThanOrEqual(40);
  await expect(page.locator('#toastContainer')).toHaveAttribute('aria-live', 'assertive');
  await expect(page.locator('.gt-toast.error')).toHaveAttribute('role', 'alert');

  await page.setViewportSize({ width: 360, height: 740 });
  const mobileToast = await page.locator('.gt-toast').first().boundingBox();
  expect(Math.round(mobileToast.x)).toBe(12);
  expect(Math.round(mobileToast.width)).toBe(336);
  expect(mobileToast.y).toBeGreaterThanOrEqual(76);
  await page.screenshot({ path: testInfo.outputPath('toasts-all-types-360x740.png') });
});

test('toasts auto-dismiss, pause on hover, close immediately and cap at four', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await ownerLogin(page);

  await showToast(page, 'info', 'This notice closes automatically.');
  await expect(page.locator('.gt-toast')).toHaveCount(0, { timeout: 5000 });

  await showToast(page, 'success', 'Hover pauses this notice.');
  const pausedToast = page.locator('.gt-toast');
  await pausedToast.hover();
  await page.waitForTimeout(4200);
  await expect(pausedToast).toBeVisible();
  await page.mouse.move(10, 400);
  await expect(pausedToast).toHaveCount(0, { timeout: 5000 });

  await showToast(page, 'error', 'Close this error.');
  await page.locator('.gt-toast-close').click();
  await expect(page.locator('.gt-toast')).toHaveCount(0);
  await expect(page.locator('#toastContainer')).toHaveAttribute('aria-live', 'polite');

  await page.evaluate(() => {
    GT.components.showToast('Optional titles remain supported.', 'info', 'Custom title');
    GT.components.openModal({ title: 'Layer check', content: '<p>Toast should remain above this modal.</p>' });
  });
  await expect(page.locator('.gt-toast-title')).toHaveText('Custom title');
  const layers = await page.evaluate(() => ({
    toast: Number(getComputedStyle(document.getElementById('toastContainer')).zIndex),
    modal: Number(getComputedStyle(document.querySelector('.modal-backdrop-gt')).zIndex)
  }));
  expect(layers.toast).toBeGreaterThan(layers.modal);
  await page.locator('[data-modal-close]').click();
  await page.locator('.gt-toast-close').click();
  await expect(page.locator('.gt-toast')).toHaveCount(0);

  await page.evaluate(() => {
    ['one', 'two', 'three', 'four', 'five'].forEach((message) => GT.components.showToast(message, 'default'));
  });
  await expect(page.locator('.gt-toast')).toHaveCount(4);
  await expect(page.getByText('one', { exact: true })).toHaveCount(0);
  await expect(page.locator('.gt-toast').first()).toContainText('two');
});
