/* Shared, side-effect-free field validators for forms across modules. */
window.GT = window.GT || {};
window.GT.validate = (function () {
  function compactPhone(value) { return String(value || '').replace(/\s/g, ''); }
  return {
    required: function (value) { return Array.isArray(value) ? value.length > 0 : String(value === null || value === undefined ? '' : value).trim().length > 0; },
    ugandanPhone: function (value) { return /^(?:\+2567\d{8}|07\d{8})$/.test(compactPhone(value)); },
    internationalPhone: function (value) { return /^\+\d{8,15}$/.test(compactPhone(value)); },
    email: function (value) { return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim()); },
    positiveInteger: function (value) { return /^\d+$/.test(String(value)) && Number(value) > 0; },
    uniqueName: function (table, value, ignoredId, field) {
      var name = String(value || '').trim().toLowerCase();
      var column = field || 'name';
      if (!name) return true;
      return !window.GT.store.all(table).some(function (record) {
        return Number(record.id) !== Number(ignoredId) && String(record[column] || '').trim().toLowerCase() === name;
      });
    }
  };
}());
