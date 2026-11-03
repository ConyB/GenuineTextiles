/* Configuration-driven list pattern shared by Customers and later register pages. */
window.GT = window.GT || {};
window.GT.dataTable = (function () {
  var sequence = 0;
  var actionMenu = null;
  var actionMenuOwner = null;
  var ignoreOpeningScrollUntil = 0;

  function escapeHtml(value) {
    var element = document.createElement('div');
    element.textContent = value === null || value === undefined ? '' : String(value);
    return element.innerHTML;
  }

  function csvCell(value) {
    return '"' + String(value === null || value === undefined ? '' : value).replace(/"/g, '""') + '"';
  }

  function columnAlign(column) {
    return ['left', 'right', 'center'].indexOf(column.align) !== -1 ? column.align : 'left';
  }

  function columnClasses(column) {
    var priority = [1, 2, 3].indexOf(Number(column.priority)) === -1 ? 1 : Number(column.priority);
    // Text wraps by default so optional columns never force the whole table wider.
    return 'table-align-' + columnAlign(column) + ' table-priority-' + priority + (column.numeric ? ' table-numeric' : '') + (column.wrap === false ? ' table-nowrap' : ' table-wrap');
  }

  function columnStyle(column) {
    if (!column.minWidth) return '';
    var width = typeof column.minWidth === 'number' ? column.minWidth + 'px' : column.minWidth;
    return ' style="min-width:' + escapeHtml(width) + '"';
  }

  function ensureActionMenu() {
    if (actionMenu) return actionMenu;
    actionMenu = document.createElement('div');
    actionMenu.id = 'gtTableActionMenu';
    actionMenu.className = 'table-action-menu';
    actionMenu.setAttribute('role', 'menu');
    actionMenu.hidden = true;
    document.body.appendChild(actionMenu);
    actionMenu.addEventListener('click', function (event) {
      var item = event.target.closest('[data-menu-action]');
      if (!item || item.disabled || !actionMenuOwner) return;
      var owner = actionMenuOwner;
      var action = owner.actions.find(function (entry) { return entry.index === Number(item.dataset.menuAction); });
      closeActionMenu(false);
      if (action) action.action.onClick(owner.row, owner.api);
    });
    actionMenu.addEventListener('keydown', function (event) {
      var items = Array.from(actionMenu.querySelectorAll('[role="menuitem"]:not(:disabled)'));
      if (event.key === 'Escape') { event.preventDefault(); closeActionMenu(true); return; }
      if (!items.length || ['ArrowDown', 'ArrowUp', 'Home', 'End'].indexOf(event.key) === -1) return;
      event.preventDefault();
      var current = items.indexOf(document.activeElement);
      if (event.key === 'Home') current = 0;
      else if (event.key === 'End') current = items.length - 1;
      else if (event.key === 'ArrowDown') current = current < 0 || current === items.length - 1 ? 0 : current + 1;
      else current = current <= 0 ? items.length - 1 : current - 1;
      items[current].focus();
    });
    document.addEventListener('pointerdown', function (event) {
      if (!actionMenuOwner || actionMenu.contains(event.target) || event.target.closest('[data-action-menu-toggle]')) return;
      closeActionMenu(false);
    });
    document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && actionMenuOwner) { event.preventDefault(); closeActionMenu(true); } });
    window.addEventListener('scroll', function () {
      if (actionMenuOwner && performance.now() >= ignoreOpeningScrollUntil) closeActionMenu(false);
    }, true);
    window.addEventListener('resize', function () { if (actionMenuOwner) closeActionMenu(false); });
    return actionMenu;
  }

  function closeActionMenu(returnFocus) {
    if (!actionMenuOwner) return;
    var button = actionMenuOwner.button;
    button.setAttribute('aria-expanded', 'false');
    actionMenu.hidden = true;
    actionMenu.innerHTML = '';
    actionMenuOwner = null;
    if (returnFocus && button.isConnected) button.focus({ preventScroll: true });
  }

  function actionDisabledReason(action, row) {
    var reason = typeof action.disabledReason === 'function' ? action.disabledReason(row) : action.disabledReason;
    if (reason) return String(reason);
    var legacyDisabled = typeof action.disabled === 'function' ? action.disabled(row) : action.disabled;
    if (legacyDisabled) return String((typeof action.title === 'function' ? action.title(row) : action.title) || action.label + ' is unavailable');
    return '';
  }

  function actionTitle(action, row) {
    return actionDisabledReason(action, row) || String((typeof action.title === 'function' ? action.title(row) : action.title) || action.label);
  }

  function menuItemMarkup(item, row) {
    var action = item.action;
    var reason = actionDisabledReason(action, row);
    return '<button class="table-action-menu-item' + (action.destructive ? ' destructive' : '') + '" type="button" role="menuitem" data-menu-action="' + item.index + '"' + (reason ? ' disabled aria-disabled="true"' : '') + ' title="' + escapeHtml(actionTitle(action, row)) + '">' + (action.icon ? '<i data-lucide="' + escapeHtml(action.icon) + '" aria-hidden="true"></i>' : '') + '<span>' + escapeHtml(action.label) + '</span></button>';
  }

  function openActionMenu(button, actions, row, api) {
    var menu = ensureActionMenu();
    if (actionMenuOwner && actionMenuOwner.button === button) { closeActionMenu(true); return; }
    closeActionMenu(false);
    var normal = actions.filter(function (item) { return !item.action.destructive; });
    var destructive = actions.filter(function (item) { return item.action.destructive; });
    menu.innerHTML = normal.map(function (item) { return menuItemMarkup(item, row); }).join('') + (normal.length && destructive.length ? '<div class="table-action-menu-divider" role="separator"></div>' : '') + destructive.map(function (item) { return menuItemMarkup(item, row); }).join('');
    actionMenuOwner = { button: button, actions: actions, row: row, api: api };
    button.setAttribute('aria-expanded', 'true');
    menu.hidden = false;
    menu.style.visibility = 'hidden';
    // Replace icon placeholders before measuring so the final menu height is used.
    window.GT.components.refreshIcons();
    var buttonRect = button.getBoundingClientRect();
    var menuRect = menu.getBoundingClientRect();
    var left = Math.max(8, Math.min(buttonRect.right - menuRect.width, window.innerWidth - menuRect.width - 8));
    var below = buttonRect.bottom + 4;
    var above = buttonRect.top - menuRect.height - 4;
    // Clamp both placements to the viewport: the owner button can itself sit partly
    // outside the viewport after a programmatic scroll or focus restoration.
    var top = below + menuRect.height <= window.innerHeight - 8 ? below : Math.max(8, Math.min(above, window.innerHeight - menuRect.height - 8));
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    menu.style.visibility = '';
    // Browsers may emit a focus-induced scroll while the fixed menu opens.
    // Ignore that opening tick; all later page/container scrolling closes it.
    ignoreOpeningScrollUntil = performance.now() + 250;
    var first = menu.querySelector('[role="menuitem"]:not(:disabled)');
    // Focus must not scroll the page: a focus-induced scroll would immediately
    // invoke the menu's intentional close-on-scroll behaviour.
    if (first) first.focus({ preventScroll: true });
  }

  function create(config) {
    sequence += 1;
    var id = config.id || 'gtDataTable' + sequence;
    var container = null;
    var state = { search: '', filters: {}, datePreset: 'any', sortField: '', sortDirection: 'asc', page: 1, pageSize: 10 };
    var dateFilters = (config.filters || []).filter(function (filter) { return filter.type === 'date'; });
    var dateRange = dateFilters.length ? window.GT.dateRangeFilter.create({
      id: id + 'DateRange',
      getValue: function () {
        return { from: state.filters[dateFilters[0].name] || '', to: dateFilters[1] ? state.filters[dateFilters[1].name] || '' : '', preset: state.datePreset };
      },
      onChange: function (range) {
        state.filters[dateFilters[0].name] = range.from;
        if (dateFilters[1]) state.filters[dateFilters[1].name] = range.to;
        state.datePreset = range.preset;
        state.page = 1;
        render();
      }
    }) : null;

    function rows() {
      return typeof config.rows === 'function' ? config.rows() : (config.rows || []).slice();
    }

    function filteredRows() {
      var search = state.search.toLowerCase().trim();
      var result = rows().filter(function (row) {
        var matchesSearch = !search || (config.searchFields || []).some(function (field) {
          return String(row[field] === null || row[field] === undefined ? '' : row[field]).toLowerCase().indexOf(search) !== -1;
        });
        var matchesFilters = (config.filters || []).every(function (filter) {
          var selected = state.filters[filter.name] || '';
          if (!selected) return true;
          return filter.test ? filter.test(row, selected) : String(row[filter.field]) === selected;
        });
        return matchesSearch && matchesFilters;
      });

      if (state.sortField) {
        var column = config.columns.find(function (item) { return item.field === state.sortField; });
        result.sort(function (left, right) {
          var leftValue = column && column.sortValue ? column.sortValue(left) : left[state.sortField];
          var rightValue = column && column.sortValue ? column.sortValue(right) : right[state.sortField];
          var comparison = String(leftValue === null || leftValue === undefined ? '' : leftValue).localeCompare(String(rightValue === null || rightValue === undefined ? '' : rightValue), undefined, { numeric: true, sensitivity: 'base' });
          return state.sortDirection === 'asc' ? comparison : -comparison;
        });
      }
      return result;
    }

    function filtersMarkup() {
      var filters = config.filters || [];
      var regular = filters.filter(function (filter) { return filter.type !== 'date'; }).map(function (filter) {
        var options = (filter.options || []).map(function (option) {
          return '<option value="' + escapeHtml(option.value) + '"' + (String(state.filters[filter.name] || '') === String(option.value) ? ' selected' : '') + '>' + escapeHtml(option.label) + '</option>';
        }).join('');
        var allLabel = filter.allLabel || 'All ' + filter.label.toLowerCase();
        var selected = String(state.filters[filter.name] || '');
        var selectedOption = (filter.options || []).find(function (option) { return String(option.value) === selected; });
        var selectedLabel = selectedOption ? selectedOption.label : allLabel;
        return '<label class="table-filter"><span class="visually-hidden">' + escapeHtml(filter.label) + '</span><select class="form-select form-select-sm" data-table-filter="' + escapeHtml(filter.name) + '" aria-label="' + escapeHtml(filter.label) + '" title="' + escapeHtml(selectedLabel) + '"><option value="">' + escapeHtml(allLabel) + '</option>' + options + '</select></label>';
      }).join('');
      var dateMarkup = dateRange ? dateRange.markup() : '';
      var clear = hasActiveFilters() ? '<button class="table-clear-filters" type="button" data-clear-filters>Clear filters</button>' : '';
      return regular + dateMarkup + clear;
    }

    function sizeFilterSelects() {
      container.querySelectorAll('.table-filter select').forEach(function (select) {
        // Equal flex tracks own the width. The selected value may ellipsize, while
        // the native option list and title preserve its complete readable label.
        select.style.minWidth = '';
        select.title = select.options[select.selectedIndex].textContent.trim();
      });
    }

    function columnHeading(column) {
      if (!column.sortable) return '<span class="table-header-content"><span>' + escapeHtml(column.label) + '</span></span>';
      var active = state.sortField === column.field;
      var direction = active ? state.sortDirection : 'none';
      var icon = !active ? 'arrow-up-down' : (state.sortDirection === 'desc' ? 'arrow-down' : 'arrow-up');
      return '<button class="table-sort" type="button" data-sort-field="' + escapeHtml(column.field) + '" aria-label="Sort by ' + escapeHtml(column.label) + '" data-sort-direction="' + direction + '"><span>' + escapeHtml(column.label) + '</span><i data-lucide="' + icon + '" aria-hidden="true"></i></button>';
    }

    function cellMarkup(column, row) {
      var value = row[column.field];
      var displayed = column.formatter ? column.formatter(value, row) : value;
      return column.html ? String(displayed) : escapeHtml(displayed);
    }

    function visibleActions(row) {
      return (config.actions || []).map(function (action, index) { return { action: action, index: index }; }).filter(function (item) {
        return !item.action.show || item.action.show(row);
      });
    }

    function splitActions(actions) {
      if (actions.length === 1) return { inline: actions, menu: [] };
      var primary = actions.filter(function (item) { return item.action.primary; });
      var allPrimary = primary.length === actions.length && actions.length <= 2;
      // The fixed desktop column has two slots: either two primary actions, or one
      // primary action beside More. Remaining actions stay in the shared menu.
      var inline = allPrimary ? primary : primary.slice(0, 1);
      return { inline: inline, menu: actions.filter(function (item) { return inline.indexOf(item) === -1; }) };
    }

    function inlineActionMarkup(item, row) {
      var action = item.action;
      var reason = actionDisabledReason(action, row);
      var classes = 'table-action-button btn ' + escapeHtml(action.className || (action.destructive ? 'btn-outline-danger' : 'btn-outline-secondary')) + (action.showLabel ? ' show-label' : '');
      return '<button class="' + classes + '" type="button" data-row-action="' + item.index + '" data-row-id="' + escapeHtml(row.id) + '" aria-label="' + escapeHtml(action.label) + '" title="' + escapeHtml(actionTitle(action, row)) + '"' + (reason ? ' disabled aria-disabled="true"' : '') + '>' + (action.icon ? '<i data-lucide="' + escapeHtml(action.icon) + '" aria-hidden="true"></i>' : '') + '<span class="table-action-label">' + escapeHtml(action.label) + '</span></button>';
    }

    function actionMarkup(row) {
      var actions = visibleActions(row);
      if (!actions.length) return '<span class="text-muted">None</span>';
      var split = splitActions(actions);
      var inline = split.inline.map(function (item) { return inlineActionMarkup(item, row); }).join('');
      var more = split.menu.length ? '<button class="table-action-button table-more-button btn btn-outline-secondary" type="button" data-action-menu-toggle data-row-id="' + escapeHtml(row.id) + '" aria-label="More actions" title="More actions" aria-haspopup="menu" aria-controls="gtTableActionMenu" aria-expanded="false"><i data-lucide="more-vertical" aria-hidden="true"></i><span class="table-action-label">More</span></button>' : '';
      return '<div class="table-row-actions"><span class="table-action-primary-slot">' + inline + '</span><span class="table-action-more-slot">' + more + '</span></div>';
    }

    function rowViewAction(row) {
      return visibleActions(row).find(function (item) { return item.action.label.toLowerCase().indexOf('view') === 0 && !actionDisabledReason(item.action, row); }) || null;
    }

    function rowCanOpen(row) {
      return Boolean(config.onRowClick || rowViewAction(row));
    }

    function openRow(row) {
      if (config.onRowClick) { config.onRowClick(row); return; }
      var item = rowViewAction(row);
      if (item) item.action.onClick(row, api);
    }

    function bodyMarkup(pageRows) {
      return pageRows.map(function (row) {
        var cells = config.columns.map(function (column) {
          return '<td class="' + columnClasses(column) + '" data-align="' + columnAlign(column) + '" data-label="' + escapeHtml(column.label) + '">' + cellMarkup(column, row) + '</td>';
        }).join('');
        if (config.actions && config.actions.length) cells += '<td class="actions-column" data-label="Actions">' + actionMarkup(row) + '</td>';
        var clickable = rowCanOpen(row);
        return '<tr data-record-id="' + escapeHtml(row.id) + '"' + (clickable ? ' class="table-clickable-row" tabindex="0"' : '') + '>' + cells + '</tr>';
      }).join('');
    }

    function emptyMarkup() {
      var empty = config.emptyState || { message: 'No results found.' };
      var action = empty.action && (!empty.action.show || empty.action.show()) ? '<button class="btn btn-primary" type="button" data-empty-action>' + escapeHtml(empty.action.label) + '</button>' : '';
      return '<div class="empty-state table-empty-state"><i data-lucide="inbox" aria-hidden="true"></i><p>' + escapeHtml(empty.message) + '</p>' + action + '</div>';
    }

    function paginationMarkup(total) {
      var pages = Math.max(1, Math.ceil(total / state.pageSize));
      state.page = Math.min(state.page, pages);
      return '<div class="table-pagination"><span>Page ' + state.page + ' of ' + pages + '</span><div><button class="btn btn-sm btn-outline-secondary" type="button" data-page="previous"' + (state.page <= 1 ? ' disabled' : '') + '>Previous</button><button class="btn btn-sm btn-outline-secondary" type="button" data-page="next"' + (state.page >= pages ? ' disabled' : '') + '>Next</button></div></div>';
    }

    function pageSizeMarkup() {
      return '<label class="table-page-size">Rows per page <select class="form-select form-select-sm" data-page-size aria-label="Rows per page"><option' + (state.pageSize === 10 ? ' selected' : '') + '>10</option><option' + (state.pageSize === 25 ? ' selected' : '') + '>25</option><option' + (state.pageSize === 50 ? ' selected' : '') + '>50</option></select></label>';
    }

    function hasActiveFilters() {
      return Boolean(state.search.trim()) || Object.keys(state.filters).some(function (name) { return Boolean(state.filters[name]); });
    }

    function searchLabel() {
      if (config.searchLabel) return config.searchLabel;
      var fields = (config.searchFields || []).map(function (field) { return String(field).replace(/_/g, ' '); });
      return fields.length ? 'Search ' + fields.join(', ') : 'Search this list';
    }

    function render() {
      if (!container) return;
      closeActionMenu(false);
      if (dateRange) dateRange.close(false);
      var filtered = filteredRows();
      var pages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
      state.page = Math.min(state.page, pages);
      var start = (state.page - 1) * state.pageSize;
      var pageRows = filtered.slice(start, start + state.pageSize);
      var end = Math.min(start + state.pageSize, filtered.length);
      var countText = filtered.length ? 'Showing ' + (start + 1) + '–' + end + ' of ' + filtered.length + ' results' : '0 results';
      var head = '<thead><tr>' + config.columns.map(function (column) { var active = state.sortField === column.field; return '<th class="' + columnClasses(column) + '" data-align="' + columnAlign(column) + '" scope="col"' + columnStyle(column) + (column.sortable ? ' aria-sort="' + (active ? (state.sortDirection === 'asc' ? 'ascending' : 'descending') : 'none') + '"' : '') + '>' + columnHeading(column) + '</th>'; }).join('') + (config.actions && config.actions.length ? '<th class="actions-column table-align-right" data-align="right" scope="col">Actions</th>' : '') + '</tr></thead>';
      var footer = config.footer ? '<tfoot>' + config.footer(filtered) + '</tfoot>' : '';
      var table = pageRows.length ? '<div class="table-wrapper"><table class="shared-data-table"><caption class="visually-hidden">' + escapeHtml(config.caption || 'Results') + '</caption>' + head + '<tbody>' + bodyMarkup(pageRows) + '</tbody>' + footer + '</table></div>' : emptyMarkup();
      var accessibleSearch = searchLabel();
      var filterRow = (config.filters || []).length ? '<div class="table-filters">' + filtersMarkup() + '</div>' : (hasActiveFilters() ? '<div class="table-filters table-filters-clear-only">' + filtersMarkup() + '</div>' : '');
      container.innerHTML = '<section class="gt-data-table" id="' + escapeHtml(id) + '"><div class="table-toolbar"><div class="table-toolbar-primary"><label class="table-search"><i data-lucide="search" aria-hidden="true"></i><span class="visually-hidden">' + escapeHtml(accessibleSearch) + '</span><input class="form-control" type="search" data-table-search value="' + escapeHtml(state.search) + '" placeholder="' + escapeHtml(config.searchPlaceholder || 'Search') + '" aria-label="' + escapeHtml(accessibleSearch) + '" title="' + escapeHtml(accessibleSearch) + '"></label><button class="btn btn-outline-secondary table-export" type="button" data-export-csv aria-label="Export CSV" title="Export CSV"><i data-lucide="download" aria-hidden="true"></i><span>Export CSV</span></button></div>' + filterRow + '</div><div class="table-meta"><p class="table-result-count" aria-live="polite">' + countText + '</p>' + pageSizeMarkup() + '</div>' + table + paginationMarkup(filtered.length) + '</section>';
      var wrapper = container.querySelector('.table-wrapper');
      if (wrapper) wrapper.scrollLeft = 0;
      sizeFilterSelects();
      if (dateRange) dateRange.bind(container);
      window.GT.components.refreshIcons();
      if (typeof config.onStateChange === 'function') config.onStateChange(api);
    }

    function exportCsv() {
      var exportColumns = config.columns.filter(function (column) { return column.export !== false; });
      var lines = [exportColumns.map(function (column) { return csvCell(column.label); }).join(',')];
      filteredRows().forEach(function (row) {
        lines.push(exportColumns.map(function (column) {
          var value = column.exportValue ? column.exportValue(row) : row[column.field];
          return csvCell(value);
        }).join(','));
      });
      var url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
      var link = document.createElement('a');
      link.href = url;
      link.download = config.exportName || 'export.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 0);
    }

    function bindEvents() {
      container.addEventListener('input', function (event) {
        if (!event.target.matches('[data-table-search]')) return;
        state.search = event.target.value;
        state.page = 1;
        render();
        var searchInput = container.querySelector('[data-table-search]');
        searchInput.focus();
        searchInput.setSelectionRange(state.search.length, state.search.length);
      });
      container.addEventListener('change', function (event) {
        if (event.target.matches('[data-table-filter]')) {
          state.filters[event.target.dataset.tableFilter] = event.target.value;
          state.page = 1;
          render();
        }
        if (event.target.matches('[data-page-size]')) {
          state.pageSize = Number(event.target.value);
          state.page = 1;
          render();
        }
      });
      container.addEventListener('click', function (event) {
        var sort = event.target.closest('[data-sort-field]');
        if (sort) {
          var field = sort.dataset.sortField;
          state.sortDirection = state.sortField === field && state.sortDirection === 'asc' ? 'desc' : 'asc';
          state.sortField = field;
          state.page = 1;
          render();
          return;
        }
        var pageButton = event.target.closest('[data-page]');
        if (pageButton) {
          state.page += pageButton.dataset.page === 'next' ? 1 : -1;
          render();
          return;
        }
        if (event.target.closest('[data-export-csv]')) { exportCsv(); return; }
        if (event.target.closest('[data-clear-filters]')) {
          state.search = '';
          state.filters = {};
          state.datePreset = 'any';
          state.page = 1;
          render();
          return;
        }
        if (event.target.closest('[data-empty-action]') && config.emptyState.action.onClick) { config.emptyState.action.onClick(); return; }
        var menuToggle = event.target.closest('[data-action-menu-toggle]');
        if (menuToggle) {
          var menuRow = rows().find(function (item) { return String(item.id) === menuToggle.dataset.rowId; });
          if (menuRow) openActionMenu(menuToggle, splitActions(visibleActions(menuRow)).menu, menuRow, api);
          return;
        }
        var actionButton = event.target.closest('[data-row-action]');
        if (actionButton) {
          var action = (config.actions || [])[Number(actionButton.dataset.rowAction)];
          var actionRow = rows().find(function (item) { return String(item.id) === actionButton.dataset.rowId; });
          if (action && actionRow) action.onClick(actionRow, api);
          return;
        }
        var rowElement = event.target.closest('[data-record-id]');
        if (rowElement && !event.target.closest('button, a, input, select, textarea')) {
          var clickedRow = rows().find(function (item) { return String(item.id) === rowElement.dataset.recordId; });
          if (clickedRow && rowCanOpen(clickedRow)) openRow(clickedRow);
        }
      });
      container.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' || event.target.closest('button, a, input, select, textarea')) return;
        var rowElement = event.target.closest('[data-record-id]');
        if (!rowElement) return;
        event.preventDefault();
        var row = rows().find(function (item) { return String(item.id) === rowElement.dataset.recordId; });
        if (row && rowCanOpen(row)) openRow(row);
      });
    }

    function mount(target) {
      container = typeof target === 'string' ? document.querySelector(target) : target;
      if (!container) return;
      bindEvents();
      render();
    }

    function setFilter(name, value) {
      state.filters[name] = value || '';
      state.page = 1;
      render();
    }

    function toggleFilter(name, value) {
      setFilter(name, String(state.filters[name] || '') === String(value) ? '' : value);
    }

    var api = { mount: mount, refresh: render, filteredRows: filteredRows, state: state, setFilter: setFilter, toggleFilter: toggleFilter };
    return api;
  }

  return { create: create };
}());
