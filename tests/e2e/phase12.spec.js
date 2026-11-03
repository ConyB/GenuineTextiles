const { test, expect } = require('@playwright/test');

async function start(page, role = 'owner', route = '#/orders') {
  await page.goto('/login.html?today=2026-10-27');
  await page.evaluate((selected) => { GT.store.reset(); GT.session.loginAsRole(selected); }, role);
  await page.goto('/index.html?today=2026-10-27' + route);
}

test('convert a quotation to a numbered order and create a linked invoice', async ({ page }) => {
  await start(page, 'owner', '#/quotations/4');
  await page.getByRole('link', {name:'Convert to order'}).click();
  await expect(page.locator('#orderForm')).toBeVisible();
  await expect(page.locator('#orderLineMount input').first()).toHaveValue('School uniforms');
  await page.locator('[name="due_date"]').fill('2026-11-20');
  await page.getByRole('button', {name:'Confirm order'}).click();
  await expect(page.locator('h1')).toContainText('Order 12');
  await page.getByRole('button', {name:'Create invoice'}).click();
  await expect(page).toHaveURL(/#\/invoices\/\d+\/edit$/);
  const ids = await page.evaluate(() => {
    const order = GT.store.where('orders', { number:'12' })[0];
    const invoice = GT.store.find('sales_documents', order.invoice_id);
    return { orderId:order.id, invoiceOrderId:invoice.order_id, count:GT.salesDocs.items(invoice.id).length };
  });
  expect(ids.invoiceOrderId).toBe(ids.orderId);
  expect(ids.count).toBe(1);
});

test('deposit approval, rejection, receipt threshold and history are enforced', async ({ page }) => {
  await start(page);
  const state = await page.evaluate(() => {
    GT.session.loginAsRole('owner');
    const order = GT.store.find('orders', 9);
    const blocked = (() => { try { GT.orders.moveStage(9, 'Cutting', 'Skip'); return false; } catch (error) { return /Deposit approval/.test(error.message); } })();
    GT.orders.rejectStage(9, 'Wait for funds');
    const rejectedStage = GT.store.find('orders', 9).current_stage;
    GT.session.loginAsRole('workshop_supervisor');
    GT.orders.requestStageApproval(9, 'Cutting', 'Materials ready');
    GT.session.loginAsRole('sales');
    const salesBlocked = (() => { try { GT.orders.approveStage(9, 'Approve'); return false; } catch (error) { return true; } })();
    GT.session.loginAsRole('general_manager');
    GT.orders.approveStage(9, 'Production approved');
    const approvedStage = GT.store.find('orders', 9).current_stage;
    GT.orders.moveStage(9, 'Received', 'Stage correction');
    const cancelAfterBackward = (() => { try { GT.orders.cancel(9, 'Customer request'); return false; } catch (error) { return /after Cutting/.test(error.message); } })();
    const noNoteBlocked = (() => { try { GT.orders.moveStage(9, 'Cutting', ''); return false; } catch (error) { return /note/.test(error.message); } })();
    GT.session.loginAsRole('owner');
    const amount = Math.ceil(GT.orders.summary(9).total / 2);
    GT.receipts.save({ invoice_id:order.invoice_id, customer_id:order.customer_id, amount, payment_method:'cash', received_at:'2026-10-27' });
    GT.session.loginAsRole('workshop_supervisor');
    GT.orders.moveStage(9, 'Cutting', 'Skip Deposit confirmed for urgent work');
    return {blocked, rejectedStage, salesBlocked, approvedStage, cancelAfterBackward, noNoteBlocked, depositMet:GT.orders.summary(9).depositMet,
      finalStage:GT.store.find('orders', 9).current_stage, history:GT.store.where('order_stage_history', {order_id:9}).length};
  });
  expect(state).toMatchObject({blocked:true,rejectedStage:'Received',salesBlocked:true,approvedStage:'Cutting',cancelAfterBackward:true,noNoteBlocked:true,depositMet:true,finalStage:'Cutting'});
  expect(state.history).toBeGreaterThanOrEqual(4);
});

test('delivery completion, cancellation and simulated ready SMS obey the lifecycle', async ({ page }) => {
  await start(page);
  const state = await page.evaluate(() => {
    const delivered = GT.store.find('orders', 1);
    let manualDelivered = false, lateCancel = false, blankCancel = false;
    try { GT.orders.moveStage(5, 'Delivered', 'Manual'); } catch (error) { manualDelivered = true; }
    try { GT.orders.cancel(5, 'Customer request'); } catch (error) { lateCancel = true; }
    try { GT.orders.cancel(7, ''); } catch (error) { blankCancel = true; }
    const sent = GT.orders.sendReadyMessage(8);
    const customer = GT.store.find('customers', GT.store.find('orders', 8).customer_id);
    GT.store.update('customers', customer.id, {phone:''});
    const skipped = GT.orders.sendReadyMessage(8);
    const cancelled = GT.orders.cancel(7, 'Customer withdrew');
    return { completed:delivered.status, manualDelivered, lateCancel, blankCancel,
      sent:sent.status, skipped, cancelled:cancelled.status, number:cancelled.number };
  });
  expect(state).toMatchObject({completed:'completed',manualDelivered:true,lateCancel:true,blankCancel:true,
    sent:'sent (simulated)',skipped:null,cancelled:'cancelled',number:'7'});
});

test('issuing every invoice line completes its linked order and void reopens it', async ({ page }) => {
  await start(page);
  const state = await page.evaluate(() => {
    const invoice = GT.store.where('sales_documents', {number:'635'})[0];
    const customer = GT.store.find('customers', invoice.customer_id);
    const order = GT.orders.confirm(GT.orders.createDraft({customer_id:customer.id,due_date:'2026-11-10',priority:'normal',
      description:'Workshop uniforms',items:GT.salesDocs.items(invoice.id)}).id);
    GT.orders.linkInvoice(order.id, invoice.id);
    const draft = GT.deliveries.createDraft(invoice.id);
    GT.deliveries.saveDraft(draft.id,{delivery_date:'2026-10-27',delivery_method:'delivered_by_us'});
    const issued = GT.deliveries.issue(draft.id);
    const completed = GT.store.find('orders',order.id);
    GT.deliveries.void(issued.id,'Dispatch rescheduled');
    const reopened = GT.store.find('orders',order.id);
    return {completedStatus:completed.status,completedStage:completed.current_stage,
      reopenedStatus:reopened.status,reopenedStage:reopened.current_stage,
      history:GT.store.where('order_stage_history',{order_id:order.id}).length};
  });
  expect(state).toMatchObject({completedStatus:'completed',completedStage:'Delivered',reopenedStatus:'active',reopenedStage:'Ready for delivery'});
  expect(state.history).toBe(3);
});

test('restricted roles see no money on order screens or job card', async ({ page }) => {
  for (const role of ['workshop_supervisor', 'store_keeper']) {
    await start(page, role, '#/orders/9');
    await expect(page.locator('#pageContent')).toContainText('Deposit not met');
    await expect(page.locator('#pageContent')).not.toContainText('UGX');
    await page.getByRole('button', {name:'Print job card'}).click();
    await expect(page.locator('.print-preview-shell')).toBeVisible();
    await expect(page.locator('.print-preview-shell')).not.toContainText('UGX');
    await expect(page.locator('.print-preview-shell')).not.toContainText('Unit price');
  }
});

test('production board groups active orders and fits a 360px phone', async ({ page }) => {
  await start(page, 'workshop_supervisor', '#/production-board');
  await page.setViewportSize({width:360,height:800});
  await expect(page.locator('.production-stage-column')).toHaveCount(7);
  await expect(page.locator('.production-stage-column').filter({has:page.getByRole('heading', {name:/Cutting/})})).toContainText('5');
  await expect(page.locator('.production-stage-column').filter({has:page.getByRole('heading', {name:/Delivered/})})).toContainText('2');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= 361)).toBeTruthy();
  await expect(page.locator('#pageContent')).not.toContainText('UGX');
  await page.goto('/index.html?today=2026-10-27#/orders');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= 361)).toBeTruthy();
  await expect(page.locator('.shared-data-table')).toBeVisible();
});

test('sales role sees only own orders and Marketing has no order menu', async ({ page }) => {
  await start(page, 'sales');
  const onlyOwn = await page.evaluate(() => GT.orders.list().every((order) => order.created_by === GT.session.currentUser().id));
  expect(onlyOwn).toBeTruthy();
  await start(page, 'marketing_manager');
  await expect(page.locator('#appSidebar a[href="#/orders"]')).toHaveCount(0);
  await expect(page.locator('#appSidebar a[href="#/production-board"]')).toHaveCount(0);
});

test('capture Phase 12 list, form, detail, deposit roles, A4 job card and responsive board', async ({ page }) => {
  async function capture(name) { await page.waitForTimeout(550); await page.screenshot({path:'tests/screenshots/' + name + '.png',fullPage:true}); }
  await start(page);
  await capture('phase12-list');
  await page.goto('/index.html?today=2026-10-27#/orders/new?source=4');
  await capture('phase12-form');
  await page.goto('/index.html?today=2026-10-27#/orders/9');
  await capture('phase12-detail-owner');
  await page.getByRole('button', {name:'Print job card'}).click();
  await page.locator('.print-page').screenshot({path:'tests/screenshots/phase12-job-card-preview.png'});
  await page.pdf({path:'tests/screenshots/phase12-job-card-a4.pdf',format:'A4',printBackground:true});
  await page.getByRole('button', {name:'Back'}).click();
  await page.goto('/index.html?today=2026-10-27#/production-board');
  await capture('phase12-production-board');
  await start(page,'workshop_supervisor','#/orders/9');
  await capture('phase12-detail-workshop');
  await page.setViewportSize({width:360,height:800});
  await page.goto('/index.html?today=2026-10-27#/orders');
  await capture('phase12-list-360');
  await page.goto('/index.html?today=2026-10-27#/production-board');
  await capture('phase12-board-360');
});
