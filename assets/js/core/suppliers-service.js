/* Active supplier picker options for later purchasing and inventory modules. */
window.GT = window.GT || {};
window.GT.suppliers = {
  options: function () {
    return window.GT.store.where('suppliers', { active: true }).sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (supplier) { return { value: supplier.id, label: supplier.name }; });
  }
};
