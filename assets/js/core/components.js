/* Shared toast, modal, confirm dialog, permission button and icon helpers. */
window.GT = window.GT || {};
window.GT.components = (function () {
  function refreshIcons() { if (window.lucide) window.lucide.createIcons(); }

  function escapeHtml(value) {
    var element = document.createElement('div');
    element.textContent = value === null || value === undefined ? '' : String(value);
    return element.innerHTML;
  }

  var toastTypes = {
    default: { icon: 'info', title: 'Note', duration: 4000 },
    success: { icon: 'check-circle', title: 'Done', duration: 4000 },
    warning: { icon: 'alert-triangle', title: 'Warning', duration: 4000 },
    error: { icon: 'x-circle', title: 'Something went wrong', duration: 6000 },
    info: { icon: 'info', title: 'Note', duration: 4000 }
  };

  function updateToastLiveRegion(stack) {
    // Errors temporarily raise the shared live region to assertive; all other notices stay polite.
    stack.setAttribute('aria-live', stack.querySelector('.gt-toast.error') ? 'assertive' : 'polite');
  }

  function removeToast(toast, immediate) {
    if (!toast || toast.dataset.dismissed === 'true') return;
    toast.dataset.dismissed = 'true';
    window.clearTimeout(toast.toastTimer);
    if (immediate) {
      var immediateStack = toast.parentNode;
      toast.remove();
      if (immediateStack) updateToastLiveRegion(immediateStack);
      return;
    }
    toast.classList.add('is-leaving');
    window.setTimeout(function () {
      var stack = toast.parentNode;
      toast.remove();
      if (stack) updateToastLiveRegion(stack);
    }, 250);
  }

  function buildToast(message, type, title) {
    var config = toastTypes[type];
    var toast = document.createElement('article');
    var icon = document.createElement('span');
    var copy = document.createElement('span');
    var heading = document.createElement('strong');
    var detail = document.createElement('span');
    var close = document.createElement('button');
    var progressTrack = document.createElement('span');
    var progress = document.createElement('span');

    toast.className = 'gt-toast ' + type + ' is-entering';
    toast.dataset.toastType = type;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.tabIndex = 0;

    icon.className = 'gt-toast-icon';
    icon.innerHTML = '<i data-lucide="' + config.icon + '" aria-hidden="true"></i>';
    copy.className = 'gt-toast-copy';
    heading.className = 'gt-toast-title';
    heading.textContent = title || config.title;
    detail.className = 'gt-toast-message';
    detail.textContent = message;
    copy.appendChild(heading);
    copy.appendChild(detail);

    close.className = 'gt-toast-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Close notification');
    close.textContent = '×';

    progressTrack.className = 'gt-toast-progress';
    progress.className = 'gt-toast-progress-bar';
    progressTrack.appendChild(progress);

    toast.appendChild(icon);
    toast.appendChild(copy);
    toast.appendChild(close);
    toast.appendChild(progressTrack);
    return { toast: toast, close: close, progress: progress, duration: config.duration };
  }

  function startToastTimer(parts) {
    var toast = parts.toast;
    var progress = parts.progress;
    var remaining = parts.duration;
    var startedAt = 0;
    var paused = false;
    var hovered = false;
    var focused = false;

    function run() {
      if (toast.dataset.dismissed === 'true') return;
      paused = false;
      startedAt = Date.now();
      progress.style.transition = 'none';
      progress.style.transform = 'scaleX(' + (remaining / parts.duration) + ')';
      progress.offsetWidth; // Restart the linear progress transition from the remaining point.
      progress.style.transition = 'transform ' + remaining + 'ms linear';
      progress.style.transform = 'scaleX(0)';
      toast.toastTimer = window.setTimeout(function () { removeToast(toast); }, remaining);
    }

    function pause() {
      if (paused || toast.dataset.dismissed === 'true') return;
      paused = true;
      remaining = Math.max(0, remaining - (Date.now() - startedAt));
      window.clearTimeout(toast.toastTimer);
      progress.style.transition = 'none';
      progress.style.transform = 'scaleX(' + (remaining / parts.duration) + ')';
    }

    function resume() {
      if (!paused || hovered || focused || remaining <= 0) return;
      run();
    }

    toast.addEventListener('mouseenter', function () { hovered = true; pause(); });
    toast.addEventListener('mouseleave', function () { hovered = false; resume(); });
    toast.addEventListener('focusin', function () { focused = true; pause(); });
    toast.addEventListener('focusout', function (event) {
      if (toast.contains(event.relatedTarget)) return;
      focused = false;
      resume();
    });
    parts.close.addEventListener('click', function () { removeToast(toast); });
    run();
  }

  function showToast(message, type, title) {
    var stack = document.getElementById('toastContainer');
    if (!stack) return null;
    var safeType = toastTypes[type] ? type : 'default';
    // Four visible notices are enough context; discard the oldest before adding another.
    if (stack.children.length >= 4) removeToast(stack.firstElementChild, true);
    var parts = buildToast(message, safeType, title);
    stack.appendChild(parts.toast);
    updateToastLiveRegion(stack);
    window.requestAnimationFrame(function () { parts.toast.classList.remove('is-entering'); });
    startToastTimer(parts);
    refreshIcons();
    return parts.toast;
  }

  function closeModal() { var root = document.getElementById('modalContainer'); root.innerHTML = ''; }
  function openModal(options) { var root = document.getElementById('modalContainer'); root.innerHTML = '<div class="modal-backdrop-gt" role="dialog" aria-modal="true" aria-labelledby="gtModalTitle"><section class="gt-modal"><h2 id="gtModalTitle">' + options.title + '</h2><div>' + (options.content || '') + '</div><div class="gt-modal-actions"><button class="btn btn-outline-secondary" type="button" data-modal-close>Close</button></div></section></div>'; root.querySelector('[data-modal-close]').addEventListener('click', closeModal); }
  function confirmDialog(options) { return new Promise(function (resolve) { var root = document.getElementById('modalContainer'); root.innerHTML = '<div class="modal-backdrop-gt" role="dialog" aria-modal="true" aria-labelledby="gtConfirmTitle"><section class="gt-modal"><h2 id="gtConfirmTitle">' + (options.title || 'Please confirm') + '</h2><p>' + (options.message || '') + '</p><div class="gt-modal-actions"><button class="btn btn-outline-secondary" type="button" data-cancel>Cancel</button><button class="btn btn-primary" type="button" data-confirm>' + (options.confirmText || 'Confirm') + '</button></div></section></div>'; root.querySelector('[data-cancel]').addEventListener('click', function () { closeModal(); resolve(false); }); root.querySelector('[data-confirm]').addEventListener('click', function () { closeModal(); resolve(true); }); }); }
  function roleButton(button, permission, action) { if (!GT.permissions.can(permission, action || 'C')) { button.hidden = true; button.disabled = true; } return button; }

  function pageHeader(options) {
    var actions = (options.actions || []).filter(function (action) {
      return !action.permission || window.GT.permissions.can(action.permission, action.permissionAction || 'C');
    }).map(function (action) {
      var classes = escapeHtml(action.className || 'btn-primary');
      if (action.route) return '<a class="btn ' + classes + '" href="' + escapeHtml(action.route) + '">' + (action.icon ? '<i data-lucide="' + escapeHtml(action.icon) + '" aria-hidden="true"></i>' : '') + escapeHtml(action.label) + '</a>';
      return '<button class="btn ' + classes + '" type="button" data-page-action="' + escapeHtml(action.name || '') + '">' + (action.icon ? '<i data-lucide="' + escapeHtml(action.icon) + '" aria-hidden="true"></i>' : '') + escapeHtml(action.label) + '</button>';
    }).join('');
    return '<header class="module-page-header"><div><div class="module-title-line"><h1>' + escapeHtml(options.title) + '</h1>' + (options.badge || '') + '</div>' + (options.description ? '<p>' + escapeHtml(options.description) + '</p>' : '') + '</div>' + (actions ? '<div class="module-page-actions">' + actions + '</div>' : '') + '</header>';
  }

  function statusBadge(label, tone) {
    return '<span class="status-badge status-' + escapeHtml(tone || 'neutral') + '">' + escapeHtml(label) + '</span>';
  }

  function tabs(items, active) {
    return '<div class="detail-tabs" role="tablist">' + items.map(function (item) {
      var selected = item.id === active;
      return '<button class="detail-tab' + (selected ? ' active' : '') + '" type="button" role="tab" data-tab-target="' + escapeHtml(item.id) + '" aria-selected="' + selected + '">' + escapeHtml(item.label) + '</button>';
    }).join('') + '</div>';
  }

  function detailRow(label, value) {
    return '<div class="detail-row"><dt>' + escapeHtml(label) + '</dt><dd>' + escapeHtml(value === null || value === undefined || value === '' ? '—' : value) + '</dd></div>';
  }

  function linkedList(items) {
    return '<ul class="detail-list">' + (items || []).map(function (item) {
      return '<li><a href="' + escapeHtml(item.route) + '"><span class="detail-list-main"><strong>' + escapeHtml(item.label) + '</strong>' +
        (item.meta ? '<span class="detail-list-meta">' + escapeHtml(item.meta) + '</span>' : '') + '</span>' +
        (item.amount ? '<span class="detail-list-amount">' + escapeHtml(item.amount) + '</span>' : '') + '</a></li>';
    }).join('') + '</ul>';
  }

  function progressBar(percent,label) {
    return '<div class="gt-progress"><progress max="100" value="' + Number(percent || 0) + '" aria-label="' + escapeHtml(label) + '"></progress><span>' + escapeHtml(label) + '</span></div>';
  }
  return { refreshIcons: refreshIcons, showToast: showToast, openModal: openModal, closeModal: closeModal, confirmDialog: confirmDialog, roleButton: roleButton, pageHeader: pageHeader, statusBadge: statusBadge, tabs: tabs, detailRow: detailRow, linkedList: linkedList, escapeHtml: escapeHtml, progressBar:progressBar };
}());

/* Shared KPI cards keep summary visuals and accessible filter buttons consistent. */
window.GT.statCards = (function () {
  function safe(value) { return window.GT.components.escapeHtml(value); }
  function render(cards) {
    return '<div class="stat-card-grid">' + (cards || []).map(function (card, index) {
      var interactive = typeof card.onClick === 'function' || card.filterKey;
      var tag = interactive ? 'button' : 'article';
      var attributes = interactive ? ' type="button" data-stat-card="' + index + '" aria-pressed="' + Boolean(card.active) + '"' : '';
      var money = /^UGX\s/.test(String(card.value));
      return '<' + tag + ' class="stat-card stat-tone-' + safe(card.tone || 'neutral') + (money ? ' stat-card-money' : '') + '"' + attributes + '><span class="stat-card-icon"><i data-lucide="' + safe(card.icon || 'bar-chart-3') + '" aria-hidden="true"></i></span><span class="stat-card-copy"><span class="stat-card-label">' + safe(card.label) + '</span><strong class="stat-card-value">' + safe(card.value) + '</strong>' + (card.helper ? '<span class="stat-card-helper">' + safe(card.helper) + '</span>' : '') + '</span></' + tag + '>';
    }).join('') + '</div>';
  }

  function bind(target, cards) {
    var container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) return;
    container.addEventListener('click', function (event) {
      var button = event.target.closest('[data-stat-card]');
      if (!button) return;
      var card = cards[Number(button.dataset.statCard)];
      if (card && typeof card.onClick === 'function') card.onClick(card, button);
    });
  }

  return { render: render, bind: bind };
}());
