const {test,expect}=require('@playwright/test');

async function start(page,role='owner',route='#/communication/messages') {
  await page.goto('/login.html?today=2026-10-28');
  await page.evaluate(selected=>{ GT.store.reset(); GT.session.loginAsRole(selected); },role);
  await page.goto('/index.html?today=2026-10-28'+route);
}

test('all roles see only permitted communication routes',async ({page})=>{
  for (const role of ['owner','general_manager','marketing_manager','sales','accountant','store_keeper','workshop_supervisor']) {
    await start(page,role);
    const denied=['accountant','store_keeper','workshop_supervisor'].includes(role);
    await expect(page.locator('h1')).toHaveText(denied?'Access denied':'Messages');
    await expect(page.locator('#appSidebar [href="#/communication/messages"]')).toHaveCount(denied?0:1);
    await page.goto('/index.html#/communication/bulk');
    await expect(page.locator('h1')).toHaveText(['owner','general_manager'].includes(role)?'Bulk messages':'Access denied');
    await page.goto('/index.html#/communication/poster-studio');
    await expect(page.locator('h1')).toHaveText(['owner','general_manager','marketing_manager'].includes(role)?'Poster Studio':'Access denied');
  }
});

test('template edit, approval and SMS segment count',async ({page})=>{
  await start(page,'marketing_manager','#/communication/templates/3');
  await page.locator('#templateBody').fill('A'.repeat(161));
  await expect(page.locator('#templateCounter')).toContainText('2 SMS segments');
  await page.getByRole('button',{name:'Save template'}).click();
  expect((await page.evaluate(()=>GT.store.find('message_templates',3))).approved).toBe(false);
  await page.evaluate(()=>GT.session.loginAsRole('sales'));
  await page.reload();
  await page.goto('/index.html#/communication/messages');
  await expect(page.locator('#messageTemplate option[value="3"]')).toHaveCount(0);
  await page.evaluate(()=>GT.session.loginAsRole('general_manager'));
  await page.goto('/index.html#/communication/templates');
  await page.getByRole('button',{name:'Approve'}).click();
  expect((await page.evaluate(()=>GT.store.find('message_templates',3))).approved).toBe(true);
  expect(await page.evaluate(()=>[GT.communication.segments('A'.repeat(160)),GT.communication.segments('A'.repeat(161)),GT.communication.segments('A'.repeat(306)),GT.communication.segments('A'.repeat(307))])).toEqual([1,2,2,3]);
});

test('compose previews placeholders and records one simulated message',async ({page})=>{
  await start(page,'general_manager');
  await page.locator('#messageCustomer').selectOption('1');
  await page.locator('#messageTemplate').selectOption('4');
  await expect(page.locator('#messagePreview')).toContainText('Pearl Dairy Farms');
  await page.locator('#messageChannel').selectOption('email');
  await expect(page.locator('#emailSender')).toContainText('genuinetextiles1@gmail.com');
  const before=await page.evaluate(()=>GT.store.count('messages'));
  await page.locator('#sendMessage').click();
  await expect(page.locator('h1')).toHaveText('Message Log');
  const rows=await page.evaluate(()=>GT.store.all('messages'));
  expect(rows).toHaveLength(before+1);
  expect(rows.at(-1)).toMatchObject({channel:'email',template_id:4,status:'Simulated',reference_type:'customer',reference_id:1});
});

test('bulk shows seven-day skips and totals; sends only eligible recipients',async ({page})=>{
  await start(page,'general_manager','#/communication/bulk');
  await page.locator('#bulkGroup').selectOption('3');
  await page.locator('#bulkTemplate').selectOption('3');
  await expect(page.locator('#bulkRecipients')).toContainText('Contacted within seven days');
  await expect(page.locator('#bulkSummary')).toContainText('estimated SMS segments');
  const skipped=await page.evaluate(()=>GT.communication.bulkPlan(3,'sms',3,GT.store.find('message_templates',3).body).filter(item=>item.reason).map(item=>item.customer.name+' — '+item.reason));
  const shown=await page.locator('#bulkRecipients h2').last().locator('xpath=following-sibling::ul[1]/li').allTextContents();
  expect(shown).toEqual(skipped);
  const expected=await page.evaluate(()=>GT.communication.bulkPlan(3,'sms',3,GT.store.find('message_templates',3).body).filter(row=>!row.reason).length);
  const before=await page.evaluate(()=>GT.store.count('messages'));
  await page.locator('#bulkSend').click();
  await expect(page.locator('h1')).toHaveText('Message Log');
  expect(await page.evaluate(()=>GT.store.count('messages'))).toBe(before+expected);
});

test('six communication templates and WhatsApp channel are available',async ({page})=>{
  await start(page,'general_manager');
  expect(await page.evaluate(()=>GT.store.all('message_templates').map(row=>row.name))).toEqual([
    'Order ready','Payment reminder','Promotion','Thank-you','New designs','Supplier discrepancy notice'
  ]);
  await expect(page.locator('#messageChannel option[value="whatsapp"]')).toHaveText('WhatsApp');
  await page.goto('/index.html#/communication/bulk');
  await expect(page.locator('#bulkChannel option[value="whatsapp"]')).toHaveText('WhatsApp');
});

test('message log filters and Sales sees own records only',async ({page})=>{
  await start(page,'sales');
  await page.locator('#messageCustomer').selectOption('1');
  await page.locator('#messageTemplate').selectOption('4');
  await page.locator('#sendMessage').click();
  await expect(page.locator('#messageLogTable')).toContainText('Pearl Dairy Farms');
  await expect(page.locator('#messageLogTable')).not.toContainText('GRN');
  await page.locator('[data-table-filter="channel"]').selectOption('email');
  await expect(page.locator('#messageLogTable')).toContainText('No messages match the filters');
});

test('supplier discrepancy notice previews GRN details and records a simulated supplier message',async ({page})=>{
  await start(page,'general_manager');
  await page.locator('#messageTemplate').selectOption('6');
  await page.locator('#messageSupplier').selectOption('3');
  await expect(page.locator('#messagePreview')).toContainText('Kampala Trims');
  await page.locator('#messageChannel').selectOption('email');
  await page.locator('#sendMessage').click();
  expect((await page.evaluate(()=>GT.store.all('messages').at(-1)))).toMatchObject({reference_type:'supplier',reference_id:3,status:'Simulated'});
  await page.goto('/index.html#/communication/templates/6');
  await expect(page.locator('#templatePreview')).toContainText('Kampala Trims');
  await expect(page.locator('#templatePreview')).toContainText('Quantity, Damage');
  await page.evaluate(()=>GT.session.loginAsRole('sales'));
  await page.reload();
  await expect(page.evaluate(()=>GT.communication.sendOne({supplierId:3,templateId:6,channel:'email',body:'Notice'}))).rejects.toThrow();
});

test('payment template uses Phase 10 seven-day reminder gate',async ({page})=>{
  await start(page,'general_manager');
  const debtor=await page.evaluate(()=>GT.debtors.list().find(row=>row.overdue_amount>0&&!GT.debtors.recentElectronic(row.id)).id);
  await page.locator('#messageCustomer').selectOption(String(debtor));
  await page.locator('#messageTemplate').selectOption('2');
  await page.locator('#sendMessage').click();
  const first=await page.evaluate(id=>({reminders:GT.store.where('debt_reminders',{customer_id:id}).length,messages:GT.store.count('messages')}),debtor);
  await page.goto('/index.html#/communication/messages');
  await page.locator('#messageCustomer').selectOption(String(debtor));
  await page.locator('#messageTemplate').selectOption('2');
  await page.locator('#sendMessage').click();
  await expect(page.locator('#messageError')).toContainText('override reason');
  const second=await page.evaluate(id=>({reminders:GT.store.where('debt_reminders',{customer_id:id}).length,messages:GT.store.count('messages')}),debtor);
  expect(second).toEqual(first);
});

test('new customer lead source is saved and shown on profile',async ({page})=>{
  await start(page,'owner','#/customers/new');
  await page.locator('#customerForm [name="name"]').fill('Phase Nineteen Customer');
  await page.locator('#customerForm [name="phone"]').fill('0701234567');
  await page.locator('#customerForm [name="customer_group_id"]').selectOption('1');
  await page.locator('#customerForm [name="lead_source_id"]').selectOption('3');
  await page.locator('#customerForm button[type="submit"]').click();
  await expect(page.locator('#overview')).toContainText('Referral');
});

test('poster live preview, save, reopen and A4 print',async ({page})=>{
  await start(page,'marketing_manager','#/communication/poster-studio');
  await page.locator('#posterTitle').fill('Uniform Fair');
  await page.locator('#posterType').selectOption('event');
  await page.locator('#posterSize').selectOption('facebook');
  await page.locator('#posterText').fill('Visit our stand');
  await expect(page.locator('#posterPreview')).toContainText('Uniform Fair');
  await page.getByRole('button',{name:'Save poster'}).click();
  await page.getByRole('button',{name:'New poster'}).click();
  await page.getByRole('button',{name:'Open'}).click();
  await expect(page.locator('#posterTitle')).toHaveValue('Uniform Fair');
  await page.getByRole('button',{name:'Print preview'}).click();
  await expect(page.locator('.print-preview-shell .print-letterhead')).toContainText('Genuine Textiles');
  await expect(page.locator('.print-preview-shell')).toContainText('Uniform Fair');
});

test('restricted roles cannot see price lists or financial message text',async ({page})=>{
  for (const role of ['store_keeper','workshop_supervisor']) {
    await start(page,role,'#/communication/messages');
    await expect(page.locator('h1')).toHaveText('Access denied');
    await expect(page.locator('#appSidebar [href^="#/communication/"]')).toHaveCount(0);
    await page.goto('/index.html#/communication/poster-studio');
    await expect(page.locator('h1')).toHaveText('Access denied');
    await page.goto('/index.html#/communication/templates/2');
    await expect(page.locator('h1')).toHaveText('Access denied');
    await expect(page.locator('#pageContent')).not.toContainText(/UGX|amount due|price list/i);
  }
});

test('price-list poster explains that prices are typed by hand',async ({page})=>{
  await start(page,'marketing_manager','#/communication/poster-studio');
  await page.setViewportSize({width:360,height:800});
  await page.locator('#posterType').selectOption('price_list');
  await expect(page.locator('#posterPriceField')).toBeVisible();
  await expect(page.locator('#posterPriceField')).toContainText('Type prices by hand. This poster does not use or change product prices.');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.locator('#posterTitle').fill('School uniform prices');
  await page.locator('#posterPrices').fill('Shirt — UGX 25,000');
  await page.getByRole('button',{name:'Print preview'}).click();
  await expect(page.locator('.print-preview-shell')).toContainText('Shirt — UGX 25,000');
});

test('360px communication pages do not overflow',async ({page})=>{
  await start(page,'owner');
  await page.setViewportSize({width:360,height:800});
  for (const route of ['#/communication/messages','#/communication/templates','#/communication/log','#/communication/poster-studio','#/communication/bulk']) {
    await page.goto('/index.html'+route);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route).toBe(true);
  }
});
