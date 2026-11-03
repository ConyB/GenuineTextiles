const { test, expect } = require('@playwright/test');

async function start(page, role = 'owner', route = '#/inventory/finished-goods') {
  await page.goto('/login.html?today=2026-10-27');
  await page.evaluate(selected => { GT.store.reset(); GT.session.loginAsRole(selected); }, role);
  await page.goto('/index.html?today=2026-10-27' + route);
}

test('finished goods list, detail and ledger show seeded variants', async ({ page }) => {
  await start(page);
  await expect(page.locator('h1')).toHaveText('Finished Goods');
  expect(await page.evaluate(() => GT.store.count('product_variants'))).toBe(12);
  await expect(page.locator('.stat-card')).toHaveCount(4);
  await page.locator('.shared-data-table tbody tr').first().click();
  await expect(page.getByRole('heading',{name:'Stock movement history'})).toBeVisible();
  await expect(page.locator('#fgMovements')).toContainText('opening');
  const valid = await page.evaluate(() => GT.store.all('product_variants').every(variant => {
    const net=GT.store.where('stock_movements',row => row.item_type==='product_variant' && row.item_id===variant.id && row.location_id===variant.location_id).reduce((sum,row) => sum+row.quantity,0);
    return net===variant.quantity;
  }));
  expect(valid).toBe(true);
});

test('pending finished-good adjustment posts only after Owner approval', async ({ page }) => {
  await start(page,'store_keeper','#/inventory/finished-goods/4');
  await expect(page.locator('#fgAdjustments')).toContainText('pending');
  await expect(page.getByRole('button',{name:'Approve',exact:true})).toHaveCount(0);
  const before=await page.evaluate(() => GT.store.find('product_variants',4).quantity);
  await page.evaluate(() => GT.session.loginAsRole('owner'));
  await page.reload();
  await page.getByRole('button',{name:'Approve',exact:true}).click();
  await page.locator('#fg_note').fill('Shelf count checked by Owner');
  await page.getByRole('button',{name:'Save decision'}).click();
  expect(await page.evaluate(() => GT.store.find('product_variants',4).quantity)).toBe(before+4);
  expect(await page.evaluate(() => GT.store.find('finished_good_adjustments',1).status)).toBe('approved');
});

test('stock production order reaches Ready and receives only its remaining quantity; transfer balances', async ({ page }) => {
  await start(page);
  const result=await page.evaluate(() => {
    const opening=GT.finishedGoods.openingStock(5,4,'Initial shelf count');
    const initial=GT.store.find('product_variants',1).quantity;
    const order=GT.finishedGoods.createStockOrder(1,5,'2026-11-02');
    for (let i=0;i<5;i++) GT.finishedGoods.advanceStockOrder(order.id);
    const received=GT.finishedGoods.receive(order.id,3);
    const tooMany=(() => { try { GT.finishedGoods.receive(order.id,3); return false; } catch { return true; } })();
    const transfer=GT.finishedGoods.transfer(1,2,2);
    return {stage:GT.store.find('orders',order.id).current_stage,customer:order.customer_id,initial,
      after:GT.store.find('product_variants',1).quantity,target:transfer.into.variant.quantity,
      receivedType:received.movement.movement_type,openingType:opening.movement.movement_type,tooMany};
  });
  expect(result).toMatchObject({stage:'Ready for delivery',customer:null,after:result.initial+1,target:2,receivedType:'received_from_production',openingType:'opening',tooMany:true});
});

test('counter sale reduces stock, issues shared-sequence receipt and prints A4', async ({ page }) => {
  await start(page,'sales','#/sales/quick-sale');
  await expect(page.locator('h1')).toHaveText('Quick Sale');
  await page.locator('#quickSearch').fill('White School Shirt');
  await page.locator('#quickItem').selectOption('1');
  await page.locator('#quickQuantity').fill('2');
  await page.getByRole('button',{name:'Add item'}).click();
  await page.locator('#quickSearch').fill('Corporate Polo Shirt');
  await page.locator('#quickItem').selectOption('7');
  await page.getByRole('button',{name:'Add item'}).click();
  const total=await page.evaluate(() => GT.quickSales.totals([{quantity:2,unit_price:35000},{quantity:1,unit_price:45000}],0).total);
  await page.locator('#quickReceived').fill(String(total+5000));
  await expect(page.locator('#quickChange')).toContainText('UGX 5,000');
  await page.getByRole('button',{name:'Complete sale'}).click();
  await expect(page.locator('h1')).toContainText('receipt 2081');
  const saved=await page.evaluate(() => ({stock1:GT.store.find('product_variants',1).quantity,stock7:GT.store.find('product_variants',7).quantity,
    receipt:GT.store.where('receipts',{number:'2081'})[0],sale:GT.store.find('quick_sales',8),today:GT.receipts.collectedOn('2026-10-27',4)}));
  expect(saved.stock1).toBe(36);
  expect(saved.stock7).toBe(13);
  expect(saved.receipt.invoice_id).toBeNull();
  expect(saved.sale.change_due).toBe(5000);
  expect(saved.today).toBeGreaterThanOrEqual(total);
  await page.getByRole('button',{name:'Print receipt'}).click();
  await expect(page.locator('.print-page')).toContainText('No. 2081');
  await expect(page.locator('.print-page')).toContainText('Quick sale 8');
  await expect(page.locator('.print-page')).not.toContainText('Invoice');
  await page.emulateMedia({media:'print'});
  const pdf=await page.pdf({format:'A4',printBackground:true});
  expect((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length).toBe(1);
});

test('discount approval waits and Owner void reverses stock and daily takings', async ({ page }) => {
  await start(page,'sales','#/sales/quick-sales');
  const result=await page.evaluate(() => {
    const stock=GT.store.find('product_variants',2).quantity, takings=GT.receipts.collectedOn('2026-10-27');
    const pending=GT.quickSales.create({location_id:1,lines:[{product_variant_id:2,quantity:1}],discount_amount:1000,
      discount_reason:'Customer loyalty',payment_method:'cash',reference:'',amount_received:50000});
    return {id:pending.id,status:pending.status,stock,takings,afterPending:GT.store.find('product_variants',2).quantity,receipt:pending.receipt_id};
  });
  expect(result).toMatchObject({status:'pending_discount',afterPending:result.stock,receipt:null});
  await page.evaluate(() => GT.session.loginAsRole('general_manager'));
  await page.reload();
  await page.goto('/index.html?today=2026-10-27#/sales/quick-sales/'+result.id);
  await page.getByRole('button',{name:'Approve discount'}).click();
  await page.locator('#quickDecisionNote').fill('Approved customer loyalty price');
  await page.getByRole('button',{name:'Save decision'}).click();
  await page.evaluate(() => GT.session.loginAsRole('sales'));
  await page.reload();
  await page.getByRole('button',{name:'Complete sale'}).click();
  expect(await page.evaluate(() => GT.store.find('product_variants',2).quantity)).toBe(result.stock-1);
  expect(await page.evaluate(() => { try { GT.receipts.voidReceipt(GT.store.find('quick_sales',8).receipt_id,'Bypass'); return false; } catch { return true; } })).toBe(true);
  await page.locator('.gt-toast-close').click();
  await page.getByRole('button',{name:'Request void'}).click();
  await page.locator('#quickDecisionNote').fill('Wrong item selected');
  await page.getByRole('button',{name:'Save decision'}).click();
  expect(await page.evaluate(() => GT.store.find('product_variants',2).quantity)).toBe(result.stock-1);
  await page.evaluate(() => GT.session.loginAsRole('owner'));
  await page.reload();
  await page.getByRole('button',{name:'Approve void'}).click();
  await page.locator('#quickDecisionNote').fill('Approved correction');
  await page.getByRole('button',{name:'Save decision'}).click();
  const final=await page.evaluate(id => ({stock:GT.store.find('product_variants',2).quantity,
    sale:GT.store.find('quick_sales',id),receipt:GT.store.find('receipts',GT.store.find('quick_sales',id).receipt_id),
    takings:GT.receipts.collectedOn('2026-10-27')}),result.id);
  expect(final.stock).toBe(result.stock);
  expect(final.sale.status).toBe('void');
  expect(final.receipt.status).toBe('void');
  expect(final.takings).toBe(result.takings);
  await page.locator('.gt-toast-close').click();
  await page.getByRole('button',{name:'Print receipt'}).click();
  await expect(page.locator('.print-page')).toContainText('VOID');
});

test('role visibility and phone and desktop layouts', async ({ page }) => {
  await start(page,'workshop_supervisor','#/inventory/finished-goods/1');
  await expect(page.locator('#pageContent')).not.toContainText(/UGX|cost|profit|price/i);
  await page.setViewportSize({width:360,height:800});
  expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.evaluate(() => GT.session.loginAsRole('store_keeper'));
  await page.reload();
  await expect(page.locator('#pageContent')).not.toContainText(/UGX|cost|profit|price/i);
  await page.goto('/index.html?today=2026-10-27#/sales/quick-sales');
  await expect(page.locator('h1')).toHaveText('Access denied');
  await page.evaluate(() => GT.session.loginAsRole('sales'));
  await page.reload();
  await expect(page.locator('h1')).toHaveText('Quick Sales');
  expect(await page.evaluate(() => GT.quickSales.list().every(row => row.cashier_id===GT.session.currentUser().id))).toBe(true);
  await page.goto('/index.html?today=2026-10-27#/sales/quick-sale');
  expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.setViewportSize({width:1440,height:900});
  const overflow=await page.evaluate(() => ({width:innerWidth,scroll:document.documentElement.scrollWidth,wide:Array.from(document.querySelectorAll('#pageContent *')).filter(el => el.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(el => ({tag:el.tagName,cls:el.className,id:el.id,right:el.getBoundingClientRect().right}))}));
  expect(overflow.scroll,JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.width+1);
});
