/* Shared preset and custom date-range popover for every data table. */
window.GT = window.GT || {};
window.GT.dateRangeFilter = (function () {
  var activeInstance = null;
  var presets = [
    { value: 'any', label: 'Any date' },
    { value: 'today', label: 'Today' },
    { value: 'this_week', label: 'This week' },
    { value: 'this_month', label: 'This month' },
    { value: 'last_30_days', label: 'Last 30 days' },
    { value: 'custom', label: 'Custom range' }
  ];

  function escapeHtml(value) {
    var element = document.createElement('div');
    element.textContent = value === null || value === undefined ? '' : String(value);
    return element.innerHTML;
  }

  function presetLabel(value) {
    var preset = presets.find(function (item) { return item.value === value; });
    return preset ? preset.label : '';
  }

  function buttonLabel(range) {
    if (!range.from && !range.to) return 'Any date';
    if (range.preset && range.preset !== 'custom' && range.preset !== 'any') return presetLabel(range.preset);
    return window.GT.dates.formatRange(range.from, range.to);
  }

  function create(config) {
    var ownerButton = null;
    var backdrop = null;
    var popover = null;
    var draft = null;
    var resizeHandler = null;

    function value() {
      var current = config.getValue ? config.getValue() : {};
      return { from: current.from || '', to: current.to || '', preset: current.preset || (current.from || current.to ? 'custom' : 'any') };
    }

    function markup() {
      var range = value();
      var label = buttonLabel(range);
      return '<button class="date-range-trigger" type="button" data-date-range-trigger="' + escapeHtml(config.id) + '" aria-label="Date range: ' + escapeHtml(label) + '" title="' + escapeHtml(label) + '" aria-haspopup="dialog" aria-expanded="false" aria-controls="' + escapeHtml(config.id) + 'Popover" data-date-from="' + escapeHtml(range.from) + '" data-date-to="' + escapeHtml(range.to) + '" data-date-preset="' + escapeHtml(range.preset) + '"><i data-lucide="calendar-days" aria-hidden="true"></i><span>' + escapeHtml(label) + '</span><i class="date-range-chevron" data-lucide="chevron-down" aria-hidden="true"></i></button>';
    }

    function summaryText() {
      return window.GT.dates.formatRange(draft.from, draft.to);
    }

    function updateCustomSummary() {
      if (!popover) return;
      var summary = popover.querySelector('[data-date-summary]');
      var error = popover.querySelector('[data-date-error]');
      summary.textContent = summaryText();
      error.textContent = '';
    }

    function showCustom(show) {
      var section = popover.querySelector('[data-date-custom]');
      section.hidden = !show;
      if (show) {
        popover.querySelector('[data-date-from]').value = draft.from;
        popover.querySelector('[data-date-to]').value = draft.to;
        updateCustomSummary();
        // Revealing the fields changes the portal height, so recalculate a safe
        // above/below placement before moving focus into the custom controls.
        position();
      }
    }

    function position() {
      if (!ownerButton || !popover || window.innerWidth < 576) return;
      popover.style.left = '0px';
      popover.style.top = '0px';
      popover.style.visibility = 'hidden';
      var owner = ownerButton.getBoundingClientRect();
      var box = popover.getBoundingClientRect();
      var left = Math.max(12, Math.min(owner.left, window.innerWidth - box.width - 12));
      var below = owner.bottom + 6;
      var above = owner.top - box.height - 6;
      var fitsBelow = below + box.height <= window.innerHeight - 12;
      var top = fitsBelow ? below : Math.max(12, Math.min(above, window.innerHeight - box.height - 12));
      popover.dataset.placement = fitsBelow ? 'bottom' : 'top';
      popover.style.left = left + 'px';
      popover.style.top = top + 'px';
      popover.style.visibility = '';
    }

    function focusableItems() {
      if (!popover) return [];
      return Array.from(popover.querySelectorAll('button:not([disabled]), input:not([disabled])')).filter(function (item) { return !item.closest('[hidden]'); });
    }

    function close(returnFocus) {
      if (!backdrop) return;
      var focusTarget = ownerButton;
      if (resizeHandler) window.removeEventListener('resize', resizeHandler);
      backdrop.remove();
      backdrop = null;
      popover = null;
      resizeHandler = null;
      if (ownerButton && ownerButton.isConnected) ownerButton.setAttribute('aria-expanded', 'false');
      if (activeInstance === api) activeInstance = null;
      if (returnFocus && focusTarget && focusTarget.isConnected) focusTarget.focus({ preventScroll: true });
    }

    function applyRange(range) {
      close(false);
      config.onChange(range);
    }

    function choosePreset(name) {
      if (name === 'custom') {
        draft.preset = 'custom';
        showCustom(true);
        popover.querySelector('[data-date-from]').focus();
        return;
      }
      var range = name === 'any' ? { from: '', to: '' } : window.GT.dates.presetRange(name, window.GT.dates.today());
      applyRange({ from: range.from, to: range.to, preset: name });
    }

    function handleKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
        return;
      }
      var presetButton = event.target.closest('[data-date-preset]');
      if (presetButton && ['ArrowDown', 'ArrowUp', 'Home', 'End'].indexOf(event.key) !== -1) {
        event.preventDefault();
        var buttons = Array.from(popover.querySelectorAll('[data-date-preset]'));
        var index = buttons.indexOf(presetButton);
        if (event.key === 'Home') index = 0;
        else if (event.key === 'End') index = buttons.length - 1;
        else if (event.key === 'ArrowDown') index = index === buttons.length - 1 ? 0 : index + 1;
        else index = index <= 0 ? buttons.length - 1 : index - 1;
        buttons[index].focus();
        return;
      }
      if (event.key !== 'Tab') return;
      var items = focusableItems();
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }

    function open(button) {
      if (activeInstance && activeInstance !== api) activeInstance.close(false);
      close(false);
      ownerButton = button;
      ownerButton.setAttribute('aria-expanded', 'true');
      draft = value();
      backdrop = document.createElement('div');
      backdrop.className = 'date-range-backdrop';
      backdrop.innerHTML = '<section class="date-range-popover" id="' + escapeHtml(config.id) + 'Popover" role="dialog" aria-modal="true" aria-labelledby="' + escapeHtml(config.id) + 'Title"><header><strong id="' + escapeHtml(config.id) + 'Title">Filter by date</strong><button class="date-range-close" type="button" data-date-close aria-label="Close date filter"><i data-lucide="x" aria-hidden="true"></i></button></header><div class="date-preset-list" role="listbox" aria-label="Date presets">' + presets.map(function (preset) { return '<button type="button" role="option" data-date-preset="' + preset.value + '" aria-selected="' + (draft.preset === preset.value ? 'true' : 'false') + '">' + preset.label + '</button>'; }).join('') + '</div><p class="date-range-summary">Selected: <strong data-date-summary>' + escapeHtml(summaryText()) + '</strong></p><div class="date-custom-range" data-date-custom' + (draft.preset === 'custom' ? '' : ' hidden') + '><label><span>From</span><input class="form-control" type="date" data-date-from value="' + escapeHtml(draft.from) + '"></label><label><span>To</span><input class="form-control" type="date" data-date-to value="' + escapeHtml(draft.to) + '"></label><p class="field-error date-range-error" data-date-error aria-live="polite"></p><div class="date-range-actions"><button class="btn btn-outline-secondary" type="button" data-date-clear>Clear</button><button class="btn btn-primary" type="button" data-date-apply>Apply</button></div></div></section>';
      document.body.appendChild(backdrop);
      popover = backdrop.querySelector('.date-range-popover');
      activeInstance = api;
      window.GT.components.refreshIcons();
      position();
      resizeHandler = position;
      window.addEventListener('resize', resizeHandler);

      backdrop.addEventListener('pointerdown', function (event) { if (event.target === backdrop) close(false); });
      popover.addEventListener('keydown', handleKeydown);
      popover.addEventListener('click', function (event) {
        var preset = event.target.closest('[data-date-preset]');
        if (preset) { choosePreset(preset.dataset.datePreset); return; }
        if (event.target.closest('[data-date-close]')) { close(true); return; }
        if (event.target.closest('[data-date-clear]')) { choosePreset('any'); return; }
        if (!event.target.closest('[data-date-apply]')) return;
        if (draft.from && draft.to && draft.from > draft.to) {
          popover.querySelector('[data-date-error]').textContent = 'From date must not be after To date.';
          popover.querySelector('[data-date-from]').focus();
          return;
        }
        applyRange({ from: draft.from, to: draft.to, preset: draft.from || draft.to ? 'custom' : 'any' });
      });
      popover.addEventListener('input', function (event) {
        if (event.target.matches('[data-date-from]')) draft.from = event.target.value;
        if (event.target.matches('[data-date-to]')) draft.to = event.target.value;
        updateCustomSummary();
      });

      var selected = popover.querySelector('[data-date-preset][aria-selected="true"]') || popover.querySelector('[data-date-preset]');
      selected.focus({ preventScroll: true });
    }

    function bind(root) {
      ownerButton = root.querySelector('[data-date-range-trigger="' + config.id + '"]');
      if (ownerButton) ownerButton.addEventListener('click', function () { open(ownerButton); });
    }

    var api = { markup: markup, bind: bind, close: close };
    return api;
  }

  window.addEventListener('hashchange', function () { if (activeInstance) activeInstance.close(false); });
  return { create: create };
}());
