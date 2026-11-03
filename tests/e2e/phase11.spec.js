// Phase 11 service lifecycle. UI journeys are added with the delivery screens.
const { test, expect } = require('@playwright/test');

async function login(page, role) {
  await page.goto('/login.html?today=2026-10-26');
  await page.evaluate((wanted) => { GT.store.reset(); GT.session.loginAsRole(wanted); }, role);
  await page.goto('/index.html?today=2026-10-26#/dashboard');
}

test('partial, complete, return and void recompute invoice quantities', async ({ page }) => {
  await login(page, 'owner');
  const result = await page.evaluate(() => {
    const doc=GT.store.all('sales_documents').find((row) => row.number==='635');
    const source=GT.salesDocs.items(doc.id)[0];
    const first=GT.deliveries.createDraft(doc.id);
    GT.deliveries.saveDraft(first.id,{delivery_method:'delivered_by_us',lines:[{sales_document_item_id:source.id,qty_dispatched:source.quantity/2}]});
    const draftNumber=first.number;
    const issued=GT.deliveries.issue(first.id);
    const partial=GT.deliveries.summary(doc.id).status;
    const second=GT.deliveries.createDraft(doc.id);
    GT.deliveries.saveDraft(second.id,{delivery_method:'courier'});
    let overQuantity='';
    try { GT.deliveries.saveDraft(second.id,{lines:[{sales_document_item_id:source.id,qty_dispatched:source.quantity}]}); }
    catch (error) { overQuantity=error.message; }
    const issuedSecond=GT.deliveries.issue(second.id);
    const complete=GT.deliveries.summary(doc.id).status;
    const line=GT.deliveries.noteLines(first.id)[0];
    GT.deliveries.confirm(first.id,{received_by:'School receiver',received_date:'2026-10-26',lines:[{delivery_note_item_id:line.id,qty_received:line.qty_dispatched-1,return_reason:'damaged'}]});
    const afterReturn=GT.deliveries.summary(doc.id).lines[0].remaining;
    GT.deliveries.void(second.id,'Courier could not collect');
    const afterVoid=GT.deliveries.summary(doc.id).lines[0].remaining;
    let confirmedVoid='';
    try { GT.deliveries.void(first.id,'Complaint'); } catch (error) { confirmedVoid=error.message; }
    return {draftNumber,number:issued.number,secondNumber:issuedSecond.number,partial,complete,afterReturn,afterVoid,overQuantity,confirmedVoid,sequence:GT.numbering.peek('delivery_note')};
  });
  expect(result).toMatchObject({draftNumber:null,number:'2056',secondNumber:'2057',partial:'part_delivered',complete:'delivered',afterReturn:1,sequence:'2058'});
  expect(result.afterVoid).toBeGreaterThan(result.afterReturn);
  expect(result.overQuantity).toContain('remaining');
  expect(result.confirmedVoid).toContain('unconfirmed');
});

test('cash balance requires manager release; rejection leaves a draft', async ({ page }) => {
  await login(page, 'sales');
  const result = await page.evaluate(() => {
    const seller=GT.session.currentUser();
    const doc=GT.store.create('sales_documents',{type:'invoice',number:'900',customer_id:14,status:'issued',issue_date:'2026-10-20',due_date:'2026-10-20',total:100000,created_by:seller.id});
    GT.store.create('sales_document_items',{sales_document_id:doc.id,description:'Shirts',size:'M',quantity:5,unit:'pcs',active:true});
    const check=GT.deliveries.releaseCheck(doc.id);
    const note=GT.deliveries.createDraft(doc.id);
    GT.deliveries.saveDraft(note.id,{delivery_method:'courier'});
    const requested=GT.deliveries.issue(note.id,'Sales cannot approve');
    const pending=GT.deliveries.pendingReleaseCount();
    GT.session.loginAsRole('general_manager');
    GT.deliveries.rejectRelease(note.id,'Await payment discussion');
    const afterReject=GT.store.find('delivery_notes',note.id).status;
    const issued=GT.deliveries.issue(note.id,'Approved after customer call');
    const decision=GT.deliveries.approvalFor(note.id,'approved');
    return {check:check.status,requested:requested.status,pending,afterReject,number:issued.number,
      approvedBy:decision.approved_by,reason:decision.reason,owner:GT.session.currentUser().id};
  });
  expect(result).toMatchObject({check:'needs_approval',requested:'approval_requested',pending:1,afterReject:'draft',number:'2056',reason:'Approved after customer call'});
  expect(result.approvedBy).toBe(result.owner);
});

test('role gates protect drafts, confirmation and void', async ({ page }) => {
  await login(page, 'owner');
  const result = await page.evaluate(() => {
    const doc=GT.store.all('sales_documents').find((row) => row.number==='635');
    const note=GT.deliveries.createDraft(doc.id);
    GT.deliveries.saveDraft(note.id,{delivery_method:'collected_by_customer'});
    GT.deliveries.issue(note.id);
    GT.session.loginAsRole('workshop_supervisor');
    const workshopList=GT.deliveries.list().length;
    let workshopConfirm='';
    try { GT.deliveries.confirm(note.id,{received_by:'Receiver',received_date:'2026-10-26',lines:[]}); }
    catch (error) { workshopConfirm=error.message; }
    GT.session.loginAsRole('store_keeper');
    let storeVoid='';
    try { GT.deliveries.void(note.id,'Wrong vehicle'); } catch (error) { storeVoid=error.message; }
    const line=GT.deliveries.noteLines(note.id)[0];
    const confirmed=GT.deliveries.confirm(note.id,{received_by:'Customer receiver',received_date:'2026-10-26',lines:[{delivery_note_item_id:line.id,qty_received:line.qty_dispatched}]});
    return {workshopList,workshopConfirm,storeVoid,status:confirmed.status};
  });
  expect(result.workshopList).toBe(12);
  expect(result.workshopConfirm).toContain('cannot confirm');
  expect(result.storeVoid).toContain('Only Owner or General Manager');
  expect(result.status).toBe('delivered');
});

test('delivery list, partial form, second dispatch and invoice status', async ({ page }) => {
  await login(page,'owner');
  await page.goto('/index.html?today=2026-10-26#/delivery-notes');
  await expect(page.locator('#deliveryNotesTable tbody tr')).toHaveCount(11);
  await page.screenshot({path:'tests/screenshots/phase11-list.png',fullPage:true});
  const doc=await page.evaluate(() => GT.store.all('sales_documents').find((row) => row.number==='635'));
  await page.goto('/index.html?today=2026-10-26#/delivery-notes/new?invoice='+doc.id);
  await expect(page.locator('#deliveryForm')).toBeVisible();
  await page.screenshot({path:'tests/screenshots/phase11-form.png',fullPage:true});
  await page.locator('#deliveryForm [name="delivery_method"]').selectOption('courier');
  const ordered=await page.evaluate((id) => GT.deliveries.summary(id).lines[0].ordered,doc.id);
  await page.locator('#deliveryLines [data-line-field="qty_dispatched"]').fill(String(ordered/2));
  await page.locator('#deliveryIssue').click();
  await expect(page.locator('.delivery-detail-page h1')).toContainText('2056');
  expect(await page.evaluate((id) => GT.deliveries.summary(id).status,doc.id)).toBe('part_delivered');
  await page.goto('/index.html?today=2026-10-26#/admin/numbering');
  await expect(page.locator('#documentNumberingTable tbody tr').filter({hasText:'Delivery Note'}).locator('td').nth(3)).toHaveText('2056');
  await page.goto('/index.html?today=2026-10-26#/delivery-notes/new?invoice='+doc.id);
  await page.locator('#deliveryForm [name="delivery_method"]').selectOption('courier');
  await expect(page.locator('#deliveryLines [data-line-field="qty_dispatched"]')).toHaveValue(String(ordered/2));
  await page.locator('#deliveryLines [data-line-field="qty_dispatched"]').fill(String(ordered));
  await expect(page.locator('#deliveryLines [data-line-error]')).toContainText('zero to remaining');
  await page.locator('#deliveryLines [data-line-field="qty_dispatched"]').fill(String(ordered/2));
  await page.locator('#deliveryIssue').click();
  await expect(page.locator('.delivery-detail-page h1')).toContainText('2057');
  expect(await page.evaluate((id) => GT.deliveries.summary(id).status,doc.id)).toBe('delivered');
  await page.goto('/index.html?today=2026-10-26#/invoices/'+doc.id);
  await expect(page.locator('#invoiceDeliveriesTable tbody tr')).toHaveCount(2);
  await expect(page.locator('#pageContent .module-title-line')).toContainText('delivered');
});

test('future draft date offers Set to today and manager release records a reason', async ({ page }) => {
  await login(page,'general_manager');
  await page.goto('/index.html?today=2026-10-26#/delivery-notes/11/edit');
  await expect(page.locator('#deliverySetToday')).toBeVisible();
  await expect(page.locator('#deliveryIssue')).toBeHidden();
  await page.locator('#deliverySetToday').click();
  await expect(page.locator('#deliveryIssue')).toBeVisible();
  await page.locator('#deliveryForm button[type="submit"]').click();
  await expect(page.locator('.delivery-detail-page h1')).toContainText('Draft');
  const cash=await page.evaluate(() => GT.store.all('sales_documents').find((row) => row.number==='642'));
  await page.goto('/index.html?today=2026-10-26#/delivery-notes/new?invoice='+cash.id);
  await expect(page.locator('#deliveryReleasePanel')).toContainText('Approval needed');
  await expect(page.locator('#deliveryReleasePanel')).toContainText('Invoice total');
  await expect(page.locator('#deliveryIssue')).toHaveText('Approve and issue');
  await page.locator('.gt-toast-close').evaluateAll((buttons) => buttons.forEach((button) => button.click()));
  await page.evaluate(() => scrollTo(0,0));
  await page.screenshot({path:'tests/screenshots/phase11-release-panel.png'});
  await page.locator('#deliveryForm [name="delivery_method"]').selectOption('courier');
  await page.locator('#deliveryIssue').click();
  await expect(page.locator('#deliveryReleaseReason')).toBeVisible();
  await page.locator('#deliveryReleaseReason').fill('Approved after customer arranged collection');
  await page.locator('#deliveryReleaseApprove').click();
  await expect(page.locator('.delivery-detail-page h1')).toContainText('2056');
  const approval=await page.evaluate(() => GT.store.where('approvals',(row) => row.type==='delivery_release' && row.status==='approved')[0]);
  expect(approval.reason).toBe('Approved after customer arranged collection');
});

test('confirmation, print copies and dispatch register contain no prices', async ({ page }) => {
  await login(page,'store_keeper');
  await page.goto('/index.html?today=2026-10-26#/dispatch-log');
  await expect(page.locator('#dispatchLogTable tbody tr')).toHaveCount(9);
  await page.locator('[data-table-filter="age"]').selectOption('late');
  await expect(page.locator('#dispatchLogTable tbody tr')).toHaveCount(1);
  await page.screenshot({path:'tests/screenshots/phase11-dispatch-log.png',fullPage:true});
  await page.locator('[data-page-action="print"]').click();
  await expect(page.locator('.print-preview-shell')).not.toContainText('UGX');
  await page.pdf({path:'tests/screenshots/phase11-dispatch-log-a4.pdf',format:'A4',landscape:true,printBackground:true});
  await page.locator('[data-print-back]').click();
  await page.goto('/index.html?today=2026-10-26#/delivery-notes/7');
  await expect(page.locator('.delivery-detail-page')).toContainText('2052');
  await expect(page.locator('.delivery-detail-page')).not.toContainText('UGX');
  await expect(page.locator('#deliveryDetailTable th').filter({hasText:'Received'})).toBeVisible();
  await expect(page.locator('#deliveryDetailTable th').filter({hasText:'Returned'})).toBeVisible();
  await page.screenshot({path:'tests/screenshots/phase11-detail.png',fullPage:true});
  await page.locator('[data-page-action="confirm"]').click();
  await page.locator('#deliveryReceivedBy').fill('School storekeeper');
  const before=await page.evaluate(() => GT.deliveries.summary(GT.store.find('delivery_notes',7).invoice_id).lines[0].remaining);
  const quantity=await page.locator('#deliveryReceivedLines [data-line-value="qty_dispatched"]').textContent();
  await page.locator('#deliveryReceivedLines [data-line-field="qty_received"]').fill(String(Number(quantity)-1));
  await page.locator('#deliveryReceivedLines [data-line-field="return_reason"]').selectOption('wrong_size');
  await page.locator('#deliveryConfirmSave').click();
  await expect(page.locator('.delivery-detail-page')).toContainText('Delivered');
  const after=await page.evaluate(() => GT.deliveries.summary(GT.store.find('delivery_notes',7).invoice_id).lines[0].remaining);
  expect(after).toBe(before+1);
  await page.locator('[data-page-action="print"]').click();
  await page.locator('#deliveryCopies').selectOption('two');
  await expect(page.locator('.delivery-print-copy')).toHaveCount(2);
  await expect(page.locator('.print-preview-shell')).not.toContainText('UGX');
  await expect(page.locator('.delivery-print-table tbody tr td').last()).toHaveText(String(after));
  await page.screenshot({path:'tests/screenshots/phase11-print-preview.png',fullPage:true});
  await page.pdf({path:'tests/screenshots/phase11-print-a4.pdf',format:'A4',printBackground:true});
  await page.locator('[data-print-back]').click();
  await page.goto('/index.html?today=2026-10-26#/delivery-notes/9');
  await page.locator('[data-page-action="print"]').click();
  await expect(page.locator('.print-preview-shell')).toContainText('VOID');
  await expect(page.locator('.print-preview-shell')).not.toContainText('UGX');
});

test('delivery roles and 360px list', async ({ page }) => {
  for (const role of ['owner','general_manager','store_keeper','sales','workshop_supervisor','accountant']) {
    await login(page,role);
    await expect(page.locator('#appSidebar a[href="#/delivery-notes"]')).toHaveCount(1);
    await expect(page.locator('#appSidebar a[href="#/dispatch-log"]')).toHaveCount(1);
  }
  await login(page,'marketing_manager');
  await expect(page.locator('#appSidebar a[href="#/delivery-notes"]')).toHaveCount(0);
  await login(page,'store_keeper');
  await expect(page.locator('#appSidebar a[href="#/delivery-notes"] .nav-count-badge')).toHaveText('2');
  const cash=await page.evaluate(() => GT.store.all('sales_documents').find((row) => row.number==='642'));
  await page.goto('/index.html?today=2026-10-26#/delivery-notes/new?invoice='+cash.id);
  await expect(page.locator('#deliveryReleasePanel')).toContainText('Approval needed');
  await expect(page.locator('.delivery-form-page')).not.toContainText('UGX');
  await expect(page.locator('#deliveryIssue')).toHaveText('Request release');
  await login(page,'workshop_supervisor');
  await page.goto('/index.html?today=2026-10-26#/delivery-notes/7');
  await expect(page.locator('.delivery-detail-page')).not.toContainText('UGX');
  await expect(page.locator('[data-page-action="confirm"]')).toHaveCount(0);
  await page.setViewportSize({width:360,height:800});
  await page.goto('/index.html?today=2026-10-26#/delivery-notes');
  expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
  await page.screenshot({path:'tests/screenshots/phase11-list-360.png',fullPage:true});
  await login(page,'owner');
  const openInvoice=await page.evaluate(() => GT.store.all('sales_documents').find((row) => row.number==='635'));
  await page.goto('/index.html?today=2026-10-26#/delivery-notes/new?invoice='+openInvoice.id);
  await expect(page.locator('#deliveryForm')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
  await page.goto('/index.html?today=2026-10-26#/delivery-notes/7');
  expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
  await page.goto('/index.html?today=2026-10-26#/dispatch-log');
  expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
});
