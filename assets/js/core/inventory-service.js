/* BUSINESS_RULES.md section 6: this is the only runtime service allowed to change material_stock. */
window.GT = window.GT || {};
window.GT.inventory = (function () {
  var LOW_STOCK_RATIO = 0.25;
  var CATEGORIES = ['fabric', 'yarn', 'thread', 'accessory', 'packaging'];
  var FABRIC_TYPES = ['cotton', 'polyester', 'drill', 'wax print', 'silk', 'rain-coat fabric', 'knit'];
  var ACCESSORY_SUBTYPES = ['buttons', 'zips', 'lining', 'interfacing', 'elastic', 'labels'];
  var UNITS = ['metre', 'cone', 'packet', 'piece'];
  var MOVEMENT_TYPES = ['opening', 'grn', 'issue', 'issue_return', 'sale', 'return', 'adjustment'];

  function number(value) { return Number(value) || 0; }
  function tidy(value) { return Number(value.toFixed(3)).toLocaleString('en-US', { maximumFractionDigits: 3 }); }

  function getStock(materialId, locationId) {
    var row = window.GT.store.where('material_stock', function (item) {
      return Number(item.material_id) === Number(materialId) && Number(item.location_id) === Number(locationId);
    })[0];
    return row ? number(row.quantity) : 0;
  }

  function totalStock(materialId) {
    return window.GT.store.where('material_stock', function (row) { return Number(row.material_id) === Number(materialId); })
      .reduce(function (total, row) { return total + number(row.quantity); }, 0);
  }

  function statusForQuantity(material, quantity) {
    if (number(quantity) === 0) return 'out';
    if (!number(material.full_stock_level)) return 'ok';
    return number(quantity) <= number(material.full_stock_level) * LOW_STOCK_RATIO ? 'low' : 'ok';
  }

  function status(material) { return statusForQuantity(material, totalStock(material.id)); }
  function statusAtLocation(material, locationId) { return statusForQuantity(material, getStock(material.id, locationId)); }

  function unitLabel(unit, quantity) {
    if (unit === 'metre') return 'm';
    if (unit === 'cone') return Number(quantity) === 1 ? 'cone' : 'cones';
    if (unit === 'packet') return Number(quantity) === 1 ? 'packet' : 'packets';
    if (unit === 'piece') return Number(quantity) === 1 ? 'piece' : 'pieces';
    return unit || '';
  }

  function formatQuantity(material, quantity) {
    var amount = number(quantity);
    if (material.category === 'fabric' && number(material.roll_length_m) > 0) {
      var rolls = Math.floor(amount / number(material.roll_length_m));
      var loose = amount - (rolls * number(material.roll_length_m));
      if (rolls > 0) return rolls + (rolls === 1 ? ' roll' : ' rolls') + (loose ? ' + ' + tidy(loose) + ' m' : '') + ' (' + tidy(amount) + ' m)';
    }
    return tidy(amount) + ' ' + unitLabel(material.unit, amount);
  }

  function recordMovement(input) {
    var material = window.GT.store.find('materials', input.materialId);
    if (!material) throw new Error('Material not found.');
    if (MOVEMENT_TYPES.indexOf(input.type) === -1) throw new Error('Unknown stock movement type.');
    if (!material.active && input.type !== 'adjustment') throw new Error('Inactive materials can only receive an approved adjustment.');
    var quantity = Number(input.quantity);
    if (!Number.isFinite(quantity) || quantity === 0) throw new Error('Movement quantity must be a signed non-zero number.');
    var location = window.GT.store.find('locations', input.locationId);
    if (!location) throw new Error('Location not found.');
    var stockRow = window.GT.store.where('material_stock', function (row) {
      return Number(row.material_id) === Number(material.id) && Number(row.location_id) === Number(location.id);
    })[0];
    var before = stockRow ? number(stockRow.quantity) : 0;
    var after = before + quantity;
    if (after < 0) throw new Error('Stock cannot go below zero.');
    var user = window.GT.session.currentUser();
    var movement = window.GT.store.create('stock_movements', {
      item_type: 'material', item_id: material.id, location_id: location.id,
      movement_type: input.type, quantity: quantity, before_qty: before, after_qty: after,
      reference_type: input.referenceType || null, reference_id: input.referenceId || null,
      user_id: user ? user.id : null, note: String(input.note || '').trim()
    });
    if (stockRow) window.GT.store.update('material_stock', stockRow.id, { quantity: after });
    else window.GT.store.create('material_stock', { material_id: material.id, location_id: location.id, quantity: after });
    window.GT.audit.log('create', 'stock_movements', movement.id, null, movement);
    window.dispatchEvent(new CustomEvent('gt:stock-changed', { detail:{ materialId:material.id, locationId:location.id } }));
    return movement;
  }

  function lowStockItems() {
    return window.GT.store.where('materials', { active: true }).map(function (material) {
      var quantity = totalStock(material.id);
      var materialStatus = statusForQuantity(material, quantity);
      var percentage = number(material.full_stock_level) ? (quantity / number(material.full_stock_level)) * 100 : 100;
      return Object.assign({}, material, { stock_quantity: quantity, stock_status: materialStatus, percentage_left: percentage });
    }).filter(function (material) { return material.stock_status === 'low' || material.stock_status === 'out'; })
      .sort(function (left, right) { return left.percentage_left - right.percentage_left || left.name.localeCompare(right.name); });
  }

  return {
    LOW_STOCK_RATIO: LOW_STOCK_RATIO, CATEGORIES: CATEGORIES, FABRIC_TYPES: FABRIC_TYPES,
    ACCESSORY_SUBTYPES: ACCESSORY_SUBTYPES, UNITS: UNITS, MOVEMENT_TYPES: MOVEMENT_TYPES,
    getStock: getStock, totalStock: totalStock, status: status, statusAtLocation: statusAtLocation, unitLabel: unitLabel,
    formatQuantity: formatQuantity, recordMovement: recordMovement, lowStockItems: lowStockItems
  };
}());
