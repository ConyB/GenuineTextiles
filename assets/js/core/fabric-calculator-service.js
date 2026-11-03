/* BUSINESS_RULES.md section 10: table-driven Owner-only fabric estimates. */
window.GT.fabricCalculator = (function () {
  var GT = window.GT;
  var ruleTables = ['fabric_rules', 'fabric_width_adjustments', 'fabric_rule_adjustments', 'fabric_wastage_rules', 'fabric_markup_rules'];

  function owner() { return GT.session.currentUser() && GT.session.currentUser().role === 'owner'; }
  function requireOwner() { if (!owner()) throw new Error('Fabric calculator is Owner only.'); }
  function metres(value) { return Number(Number(value).toFixed(3)); }
  function designs() { requireOwner(); return GT.store.all('designs'); }
  function fabrics() { requireOwner(); return GT.store.where('materials', function (row) { return row.category === 'fabric' && row.active; }); }
  function rules(table) { requireOwner(); if (ruleTables.indexOf(table) < 0) throw new Error('Unknown calculator rule.'); return GT.store.all(table); }

  // Step 1: use the explicit design/size row at its reference width (A-06).
  function baseFor(designId, size) {
    return GT.store.where('fabric_rules', function (row) { return row.design_id === Number(designId) && row.size === size; })[0] || null;
  }
  // Step 2: lookup a visible, editable metre adjustment. No width formula is inferred (A-06, A-96).
  function widthFor(referenceWidth, width) {
    return GT.store.where('fabric_width_adjustments', function (row) {
      return row.reference_width_inches === Number(referenceWidth) && row.width_inches === Number(width);
    })[0] || null;
  }
  // Step 3: selected add-ons are metres per piece (A-06, A-97).
  function styleTotal(designId, optionIds) {
    var options = GT.store.where('fabric_rule_adjustments', function (row) { return row.design_id === Number(designId); });
    var chosen = (optionIds || []).map(Number);
    if (chosen.some(function (id) { return !options.some(function (row) { return row.id === id; }); })) throw new Error('Choose style options for the selected design.');
    return metres(options.filter(function (row) { return chosen.indexOf(row.id) >= 0; }).reduce(function (sum, row) { return sum + Number(row.extra_metres); }, 0));
  }
  // Step 4: one wastage row for the design (A-06).
  function wastageFor(designId) {
    return GT.store.where('fabric_wastage_rules', function (row) { return row.design_id === Number(designId); })[0] || null;
  }
  // Step 5: multiply the completed per-piece length by whole-piece quantity (A-06).
  function totalFor(perPiece, quantity) { return metres(perPiece * quantity); }
  // Steps 6-7: round the monetary result to a whole UGX; percentage is an editable placeholder (A-06, A-98).
  function costFor(totalMetres, costPerMetre) { return Math.round(totalMetres * costPerMetre); }
  function priceFor(cost, markupPercent) { return Math.round(cost * (1 + markupPercent / 100)); }

  function calculate(input) {
    requireOwner();
    var design = GT.store.find('designs', input.design_id);
    var base = baseFor(input.design_id, input.size);
    var quantity = Number(input.quantity);
    var width = Number(input.width_inches);
    if (!design || !base) throw new Error('Choose a design and size with a base rule.');
    if (!Number.isInteger(quantity) || quantity < 1) throw new Error('Quantity must be a whole number above zero.');
    var fabric = input.fabric_id ? GT.store.find('materials', input.fabric_id) : null;
    if (input.fabric_id && (!fabric || !fabric.active || fabric.category !== 'fabric')) throw new Error('Choose an active fabric.');
    if (fabric && Number(fabric.width_inches) !== width) throw new Error('The chosen width must match the selected fabric.');
    var widthRule = widthFor(base.reference_width_inches, width);
    var wastage = wastageFor(design.id);
    var markup = GT.store.all('fabric_markup_rules')[0];
    if (!widthRule) throw new Error('No width adjustment is defined for this width.');
    if (!wastage || !markup) throw new Error('A wastage or markup rule is missing.');
    var styles = styleTotal(design.id, input.option_ids);
    var perPiece = metres(Number(base.base_metres) + Number(widthRule.adjustment_metres) + styles + Number(wastage.wastage_metres));
    if (perPiece <= 0) throw new Error('The rule combination must give metres above zero.');
    var total = totalFor(perPiece, quantity);
    // A-100: until a location is confirmed, availability reads total metres at both locations.
    var stock = fabric ? metres(GT.inventory.totalStock(fabric.id)) : null;
    var cost = fabric ? costFor(total, Number(fabric.cost_per_unit)) : null;
    return { design:design, size:input.size, reference_width_inches:Number(base.reference_width_inches), width_inches:width, quantity:quantity, fabric:fabric,
      base_metres:Number(base.base_metres), width_adjustment_metres:Number(widthRule.adjustment_metres),
      style_metres:styles, wastage_metres:Number(wastage.wastage_metres), metres_per_piece:perPiece,
      total_metres:total, on_hand_metres:stock, stock_enough:fabric ? stock >= total : null,
      material_cost:cost, markup_percent:Number(markup.markup_percent), suggested_price:fabric ? priceFor(cost, Number(markup.markup_percent)) : null };
  }

  function saveRule(table, id, changes) {
    requireOwner();
    if (ruleTables.indexOf(table) < 0) throw new Error('Unknown calculator rule.');
    var old = GT.store.find(table, id);
    if (!old) throw new Error('Rule not found.');
    var field = {fabric_rules:'base_metres',fabric_width_adjustments:'adjustment_metres',fabric_rule_adjustments:'extra_metres',fabric_wastage_rules:'wastage_metres',fabric_markup_rules:'markup_percent'}[table];
    var value = Number(changes[field]);
    if (!Number.isFinite(value) || (field !== 'adjustment_metres' && value < 0) || (field === 'base_metres' && value === 0))
      throw new Error('Enter a valid rule value. Base metres must be above zero.');
    if (field !== 'markup_percent' && Math.round(value * 1000) !== value * 1000) throw new Error('Metres may have at most three decimal places.');
    if (field === 'markup_percent' && Math.round(value * 100) !== value * 100) throw new Error('Markup may have at most two decimal places.');
    // A changed owner example is no longer the exact value supplied by the owner (A-06).
    var source = value === Number(old[field]) ? old.source : 'ASSUMED illustration';
    var saved = GT.store.update(table, id, { [field]:value, source:source });
    GT.audit.log('update', table, id, old, saved);
    return saved;
  }

  function saveNote(input, result) {
    requireOwner();
    var note = String(input.note || '').trim();
    if (!note) throw new Error('Enter a note before saving this calculation.');
    var row = GT.store.create('fabric_calculations', {
      design_id:result.design.id, size:result.size, fabric_id:result.fabric ? result.fabric.id : null,
      width_inches:result.width_inches, option_ids:(input.option_ids || []).map(Number), quantity:result.quantity,
      metres_per_piece:result.metres_per_piece, total_metres:result.total_metres,
      material_cost:result.material_cost, suggested_price:result.suggested_price,
      note:note, created_by:GT.session.currentUser().id
    });
    GT.audit.log('create','fabric_calculations',row.id,null,row);
    return row;
  }

  function notes() { requireOwner(); return GT.store.all('fabric_calculations'); }
  return { designs:designs, fabrics:fabrics, rules:rules, calculate:calculate, saveRule:saveRule, saveNote:saveNote, notes:notes,
    baseFor:baseFor, widthFor:widthFor, styleTotal:styleTotal, wastageFor:wastageFor, totalFor:totalFor, costFor:costFor, priceFor:priceFor };
}());
