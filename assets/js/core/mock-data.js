/* Reference seed from MOCK_DATA_SPEC.md through the Phase 6 purchasing story. */
window.GT.mockData = (function () {
  var roles = [
    { id: 1, name: 'owner' },
    { id: 2, name: 'general_manager' },
    { id: 3, name: 'store_keeper' },
    { id: 4, name: 'sales' },
    { id: 5, name: 'workshop_supervisor' },
    { id: 6, name: 'accountant' },
    { id: 7, name: 'marketing_manager' }
  ];

  // Passwords and identities below exist only to exercise the clickable prototype.
  var users = [
    { id: 1, name: 'Kibira Edward', email: 'owner@genuinetextiles.demo', phone: '+256 700 000 001', password: 'demo123', password_is_prototype: true, role_id: 1, location_id: 1, active: true },
    { id: 2, name: 'Grace Nabirye', email: 'manager@genuinetextiles.demo', phone: '+256 700 000 002', password: 'demo123', password_is_prototype: true, role_id: 2, location_id: 1, active: true },
    { id: 3, name: 'Martin Okello', email: 'store@genuinetextiles.demo', phone: '+256 700 000 003', password: 'demo123', password_is_prototype: true, role_id: 3, location_id: 2, active: true },
    { id: 4, name: 'Lydia Namukasa', email: 'sales@genuinetextiles.demo', phone: '+256 700 000 004', password: 'demo123', password_is_prototype: true, role_id: 4, location_id: 1, active: true },
    { id: 5, name: 'Joel Ssemanda', email: 'sales2@genuinetextiles.demo', phone: '+256 700 000 005', password: 'demo123', password_is_prototype: true, role_id: 4, location_id: 1, active: true },
    { id: 6, name: 'Ruth Achen', email: 'workshop@genuinetextiles.demo', phone: '+256 700 000 006', password: 'demo123', password_is_prototype: true, role_id: 5, location_id: 2, active: true },
    { id: 7, name: 'Brian Kato', email: 'accounts@genuinetextiles.demo', phone: '+256 700 000 007', password: 'demo123', password_is_prototype: true, role_id: 6, location_id: 1, active: true },
    { id: 8, name: 'Irene Nansubuga', email: 'marketing@genuinetextiles.demo', phone: '+256 700 000 008', password: 'demo123', password_is_prototype: true, role_id: 7, location_id: 1, active: true }
  ];

  // A-13 remains OPEN, so these names are deliberately placeholders.
  var locations = [
    { id: 1, name: 'Location 1 (placeholder)', type: 'shop', address: 'Nasser Road, Kampala' },
    { id: 2, name: 'Location 2 (placeholder)', type: 'workshop', address: 'Address pending owner confirmation' }
  ];

  var businessSettings = [
    { id: 1, key: 'name', value: 'Genuine Textiles' },
    { id: 2, key: 'tagline', value: 'Your Quality Uniforms Factory' },
    { id: 3, key: 'address', value: 'Located at Nasser Road, Mirembe Arcade, Last Floor Room K07-8-9' },
    { id: 4, key: 'po_box', value: 'P.O. Box 26198 Kampala Uganda' },
    { id: 5, key: 'phones', value: ['+256 704 653 045', '+256 782 653 045', '+256 700 685 476', '+256 704 332 806'] },
    { id: 6, key: 'emails', value: ['genuinetextiles1@gmail.com'] },
    { id: 7, key: 'vat_rate', value: 18 },
    { id: 8, key: 'logo_small', value: 'assets/images/logo.png' },
    { id: 9, key: 'logo_large', value: 'assets/images/logo-large.png' },
    { id: 10, key: 'bank_name', value: 'Equity Bank' },
    { id: 11, key: 'bank_account_name', value: 'Genuine Textiles' },
    { id: 12, key: 'bank_account_number', value: 'ENTER ACCOUNT NUMBER' },
    { id: 13, key: 'quotation_terms', value: 'Price Validity: 14 days from date of the Quotation, subject to change basing on the prevailing exchange rate.' },
    { id: 14, key: 'trading_name', value: 'Genuine Textiles' },
    { id: 15, key: 'slogan_line', value: 'Cut | Design | Sew | Knit' },
    { id: 16, key: 'general_email', value: 'genuinetextiles1@gmail.com' },
    { id: 17, key: 'sending_email', value: 'genuinetextiles1@gmail.com' },
    { id: 18, key: 'website', value: '' },
    { id: 19, key: 'tin', value: 'ENTER TIN' },
    { id: 20, key: 'authorised_signatory', value: 'Kibira' },
    { id: 21, key: 'quotation_validity_days', value: 14 },
    { id: 22, key: 'cash_invoice_terms', value: 'All accounts are due on demand' },
    { id: 23, key: 'credit_invoice_terms', value: 'Payment due within 30 days' },
    { id: 24, key: 'default_credit_days', value: 30 }
  ];

  var documentSequences = [
    { id: 1, document_type: 'invoice', next_number: 645, padding: 0 },
    { id: 2, document_type: 'receipt', next_number: 2074, padding: 0 },
    { id: 3, document_type: 'delivery_note', next_number: 2056, padding: 0 },
    { id: 4, document_type: 'quotation', next_number: 99, padding: 3 },
    { id: 5, document_type: 'proforma', next_number: 97, padding: 3 },
    { id: 6, document_type: 'grn', next_number: 9, padding: 4 },
    { id: 7, document_type: 'material_issue', next_number: 1, padding: 0 },
    { id: 8, document_type: 'order', next_number: 12, padding: 0 },
    { id: 9, document_type: 'payment_voucher', next_number: 13, padding: 0 }
  ];

  var customerGroups = [
    { id: 1, name: 'Individual' },
    { id: 2, name: 'School' },
    { id: 3, name: 'Corporate' },
    { id: 4, name: 'Reseller' }
  ];

  function customer(id, name, groupId, credit, leadSourceId) {
    return {
      id: id,
      name: name,
      contact_person: groupId === 1 ? name : 'Contact ' + String(id).padStart(2, '0'),
      phone: '+256 701 000 ' + String(id).padStart(3, '0'),
      email: 'customer' + id + '@example.demo',
      address: 'Prototype address ' + id + ', Uganda',
      customer_group_id: groupId,
      is_credit: credit,
      credit_limit: credit ? 5000000 + (id * 250000) : 0,
      credit_days: credit ? 30 : 0,
      lead_source_id: leadSourceId,
      notes: 'Fictional prototype contact details.',
      active: id !== 22 && id !== 24
    };
  }

  var customerNames = [
    ['Pearl Dairy Farms', 3], ['SR Afro Chick Breeders Ltd', 3],
    ['Kampala Horizon School', 2], ['Lakeview Learning Centre', 2], ['Bright Path Academy', 2],
    ['Green Hills Primary School', 2], ['Sunrise Valley School', 2], ['New Dawn Secondary School', 2],
    ['Maple Grove Junior School', 2], ['Riverbend Preparatory School', 2], ['Unity Gate College', 2],
    ['Starlight Community School', 2], ['Acacia Heights Academy', 2], ['Golden Steps Nursery', 2],
    ['Blue Crane Logistics', 3], ['Cedar Works Uganda', 3], ['Harbour View Hospitality', 3],
    ['Summit Safety Services', 3], ['Careline Medical Centre', 3], ['Metro Facility Services', 3],
    ['Amina Nakato', 1], ['Peter Walusimbi', 1], ['Sarah Akello', 1],
    ['Uniform Corner Reseller', 4], ['City Stitch Reseller', 4]
  ];
  var customers = customerNames.map(function (item, index) {
    var id = index + 1;
    var row=customer(id, item[0], item[1], id <= 13, id%7===0?null:((id - 1) % 5) + 1);
    row.created_at=(id<=10?'2026-08-':id<=18?'2026-09-':'2026-10-')+String(4+(id%20)).padStart(2,'0')+'T09:00:00+03:00';
    return row;
  });
  // MOCK_DATA_SPEC.md Phase 11 (A-50): retain 13 debtors while allowing a cash balance to test release.
  customers[12].is_credit = false;
  customers[12].credit_limit = 0;
  customers[12].credit_days = 0;

  var suppliers = [
    { id: 1, name: 'Nytil', contact: 'James Mugisha', phone: '+256 702 000 001', email: 'nytil@example.demo', location: 'Kampala, Uganda', supplies: 'Fabric and yarn', categories_json: ['fabric','yarn'], notes: '', type: 'local', active: true },
    { id: 2, name: 'Luwero Textile Supplies', contact: 'Agnes Nambi', phone: '+256 702 000 002', email: 'luwero@example.demo', location: 'Luwero, Uganda', supplies: 'Cotton and drill fabric', categories_json: ['fabric'], notes: '', type: 'local', active: true },
    { id: 3, name: 'Kampala Trims', contact: 'Paul Ouma', phone: '0702 000 003', email: 'trims@example.demo', location: 'Kampala, Uganda', supplies: 'Buttons, zips and labels', categories_json: ['accessory'], notes: '', type: 'local', active: true },
    { id: 4, name: 'Eastlake Imports', contact: 'Mercy Wanjiku', phone: '+254 700 000 004', email: 'eastlake@example.demo', location: 'Nairobi, Kenya', supplies: 'Polyester and lining', categories_json: ['fabric','accessory'], notes: '', type: 'import', active: true },
    { id: 5, name: 'Blue Loom Imports', contact: 'Neema Salim', phone: '+255 700 000 005', email: 'blueloom@example.demo', location: 'Dar es Salaam, Tanzania', supplies: 'Uniform fabrics', categories_json: ['fabric'], notes: 'Inactive prototype supplier.', type: 'import', active: false },
    { id: 6, name: 'Global Yarn House', contact: 'Lin Wei', phone: '+86 130 0000 0006', email: 'yarnhouse@example.demo', location: 'Guangzhou, China', supplies: 'Sweater yarns and thread', categories_json: ['yarn','thread'], notes: 'Inactive prototype supplier.', type: 'import', active: false }
  ];

  // Phase 5 inventory tells a complete stock story: base-unit balances always equal movement sums.
  var materialRows = [
    ['Cotton Poplin White 60 inch','fabric','', 'metre','White','cotton',60,2,18000,400,40,true,0],
    ['Drill Navy 58 inch','fabric','', 'metre','Navy','drill',58,2,22000,320,40,true,0],
    ['Polyester Grey 60 inch','fabric','', 'metre','Grey','polyester',60,4,20000,400,50,true,80],
    ['Rain-coat Fabric Navy 58 inch','fabric','', 'metre','Navy','rain-coat fabric',58,4,30000,200,40,true,40],
    ['Wax Print Blue 44 inch','fabric','', 'metre','Blue','wax print',44,1,28000,150,30,true,25],
    ['Knit Fabric Maroon 60 inch','fabric','', 'metre','Maroon','knit',60,1,25000,160,40,true,35],
    ['Cotton Poplin Sky Blue 44 inch','fabric','', 'metre','Sky blue','cotton',44,2,18000,400,40,true,100],
    ['Drill Khaki 58 inch','fabric','', 'metre','Khaki','drill',58,2,22000,240,40,true,50],
    ['Cotton Poplin White 44 inch','fabric','', 'metre','White','cotton',44,2,17500,400,40,true,300],
    ['Cotton Poplin Cream 60 inch','fabric','', 'metre','Cream','cotton',60,2,18500,400,40,true,350],
    ['Drill Black 58 inch','fabric','', 'metre','Black','drill',58,2,22500,300,40,true,210],
    ['Drill Grey 60 inch','fabric','', 'metre','Grey','drill',60,2,23000,320,40,true,260],
    ['Polyester Royal Blue 60 inch','fabric','', 'metre','Royal blue','polyester',60,4,20500,350,50,true,280],
    ['Polyester White 58 inch','fabric','', 'metre','White','polyester',58,4,20000,400,50,true,330],
    ['Rain-coat Fabric Yellow 58 inch','fabric','', 'metre','Yellow','rain-coat fabric',58,4,31000,180,40,true,130],
    ['Wax Print Red 44 inch','fabric','', 'metre','Red','wax print',44,1,28500,150,30,true,120],
    ['Wax Print Green 44 inch','fabric','', 'metre','Green','wax print',44,1,28500,150,30,true,110],
    ['Silk Cream 44 inch','fabric','', 'metre','Cream','silk',44,4,34000,120,30,true,90],
    ['Knit Fabric Navy 60 inch','fabric','', 'metre','Navy','knit',60,1,25500,160,40,true,140],
    ['Lining Black','accessory','lining','metre','Black','',null,4,8000,220,null,true,180],
    ['Lining White','accessory','lining','metre','White','',null,4,8000,200,null,true,160],
    ['Interfacing White','accessory','interfacing','metre','White','',null,3,6500,160,null,true,140],
    ['Elastic White','accessory','elastic','metre','White','',null,3,2200,300,null,true,250],
    ['Elastic Black','accessory','elastic','metre','Black','',null,3,2200,300,null,true,220],
    ['Sweater Yarn Navy','yarn','', 'cone','Navy','',null,1,32000,100,null,true,80],
    ['Sweater Yarn Maroon','yarn','', 'cone','Maroon','',null,1,32000,100,null,true,70],
    ['Sweater Yarn Grey','yarn','', 'cone','Grey','',null,1,31000,90,null,true,60],
    ['Sewing Thread White','thread','', 'cone','White','',null,3,7500,150,null,true,120],
    ['Sewing Thread Navy','thread','', 'cone','Navy','',null,3,7500,150,null,true,110],
    ['Sewing Thread Black','thread','', 'cone','Black','',null,3,7500,150,null,true,130],
    ['Shirt Buttons White','accessory','buttons','packet','White','',null,3,12000,100,null,true,75],
    ['Trouser Buttons Black','accessory','buttons','packet','Black','',null,3,14000,100,null,true,80],
    ['Zips Navy 20 cm','accessory','zips','piece','Navy','',null,3,1200,200,null,true,160],
    ['Zips Black 20 cm','accessory','zips','piece','Black','',null,3,1200,200,null,true,150],
    ['School Badge Labels','accessory','labels','packet','Mixed','',null,3,18000,70,null,true,55],
    ['Care Labels','accessory','labels','packet','White','',null,3,15000,70,null,true,60],
    ['Clear Garment Bags','packaging','', 'packet','Clear','',null,3,24000,100,null,true,90],
    ['Uniform Cartons','packaging','', 'piece','Brown','',null,3,3500,80,null,true,65],
    ['Brass Buttons Old Style','accessory','buttons','packet','Brass','',null,3,16000,100,null,false,40],
    ['Zips Red Discontinued','accessory','zips','piece','Red','',null,3,1200,100,null,false,30]
  ];
  var materials = materialRows.map(function (row, index) {
    return { id:index+1, name:row[0], category:row[1], subtype:row[2], unit:row[3], colour:row[4], fabric_type:row[5], width_inches:row[6], supplier_id:row[7], cost_per_unit:row[8], full_stock_level:row[9], roll_length_m:row[10], active:row[11], notes:index >= 38 ? 'Inactive prototype material.' : '', target_quantity:row[12] };
  });
  var grnDates = ['2026-08-05','2026-08-18','2026-09-03','2026-09-17','2026-10-02','2026-10-09','2026-10-15','2026-10-21'];
  var grnSuppliers = [1,2,3,4,5,6,1,2];
  var goodsReceivedNotes = grnDates.map(function (date,index) {
    var discrepancy = index === 2;
    return { id:index+1, number:String(index+1).padStart(4,'0'), supplier_id:grnSuppliers[index], supplier_doc_no:index===4?'':'SUP-DN-'+String(index+1).padStart(3,'0'), supplier_doc_missing:index===4, location_id:1, received_by:index%2?2:3, received_at:date, quantity_ok:!discrepancy, quality_ok:true, damage_ok:!discrepancy, colour_ok:true, status:discrepancy?'discrepancy':'ok', supplier_notified:false, notes:discrepancy?'Two metres were rejected because the fabric edge was damaged.':'Delivery checked and accepted.', photo_data:'', void_reason:'', voided_by:null, voided_at:null, created_by:index%2?2:3, created_at:date+'T10:00:00+03:00' };
  });
  var grnItems = [];
  var materialStock = [];
  var stockMovements = [];
  var movementId = 1;
  materials.forEach(function (material, index) {
    var locationOne = Math.floor(material.target_quantity * 0.6);
    var targets = [locationOne, material.target_quantity - locationOne];
    targets.forEach(function (target, locationIndex) {
      var locationId = locationIndex + 1;
      var hasHistory = index < 12 && locationId === 1;
      var received = hasHistory ? Math.max(5, Math.round(material.full_stock_level * 0.10)) : 0;
      var issued = hasHistory ? Math.max(8, Math.round(material.full_stock_level * 0.15)) : 0;
      var opening = target - received + issued;
      materialStock.push({ id: materialStock.length + 1, material_id: material.id, location_id: locationId, quantity: target });
      stockMovements.push({ id:movementId++, item_type:'material', item_id:material.id, location_id:locationId, movement_type:'opening', quantity:opening, before_qty:0, after_qty:opening, reference_type:'opening_balance', reference_id:null, user_id:1, note:'Opening stock for the prototype.', created_at:'2026-07-01T08:00:00+03:00' });
      if (hasHistory) {
        var grnId = (index % 8) + 1;
        var rejected = grnId === 3 ? 2 : 0;
        grnItems.push({ id:grnItems.length+1, grn_id:grnId, material_id:material.id, quantity_received:received+rejected, quantity_rejected:rejected, unit_cost:material.cost_per_unit, created_at:goodsReceivedNotes[grnId-1].created_at });
        stockMovements.push({ id:movementId++, item_type:'material', item_id:material.id, location_id:locationId, movement_type:'grn', quantity:received, before_qty:opening, after_qty:opening+received, reference_type:'goods_received_note', reference_id:grnId, user_id:goodsReceivedNotes[grnId-1].received_by, note:'GRN '+goodsReceivedNotes[grnId-1].number, created_at:goodsReceivedNotes[grnId-1].created_at });
        stockMovements.push({ id:movementId++, item_type:'material', item_id:material.id, location_id:locationId, movement_type:'issue', quantity:-issued, before_qty:opening+received, after_qty:target, reference_type:'historical_issue', reference_id:index+1, user_id:3, note:'Historical workshop issue.', created_at:'2026-10-' + String(2 + index).padStart(2,'0') + 'T14:30:00+03:00' });
      }
    });
    delete material.target_quantity;
  });

  // A-33: only approved adjustments receive movements; pending/rejected rows never change stock.
  var stockAdjustments = [
    {id:1,material_id:5,location_id:2,direction:'increase',quantity:10,reason:'found',note:'Found during the monthly shelf count.',status:'pending',requested_by:3,requested_at:'2026-10-22T09:00:00+03:00',decided_by:null,decided_at:null,decision_note:'',movement_id:null},
    {id:2,material_id:7,location_id:1,direction:'decrease',quantity:5,reason:'damaged',note:'Water damage found during inspection.',status:'pending',requested_by:2,requested_at:'2026-10-22T10:00:00+03:00',decided_by:null,decided_at:null,decision_note:'',movement_id:null},
    {id:3,material_id:13,location_id:1,direction:'increase',quantity:5,reason:'stock_count_correction',note:'Count was five metres above the ledger.',status:'approved',requested_by:3,requested_at:'2026-10-18T08:30:00+03:00',decided_by:1,decided_at:'2026-10-18T09:10:00+03:00',decision_note:'Count witnessed and approved.',movement_id:null},
    {id:4,material_id:14,location_id:2,direction:'decrease',quantity:3,reason:'lost',note:'Three metres could not be traced after count.',status:'approved',requested_by:2,requested_at:'2026-10-19T11:00:00+03:00',decided_by:1,decided_at:'2026-10-19T12:00:00+03:00',decision_note:'Approved after recount.',movement_id:null},
    {id:5,material_id:15,location_id:1,direction:'increase',quantity:8,reason:'other',note:'Requested correction without supporting count.',status:'rejected',requested_by:3,requested_at:'2026-10-20T13:00:00+03:00',decided_by:1,decided_at:'2026-10-20T14:00:00+03:00',decision_note:'Recount required before adjustment.',movement_id:null}
  ];
  [stockAdjustments[2],stockAdjustments[3]].forEach(function (adjustment) {
    var stock = materialStock.find(function (row) { return row.material_id===adjustment.material_id&&row.location_id===adjustment.location_id; });
    var signed = adjustment.direction==='decrease'?-adjustment.quantity:adjustment.quantity;
    var before = stock.quantity;
    stock.quantity = before + signed;
    var movement = {id:movementId++,item_type:'material',item_id:adjustment.material_id,location_id:adjustment.location_id,movement_type:'adjustment',quantity:signed,before_qty:before,after_qty:stock.quantity,reference_type:'stock_adjustment',reference_id:adjustment.id,user_id:1,note:adjustment.note,created_at:adjustment.decided_at};
    stockMovements.push(movement);
    adjustment.movement_id=movement.id;
  });
  var approvals = stockAdjustments.map(function (adjustment) { return {id:adjustment.id,type:'stock_adjustment',entity_type:'stock_adjustments',entity_id:adjustment.id,requested_by:adjustment.requested_by,approved_by:adjustment.decided_by,status:adjustment.status,reason:adjustment.decision_note||adjustment.note,created_at:adjustment.requested_at}; });

  function auditRow(id, userId, action, entityType, entityId, before, after, createdAt) { return { id: id, user_id: userId, action: action, entity_type: entityType, entity_id: entityId, before_json: before ? JSON.stringify(before) : null, after_json: after ? JSON.stringify(after) : null, created_at: createdAt }; }
  var auditLogs = [
    auditRow(1,1,'create','customers',21,null,{name:'Amina Nakato',active:true},'2026-10-14T08:15:00+03:00'),
    auditRow(2,2,'update','customers',3,{phone:'0701000003'},{phone:'+256 701 000 003'},'2026-10-15T09:20:00+03:00'),
    auditRow(3,1,'deactivate','customers',22,{active:true},{active:false},'2026-10-15T14:05:00+03:00'),
    auditRow(4,2,'update','suppliers',1,{contact:''},{contact:'James Mugisha'},'2026-10-16T10:10:00+03:00'),
    auditRow(5,1,'update','business_settings',1,{vat_rate:17},{vat_rate:18},'2026-10-16T16:35:00+03:00'),
    auditRow(6,1,'update','document_sequences',1,{next_number:644},{next_number:645},'2026-10-17T08:45:00+03:00'),
    auditRow(7,2,'create','customers',15,null,{name:'Blue Crane Logistics',active:true},'2026-10-17T11:30:00+03:00'),
    auditRow(8,1,'activate','customers',24,{active:false},{active:true},'2026-10-18T09:00:00+03:00'),
    auditRow(9,2,'deactivate','suppliers',5,{active:true},{active:false},'2026-10-18T13:20:00+03:00'),
    auditRow(10,1,'update','customer_groups',3,{name:'Companies'},{name:'Corporate'},'2026-10-19T10:40:00+03:00'),
    auditRow(11,1,'create','customer_groups',4,null,{name:'Reseller'},'2026-10-19T15:15:00+03:00'),
    auditRow(12,2,'update','customers',1,{credit_limit:5000000},{credit_limit:5250000},'2026-10-20T08:25:00+03:00'),
    auditRow(13,1,'update','business_settings',1,{quotation_validity_days:7},{quotation_validity_days:14},'2026-10-20T12:50:00+03:00'),
    auditRow(14,1,'update','document_sequences',4,{next_number:98},{next_number:99},'2026-10-21T09:35:00+03:00'),
    auditRow(15,2,'update','suppliers',4,{location:'Kenya'},{location:'Nairobi, Kenya'},'2026-10-21T16:05:00+03:00')
  ];

  function employee(id, role, number, payType, userId) {
    return {
      id: id,
      name: role.replace('_', ' ') + ' staff ' + String(number).padStart(2, '0'),
      phone: '+256 703 000 ' + String(id).padStart(3, '0'),
      nin: 'PROTO-NIN-' + String(id).padStart(3, '0'),
      address: 'Prototype employee address ' + id,
      next_of_kin_name: 'Next of Kin ' + id,
      next_of_kin_phone: '+256 703 100 ' + String(id).padStart(3, '0'),
      date_of_birth: '199' + (id % 10) + '-06-15',
      date_joined: '202' + (id % 6) + '-01-10',
      role: role,
      pay_type: payType,
      monthly_salary: payType === 'salary' ? 450000 + (id * 25000) : 0,
      user_id: userId || null,
      active: true
    };
  }

  var employees = [];
  function addEmployees(role, count, payType, linkedUsers) {
    for (var index = 1; index <= count; index += 1) {
      employees.push(employee(employees.length + 1, role, employees.filter(function (item) { return item.role === role; }).length + 1, payType, (linkedUsers || [])[index - 1]));
    }
  }
  addEmployees('tailor', 7, 'piece');
  addEmployees('cutter', 3, 'piece');
  addEmployees('finisher', 3, 'piece');
  addEmployees('knitter', 2, 'piece');
  addEmployees('embroidery', 2, 'piece');
  addEmployees('sales', 3, 'salary', [4, 5]);
  addEmployees('cleaner', 2, 'salary');
  addEmployees('supervisor', 2, 'salary', [6]);
  addEmployees('tailor', 1, 'piece');
  addEmployees('cleaner', 1, 'salary');
  // A-91: employment roles are the eight roles in BUSINESS_RULES.md section 11.
  // Store and marketing users remain in the users table but are not workshop employees.

  // BUSINESS_RULES.md section 8 (A-57): Phase 12's seven-stage fallback supersedes the older eight-stage assumption pending owner confirmation.
  var orderStages = ['Received', 'Deposit confirmed', 'Cutting', 'Sewing', 'Finishing and quality check', 'Ready for delivery', 'Delivered'].map(function (name, index) {
    return { id: index + 1, name: name, sort_order: index + 1, active: true };
  });

  var expenseCategories = ['Rent', 'Electricity', 'Transport', 'Salaries', 'Materials', 'Repairs', 'Airtime', 'Marketing', 'Lunch', 'Drinking water', 'Allowances'].map(function (name, index) {
    return { id: index + 1, name: name };
  });

  // A-83 to A-86: eleven approved vouchers, two pending requests, one rejection and one cancelled voucher.
  var expenseSeeds = [
    ['2026-08-03',1,1450000,'Mirembe Arcade','August workshop rent','bank','approved',2],
    ['2026-08-12',2,186000,'UMEME','August electricity','bank','approved',7],
    ['2026-08-22',3,74000,'City courier','Fabric collection','cash','approved',2],
    ['2026-09-03',1,1450000,'Mirembe Arcade','September workshop rent','bank','approved',2],
    ['2026-09-15',6,125000,'Machine repair shop','Overlocker belt and service','cash','approved',7],
    ['2026-09-27',5,97000,'Nasser Road supplies','Thread and buttons','cash','approved',2],
    ['2026-10-03',1,1450000,'Mirembe Arcade','October workshop rent','bank','approved',2],
    ['2026-10-09',2,211000,'UMEME','October electricity','bank','approved',7],
    ['2026-10-16',3,86000,'City courier','School delivery transport','cash','approved',2],
    ['2026-10-21',7,30000,'Airtime retailer','Customer contact airtime','cash','approved',7],
    ['2026-10-24',5,68000,'Nasser Road supplies','Small thread purchase','cash','approved',2],
    ['2026-10-26',10,24000,'Water supplier','Workshop drinking water','cash','pending',7],
    ['2026-10-26',9,54000,'Lunch vendor','Workshop lunch','cash','pending',2],
    ['2026-10-20',8,250000,'Local printer','Poster printing request','bank','rejected',2],
    ['2026-10-18',6,115000,'Machine repair shop','Duplicate repair invoice','cash','cancelled',7]
  ];
  var expenses = expenseSeeds.map(function (item, index) { return { id:index+1, expense_date:item[0], category_id:item[1], amount:item[2],
    payee:item[3], description:item[4], payment_method:item[5], status:item[6], recorded_by:item[7],
    voucher_number:item[6]==='approved'||item[6]==='cancelled'?String(index<=10?index+1:12):null,
    approved_by:item[6]==='approved'||item[6]==='cancelled'?1:null, approved_at:item[6]==='approved'||item[6]==='cancelled'?item[0]+'T13:00:00+03:00':null,
    rejection_reason:item[6]==='rejected'?'No approved marketing budget.':null,
    cancelled_by:item[6]==='cancelled'?1:null, cancelled_at:item[6]==='cancelled'?'2026-10-18T16:00:00+03:00':null,
    cancellation_reason:item[6]==='cancelled'?'Duplicate invoice.':null,
    receipt_photo_path:null, is_recurring:false }; });
  expenses.filter(function (row) { return row.status === 'pending' || row.status === 'rejected'; }).forEach(function (row) {
    approvals.push({id:approvals.length+1,type:'expense',entity_type:'expenses',entity_id:row.id,
      requested_by:row.recorded_by,approved_by:row.status==='rejected'?1:null,
      status:row.status==='pending'?'requested':'rejected',reason:row.rejection_reason||row.description,
      created_at:row.expense_date+'T12:00:00+03:00'});
  });

  var leadSources = ['Social media', 'WhatsApp', 'Referral', 'Exhibition', 'Other'].map(function (name, index) {
    return { id: index + 1, name: name };
  });

  var messageTemplates = [
    { id: 1, name: 'Order ready', channel: 'sms', body: 'Dear {{customer_name}}, your order {{order_number}} is ready for collection from {{business_name}}. Call {{phone_numbers}}.' },
    { id: 2, name: 'Payment reminder', channel: 'sms', body: 'Dear {{customer_name}}, invoice {{invoice_numbers}} has {{amount_due}} due since {{due_date}}. Please contact {{business_name}} on {{phone_numbers}}.' },
    { id: 3, name: 'Promotion', channel: 'sms', body: 'Dear {{customer_name}}, ask {{business_name}} about our current uniform promotion. Call {{phone_numbers}}.' },
    { id: 4, name: 'Thank-you', channel: 'sms', body: 'Dear {{customer_name}}, thank you for choosing {{business_name}}.' },
    { id: 5, name: 'New designs', channel: 'email', body: 'Dear {{customer_name}}, new uniform designs are now available from {{business_name}}. Contact {{phone_numbers}}.' },
    { id: 6, name: 'Supplier discrepancy notice', channel: 'email', body: 'Dear {{supplier_name}},\n\n{{business_name}} recorded a discrepancy on goods received note {{grn_number}} dated {{grn_date}}.\nFailed checks: {{failed_checks}}.\nDetails: {{notes}}\n\nPlease review and contact us.' }
  ];
  var messages = [{id:1,channel:'email',recipient_name:suppliers[2].name,recipient_contact:suppliers[2].email,template_id:6,body:'Dear '+suppliers[2].name+',\n\nGenuine Textiles recorded a discrepancy on goods received note 0003 dated '+grnDates[2]+'.\nFailed checks: Quantity, Damage.\nDetails: '+goodsReceivedNotes[2].notes+'\n\nPlease review and contact us.',status:'draft',sent_by:null,sent_at:null,reference_type:'goods_received_note',reference_id:3,created_at:grnDates[2]+'T10:15:00+03:00'}];

  var accountRows = [
    ['1000', 'Cash', 'asset'], ['1010', 'Bank', 'asset'], ['1100', 'Accounts Receivable', 'asset'],
    ['1200', 'Material Inventory', 'asset'], ['1210', 'Finished Goods Inventory', 'asset'], ['1500', 'Equipment', 'asset'],
    ['2000', 'Accounts Payable', 'liability'], ['2100', 'VAT Payable', 'liability'], ['2200', 'Wages Payable', 'liability'],
    ['3000', 'Owner Capital', 'equity'], ['3100', 'Retained Earnings', 'equity'],
    ['4000', 'Sales Income', 'income'], ['4100', 'Other Income', 'income'],
    ['5000', 'Material Costs', 'expense'], ['5100', 'Wages Expense', 'expense'], ['5200', 'Rent Expense', 'expense'],
    ['5210', 'Electricity Expense', 'expense'], ['5220', 'Transport Expense', 'expense'],
    ['5230', 'Marketing Expense', 'expense'], ['5240', 'Repairs Expense', 'expense']
  ];
  var accounts = accountRows.map(function (row, index) {
    return { id: index + 1, code: row[0], name: row[1], type: row[2] };
  });
  var ledgerEntries = [];
  function seedLedger(date, method, amount, type, id, narration, reverse) {
    var cashId = accounts.find(function (row) { return row.code === (method === 'bank' ? '1010' : '1000'); }).id;
    var incoming = type === 'receipt' ? !reverse : !!reverse;
    ledgerEntries.push({ id:ledgerEntries.length+1, entry_date:date, account_id:cashId,
      debit:incoming?amount:0, credit:incoming?0:amount, reference_type:type+(reverse?'_reversal':''),
      reference_id:id, narration:narration });
  }

  // Phase 7: the last ten paper numbers in each series remain reserved; drafts are additional unnumbered rows (A-36).
  var salesDocuments = [], salesDocumentItems = [];
  var salesDates = ['2026-07-30','2026-08-08','2026-08-19','2026-08-30','2026-09-09','2026-09-19','2026-09-29','2026-10-09','2026-10-17','2026-10-22'];
  function seedSales(type, firstNumber, offset) {
    salesDates.forEach(function (date, index) {
      var specialQuote = type === 'quotation' && index === 9;
      var specialProforma = type === 'proforma' && index === 9;
      if (specialProforma) date = '2026-09-10'; // Owner's paper proforma 096 carries this date.
      var customerId = specialQuote ? 1 : (specialProforma ? 2 : ((index + offset) % customers.length) + 1);
      var client = customers[customerId - 1];
      var discount = type === 'quotation' && index === 8 ? 50000 : 0;
      var subtotal = specialQuote ? 9000000 : (specialProforma ? 4590000 : (type === 'quotation' ? 450000 : 300000));
      var vat = Math.round((subtotal - discount) * 0.18), total = subtotal - discount + vat;
      var number = String(firstNumber + index).padStart(3, '0');
      var status = index === 0 ? 'void' : 'issued';
      var id = salesDocuments.length + 1;
      salesDocuments.push({ id:id, type:type, number:number, customer_id:client.id, customer_name:client.name, customer_address:client.address, customer_phone:client.phone,
        order_id:null, issue_date:date, valid_until:type === 'quotation' ? new Date(Date.parse(date + 'T12:00:00Z') + 14 * 86400000).toISOString().slice(0,10) : null, due_date:null,
        subtotal:subtotal, discount_amount:discount, discount_reason:discount ? 'Approved repeat customer price.' : '', discount_status:discount ? 'approved' : 'none', discount_requested_by:discount ? 4 : null, discount_approved_by:discount ? 2 : null,
        vat_rate:18, vat_amount:vat, total:total, amount_in_words:specialQuote ? 'Ten million six hundred twenty thousand shillings only.' : (specialProforma ? 'Five million four hundred sixteen thousand two hundred shillings only.' : (discount ? 'Four hundred seventy two thousand shillings only.' : (type === 'quotation' ? 'Five hundred thirty one thousand shillings only.' : 'Three hundred fifty four thousand shillings only.'))),
        fiscal_document_no:null, status:status, voided_reason:index === 0 ? 'Corrected paper document.' : '', voided_at:index === 0 ? date + 'T14:00:00+03:00' : null, voided_by:index === 0 ? 2 : null,
        created_by:index % 2 ? 4 : 2, location_id:1, source_document_id:null, issued_at:date + 'T09:00:00+03:00', issued_by:index % 2 ? 4 : 2,
        notes:'', terms_text:type === 'quotation' ? 'Price Validity: 14 days from date of the Quotation, subject to change basing on the prevailing exchange rate.' : '', created_at:date + 'T08:00:00+03:00' });
      var lines = specialQuote ? [['Raincoats','All',200,'pcs',45000]] : (specialProforma ? [
        ['Security Uniforms with caps','All',44,'pairs',75000], ['Sky Blue Workers Suits (Shirt & Trouser)','All',12,'pairs',55000],
        ['Corporate Sales Trousers','All',9,'pcs',40000], ['Maids Black Trousers','All',4,'pcs',30000], ['Blue T-Shirts','All',6,'pcs',25000]
      ] : [[type === 'quotation' ? 'School uniforms' : 'Work uniforms','All',10,'pcs',type === 'quotation' ? 45000 : 30000]]);
      lines.forEach(function (line) { salesDocumentItems.push({ id:salesDocumentItems.length+1, sales_document_id:id, description:line[0], size:line[1], quantity:line[2], unit:line[3], unit_price:line[4], amount:line[2]*line[4], active:true, created_at:date+'T08:00:00+03:00' }); });
    });
    var draftId = salesDocuments.length + 1, draftCustomer = customers[type === 'quotation' ? 3 : 4];
    salesDocuments.push({ id:draftId, type:type, number:null, customer_id:draftCustomer.id, customer_name:null, customer_address:null, customer_phone:null, issue_date:'2026-10-22', valid_until:type === 'quotation' ? '2026-11-05' : null,
      subtotal:300000, discount_amount:30000, discount_reason:'Volume order', discount_status:'requested', discount_requested_by:4, discount_approved_by:null, vat_rate:18, vat_amount:48600, total:318600,
      amount_in_words:'Three hundred eighteen thousand six hundred shillings only.', status:'draft', created_by:4, location_id:1, source_document_id:null, issued_at:null, issued_by:null, voided_at:null, voided_by:null, voided_reason:'', notes:'Awaiting discount approval.',
      terms_text:type === 'quotation' ? 'Price Validity: 14 days from date of the Quotation, subject to change basing on the prevailing exchange rate.' : '', created_at:'2026-10-22T11:00:00+03:00' });
    salesDocumentItems.push({ id:salesDocumentItems.length+1, sales_document_id:draftId, description:'Work uniforms', size:'All', quantity:10, unit:'pcs', unit_price:30000, amount:300000, active:true, created_at:'2026-10-22T11:00:00+03:00' });
    approvals.push({ id:approvals.length+1, type:'discount', entity_type:'sales_documents', entity_id:draftId, requested_by:4, approved_by:null, status:'requested', reason:'Volume order', created_at:'2026-10-22T11:00:00+03:00' });
  }
  seedSales('quotation', 89, 0);
  seedSales('proforma', 87, 8);
  approvals.push({ id:approvals.length+1, type:'discount', entity_type:'sales_documents', entity_id:9, requested_by:4, approved_by:2, status:'approved', reason:'Approved repeat customer price', created_at:'2026-10-17T08:00:00+03:00' });

  // Phase 8: 615â€“644 are paper invoice numbers; drafts use no number (BUSINESS_RULES.md 1).
  var receipts = [];
  var invoiceDates = {};
  for (var n=615;n<=624;n++) invoiceDates[n]=window.GT.dates.addDays('2026-07-10',(n-615)*4);
  for (var n2=625;n2<=629;n2++) invoiceDates[n2]=window.GT.dates.addDays('2026-10-05',n2-625);
  for (var n3=630;n3<=632;n3++) invoiceDates[n3]=window.GT.dates.addDays('2026-09-05',n3-630);
  Object.assign(invoiceDates,{633:'2026-08-12',634:'2026-07-22',635:'2026-10-18',636:'2026-10-19',637:'2026-10-20',638:'2026-10-21',639:'2026-10-22',640:'2026-04-28',641:'2026-09-12',642:'2026-08-01',643:'2026-10-18',644:'2026-10-23'});
  var garments = [
    ['School shirts','M',80,'pcs',35000],['School shorts','L',75,'pcs',32000],['School skirts','M',60,'pcs',38000],
    ['School trousers','L',70,'pcs',42000],['School dresses','M',55,'pcs',45000],['Sweaters','All',65,'pcs',48000],
    ['Corporate shirts','XL',50,'pcs',55000],['Corporate trousers','L',45,'pcs',65000],['T-shirts','All',100,'pcs',25000],
    ['Medical uniforms','All',40,'sets',75000],['Security uniforms','All',50,'sets',85000]
  ];
  function invoiceLines(number) {
    if (number === 640) return [['Raincoats','All',400,'pcs',45000]];
    if (number === 641) return [
      ['Security Uniforms with caps','All',44,'pairs',75000],['Sky Blue Workers Suits (Shirt & Trouser)','All',12,'pairs',55000],
      ['Corporate Sales Trousers','All',9,'pcs',40000],['Maids Black Trousers','All',4,'pcs',30000],['Blue T-Shirts','All',6,'pcs',25000]
    ];
    if (number === 633) return [['Raincoats','All',200,'pcs',45000]];
    return [garments[(number-615)%garments.length]];
  }
  function invoiceCustomer(number) {
    if (number >= 625 && number <= 634) return number-622;
    if (number === 640) return 1;
    if (number === 641) return 2;
    if (number === 642) return 13;
    if (number === 644) return 21;
    return 14 + ((number-615)%7);
  }
  function addInvoice(number) {
    var date=invoiceDates[number], client=customers[invoiceCustomer(number)-1], lines=invoiceLines(number);
    var discount=number===638?100000:0;
    var items=lines.map(function (line) { return { description:line[0],size:line[1],quantity:line[2],unit:line[3],unit_price:line[4],amount:line[2]*line[4] }; });
    var totals=window.GT.calc.calcTotals(items,discount,18), id=salesDocuments.length+1;
    var source=number===641?21:number===635?9:number===636?20:number===637?8:null;
    var due=window.GT.dates.addDays(date,client.is_credit?(client.credit_days||30):0);
    salesDocuments.push({ id:id,type:'invoice',number:String(number),customer_id:client.id,customer_name:client.name,customer_address:client.address,customer_phone:client.phone,
      order_id:null,order_reference:'',source_document_id:source,issue_date:date,valid_until:null,due_date:due,
      subtotal:totals.subtotal,discount_amount:discount,discount_reason:discount?'Approved bulk order price.':'',discount_status:discount?'approved':'none',discount_requested_by:discount?4:null,discount_approved_by:discount?2:null,
      vat_rate:18,vat_amount:totals.vat,total:totals.total,amount_in_words:window.GT.format.amountInWords(totals.total),fiscal_document_no:number===640?'1253652875875':null,
      status:number===644?'void':'issued',voided_reason:number===644?'Corrected paper invoice.':'',voided_at:number===644?date+'T14:00:00+03:00':null,voided_by:number===644?2:null,
      credit_override_approved_by:null,created_by:number%2?4:2,location_id:1,issued_at:date+'T09:00:00+03:00',issued_by:number%2?4:2,
      notes:'',terms_text:client.is_credit?'Payment due within 30 days â€” Due '+window.GT.dates.formatDate(due):'All accounts are due on demand',created_at:date+'T08:00:00+03:00' });
    items.forEach(function (item) { salesDocumentItems.push(Object.assign({ id:salesDocumentItems.length+1,sales_document_id:id,active:true,created_at:date+'T08:00:00+03:00' },item)); });
    return salesDocuments[salesDocuments.length-1];
  }
  var invoiceRows=[];
  for (var number=615;number<=644;number++) invoiceRows.push(addInvoice(number));
  // BUSINESS_RULES.md section 3: 16 paid, 11 part paid, 2 unpaid, 1 void; 45 receipts in all.
  var paymentMethods=['cash','mtn','airtel','bank','cheque'];
  function addReceipt(doc,amount,sequence) {
    var paid=receipts.filter(function (row) { return row.invoice_id===doc.id; }).reduce(function (sum,row) { return sum+row.amount; },0);
    var date=window.GT.dates.addDays(doc.issue_date,sequence);
    var method=paymentMethods[receipts.length%paymentMethods.length];
    var serial=receipts.length+1;
    var reference=method==='cash'?'':method==='cheque'?String(400000+serial):method==='bank'?'EQB/TRF/26'+date.slice(5,7)+date.slice(8,10)+'/'+String(serial).padStart(4,'0'):'MP26'+date.slice(5,7)+date.slice(8,10)+'.1534.A'+String(80000+serial);
    receipts.push({ id:serial,number:String(2029+receipts.length),customer_id:doc.customer_id,customer_name:customers[doc.customer_id-1].name,invoice_id:doc.id,
      amount:amount,payment_method:method,reference:reference,description:sequence===1?'Deposit on invoice '+doc.number:doc.total-paid-amount===0?'Balance of invoice '+doc.number:'Part payment on invoice '+doc.number,
      balance_after:doc.total-paid-amount,status:'issued',received_by:receipts.length%2?4:2,received_at:date+'T11:00:00+03:00',void_reason:null,voided_by:null,voided_at:null,created_at:date+'T11:00:00+03:00' });
  }
  invoiceRows.forEach(function (doc) {
    if (doc.status==='void' || doc.number==='640' || doc.number==='633') return;
    var debtor=doc.customer_id<=13;
    var half=Math.floor(doc.total/2);
    addReceipt(doc,half,1);
    if (debtor) return;
    if (doc.number==='615' || doc.number==='616') { var quarter=Math.floor((doc.total-half)/2); addReceipt(doc,quarter,2); addReceipt(doc,doc.total-half-quarter,3); }
    else addReceipt(doc,doc.total-half,2);
  });
  // MOCK_DATA_SPEC.md Phase 9: two corrected paper receipts remain in history.
  ['615','616'].forEach(function (number,index) {
    var doc=invoiceRows.filter(function (row) { return row.number===number; })[0];
    var group=receipts.filter(function (row) { return row.invoice_id===doc.id; });
    var wrong=group[0], final=group[group.length-1];
    wrong.status='void'; wrong.void_reason=index?'Wrong invoice selected':'Wrong amount entered'; wrong.voided_by=2;
    wrong.voided_at=window.GT.dates.addDays(wrong.received_at,2)+'T14:00:00+03:00';
    final.amount+=wrong.amount;
    group.slice(1).forEach(function (row) {
      var prior=group.filter(function (item) { return item.status!=='void' && item.id<=row.id; }).reduce(function (sum,item) { return sum+item.amount; },0);
      row.balance_after=doc.total-prior;
    });
  });
  // Re-date current-month payments within their invoice dates so the collection cards have live figures.
  receipts.filter(function (row) { return row.received_at.slice(0,7)==='2026-10' && row.received_at.slice(0,10)<='2026-10-26'; }).slice(-3).forEach(function (row) { row.received_at='2026-10-26T11:00:00+03:00'; });
  function addInvoiceDraft(customerId,discount) {
    var client=customers[customerId-1],date='2026-10-24',subtotal=600000,totals=window.GT.calc.calcTotals([{amount:subtotal}],discount,18),id=salesDocuments.length+1;
    salesDocuments.push({ id:id,type:'invoice',number:null,customer_id:client.id,customer_name:null,customer_address:null,customer_phone:null,order_id:null,order_reference:'',source_document_id:null,
      issue_date:date,valid_until:null,due_date:window.GT.dates.addDays(date,client.credit_days||30),subtotal:totals.subtotal,discount_amount:discount,discount_reason:discount?'Bulk order request.':'',
      discount_status:discount?'requested':'none',discount_requested_by:discount?4:null,discount_approved_by:null,vat_rate:18,vat_amount:totals.vat,total:totals.total,
      amount_in_words:window.GT.format.amountInWords(totals.total),fiscal_document_no:null,status:'draft',credit_override_approved_by:null,created_by:4,location_id:1,
      issued_at:null,issued_by:null,voided_at:null,voided_by:null,voided_reason:'',notes:'',terms_text:'',created_at:date+'T08:00:00+03:00' });
    salesDocumentItems.push({ id:salesDocumentItems.length+1,sales_document_id:id,description:'School shirts',size:'All',quantity:20,unit:'pcs',unit_price:30000,amount:600000,active:true,created_at:date+'T08:00:00+03:00' });
    if (discount) approvals.push({ id:approvals.length+1,type:'discount',entity_type:'sales_documents',entity_id:id,requested_by:4,approved_by:null,status:'requested',reason:'Bulk order request.',created_at:date+'T08:00:00+03:00' });
  }
  addInvoiceDraft(3,0);
  addInvoiceDraft(4,50000);

  // DOCUMENT_TEMPLATES.md section 6 (A-45): statement rows are locked issue-time snapshots.
  var pearlInvoice = invoiceRows.find(function (row) { return row.number === '640'; });
  var statements = [
    { id:1, customer_id:1, statement_date:'2026-05-25', addressee_title:'The Finance Manager', addressee_name:'Pearl Dairy Farms', intro_text:'We kindly request payment for the goods already supplied, as stated with reference to the document numbers below.',
      lines_json:[{invoice_id:pearlInvoice.id,document_ref:'1253652875875',particulars:'400 pcs of Rain Coats',delivery_date:'2026-05-05',gross_amount:21240000,advance:0,amount_due:21240000}],
      total_gross:21240000,total_advance:0,total_due:21240000,signatory_name:'Kibira',created_by:1,created_at:'2026-05-25T10:00:00+03:00',status:'issued',void_reason:null },
    { id:2, customer_id:2, statement_date:'2026-10-18', addressee_title:'The Finance Manager',addressee_name:customers[1].name,intro_text:'We kindly request payment for the goods already supplied, as stated with reference to the document numbers below.',
      lines_json:[{invoice_id:invoiceRows.find(function (row) { return row.number==='641'; }).id,document_ref:'641',particulars:'44 pairs of Security Uniforms with caps',delivery_date:'2026-09-12',gross_amount:5416200,advance:2708100,amount_due:2708100}],
      total_gross:5416200,total_advance:2708100,total_due:2708100,signatory_name:'Kibira',created_by:2,created_at:'2026-10-18T10:00:00+03:00',status:'issued',void_reason:null },
    { id:3, customer_id:13, statement_date:'2026-10-20',addressee_title:'The Finance Manager',addressee_name:customers[12].name,intro_text:'We kindly request payment for the goods already supplied, as stated with reference to the document numbers below.',
      lines_json:[{invoice_id:invoiceRows.find(function (row) { return row.number==='642'; }).id,document_ref:'642',particulars:'School uniforms',delivery_date:'2026-08-01',gross_amount:invoiceRows.find(function (row) { return row.number==='642'; }).total,advance:Math.floor(invoiceRows.find(function (row) { return row.number==='642'; }).total/2),amount_due:Math.ceil(invoiceRows.find(function (row) { return row.number==='642'; }).total/2)}],
      total_gross:invoiceRows.find(function (row) { return row.number==='642'; }).total,total_advance:Math.floor(invoiceRows.find(function (row) { return row.number==='642'; }).total/2),total_due:Math.ceil(invoiceRows.find(function (row) { return row.number==='642'; }).total/2),signatory_name:'Kibira',created_by:2,created_at:'2026-10-20T10:00:00+03:00',status:'void',void_reason:'Replaced after customer address correction.' }
  ];
  // BUSINESS_RULES.md section 4 (A-46): historical simulated reminders exercise spacing and promise states.
  var debtorIds = [1,2,8,9,10,11,12];
  var debtReminders = [];
  function seedDebt(customerId) {
    return invoiceRows.filter(function (row) { return row.customer_id===customerId && row.status==='issued'; }).reduce(function (sum,doc) {
      return sum+doc.total-receipts.filter(function (row) { return row.invoice_id===doc.id && row.status!=='void'; }).reduce(function (paid,row) { return paid+row.amount; },0);
    },0);
  }
  function seedReminder(customerId,channel,date,outcome) {
    var id=debtReminders.length+1,client=customers[customerId-1];
    var ids=invoiceRows.filter(function (row) { return row.customer_id===customerId && row.status==='issued'; }).map(function (row) { return row.id; });
    var text=channel==='call'?(outcome==='promised'?'Customer promised to pay.':'Discussed overdue balance.'):'Payment reminder for '+client.name+'. Please contact Genuine Textiles about your overdue invoice.';
    var messageId=null;
    if (channel!=='call') { messageId=messages.length+1; messages.push({id:messageId,channel:channel,recipient_name:client.name,recipient_contact:channel==='sms'?client.phone:client.email,template_id:2,body:text,status:'sent (simulated)',sent_by:2,sent_at:date+'T11:00:00+03:00',reference_type:'debt_reminder',reference_id:id,created_at:date+'T11:00:00+03:00'}); }
    debtReminders.push({id:id,customer_id:customerId,invoice_ids_json:ids,channel:channel,message_id:messageId,message_text:text,outcome:outcome||'sent',
      promise_date:outcome==='promised'?(customerId===1?'2026-11-05':'2026-10-20'):null,promise_amount:outcome==='promised'?500000:null,
      balance_at_reminder:seedDebt(customerId),sent_by:2,sent_at:date+'T11:00:00+03:00',created_at:date+'T11:00:00+03:00'});
  }
  for (var reminderNo=0;reminderNo<20;reminderNo++) {
    var reminderDay=reminderNo===14||reminderNo===15?24:13+Math.floor(reminderNo/4);
    seedReminder(debtorIds[reminderNo%7],'sms','2026-10-'+String(reminderDay).padStart(2,'0'));
  }
  seedReminder(1,'email','2026-09-20'); seedReminder(8,'email','2026-10-17'); seedReminder(9,'email','2026-10-18');
  seedReminder(1,'call','2026-10-24','promised'); seedReminder(2,'call','2026-10-19','promised');

  // MOCK_DATA_SPEC.md Phase 11 (A-49): the paper pad ended at 2055; these notes use older paid invoices.
  var deliveryNotes = [], deliveryNoteItems = [];
  for (var noteNumber=2046;noteNumber<=2055;noteNumber++) {
    var invoiceNumber=615+noteNumber-2046, sourceInvoice=invoiceRows.find(function (row) { return row.number===String(invoiceNumber); });
    var client=customers[sourceInvoice.customer_id-1], line=salesDocumentItems.find(function (row) { return row.sales_document_id===sourceInvoice.id; });
    var issued=noteNumber===2052||noteNumber===2053, voided=noteNumber===2054;
    var date=noteNumber===2052?'2026-10-20':noteNumber===2053?'2026-10-24':noteNumber===2055?'2026-10-25':'2026-09-01';
    var dispatched=noteNumber===2052 ? line.quantity/2 : line.quantity;
    var returned=noteNumber===2051 ? 2 : 0;
    var status=voided?'void':issued?'issued':'delivered';
    deliveryNotes.push({id:deliveryNotes.length+1,number:String(noteNumber),customer_id:client.id,invoice_id:sourceInvoice.id,
      delivery_date:date,delivery_method:noteNumber%3===0?'courier':noteNumber%3===1?'delivered_by_us':'collected_by_customer',
      carrier_or_collector_name:noteNumber%3===0?'Kampala Courier':noteNumber%3===1?'Company rider':client.contact_person,
      phone:client.phone,delivery_address:client.address,contact_person:client.contact_person,contact_phone:client.phone,
      notes:'',dispatched_by:3,created_by:sourceInvoice.created_by,status:status,release_approved_by:null,
      issued_at:date+'T09:00:00+03:00',received_by:status==='delivered'?client.contact_person:null,
      received_date:status==='delivered'?date:null,confirmed_by:status==='delivered'?3:null,
      confirmed_at:status==='delivered'?date+'T14:00:00+03:00':null,
      void_reason:voided?'Delivery rescheduled.':null,voided_by:voided?2:null,
      voided_at:voided?date+'T15:00:00+03:00':null,discarded_at:null,created_at:date+'T08:00:00+03:00'});
    deliveryNoteItems.push({id:deliveryNoteItems.length+1,delivery_note_id:deliveryNotes.length,sales_document_item_id:line.id,
      description:line.description,size:line.size,quantity_ordered:line.quantity,qty_dispatched:dispatched,
      qty_received:status==='delivered'?dispatched-returned:null,qty_returned:returned,
      return_reason:returned?'damaged':null,created_at:date+'T08:00:00+03:00'});
  }
  var draftInvoice=invoiceRows.find(function (row) { return row.number==='625'; });
  var draftLine=salesDocumentItems.find(function (row) { return row.sales_document_id===draftInvoice.id; });
  var draftClient=customers[draftInvoice.customer_id-1];
  deliveryNotes.push({id:11,number:null,customer_id:draftClient.id,invoice_id:draftInvoice.id,
    delivery_date:'2026-10-28',delivery_method:'courier',carrier_or_collector_name:'',phone:'',
    delivery_address:draftClient.address,contact_person:draftClient.contact_person,contact_phone:draftClient.phone,
    notes:'Planned dispatch.',dispatched_by:null,created_by:4,status:'draft',release_approved_by:null,
    issued_at:null,received_by:null,received_date:null,confirmed_by:null,confirmed_at:null,
    void_reason:null,voided_by:null,voided_at:null,discarded_at:null,created_at:'2026-10-25T08:00:00+03:00'});
  deliveryNoteItems.push({id:11,delivery_note_id:11,sales_document_item_id:draftLine.id,description:draftLine.description,
    size:draftLine.size,quantity_ordered:draftLine.quantity,qty_dispatched:draftLine.quantity,
    qty_received:null,qty_returned:0,return_reason:null,created_at:'2026-10-25T08:00:00+03:00'});

  // MOCK_DATA_SPEC.md Phase 12 (A-57): order links add no invoice, receipt or delivery quantities.
  var orders = [], orderItems = [], orderStageHistory = [];
  var orderSeeds = [
    { invoice:615, stage:7, due:'2026-10-24' }, { invoice:616, stage:7, due:'2026-10-25' },
    { invoice:625, stage:4, due:'2026-10-24' }, { invoice:626, stage:5, due:'2026-10-25' },
    { invoice:627, stage:3, due:'2026-11-03', priority:'urgent' },
    { invoice:628, stage:2, due:'2026-11-05' },
    { source:3, stage:1, due:'2026-11-07' },
    { invoice:629, stage:6, due:'2026-11-08' },
    { invoice:633, stage:1, due:'2026-11-10', pending:true },
    { invoice:641, source:21, stage:4, due:'2026-11-12' },
    { source:10, stage:1, due:'2026-11-15', status:'cancelled' },
    { source:6, stage:1, due:'2026-11-17', status:'draft' }
  ];
  orderSeeds.forEach(function (seed, index) {
    var doc = seed.invoice ? invoiceRows.find(function (item) { return item.number === String(seed.invoice); }) : salesDocuments.find(function (item) { return item.id === seed.source; });
    var source = seed.source ? salesDocuments.find(function (item) { return item.id === seed.source; }) : null;
    var copied = salesDocumentItems.filter(function (item) { return item.sales_document_id === (source && !seed.invoice ? source.id : doc.id) && item.active !== false; });
    var id = index + 1, status = seed.status || (seed.stage === 7 ? 'completed' : 'active');
    var order = { id:id, number:status === 'draft' ? null : String(id), customer_id:doc.customer_id,
      source_document_id:source ? source.id : null, invoice_id:seed.invoice ? doc.id : null,
      order_date:'2026-10-22', due_date:seed.due, priority:seed.priority || 'normal',
      description:copied.map(function (item) { return item.description; }).join(', '), notes:'',
      created_by:doc.created_by, location_id:1, status:status, current_stage:orderStages[seed.stage-1].name,
      stage_id:seed.stage, cancellation_reason:status === 'cancelled' ? 'Customer withdrew the request.' : null,
      created_at:'2026-10-22T08:00:00+03:00' };
    orders.push(order);
    if (seed.invoice) doc.order_id = id;
    copied.forEach(function (item) { orderItems.push({ id:orderItems.length+1, order_id:id, description:item.description,
      size:item.size, quantity:item.quantity, unit:item.unit, unit_price:item.unit_price,
      created_at:'2026-10-22T08:00:00+03:00' }); });
    if (status !== 'draft') orderStageHistory.push({ id:orderStageHistory.length+1, order_id:id,
      stage_id:seed.stage, stage:order.current_stage, changed_by:seed.stage === 7 ? 3 : 6,
      changed_at:'2026-10-22T09:00:00+03:00', note:seed.stage === 7 ? 'All lines delivered.' : 'Seeded production position.' });
    if (seed.pending) approvals.push({ id:approvals.length+1, type:'order_stage', entity_type:'orders', entity_id:id,
      requested_by:6, approved_by:null, status:'requested', reason:'Production requested before deposit.',
      target_stage:'Cutting', created_at:'2026-10-22T10:00:00+03:00' });
  });

  // A-92: assumed illustrative rates, selected by garment and task on each log entry.
  var pieceRates = [
    ['Shirt','cut',900],['Shirt','sew',2400],['Shirt','finish',600],['Shirt','embroider',500],
    ['Trouser','cut',1100],['Trouser','sew',2600],['Trouser','finish',700],
    ['Skirt','cut',800],['Skirt','sew',2100],['Skirt','finish',600],
    ['Sweater','knit',3000],['Sweater','finish',800],['Sweater','embroider',500],
    ['Other garment','cut',1000],['Other garment','sew',2500],['Other garment','finish',700],
    ['Other garment','knit',3000],['Other garment','embroider',500]
  ].map(function (entry,index) { return {id:index+1,garment_type:entry[0],task:entry[1],rate:entry[2],assumed:true}; });
  var attendance = [], productionLogs = [], qualityIssues = [];
  // PRODUCT_VISION.md working hours: Monday to Saturday; two weeks omit Sunday.
  for (var dayNo=12;dayNo<=24;dayNo++) {
    var day='2026-10-'+String(dayNo).padStart(2,'0');
    if (dayNo===18) continue;
    employees.forEach(function (person) { attendance.push({id:attendance.length+1,employee_id:person.id,work_date:day,
      status:person.id===1&&dayNo===20?'late':person.id===2&&dayNo===21?'absent':person.id===3&&dayNo===22?'leave':'present'}); });
  }
  [
    ['2026-10-19',1,4,'Shirt','sew',8],['2026-10-20',1,4,'Shirt','sew',10],
    ['2026-10-21',2,8,'Trouser','sew',6],['2026-10-22',8,4,'Shirt','cut',12],
    ['2026-10-22',11,4,'Shirt','finish',7],['2026-10-23',16,3,'Other garment','embroider',4]
  ].forEach(function (entry) { var item=orderItems.find(function (row) { return row.order_id===entry[2]; });
    if (!item) return; var rate=pieceRates.find(function (row) { return row.garment_type===entry[3]&&row.task===entry[4]; });
    productionLogs.push({id:productionLogs.length+1,work_date:entry[0],employee_id:entry[1],order_item_id:item.id,
      garment_type:entry[3],task:entry[4],quantity:entry[5],piece_rate:rate.rate,amount:entry[5]*rate.rate});
  });
  qualityIssues.push({id:1,order_item_id:orderItems.find(function (row) { return row.order_id===4; }).id,
    employee_id:1,description:'Uneven seam needs rework.',rework_needed:true,logged_by:6,logged_at:'2026-10-22T15:00:00+03:00'});
  var productionTargets = ['cut','sew','finish','knit','embroider'].reduce(function (rows,section) {
    rows.push({id:rows.length+1,section:section,period:'daily',target_quantity:section==='sew'?15:10});
    rows.push({id:rows.length+1,section:section,period:'weekly',target_quantity:section==='sew'?75:50}); return rows;
  },[]);

  // MOCK_DATA_SPEC.md Phase 13 (A-69): six issued requests (one partly returned), one waiting and one rejected.
  // Add each seeded issue movement to the existing ledger and its matching location balance.
  var materialIssues = [], materialIssueItems = [];
  [3,4,5,6,7,8,9,10].forEach(function (orderId, index) {
    var issueId = index + 1, isIssued = index < 6, isPartial = index === 5;
    var status = isIssued ? 'issued' : index === 6 ? 'requested' : 'rejected';
    var stamp = '2026-10-' + String(23 + Math.floor(index / 2)).padStart(2,'0') + 'T09:00:00+03:00';
    var issue = {id:issueId, number:isIssued ? String(issueId) : null, order_id:orderId, location_id:1,
      status:status, requested_by:6, requested_at:stamp, issued_by:isIssued ? 3 : null,
      issued_at:isIssued ? stamp : null, decision_note:status === 'rejected' ? 'Fabric allocation needs review.' : '',
      notes:'Workshop material request.', created_at:stamp};
    var line = {id:issueId, material_issue_id:issueId, material_id:9 + index, quantity:2 + index,
      note:'For the assigned order.', returned_quantity:isPartial ? 2 : 0, created_at:stamp};
    materialIssues.push(issue); materialIssueItems.push(line);
    auditLogs.push(auditRow(auditLogs.length+1,6,'request','material_issues',issueId,null,issue,stamp));
    if (!isIssued) {
      if (status === 'rejected') auditLogs.push(auditRow(auditLogs.length+1,3,'rejected','material_issues',issueId,null,issue,stamp));
      return;
    }
    var stock = materialStock.find(function (item) { return item.material_id === line.material_id && item.location_id === issue.location_id; });
    var before = stock.quantity;
    stock.quantity -= line.quantity;
    stockMovements.push({id:movementId++, item_type:'material', item_id:line.material_id, location_id:issue.location_id,
      movement_type:'issue', quantity:-line.quantity, before_qty:before, after_qty:stock.quantity,
      reference_type:'material_issue', reference_id:issueId, user_id:3, note:'Material issue ' + issue.number, created_at:stamp});
    auditLogs.push(auditRow(auditLogs.length+1,3,'issue','material_issues',issueId,null,issue,stamp));
    if (isPartial) {
      var beforeReturn = stock.quantity;
      stock.quantity += line.returned_quantity;
      stockMovements.push({id:movementId++, item_type:'material', item_id:line.material_id, location_id:issue.location_id,
        movement_type:'issue_return', quantity:line.returned_quantity, before_qty:beforeReturn, after_qty:stock.quantity,
        reference_type:'material_issue_return', reference_id:line.id, user_id:3, note:'Return for material issue ' + issue.number, created_at:stamp});
      auditLogs.push(auditRow(auditLogs.length+1,3,'return','material_issues',issueId,null,{item_id:line.id,quantity:line.returned_quantity},stamp));
    }
  });
  documentSequences.find(function (item) { return item.document_type === 'material_issue'; }).next_number = 7;

  // Phase 14 (A-73 to A-78): variant balances agree with opening and quick-sale movements.
  var productSeeds = [
    ['White School Shirt','school',35000],['Navy School Shorts','school',30000],
    ['School Pleated Skirt','school',38000],['Grey School Trousers','school',42000],
    ['Maroon School Sweater','sweater',55000],['Corporate Polo Shirt','corporate',45000],
    ['Industrial Overall','industrial',75000],['Hospitality Apron','hospitality',32000],
    ['Medical Scrub Top','medical',40000]
  ];
  var products = productSeeds.map(function (seed,index) { return {id:index+1,name:seed[0],garment_type:seed[0].toLowerCase().replace(/ /g,'_'),category:seed[1],price:seed[2],active:true}; });
  var variantSeeds = [
    [1,'28','White',1,42,60],[1,'30','White',1,18,60],[2,'28','Navy',1,24,50],
    [3,'30','Navy',1,6,40],[4,'32','Grey',1,0,40],[5,'M','Maroon',1,13,40],
    [6,'L','Royal blue',1,15,40],[7,'XL','Navy',1,4,30],[8,'One size','Black',1,11,35],
    [9,'M','Teal',2,16,40],[5,'L','Maroon',2,3,30],[1,'32','White',2,0,40]
  ];
  var productVariants = variantSeeds.map(function (seed,index) { return {id:index+1,product_id:seed[0],size:seed[1],colour:seed[2],location_id:seed[3],quantity:seed[4],full_stock_level:seed[5]}; });
  productVariants.forEach(function (variant) {
    if (!variant.quantity) return;
    stockMovements.push({id:movementId++,item_type:'product_variant',item_id:variant.id,location_id:variant.location_id,
      movement_type:'opening',quantity:variant.quantity,before_qty:0,after_qty:variant.quantity,
      reference_type:'opening_balance',reference_id:null,user_id:1,note:'Opening ready-made stock.',created_at:'2026-07-01T08:00:00+03:00'});
  });
  var quickSales = [], quickSaleItems = [];
  var quickSeeds = [
    ['2026-10-19',4,'cash','',[[1,2],[2,1]]],
    ['2026-10-20',5,'mtn','MTN26102001',[[1,1],[6,1]]],
    ['2026-10-22',4,'cash','',[[3,1]]],
    ['2026-10-24',2,'bank','BNK26102401',[[7,1],[8,1]]],
    ['2026-10-25',5,'airtel','ATL26102501',[[2,2]]],
    ['2026-10-26',4,'cash','',[[1,1],[9,1]]],
    ['2026-10-27',5,'cash','',[[6,1],[3,1]]]
  ];
  quickSeeds.forEach(function (seed,index) {
    var saleId=index+1, date=seed[0], cashier=seed[1], number=String(2074+index), lines=[];
    seed[4].forEach(function (part) { var variant=productVariants[part[0]-1], product=products[variant.product_id-1];
      lines.push({id:quickSaleItems.length+1,quick_sale_id:saleId,product_variant_id:variant.id,description:product.name,
        size:variant.size,colour:variant.colour,quantity:part[1],unit_price:product.price,amount:part[1]*product.price});
      quickSaleItems.push(lines[lines.length-1]);
    });
    var amounts=window.GT.calc.calcTotals(lines,0,18), receiptId=receipts.length+1;
    var paper={id:receiptId,number:number,customer_id:null,customer_name:'Walk-in customer',invoice_id:null,
      amount:amounts.total,payment_method:seed[2],reference:seed[3],description:'Quick sale '+saleId,balance_after:0,
      received_by:cashier,received_at:date+'T12:00:00+03:00',status:'issued',void_reason:null,voided_by:null,voided_at:null};
    receipts.push(paper);
    quickSales.push({id:saleId,receipt_id:receiptId,location_id:1,cashier_id:cashier,sale_date:date,status:'issued',
      subtotal:amounts.subtotal,discount_amount:0,discount_reason:'',discount_status:'none',vat_rate:18,vat_amount:amounts.vat,total:amounts.total,
      payment_method:seed[2],reference:seed[3],amount_received:amounts.total,change_due:0,void_reason:null,voided_by:null,voided_at:null});
    lines.forEach(function (line) { var variant=productVariants[line.product_variant_id-1], before=variant.quantity;
      variant.quantity-=line.quantity;
      stockMovements.push({id:movementId++,item_type:'product_variant',item_id:variant.id,location_id:variant.location_id,
        movement_type:'sale',quantity:-line.quantity,before_qty:before,after_qty:variant.quantity,
        reference_type:'quick_sale',reference_id:saleId,user_id:cashier,note:'Quick sale receipt '+number,created_at:date+'T12:00:00+03:00'});
    });
  });
  documentSequences.find(function (item) { return item.document_type === 'receipt'; }).next_number=2081;
  // Existing Phase 8 and Phase 14 collections flow into the same cash book as expenses (A-85).
  receipts.filter(function (row) { return row.status !== 'void'; }).forEach(function (row) {
    seedLedger(row.received_at.slice(0,10),row.payment_method,Number(row.amount),'receipt',row.id,'Receipt '+row.number,false);
  });
  expenses.forEach(function (row) {
    if (row.status === 'approved' || row.status === 'cancelled') seedLedger(row.expense_date,row.payment_method,row.amount,'expense',row.id,'Voucher '+row.voucher_number,false);
    if (row.status === 'cancelled') seedLedger(row.expense_date,row.payment_method,row.amount,'expense',row.id,'Cancel voucher '+row.voucher_number,true);
  });
  var finishedGoodAdjustments=[{id:1,product_variant_id:4,direction:'increase',quantity:4,reason:'Counted four extra skirts on shelf.',
    status:'pending',requested_by:3,requested_at:'2026-10-26T10:00:00+03:00',decided_by:null,decided_at:null,decision_note:'',movement_id:null}];
  approvals.push({id:approvals.length+1,type:'stock_adjustment',entity_type:'finished_good_adjustments',entity_id:1,
    requested_by:3,approved_by:null,status:'pending',reason:finishedGoodAdjustments[0].reason,created_at:finishedGoodAdjustments[0].requested_at});

  // BUSINESS_RULES.md section 10 / A-06: only the large sleeved shirt example is owner-supplied.
  var designs = [
    {id:1,name:'Sleeved school shirt',garment_type:'shirt'},
    {id:2,name:'School trousers',garment_type:'trousers'},
    {id:3,name:'School skirt',garment_type:'skirt'},
    {id:4,name:'School sweater',garment_type:'sweater'}
  ];
  var baseExamples = [[1,'Small',1.2],[1,'Medium',1.35],[1,'Large',1.5],
    [2,'Small',1.4],[2,'Medium',1.6],[2,'Large',1.8],
    [3,'Small',1.1],[3,'Medium',1.25],[3,'Large',1.4],
    [4,'Small',1.3],[4,'Medium',1.5],[4,'Large',1.7]];
  var fabricRules = baseExamples.map(function (row,index) { return {
    id:index+1,design_id:row[0],size:row[1],reference_width_inches:60,
    base_metres:row[2],source:index===2?'Owner example':'ASSUMED illustration'
  }; });
  var fabricWidthAdjustments = [
    {id:1,reference_width_inches:60,width_inches:44,adjustment_metres:0.3,source:'ASSUMED illustration'},
    {id:2,reference_width_inches:60,width_inches:58,adjustment_metres:0.05,source:'ASSUMED illustration'},
    {id:3,reference_width_inches:60,width_inches:60,adjustment_metres:0,source:'Owner example'}
  ];
  var fabricRuleAdjustments = [
    {id:1,design_id:1,option_name:'Long sleeves',extra_metres:0.2,source:'ASSUMED illustration'},
    {id:2,design_id:2,option_name:'Extra panels',extra_metres:0.15,source:'ASSUMED illustration'},
    {id:3,design_id:3,option_name:'Pleats',extra_metres:0.2,source:'ASSUMED illustration'},
    {id:4,design_id:3,option_name:'Lining',extra_metres:0.25,source:'ASSUMED illustration'}
  ];
  var fabricWastageRules = [
    {id:1,design_id:1,wastage_metres:0.1,source:'Owner example'},
    {id:2,design_id:2,wastage_metres:0.12,source:'ASSUMED illustration'},
    {id:3,design_id:3,wastage_metres:0.1,source:'ASSUMED illustration'},
    {id:4,design_id:4,wastage_metres:0.12,source:'ASSUMED illustration'}
  ];
  var fabricMarkupRules = [{id:1,markup_percent:30,source:'ASSUMED illustration'}];

  // A-111: fictional signup dates cannot follow the customer's earliest seeded document.
  customers.forEach(function (client) {
    var dates = salesDocuments.filter(function (doc) { return doc.customer_id === client.id; }).map(function (doc) { return doc.issue_date; }).sort();
    if (dates.length && client.created_at.slice(0,10) > dates[0]) client.created_at = window.GT.dates.addDays(dates[0],-1) + 'T09:00:00+03:00';
  });
  // MOCK_DATA_SPEC.md: four fictional campaigns, two each year; budgets never seed expense postings.
  var campaigns = [
    {id:1,name:'School uniform preview',type:'promotion',channel:'WhatsApp',start_date:'2025-01-08',end_date:'2025-01-22',budget:350000,target_audience:'School administrators',status:'Finished',notes:'Preview of uniform samples.',leads_gained:18,orders_won:4,sales_value:2800000,result_notes:'Four sample requests became orders.'},
    {id:2,name:'Community trade exhibition',type:'exhibition',channel:'Exhibition',start_date:'2025-07-10',end_date:'2025-07-12',budget:800000,target_audience:'Local schools and businesses',status:'Finished',notes:'Uniform display stand.',leads_gained:27,orders_won:5,sales_value:4200000,result_notes:'Follow-up completed.'},
    {id:3,name:'October referral drive',type:'referral_drive',channel:'Referral',start_date:'2026-10-15',end_date:'2026-10-31',budget:200000,target_audience:'Existing school customers',status:'Running',notes:'Invite customers to introduce another school.',leads_gained:8,orders_won:2,sales_value:1600000,result_notes:'Results entered so far.'},
    {id:4,name:'New term social campaign',type:'social_media',channel:'Facebook',start_date:'2026-11-01',end_date:'2026-11-20',budget:450000,target_audience:'Parents and school buyers',status:'Planned',notes:'Prepare photographs of the new range.',leads_gained:0,orders_won:0,sales_value:0,result_notes:''}
  ].map(function (row) { return Object.assign(row,{message_ids:[],poster_ids:[],created_by:8}); });

  return {
    version: '20.0.1',
    seededAt: '2026-10-22T08:00:00+03:00',
    tables: {
      roles: roles,
      users: users,
      locations: locations,
      business_settings: businessSettings,
      document_sequences: documentSequences,
      audit_logs: auditLogs,
      approvals: approvals,
      sales_documents: salesDocuments,
      sales_document_items: salesDocumentItems,
      receipts: receipts,
      quick_sales: quickSales,
      quick_sale_items: quickSaleItems,
      delivery_notes: deliveryNotes,
      delivery_note_items: deliveryNoteItems,
      statements: statements,
      debt_reminders: debtReminders,
      customer_groups: customerGroups,
      customers: customers,
      suppliers: suppliers,
      materials: materials,
      material_stock: materialStock,
      products: products,
      product_variants: productVariants,
      finished_good_adjustments: finishedGoodAdjustments,
      stock_movements: stockMovements,
      material_issues: materialIssues,
      material_issue_items: materialIssueItems,
      stock_adjustments: stockAdjustments,
      goods_received_notes: goodsReceivedNotes,
      grn_items: grnItems,
      employees: employees,
      attendance: attendance,
      production_logs: productionLogs,
      quality_issues: qualityIssues,
      production_targets: productionTargets,
      piece_rates: pieceRates,
      order_stages: orderStages,
      designs: designs,
      fabric_rules: fabricRules,
      fabric_width_adjustments: fabricWidthAdjustments,
      fabric_rule_adjustments: fabricRuleAdjustments,
      fabric_wastage_rules: fabricWastageRules,
      fabric_markup_rules: fabricMarkupRules,
      fabric_calculations: [],
      orders: orders,
      order_items: orderItems,
      order_stage_history: orderStageHistory,
      expense_categories: expenseCategories,
      expenses: expenses,
      ledger_entries: ledgerEntries,
      lead_sources: leadSources,
      campaigns: campaigns,
      sales_targets: [{id:1,user_id:4,month:'2026-10',target_amount:45000000},{id:2,user_id:5,month:'2026-10',target_amount:30000000}],
      sales_target_history: [{id:1,sales_target_id:1,user_id:4,month:'2026-10',previous_amount:null,target_amount:45000000,changed_by:1,changed_at:'2026-10-01T09:00:00+03:00'},
        {id:2,sales_target_id:2,user_id:5,month:'2026-10',previous_amount:null,target_amount:30000000,changed_by:1,changed_at:'2026-10-01T09:05:00+03:00'}],
      message_templates: messageTemplates,
      messages: messages,
      accounts: accounts
    }
  };
}());


