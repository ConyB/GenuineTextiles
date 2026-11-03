/* Active material picker options shared by later inventory and production modules. */
window.GT = window.GT || {};
window.GT.materials = {
  options: function () {
    return window.GT.store.where('materials', { active: true }).sort(function (a, b) { return a.name.localeCompare(b.name); })
      .map(function (material) { return { value: material.id, label: material.name }; });
  }
};
