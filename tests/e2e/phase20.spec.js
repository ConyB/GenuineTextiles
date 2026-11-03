const {test,expect}=require('@playwright/test');

async function start(page,role='owner',route='#/marketing/campaigns') {
  await page.goto('/login.html?today=2026-10-29');
  await page.evaluate(selected=>{GT.store.reset();GT.session.loginAsRole(selected);},role);
  await page.goto('/index.html?today=2026-10-29'+route);
}

test('Phase 20 routes and money follow every role',async ({page})=>{
  for (const role of ['owner','general_manager','marketing_manager','accountant','sales','store_keeper','workshop_supervisor']) {
    await start(page,role);
    const allowed=['owner','general_manager','marketing_manager'].includes(role);
    await expect(page.locator('h1')).toHaveText(allowed?'Campaigns':'Access denied');
    await expect(page.locator('#appSidebar [href="#/marketing/campaigns"]')).toHaveCount(allowed?1:0);
    await expect(page.locator('a[href="#/marketing/campaigns/new"]')).toHaveCount(role==='marketing_manager'?1:0);
    await page.goto('/index.html?today=2026-10-29#/marketing/campaigns/new');
    await expect(page.locator('h1')).toHaveText(role==='marketing_manager'?'New campaign':'Access denied');
    await page.goto('/index.html?today=2026-10-29#/marketing/campaigns/1/edit');
    await expect(page.locator('h1')).toHaveText(role==='marketing_manager'?'Edit campaign':'Access denied');
    if (role!=='marketing_manager') expect(await page.evaluate(()=>{try {GT.marketing.saveCampaign(null,{});return false;}catch(error){return error.message.includes('cannot change');}})).toBe(true);
    await page.goto('/index.html?today=2026-10-29#/marketing/lead-sources');
    await expect(page.locator('h1')).toHaveText(['owner','general_manager','marketing_manager','accountant'].includes(role)?'Lead Source Report':'Access denied');
    await page.goto('/index.html?today=2026-10-29#/marketing/targets');
    await expect(page.locator('h1')).toHaveText(['owner','general_manager','accountant'].includes(role)?'Sales Targets':role==='sales'?'My Target':'Access denied');
    await expect(page.locator('#targetForm')).toHaveCount(['owner','general_manager'].includes(role)?1:0);
    if (role==='sales') {
      await expect(page.locator('#salesTargetsTable')).toContainText('Lydia Namukasa');
      await expect(page.locator('#salesTargetsTable')).not.toContainText('Joel Ssemanda');
    }
    if (['store_keeper','workshop_supervisor'].includes(role)) {
      await page.goto('/index.html?today=2026-10-29#/dashboard');
      await expect(page.locator('#pageContent')).not.toContainText('UGX');
    }
  }
});

test('campaign plan, results, status, links and print never post an expense',async ({page})=>{
  await start(page,'marketing_manager');
  await page.evaluate(()=>{
    GT.store.create('posters',{title:'School fair poster',template:'promotion',size_preset:'facebook',content_json:{},created_by:8});
    GT.store.create('messages',{channel:'sms',recipient_name:'School',recipient_contact:'0700000000',template_id:3,body:'Fair',status:'Simulated',sent_by:8,sent_at:'2026-10-28T10:00:00+03:00'});
  });
  const before=await page.evaluate(()=>Object.fromEntries(GT.schema.tables.filter(row=>!['campaigns','audit_logs'].includes(row.name)).map(row=>[row.name,GT.store.all(row.name)])));
  await page.goto('/index.html?today=2026-10-29#/marketing/campaigns/new');
  await page.locator('#name').fill('School fair');
  await page.locator('#type').selectOption('exhibition');
  await page.locator('#channel').fill('School visit');
  await page.locator('#start_date').fill('2026-10-20');
  await page.locator('#end_date').fill('2026-10-30');
  await page.locator('#budget').fill('500000');
  await page.locator('#target_audience').fill('Schools');
  await page.locator('#leads_gained').fill('12');
  await page.locator('#orders_won').fill('3');
  await page.locator('#sales_value').fill('700000');
  await page.locator('#result_notes').fill('Good response');
  const messageId=await page.evaluate(()=>GT.store.all('messages').at(-1).id);
  await page.locator('[name="message_ids"][value="'+messageId+'"]').check();
  await page.locator('[name="poster_ids"]').check();
  await page.getByRole('button',{name:'Save campaign'}).click();
  await expect(page.locator('h1')).toHaveText('School fair');
  await expect(page.locator('#pageContent')).toContainText('School fair poster');
  expect(await page.evaluate(()=>Object.fromEntries(GT.schema.tables.filter(row=>!['campaigns','audit_logs'].includes(row.name)).map(row=>[row.name,GT.store.all(row.name)])))).toEqual(before);
  await page.getByRole('button',{name:'Print summary'}).click();
  await expect(page.locator('.print-page')).toContainText('CAMPAIGN SUMMARY');
  await expect(page.locator('.print-page')).toContainText('Genuine Textiles');
  await expect(page.locator('.print-page')).not.toContainText('Voucher No.');
  await page.locator('[data-print-back]').click();
  await page.getByRole('link',{name:'Edit campaign'}).click();
  await page.locator('#status').selectOption('Finished');
  await page.getByRole('button',{name:'Save campaign'}).click();
  expect((await page.evaluate(()=>GT.store.all('campaigns'))).at(-1)).toMatchObject({status:'Finished',leads_gained:12,orders_won:3,sales_value:700000,message_ids:[messageId],poster_ids:[1]});
  await page.evaluate(()=>GT.session.loginAsRole('sales'));
  await page.goto('/index.html?today=2026-10-29#/marketing/campaigns');
  await expect(page.locator('h1')).toHaveText('Access denied');
  await expect(page.locator('#pageContent')).not.toContainText('500,000');
  await expect(page.locator('#pageContent')).not.toContainText('700,000');
  await page.goto('/index.html?today=2026-10-29#/marketing/campaigns/1');
  await expect(page.locator('h1')).toHaveText('Access denied');
});

test('lead source counts and invoice value include no source and print',async ({page})=>{
  await start(page,'accountant','#/marketing/lead-sources');
  const report=await page.evaluate(()=>GT.marketing.leadReport('2026-10-01','2026-10-31'));
  const expected=await page.evaluate(()=>GT.store.all('customers').filter(row=>row.created_at.startsWith('2026-10')).length);
  expect(report.reduce((total,row)=>total+row.customers,0)).toBe(expected);
  expect(report.find(row=>row.name==='No source').customers).toBeGreaterThan(0);
  await page.locator('#leadMonth').fill('2026-10');
  await expect(page.locator('#leadSourceReport')).toContainText('No source');
  await expect(page.locator('.date-range-trigger')).toContainText('1 Oct');
  await page.getByRole('button',{name:'Print'}).click();
  await expect(page.locator('.print-page')).toContainText('LEAD SOURCE REPORT');
  await expect(page.locator('.print-page')).toContainText('No source');
  await expect(page.locator('.print-page')).not.toContainText('Report No.');
});

test('target change history, void exclusion and independent reconciliation',async ({page})=>{
  await start(page,'owner','#/marketing/targets');
  const first=await page.evaluate(()=>GT.salesTargets.rows('2026-10').find(row=>row.id===4));
  const salesReport=await page.evaluate(()=>GT.reports.sales().filter(row=>row.kind==='Invoice'&&row.issued_by===4&&row.date.startsWith('2026-10')).reduce((sum,row)=>sum+row.billed,0));
  expect(first.actual).toBe(salesReport);
  await page.locator('#user_id').selectOption('4');
  await page.locator('#target_amount').fill('60000000');
  await page.getByRole('button',{name:'Set target'}).click();
  const saved=await page.evaluate(()=>({current:GT.store.where('sales_targets',{user_id:4,month:'2026-10'}),history:GT.salesTargets.history('2026-10').filter(row=>row.user_id===4)}));
  expect(saved.current).toHaveLength(1);
  expect(saved.current[0].target_amount).toBe(60000000);
  expect(saved.history).toHaveLength(2);
  expect(saved.history[0]).toMatchObject({previous_amount:45000000,target_amount:60000000,changed_by:1});
  await expect(page.locator('#salesTargetsTable')).toContainText('In progress');
  await page.getByRole('button',{name:'Print monthly report'}).click();
  await expect(page.locator('.print-page')).toContainText('MONTHLY SALES TARGETS');
  await expect(page.locator('.print-page')).not.toContainText('Document No.');
  await page.locator('[data-print-back]').click();
  const check=await page.evaluate(()=>{
    const actual=GT.salesTargets.rows('2026-10').find(row=>row.id===4).actual;
    const source=GT.reports.sales().filter(row=>row.kind==='Invoice'&&row.issued_by===4&&row.date.startsWith('2026-10')).reduce((sum,row)=>sum+row.billed,0);
    return actual===source;
  });
  expect(check).toBe(true);
  const mismatch=await page.evaluate(()=>{
    const original=GT.reports.salesByEmployee;
    GT.reports.salesByEmployee=()=>({4:1});
    GT.app.renderPage();
    const reconciled=GT.salesTargets.reconcile('2026-10',GT.salesTargets.rows('2026-10'));
    GT.reports.salesByEmployee=original;
    return reconciled;
  });
  expect(mismatch).toBe(false);
  await expect(page.locator('#targetReconciliation')).toContainText('FAIL');
  const afterVoid=await page.evaluate(()=>{
    const source=GT.store.where('sales_documents',row=>row.type==='invoice'&&row.status==='issued'&&row.issued_by===4&&row.issue_date.startsWith('2026-10'))[0];
    GT.store.create('sales_documents',{...source,id:undefined,number:'VOID-TEST',status:'void',total:999999});
    return GT.salesTargets.rows('2026-10').find(row=>row.id===4).actual;
  });
  expect(afterVoid).toBe(first.actual);
  const attribution=await page.evaluate(()=>{
    const before=GT.salesTargets.rows('2026-10');
    GT.store.create('sales_documents',{type:'invoice',customer_id:1,customer_name:'Issuer fixture',status:'issued',issue_date:'2026-10-09',created_by:5,issued_by:4,total:12345,number:'ISSUER-TEST'});
    GT.store.create('sales_documents',{type:'invoice',customer_id:1,status:'draft',issue_date:'2026-10-09',created_by:4,issued_by:4,total:99999});
    GT.store.create('sales_documents',{type:'invoice',customer_id:1,status:'issued',issue_date:'2026-11-01',created_by:4,issued_by:4,total:99999,number:'NEXT-MONTH'});
    const after=GT.salesTargets.rows('2026-10');
    return {issuer:after.find(row=>row.id===4).actual-before.find(row=>row.id===4).actual,creator:after.find(row=>row.id===5).actual-before.find(row=>row.id===5).actual,actual:after.find(row=>row.id===4).actual};
  });
  expect(attribution).toMatchObject({issuer:12345,creator:0});
  await page.goto('/index.html?today=2026-10-29#/reports/sales');
  await page.locator('[data-date-range-trigger]').click();
  await page.getByRole('option',{name:'Custom range'}).click();
  await page.locator('.date-range-popover input[data-date-from]').fill('2026-10-01');
  await page.locator('.date-range-popover input[data-date-to]').fill('2026-10-31');
  await page.getByRole('button',{name:'Apply',exact:true}).click();
  await page.locator('[data-table-filter="invoice_issuer"]').selectOption('4');
  await expect(page.locator('#salesReportStats')).toContainText('UGX '+attribution.actual.toLocaleString('en-US'));
});

test('campaign validation, filters, cancellation, empty states and 360px form',async ({page})=>{
  await start(page,'marketing_manager','#/marketing/campaigns/new');
  await page.setViewportSize({width:360,height:900});
  await page.getByRole('button',{name:'Save campaign'}).click();
  await expect(page.locator('#nameError')).toContainText('Enter a campaign name');
  await page.locator('#name').fill('Long-running school outreach');
  await page.locator('#channel').fill('WhatsApp');
  await page.locator('#start_date').fill('2026-10-29');
  await page.locator('#end_date').fill('2026-10-20');
  await page.getByRole('button',{name:'Save campaign'}).click();
  await expect(page.locator('#end_dateError')).toContainText('on or after');
  await expect(page.locator('#name')).toHaveValue('Long-running school outreach');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const dialogPromise=page.waitForEvent('dialog');
  const navigation=page.evaluate(()=>{location.hash='#/dashboard';});
  const dialog=await dialogPromise; expect(dialog.message()).toContain('unsaved'); await dialog.dismiss(); await navigation;
  await expect(page.locator('#campaignForm')).toBeVisible();
  await page.locator('#end_date').fill('2026-10-31');
  await page.locator('#status').selectOption('Cancelled');
  await page.getByRole('button',{name:'Save campaign'}).click();
  await expect(page.locator('#pageContent')).toContainText('Cancelled');
  await page.goto('/index.html?today=2026-10-29#/marketing/campaigns');
  await page.locator('[data-table-filter="status"]').selectOption('Cancelled');
  await expect(page.locator('#campaignsTable')).toContainText('Long-running school outreach');
  await page.locator('[data-table-search]').fill('no matching campaign');
  await expect(page.locator('#campaignsTable')).toContainText('No campaigns match');
});

test('lead cohorts and monthly values exclude void and out-of-period invoices',async ({page})=>{
  await start(page,'marketing_manager','#/marketing/lead-sources');
  const result=await page.evaluate(()=>{
    const source=GT.store.create('lead_sources',{name:'Fixture referral'});
    function client(name,date,lead) { const row=GT.store.create('customers',{name,lead_source_id:lead,active:true}); return GT.store.update('customers',row.id,{created_at:date+'T09:00:00+03:00'}); }
    const a=client('New fixture customer','2026-10-05',source.id), b=client('Earlier fixture customer','2026-09-05',source.id), c=client('No-source fixture','2026-12-05',null);
    function invoice(customer,date,status,total) { GT.store.create('sales_documents',{type:'invoice',customer_id:customer.id,customer_name:customer.name,issue_date:date,issued_by:4,status,total,number:'TEST'}); }
    invoice(a,'2026-10-10','issued',250000); invoice(a,'2026-10-11','void',900000); invoice(a,'2026-11-10','issued',500000); invoice(b,'2026-10-12','issued',700000);
    invoice(c,'2026-12-10','issued',60000); invoice(c,'2026-12-11','void',10000);
    return {october:GT.marketing.leadReport('2026-10-01','2026-10-31').find(row=>row.name==='Fixture referral'),
      monthly:GT.marketing.leadReport('2026-09-01','2026-11-30',true).filter(row=>row.name==='Fixture referral'),
      noSource:GT.marketing.leadReport('2026-12-01','2026-12-31').find(row=>row.name==='No source')};
  });
  expect(result.october).toMatchObject({customers:1,invoiced:250000});
  expect(result.monthly).toEqual(expect.arrayContaining([expect.objectContaining({month:'2026-10',customers:1,invoiced:750000}),expect.objectContaining({month:'2026-09',customers:1,invoiced:700000})]));
  expect(result.noSource).toMatchObject({customers:1,invoiced:60000});
  await page.locator('#leadMonth').fill('2040-01');
  await expect(page.locator('#leadSourceReport')).toContainText('No customers were recorded');
  await page.getByRole('button',{name:'Print',exact:true}).click();
  await expect(page.locator('.print-page')).toContainText('No records in this selection');
});

test('target statuses, service permissions and second salesperson print and CSV stay scoped',async ({page})=>{
  await start(page,'general_manager','#/marketing/targets');
  const finances=await page.evaluate(()=>['expenses','ledger_entries','payroll_runs','payroll_lines','document_sequences'].map(name=>GT.store.all(name)));
  const states=await page.evaluate(()=>{
    GT.salesTargets.save(4,'2026-10',1); GT.salesTargets.save(5,'2026-09',100000); GT.salesTargets.save(5,'2026-11',100000);
    return {met:GT.salesTargets.rows('2026-10').find(row=>row.id===4).status,missed:GT.salesTargets.rows('2026-09').find(row=>row.id===5).status,
      future:GT.salesTargets.rows('2026-11').find(row=>row.id===5).status,unset:GT.salesTargets.rows('2026-12')[0].has_target};
  });
  expect(states).toEqual({met:'Target met',missed:'Missed',future:'Not started',unset:false});
  expect(await page.evaluate(()=>['expenses','ledger_entries','payroll_runs','payroll_lines','document_sequences'].map(name=>GT.store.all(name)))).toEqual(finances);
  for (const role of ['accountant','marketing_manager','sales','store_keeper','workshop_supervisor']) {
    const denied=await page.evaluate(selected=>{GT.session.loginAsRole(selected);try {GT.salesTargets.save(4,'2026-10',1);return false;}catch(error){return true;}},role);
    expect(denied).toBe(true);
  }
  await page.evaluate(()=>GT.session.loginAsUser(5));
  await page.goto('/index.html?today=2026-10-29#/marketing/targets');
  await page.reload();
  await expect(page.locator('h1')).toHaveText('My Target');
  await expect(page.locator('#pageContent')).toContainText('Joel Ssemanda');
  await expect(page.locator('#pageContent')).not.toContainText('Lydia Namukasa');
  expect(await page.evaluate(()=>GT.salesTargets.history('2026-10'))).toEqual([]);
  const downloadPromise=page.waitForEvent('download'); await page.locator('#salesTargetsTable [data-export-csv]').click();
  const download=await downloadPromise; const csv=require('fs').readFileSync(await download.path(),'utf8');
  expect(csv).toContain('Joel Ssemanda'); expect(csv).not.toContain('Lydia Namukasa');
  await page.getByRole('button',{name:'Print monthly report'}).click();
  await expect(page.locator('.print-page')).toContainText('Joel Ssemanda');
  await expect(page.locator('.print-page')).not.toContainText('Lydia Namukasa');
});

test('rankings include invoice and counter lines without counting voids or receipt payments twice',async ({page})=>{
  await start(page,'accountant','#/reports/sales');
  const result=await page.evaluate(()=>{
    const invoice=GT.store.create('sales_documents',{type:'invoice',customer_id:1,customer_name:'Fixture school',issue_date:'2030-01-02',issued_by:4,status:'issued',number:'FIXTURE',total:35400});
    GT.store.create('sales_document_items',{sales_document_id:invoice.id,description:'Fixture tunic',quantity:3,unit:'pcs',amount:30000,active:true});
    const voided=GT.store.create('sales_documents',{type:'invoice',customer_id:1,issue_date:'2030-01-02',issued_by:4,status:'void',total:99999});
    GT.store.create('sales_document_items',{sales_document_id:voided.id,description:'Fixture tunic',quantity:99,unit:'pcs',amount:99000,active:true});
    const receipt=GT.store.create('receipts',{status:'issued',amount:23600,received_at:'2030-01-03T10:00:00+03:00'});
    const sale=GT.store.create('quick_sales',{receipt_id:receipt.id,status:'issued',sale_date:'2030-01-03'});
    GT.store.create('quick_sale_items',{quick_sale_id:sale.id,product_variant_id:1,description:'School shirt',quantity:2,amount:20000});
    return {customers:GT.reports.bestCustomers('2030-01-01','2030-01-31'),items:GT.reports.bestItems('2030-01-01','2030-01-31')};
  });
  expect(result.customers).toHaveLength(1); expect(result.customers[0]).toMatchObject({value:35400,invoices:1});
  expect(result.items).toEqual(expect.arrayContaining([expect.objectContaining({name:'Fixture tunic',quantity:3,value:30000,category:'Unclassified'}),expect.objectContaining({quantity:2,value:20000,category:'school'})]));
});

test('Phase 20 screens and A4 previews stay usable with shared controls at desktop and 360px',async ({page})=>{
  test.setTimeout(90000);
  require('fs').mkdirSync('artifacts/phase20',{recursive:true});
  await start(page,'marketing_manager');
  const screens=[['campaigns','#/marketing/campaigns'],['campaign-form','#/marketing/campaigns/new'],['campaign-detail','#/marketing/campaigns/3'],['lead-sources','#/marketing/lead-sources']];
  for (const width of [1440,360]) {
    await page.setViewportSize({width,height:1000});
    for (const [name,route] of screens) {
      await page.goto('/index.html?today=2026-10-29'+route);
      await expect(page.locator('#pageContent h1')).toHaveCount(1);
      await expect(page.locator('#appSidebar [aria-current="page"]')).toHaveCount(1);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route).toBe(true);
      await page.screenshot({path:'artifacts/phase20/'+name+'-'+width+'.png',fullPage:true});
    }
  }
  await page.setViewportSize({width:1440,height:2000});
  for (const [name,route] of [['campaign','#/marketing/campaigns/3'],['leads','#/marketing/lead-sources']]) {
    await page.goto('/index.html?today=2026-10-29'+route);
    await page.locator('[data-page-action="print"]').click();
    await expect(page.locator('.print-letterhead')).toHaveCount(1);
    await page.locator('.print-preview-toolbar').evaluate(el=>el.style.visibility='hidden');
    const width=await page.locator('.print-page').evaluate(el=>el.getBoundingClientRect().width);
    expect(Math.abs(width-793.7)).toBeLessThan(1);
    await page.locator('.print-page').screenshot({path:'artifacts/phase20/'+name+'-a4.png'});
    await page.locator('.print-preview-toolbar').evaluate(el=>el.style.visibility='visible');
    await page.locator('[data-print-back]').click();
  }
  await page.evaluate(()=>GT.session.loginAsRole('owner'));
  await page.reload();
  for (const width of [1440,360]) {
    await page.setViewportSize({width,height:1000});
    await page.goto('/index.html?today=2026-10-29#/marketing/targets');
    await expect(page.locator('#appSidebar [aria-current="page"]')).toHaveAttribute('href','#/marketing/targets');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:'artifacts/phase20/targets-'+width+'.png',fullPage:true});
  }
  await page.setViewportSize({width:1440,height:2000});
  await page.getByRole('button',{name:'Print monthly report'}).click();
  await expect(page.locator('.print-page')).toContainText('PASS');
  await page.locator('.print-preview-toolbar').evaluate(el=>el.style.visibility='hidden');
  const wrapped=await page.locator('.print-page .report-number').evaluateAll(cells=>cells.some(el=>getComputedStyle(el).whiteSpace!=='nowrap'));
  expect(wrapped).toBe(false);
  await page.locator('.print-page').screenshot({path:'artifacts/phase20/targets-a4.png'});
});

test('dashboard target card and existing sales report sections work at 360px',async ({page})=>{
  await start(page,'sales','#/dashboard');
  await expect(page.locator('#dashboardStats')).toContainText('My target progress');
  await page.getByText('My target progress').click();
  await expect(page.locator('h1')).toHaveText('My Target');
  await page.setViewportSize({width:360,height:800});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await page.evaluate(()=>GT.session.loginAsRole('owner'));
  await page.goto('/index.html?today=2026-10-29#/reports/sales');
  await expect(page.locator('#bestCustomers')).toBeVisible();
  await expect(page.locator('#bestItems')).toBeVisible();
  await expect(page.locator('#salesByEmployee')).toBeVisible();
  await expect(page.locator('#bestItems')).toContainText('Unclassified');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
});

