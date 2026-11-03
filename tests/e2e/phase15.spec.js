const { test, expect } = require('@playwright/test');

async function start(page, role = 'owner', route = '#/dashboard') {
  await page.goto('/login.html?today=2026-10-27');
  await page.evaluate(selected => { GT.store.reset(); GT.session.loginAsRole(selected); }, role);
  await page.goto('/index.html?today=2026-10-27' + route);
}

test('expense request has no voucher or ledger effect until Owner approval', async ({ page }) => {
  await start(page, 'accountant', '#/finance/expenses/new');
  const before = await page.evaluate(() => ({ next:GT.numbering.peek('payment_voucher'), rows:GT.store.count('ledger_entries'), out:GT.cashBook.monthly(GT.dates.today()).out }));
  await page.locator('#category_id').selectOption('6');
  await page.locator('#payee').fill('Machine repair shop');
  await page.locator('#amount').fill('37,000');
  await page.locator('#description').fill('Needle plate replacement');
  await page.getByRole('button', { name:'Submit for approval' }).click();
  await expect(page.locator('h1')).toContainText('Expense request');
  const id = await page.evaluate(() => Math.max(...GT.store.all('expenses').map(row => row.id)));
  expect(await page.evaluate(expenseId => ({ row:GT.store.find('expenses',expenseId), next:GT.numbering.peek('payment_voucher'), count:GT.store.count('ledger_entries'), out:GT.cashBook.monthly(GT.dates.today()).out }), id)).toMatchObject({
    row:{status:'pending',voucher_number:null},next:before.next,count:before.rows,out:before.out
  });
  await page.evaluate(() => GT.session.loginAsRole('owner'));
  await page.reload();
  await page.getByRole('button', { name:'Approve', exact:true }).click();
  await page.getByRole('button', { name:'Confirm' }).click();
  await expect(page.locator('h1')).toContainText('Expense voucher 13');
  const approved = await page.evaluate(expenseId => ({ row:GT.store.find('expenses',expenseId), ledger:GT.store.where('ledger_entries',{reference_type:'expense',reference_id:expenseId}), month:GT.cashBook.monthly(GT.dates.today()) }),id);
  expect(approved.row.status).toBe('approved');
  expect(approved.ledger).toHaveLength(1);
  expect(approved.ledger[0].credit).toBe(37000);
  expect(approved.month.out).toBe(before.out+37000);
  await page.getByRole('button',{name:'Print voucher'}).click();
  await expect(page.locator('.print-page')).toContainText('PAYMENT VOUCHER');
  await expect(page.locator('.print-page')).toContainText('Needle plate replacement');
  await expect(page.locator('.print-page')).toContainText('No. 13');
  expect(await page.locator('.print-page').evaluate(node => node.getBoundingClientRect().height)).toBeLessThan(1200);
});

test('Owner rejects with reason; draft discard consumes no voucher', async ({ page }) => {
  await start(page,'owner','#/finance/expenses/12');
  await page.getByRole('button',{name:'Reject',exact:true}).click();
  await page.getByRole('button',{name:'Confirm'}).click();
  await expect(page.locator('#expenseDecisionError')).toContainText('reason');
  await page.locator('#expenseDecisionReason').fill('No invoice supplied');
  await page.getByRole('button',{name:'Confirm'}).click();
  expect(await page.evaluate(() => GT.store.find('expenses',12))).toMatchObject({status:'rejected',rejection_reason:'No invoice supplied',voucher_number:null});
  const next = await page.evaluate(() => GT.numbering.peek('payment_voucher'));
  await page.goto('/index.html?today=2026-10-27#/finance/expenses/new');
  await page.locator('#category_id').selectOption('5');
  await page.locator('#payee').fill('Nasser Road supplies');
  await page.locator('#amount').fill('12,000');
  await page.locator('#description').fill('Thread');
  await page.getByRole('button',{name:'Save draft'}).click();
  await page.getByRole('button',{name:'Discard draft'}).click();
  await page.getByRole('button',{name:'Discard',exact:true}).click();
  expect(await page.evaluate(() => GT.numbering.peek('payment_voucher'))).toBe(next);
  expect(await page.evaluate(() => GT.store.all('expenses').at(-1).status)).toBe('discarded');
});

test('optional receipt photo uses shared compression and appears on detail', async ({ page }) => {
  await start(page,'accountant','#/finance/expenses/new');
  await page.locator('#category_id').selectOption('3');
  await page.locator('#payee').fill('City courier');
  await page.locator('#amount').fill('18,000');
  await page.locator('#description').fill('Fabric collection');
  await page.locator('#expensePhoto').setInputFiles({name:'receipt.png',mimeType:'image/png',
    buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64')});
  await expect(page.locator('#expensePhotoPreview')).toBeVisible();
  await page.getByRole('button',{name:'Submit for approval'}).click();
  await expect(page.locator('#openExpensePhoto')).toBeVisible();
  const photo=await page.evaluate(() => GT.store.all('expenses').at(-1).receipt_photo_path);
  expect(photo.startsWith('data:image/jpeg;base64,')).toBe(true);
  await page.locator('#openExpensePhoto').click();
  await expect(page.locator('.expense-photo-large')).toBeVisible();
});

test('Owner cancellation retains voucher and reverses the ledger and monthly money out', async ({ page }) => {
  await start(page,'owner','#/finance/expenses/11');
  const before=await page.evaluate(() => GT.cashBook.monthly(GT.dates.today()).out);
  await page.getByRole('button',{name:'Cancel expense'}).click();
  await page.getByRole('button',{name:'Confirm'}).click();
  await expect(page.locator('#expenseDecisionError')).toContainText('reason');
  await page.locator('#expenseDecisionReason').fill('Payment entered twice');
  await page.getByRole('button',{name:'Confirm'}).click();
  const result=await page.evaluate(() => ({row:GT.store.find('expenses',11),out:GT.cashBook.monthly(GT.dates.today()).out,
    reversal:GT.store.where('ledger_entries',{reference_type:'expense_reversal',reference_id:11})}));
  expect(result.row).toMatchObject({status:'cancelled',voucher_number:'11',cancellation_reason:'Payment entered twice'});
  expect(result.out).toBe(before-68000);
  expect(result.reversal).toHaveLength(1);
  expect(result.reversal[0].debit).toBe(68000);
  await page.getByRole('button',{name:'Print voucher'}).click();
  await expect(page.locator('.print-page')).toContainText('VOID');
});

test('invoice receipt posts once; void reverses cash book and daily collections', async ({ page }) => {
  await start(page,'owner','#/dashboard');
  const seed=await page.evaluate(() => ({in:GT.cashBook.monthly(GT.dates.today()).in,takings:GT.dashboard.takings(),receiptCount:GT.store.count('receipts')}));
  const result=await page.evaluate(() => {
    const invoice=GT.receipts.openInvoicesFor()[0];
    const created=GT.receipts.save({invoice_id:invoice.id,customer_id:invoice.customer_id,amount:1000,payment_method:'cash',reference:'',received_at:GT.dates.today()});
    return {id:created.id,amount:created.amount};
  });
  expect(await page.evaluate(() => GT.cashBook.monthly(GT.dates.today()).in)).toBe(seed.in+1000);
  expect(await page.evaluate(() => GT.dashboard.takings())).toBe(seed.takings+1000);
  await page.evaluate(id => GT.receipts.voidReceipt(id,'Wrong amount'),result.id);
  expect(await page.evaluate(() => GT.cashBook.monthly(GT.dates.today()).in)).toBe(seed.in);
  expect(await page.evaluate(() => GT.dashboard.takings())).toBe(seed.takings);
  expect(await page.evaluate(() => GT.store.count('receipts'))).toBe(seed.receiptCount+1);
});

test('quick sale posts one collection and its approved void reverses it', async ({ page }) => {
  await start(page,'sales','#/sales/quick-sale');
  const result=await page.evaluate(() => {
    const before=GT.cashBook.monthly(GT.dates.today()).in;
    const sale=GT.quickSales.create({location_id:1,lines:[{product_variant_id:1,quantity:1}],
      discount_amount:0,payment_method:'cash',reference:'',amount_received:50000});
    return {id:sale.id,receiptId:sale.receipt_id,total:sale.total,before,after:GT.cashBook.monthly(GT.dates.today()).in};
  });
  expect(result.after).toBe(result.before+result.total);
  expect(await page.evaluate(id => GT.store.where('ledger_entries',{reference_type:'receipt',reference_id:id}).length,result.receiptId)).toBe(1);
  await page.evaluate(id => GT.quickSales.requestVoid(id,'Wrong item'),result.id);
  await page.evaluate(() => GT.session.loginAsRole('owner'));
  await page.reload();
  await page.evaluate(id => GT.quickSales.decideVoid(id,true,'Approved correction'),result.id);
  expect(await page.evaluate(() => GT.cashBook.monthly(GT.dates.today()).in)).toBe(result.before);
  expect(await page.evaluate(id => GT.store.where('ledger_entries',{reference_type:'receipt_reversal',reference_id:id}).length,result.receiptId)).toBe(1);
});

test('cash-book receipt row opens the matching quick sale', async ({ page }) => {
  await start(page,'owner','#/finance/cash-book');
  await page.locator('.shared-data-table tbody tr').filter({hasText:'Receipt 2080'}).click();
  await expect(page.locator('h1')).toContainText('receipt 2080');
});

test('role dashboards link to source pages and restricted roles see no money', async ({ page }) => {
  for (const role of ['owner','general_manager','accountant','workshop_supervisor','store_keeper','sales','marketing_manager']) {
    await start(page,role);
    await expect(page.locator('h1')).toHaveText('Dashboard');
    await expect(page.locator('#appSidebar [aria-current="page"]')).toHaveCount(1);
    const cards=page.locator('#dashboardStats .stat-card');
    for (const card of await cards.all()) await expect(card).toHaveAttribute('data-stat-card');
    if (['store_keeper','workshop_supervisor'].includes(role)) {
      await expect(page.locator('#appSidebar a[href="#/finance/expenses"]')).toHaveCount(0);
      await expect(page.locator('#pageContent')).not.toContainText('UGX');
      await page.goto('/index.html?today=2026-10-27#/finance/expenses');
      await expect(page.locator('#pageContent')).toContainText('Access denied');
    }
    if (role==='sales') {
      await expect(page.locator('#pageContent')).toContainText('Quick sales today');
      await expect(page.locator('#pageContent')).not.toContainText('Money out');
    }
    if (role==='general_manager' || role==='accountant') {
      await page.goto('/index.html?today=2026-10-27#/finance/expenses/new');
      await expect(page.locator('h1')).toHaveText('New expense');
      await page.goto('/index.html?today=2026-10-27#/finance/expenses/12');
      await expect(page.getByRole('button',{name:'Approve',exact:true})).toHaveCount(0);
    }
    if (role==='owner') {
      await expect(page.locator('#pageContent')).toContainText('Money out this month');
      await page.getByRole('button',{name:/Pending Owner approvals/}).click();
      await expect(page.locator('h1')).toHaveText('Pending approvals');
      await expect(page.locator('#dashboardApprovalMount')).toContainText('Expense request');
    }
  }
});

test('expenses and dashboards remain usable at 360px', async ({ page }) => {
  await start(page,'owner','#/finance/expenses');
  await page.setViewportSize({width:360,height:800});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
  await expect(page.locator('.shared-data-table tbody tr').first()).toBeVisible();
  await page.goto('/index.html?today=2026-10-27#/dashboard');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
  await expect(page.locator('.dashboard-bars a').first()).toBeVisible();
});

test('dashboard cards open their source pages for every role', async ({ page }) => {
  const expected = {
    owner:['#/sales/receipts','#/finance/cash-book','#/finance/cash-book','#/debtors','#/orders','#/inventory/alerts','#/dashboard/approvals','#/marketing/targets'],
    general_manager:['#/sales/receipts','#/finance/cash-book','#/finance/cash-book','#/debtors','#/orders','#/inventory/alerts','#/dashboard/approvals','#/marketing/targets'],
    accountant:['#/sales/receipts','#/finance/cash-book','#/finance/cash-book','#/debtors','#/orders','#/inventory/alerts','#/dashboard/approvals','#/marketing/targets'],
    workshop_supervisor:['#/orders','#/production-board'],
    store_keeper:['#/inventory/alerts','#/material-issues','#/inventory/finished-goods'],
    sales:['#/sales/quick-sales','#/orders','#/marketing/targets']
  };
  for (const [role,routes] of Object.entries(expected)) {
    await start(page,role);
    await expect(page.locator('#dashboardStats .stat-card')).toHaveCount(routes.length);
    for (let index=0;index<routes.length;index+=1) {
      await page.locator('#dashboardStats .stat-card').nth(index).click();
      expect(new URL(page.url()).hash).toBe(routes[index]);
      await expect(page.locator('#pageContent')).not.toContainText('Access denied');
      await expect(page.locator('#pageContent')).not.toContainText('Built in a later phase');
      await page.goto('/index.html?today=2026-10-27#/dashboard');
    }
  }
});

test('dashboard activity includes each source, actor and date, with role-safe amounts', async ({ page }) => {
  await start(page,'owner');
  const events=await page.evaluate(() => GT.dashboard.recentActivity());
  expect(new Set(events.map(row => row.type))).toEqual(new Set(['receipt','quick_sale','order','expense','approval']));
  for (const event of events) {
    expect(event.label.length).toBeGreaterThan(12);
    expect(event.actor.length).toBeGreaterThan(1);
    expect(event.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  }
  await expect(page.locator('.dashboard-section').filter({hasText:'Recent activity'}).locator('.detail-list li')).toHaveCount(events.length);
  for (const event of events) {
    const link=page.locator('.dashboard-section').filter({hasText:'Recent activity'}).locator('.detail-list a[href="'+event.route+'"]');
    await expect(link.first()).toContainText(event.actor);
    await expect(link.first()).toContainText(await page.evaluate(date => GT.dates.formatDate(date),event.date));
  }
  for (const route of [...new Set(events.map(event => event.route))]) {
    await page.locator('.dashboard-section').filter({hasText:'Recent activity'}).locator('.detail-list a[href="'+route+'"]').first().click();
    expect(new URL(page.url()).hash).toBe(route);
    await expect(page.locator('#pageContent')).not.toContainText('Access denied');
    await page.goto('/index.html?today=2026-10-27#/dashboard');
  }
  await page.locator('.dashboard-bars a').first().click();
  expect(new URL(page.url()).hash).toBe('#/production-board');
  for (const role of ['workshop_supervisor','store_keeper']) {
    await start(page,role);
    expect((await page.evaluate(() => GT.dashboard.recentActivity())).every(row => row.amount===null)).toBe(true);
  }
});

test('dashboard money out matches statement expenditure in each cancellation month', async ({ page }) => {
  await start(page,'owner');
  const before=await page.evaluate(() => GT.dashboard.monthMoney().out);
  const statement=await page.evaluate(() => GT.reports.financial('2026-10').expenseSpending);
  expect(before).toBe(statement);
  await page.goto('/index.html?today=2026-11-03#/dashboard');
  await page.evaluate(() => GT.expenses.cancel(11,'Duplicate payment'));
  const totals=await page.evaluate(() => ({october:GT.cashBook.monthly('2026-10-27').out,
    november:GT.cashBook.monthly('2026-11-03').out,octoberStatement:GT.reports.financial('2026-10').expenseSpending,
    novemberStatement:GT.reports.financial('2026-11').expenseSpending,
    ledger:GT.store.where('ledger_entries',{reference_type:'expense_reversal',reference_id:11}).length}));
  expect(totals).toEqual({october:before,november:-68000,octoberStatement:before,novemberStatement:-68000,ledger:1});
});

test('dashboard KPI money stays on one line and rows have equal, balanced cards', async ({ page }) => {
  await start(page,'owner');
  for (const width of [1440,360]) {
    await page.setViewportSize({width,height:900});
    const cards=await page.locator('#dashboardStats .stat-card').evaluateAll(nodes => nodes.map(node => {
      const box=node.getBoundingClientRect(),value=node.querySelector('.stat-card-value');
      return {top:Math.round(box.top),height:Math.round(box.height),width:box.width,
        money:node.classList.contains('stat-card-money'),nowrap:getComputedStyle(value).whiteSpace,
        clipped:value.scrollWidth>value.clientWidth+1};
    }));
    const rows=[...new Set(cards.map(card => card.top))];
    for (const top of rows) expect(new Set(cards.filter(card => card.top===top).map(card => card.height)).size).toBe(1);
    for (const card of cards.filter(card => card.money)) {
      expect(card.nowrap).toBe('nowrap');
      expect(card.clipped).toBe(false);
    }
    if (width===1440) expect(cards.filter(card => card.top===rows.at(-1))[0].width).toBeGreaterThanOrEqual(cards[0].width);
  }
});
