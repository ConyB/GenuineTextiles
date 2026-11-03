const {test,expect}=require('@playwright/test');

async function start(page,role='owner') {
  await page.goto('/login.html?today=2026-10-28');
  await page.evaluate(selected=>{ GT.store.reset(); GT.session.loginAsRole(selected); },role);
  await page.goto('/index.html?today=2026-10-28#/production/fabric-calculator');
}

test('Owner example is exactly 1.6 m and source rows are visible',async ({page})=>{
  await start(page);
  await expect(page.locator('#fabricResult')).toContainText('1.60 m');
  const result=await page.evaluate(()=>GT.fabricCalculator.calculate({design_id:1,size:'Large',width_inches:60,quantity:1,option_ids:[]}));
  expect(result).toMatchObject({base_metres:1.5,width_adjustment_metres:0,wastage_metres:0.1,metres_per_piece:1.6,total_metres:1.6});
  await expect(page.locator('#fabric_rulesMount')).toContainText('Owner example');
  await expect(page.locator('#fabric_width_adjustmentsMount')).toContainText('ASSUMED illustration');
  await expect(page.locator('.fabric-rule-notice')).toHaveText('Rules are illustrations until the owner confirms them (A-06).');
});

test('width, style and quantity follow the seven service steps',async ({page})=>{
  await start(page);
  await page.locator('#fabricCalculatorForm [name="width_inches"]').selectOption('44');
  await expect(page.locator('#fabricResult')).toContainText('1.90 m');
  await page.locator('.fabric-option input[value="1"]').check();
  await expect(page.locator('#fabricResult')).toContainText('2.10 m');
  await page.locator('#fabricCalculatorForm [name="quantity"]').fill('3');
  await expect(page.locator('#fabricResult')).toContainText('6.30 m');
  const result=await page.evaluate(()=>GT.fabricCalculator.calculate({design_id:1,size:'Large',width_inches:44,quantity:3,option_ids:[1]}));
  expect(result).toMatchObject({width_adjustment_metres:0.3,style_metres:0.2,metres_per_piece:2.1,total_metres:6.3});
});

test('fabric cost, price and on-hand check use existing stock without moving it',async ({page})=>{
  await start(page);
  const before=await page.evaluate(()=>({stock:GT.inventory.totalStock(10),movements:GT.store.count('stock_movements')}));
  await page.locator('#fabricCalculatorForm [name="fabric_id"]').selectOption('10');
  await expect(page.locator('#fabricResult')).toContainText('UGX 29,600');
  await expect(page.locator('#fabricResult')).toContainText('UGX 38,480');
  await expect(page.locator('#fabricResult')).toContainText('Enough stock');
  await page.locator('#fabricCalculatorForm [name="quantity"]').fill('1000');
  await expect(page.locator('#fabricResult')).toContainText('Not enough stock');
  const after=await page.evaluate(()=>({stock:GT.inventory.totalStock(10),movements:GT.store.count('stock_movements')}));
  expect(after).toEqual(before);
});

test('Owner edits a rule and saves only a standalone calculation note',async ({page})=>{
  await start(page);
  await page.goto('/index.html#/production/fabric-calculator/rules/fabric_width_adjustments/2');
  await page.locator('#fabricRuleForm [name="adjustment_metres"]').fill('0.08');
  await page.locator('#fabricRuleForm button[type="submit"]').click();
  await expect(page.locator('h1')).toHaveText('Fabric Calculator');
  expect(await page.evaluate(()=>GT.store.find('fabric_width_adjustments',2))).toMatchObject({adjustment_metres:0.08,source:'ASSUMED illustration'});
  await page.locator('#fabricCalculatorForm [name="fabric_id"]').selectOption('2');
  await page.locator('#fabricCalculatorForm [name="note"]').fill('Test cutting estimate');
  await page.locator('#fabricCalculatorForm button[type="submit"]').click();
  const saved=await page.evaluate(()=>({notes:GT.store.all('fabric_calculations'),movements:GT.store.count('stock_movements')}));
  expect(saved.notes).toHaveLength(1);
  expect(saved.notes[0]).toMatchObject({note:'Test cutting estimate',fabric_id:2,metres_per_piece:1.68});
  expect(saved.notes[0].order_id).toBeUndefined();
  await expect(page.locator('#fabricNotesMount')).toContainText('Test cutting estimate');
});

test('all non-Owner roles have no navigation and direct routes are blocked',async ({page})=>{
  for (const role of ['general_manager','store_keeper','sales','workshop_supervisor','accountant','marketing_manager']) {
    await start(page,role);
    await expect(page.locator('h1')).toHaveText('Access denied');
    await expect(page.locator('#appSidebar [href="#/production/fabric-calculator"]')).toHaveCount(0);
    await expect(page.locator('#pageContent')).not.toContainText(/UGX|markup|suggested price|material cost/i);
    await page.goto('/index.html#/production/fabric-calculator/rules/fabric_markup_rules/1');
    await expect(page.locator('h1')).toHaveText('Access denied');
  }
});

test('empty notes and missing rules show honest empty states',async ({page})=>{
  await start(page);
  await expect(page.locator('#fabricNotesMount')).toContainText('No calculation notes saved yet.');
  await page.evaluate(()=>GT.store.all('fabric_rules').forEach(row=>GT.store.remove('fabric_rules',row.id)));
  await page.reload();
  await expect(page.locator('#fabricResult')).toContainText('Choose a design and size with a base rule.');
  await expect(page.locator('#fabric_rulesMount')).toContainText('No base metres by design and size are defined.');
});

test('360px calculator has no page overflow and print uses one A4 report',async ({page})=>{
  await start(page);
  await page.setViewportSize({width:360,height:800});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await expect(page.locator('#fabric_rulesMount .shared-data-table tbody tr').first()).toBeVisible();
  await page.getByRole('button',{name:'Print calculation'}).click();
  await expect(page.locator('.print-preview-shell')).toContainText('FABRIC CALCULATION REPORT');
  await expect(page.locator('.print-preview-shell')).toContainText('Rules are illustrations until the owner confirms them (A-06).');
  await expect(page.locator('.print-preview-shell .print-letterhead')).toContainText('Genuine Textiles');
  await expect(page.locator('.print-preview-shell')).not.toContainText(/No\.\s*\d+|Quotation|Invoice/);
  await page.emulateMedia({media:'print'});
  const pdf=await page.pdf({format:'A4',printBackground:true});
  expect(pdf.length).toBeGreaterThan(1000);
});
