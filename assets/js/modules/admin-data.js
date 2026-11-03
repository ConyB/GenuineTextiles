/* Owner-only Phase 2 proof screens for browsing and resetting the fake database. */
window.GT.adminData = (function () {
  var browserTable = null;

  function escapeText(value) {
    var element = document.createElement('div');
    element.textContent = value;
    return element.innerHTML;
  }

  function displayValue(value) {
    var text = value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value === null || value === undefined ? '' : value);
    return text.length > 120 ? text.slice(0, 117) + '...' : text;
  }

  function tableList() {
    return window.GT.schema.tables.map(function (table) {
      return '<button class="data-table-button" type="button" data-table-name="' + table.name + '"><span>' + escapeText(table.label) + '</span><strong>' + window.GT.store.count(table.name) + '</strong></button>';
    }).join('');
  }

  function showRows(name) {
    var info = window.GT.schema.find(name);
    var rows = window.GT.store.all(name).slice(0, 20);
    var results = document.getElementById('dataBrowserRows');
    browserTable = null;
    if (!info) { results.innerHTML = '<p class="empty-state">Choose a table to inspect.</p>'; return; }
    if (!rows.length) { results.innerHTML = '<div class="data-browser-heading"><h2>' + escapeText(info.label) + '</h2><span>0 rows</span></div><p class="empty-state">This table exists and is currently empty.</p>'; return; }
    var columns = [];
    rows.forEach(function (row) { Object.keys(row).forEach(function (column) { if (columns.indexOf(column) === -1) columns.push(column); }); });
    var heading = '<div class="data-browser-heading"><h2>' + escapeText(info.label) + '</h2><span>Showing ' + rows.length + ' of ' + window.GT.store.count(name) + ' rows</span></div>';
    results.innerHTML = heading + '<div id="dataBrowserTableMount"></div>';
    browserTable = window.GT.dataTable.create({
      id: 'dataBrowserSharedTable',
      caption: info.label + ' data',
      rows: rows,
      searchFields: columns,
      searchPlaceholder: 'Search rows',
      exportName: 'genuine-textiles-' + name + '.csv',
      columns: columns.map(function (column, index) {
        var numeric = rows.some(function (row) { return typeof row[column] === 'number'; });
        return {
          label: column,
          field: column,
          sortable: true,
          align: numeric ? 'right' : 'left',
          numeric: numeric,
          // Keep identifiers visible; progressively hide later raw fields on smaller screens.
          priority: index === 0 ? 1 : (index < 5 ? 2 : 3),
          formatter: displayValue
        };
      })
    });
    browserTable.mount('#dataBrowserTableMount');
  }

  function renderDataBrowser() {
    return '<section class="admin-data-page"><div class="page-heading"><div><h1>Data Browser <small>(prototype only)</small></h1><p>Every table defined in DATABASE_DESIGN.md is available here. Select one to preview up to 20 rows.</p></div><span class="badge text-bg-light border">Seed ' + escapeText(window.GT.store.version) + '</span></div><div class="data-browser-layout"><nav class="data-table-list" aria-label="Database tables">' + tableList() + '</nav><section class="data-browser-results" id="dataBrowserRows" aria-live="polite"><p class="empty-state">Choose a table to inspect its seed data.</p></section></div></section>';
  }

  function renderReset() {
    return '<section class="page-placeholder admin-reset-page"><h1>Reset Demo Data</h1><p>Restore all prototype tables to seed version ' + escapeText(window.GT.store.version) + '. Any records created while testing will be removed.</p><button class="btn btn-primary" id="resetDemoData" type="button"><i data-lucide="rotate-ccw" aria-hidden="true"></i> Reset demo data</button></section>';
  }

  function bindDataBrowser() {
    document.querySelectorAll('[data-table-name]').forEach(function (button) {
      button.addEventListener('click', function () {
        document.querySelectorAll('[data-table-name]').forEach(function (item) { item.classList.remove('active'); });
        button.classList.add('active');
        showRows(button.dataset.tableName);
      });
    });
  }

  function bindReset() {
    document.getElementById('resetDemoData').addEventListener('click', function () {
      window.GT.components.confirmDialog({ title: 'Reset all demo data?', message: 'This removes prototype changes and restores the current reference seed.', confirmText: 'Reset demo data' }).then(function (confirmed) {
        if (!confirmed) return;
        window.GT.store.reset();
        window.location.href = 'index.html?demo_reset=1#/admin/reset-demo-data';
      });
    });
  }

  function handles(route) {
    return route === '#/admin/data-browser' || route === '#/admin/reset-demo-data';
  }

  function render(route) {
    return route === '#/admin/data-browser' ? renderDataBrowser() : renderReset();
  }

  function bind(route) {
    if (route === '#/admin/data-browser') bindDataBrowser();
    else bindReset();
  }

  return { handles: handles, render: render, bind: bind };
}());
