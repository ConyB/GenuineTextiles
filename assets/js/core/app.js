/* Shared shell renderer and role-filtered hash router for Phase 2. */
window.GT.app = (function () {
  var currentRoute = '';
  var removeUserMenuListeners = null;

  function escapeText(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function userInitials(name) {
    var words = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return 'GT';
    return (words[0].charAt(0) + (words.length > 1 ? words[words.length - 1].charAt(0) : '')).toUpperCase();
  }

  function logoMarkup(className) {
    var settings = window.GT.settings;
    return '<img class="' + className + '" src="' + settings.logoSmall + '" alt="' + settings.logoAlt + '" onerror="this.remove()">';
  }

  function renderSidebar() {
    var user = window.GT.session.currentUser();
    var menu = document.querySelector('#appSidebar .sidebar-menu');
    var scrollTop = menu ? menu.scrollTop : 0;
    var body = '<div class="sidebar-header"><a class="sidebar-brand" href="#/dashboard">' + logoMarkup('sidebar-logo') + '<span class="sidebar-wordmark">' + escapeText(window.GT.settings.wordmark) + '<small class="sidebar-tagline">' + escapeText(window.GT.settings.tagline) + '</small></span></a></div><nav class="sidebar-menu" aria-label="Pages">';
    window.GT.navigation.visibleGroups().forEach(function (group, index) {
      var groupId = 'sidebar-group-' + index;
      var saved = group.label ? window.GT.session.getUiState('sidebar_' + group.label) : null;
      // UI_CHECKLIST.md shell rule: Sales starts open; the current route is opened below.
      var isOpen = !group.label || (saved === null ? group.label === 'Sales' : saved === true);
      var items = '';
      var groupBadge = 0;
      group.items.forEach(function (item) {
        var badge = item.badge === 'low_stock' && window.GT.inventory ? window.GT.inventory.lowStockItems().length : 0;
        if (item.badge === 'pending_adjustments' && user && user.role === 'owner') badge = window.GT.store.where('stock_adjustments', { status:'pending' }).length;
        if (item.badge === 'finished_goods_adjustments' && user && user.role === 'owner') badge = window.GT.store.where('finished_good_adjustments', { status:'pending' }).length;
        if (item.badge === 'overdue_debtors' && window.GT.debtors) badge = window.GT.debtors.overdueDebtorCount();
        if (item.badge === 'delivery_notes' && window.GT.deliveries && user) badge = ['owner','general_manager'].indexOf(user.role) !== -1 ? window.GT.deliveries.pendingReleaseCount() : user.role === 'store_keeper' ? window.GT.deliveries.awaitingConfirmationCount() : 0;
        if (item.badge === 'orders' && window.GT.orders && user) badge = ['owner','general_manager'].indexOf(user.role) !== -1 ? window.GT.orders.lateCount() + window.GT.orders.awaitingApprovalCount() : user.role === 'workshop_supervisor' ? window.GT.orders.list({status:'active'}).length : 0;
        if (item.badge === 'material_issues' && window.GT.materialIssues && user && ['owner','general_manager','store_keeper'].indexOf(user.role) !== -1) badge = window.GT.materialIssues.pendingCount();
        if (item.badge === 'pending_expenses' && window.GT.expenses && user && user.role === 'owner') badge = window.GT.store.where('expenses',{status:'pending'}).length;
        groupBadge += badge;
        items += '<a class="nav-link" href="' + item.route + '" data-route="' + item.route + '"><i data-lucide="' + item.icon + '" aria-hidden="true"></i><span class="nav-link-label">' + escapeText(item.label) + '</span>' + (badge ? '<span class="nav-count-badge" aria-label="' + badge + ' ' + escapeText(item.label.toLowerCase()) + '">' + badge + '</span>' : '') + '</a>';
      });
      body += '<section class="nav-group' + (isOpen ? ' is-open' : '') + '"' + (group.label ? ' data-group="' + escapeText(group.label) + '"' : '') + '>';
      if (group.label) body += '<button class="nav-group-title" type="button" aria-expanded="' + isOpen + '" aria-controls="' + groupId + '"><span class="nav-group-label">' + escapeText(group.label) + '</span>' + (groupBadge ? '<span class="nav-group-badge" aria-label="' + groupBadge + ' alerts">' + groupBadge + '</span>' : '') + '<i data-lucide="chevron-down" aria-hidden="true"></i></button>';
      body += '<div class="nav-group-items" id="' + groupId + '"' + (isOpen ? '' : ' inert') + '><div class="nav-group-items-inner">' + items + '</div></div></section>';
    });
    body += '</nav>';
    document.getElementById('appSidebar').innerHTML = body;
    document.querySelector('#appSidebar .sidebar-menu').scrollTop = scrollTop;
    document.querySelectorAll('.nav-group-title').forEach(function (button) {
      button.addEventListener('click', function () {
        var group = button.closest('.nav-group');
        setGroupOpen(group, !group.classList.contains('is-open'));
        window.GT.session.setUiState('sidebar_' + group.dataset.group, group.classList.contains('is-open'));
      });
    });
    document.querySelectorAll('#appSidebar a').forEach(function (link) {
      link.addEventListener('click', closeDrawer);
    });
  }

  function setGroupOpen(group, open) {
    if (!group) return;
    group.classList.toggle('is-open', open);
    var button = group.querySelector('.nav-group-title');
    if (button) button.setAttribute('aria-expanded', String(open));
    group.querySelector('.nav-group-items').inert = !open;
  }

  function actionButton(label, route, permission) {
    if (!window.GT.permissions.can(permission, 'C')) return '';
    return '<a class="btn btn-sm btn-primary quick-action" href="' + route + '" aria-label="' + label + '"><span class="quick-action-label">' + label + '</span><i data-lucide="plus" aria-hidden="true"></i></a>';
  }

  function inventoryNotifications() {
    var user = window.GT.session.currentUser();
    var stockAllowed = window.GT.permissions.can('materials_stock', 'V') && window.GT.inventory;
    var debtAllowed = window.GT.permissions.can('debtors', 'V') && window.GT.debtors;
    if (!stockAllowed && !debtAllowed && !(user && user.role === 'owner')) return '';
    var items = stockAllowed ? window.GT.inventory.lowStockItems() : [];
    var debtCount = debtAllowed ? window.GT.debtors.overdueDebtorCount() : 0;
    var list = items.slice(0, 5).map(function (material) {
      return '<li><a href="#/inventory/alerts"><strong>' + escapeText(material.name) + '</strong><span>' + escapeText(window.GT.inventory.formatQuantity(material, material.stock_quantity)) + ' left</span></a></li>';
    }).join('');
    if (debtAllowed) list += '<li><a href="#/debtors"><strong>Overdue debtors</strong><span>' + debtCount + ' customers</span></a></li>';
    var expenseCount = user && user.role === 'owner' && window.GT.expenses ? window.GT.store.where('expenses',{status:'pending'}).length : 0;
    if (expenseCount) list += '<li><a href="#/finance/expenses"><strong>Expenses awaiting approval</strong><span>' + expenseCount + ' requests</span></a></li>';
    if (!list) list = '<li><span>No current alerts.</span></li>';
    var total = items.length + debtCount + expenseCount;
    return '<div class="topbar-popover"><button class="icon-button notification-button" id="notificationsButton" aria-label="Notifications, ' + total + ' alerts" aria-expanded="false"><i data-lucide="bell"></i>' + (total ? '<span class="notification-count">' + total + '</span>' : '') + '</button><div class="notification-panel" id="notificationsPanel"><div class="notification-heading"><strong>Alerts</strong></div><ul class="notification-list">' + list + '</ul><a class="notification-footer" href="' + (debtAllowed ? '#/debtors' : '#/inventory/alerts') + '">View alerts</a></div></div>';
  }

  function renderTopbar() {
    var user = window.GT.session.currentUser();
    var role = window.GT.session.roleLabel(user.role);
    var avatar = '<span class="user-avatar" aria-hidden="true">' + escapeText(userInitials(user.name)) + '</span>';
    document.getElementById('appTopbar').innerHTML = '<button class="icon-button menu-button" id="sidebarToggle" aria-label="Open navigation"><i data-lucide="menu"></i></button><div class="topbar-context topbar-title" id="topbarContext"><span class="topbar-mobile-title">Genuine Textiles</span></div><div class="topbar-actions"><button class="btn btn-sm btn-outline-secondary location-switcher" disabled title="Location switching awaits answer A-13">Locations pending</button>' + actionButton('New Invoice', '#/invoices/new', 'invoices') + actionButton('New Receipt', '#/receipts/new', 'receipts') + actionButton('Quick Sale', '#/sales/quick-sale', 'quick_sale') + inventoryNotifications() + '<div class="user-menu">' +
      '<button class="user-menu-trigger" id="userMenuButton" type="button" aria-label="User menu" aria-haspopup="menu" aria-controls="userDropdown" aria-expanded="false">' + avatar + '<span class="user-menu-copy"><span class="user-menu-name">' + escapeText(user.name) + '</span><span class="user-menu-role">' + escapeText(role) + '</span></span><i class="user-menu-chevron" data-lucide="chevron-down" aria-hidden="true"></i></button>' +
      '<div class="user-dropdown" id="userDropdown" role="menu" aria-labelledby="userMenuButton"><div class="user-menu-header">' + avatar + '<strong>' + escapeText(user.name) + '</strong><span class="user-role-chip">' + escapeText(role) + '</span><span class="user-menu-email">' + escapeText(user.email || 'No email recorded') + '</span></div>' +
      '<button class="user-menu-item" type="button" id="switchRole" role="menuitem"><i data-lucide="repeat" aria-hidden="true"></i><span>Demo: switch role</span><span class="demo-menu-badge">Demo</span></button><div class="user-menu-divider" role="separator"></div><button class="user-menu-item logout" type="button" id="logoutButton" role="menuitem"><i data-lucide="log-out" aria-hidden="true"></i><span>Log out</span></button></div></div></div>';
    bindTopbar();
  }

  function bindTopbar() {
    var sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) sidebarToggle.addEventListener('click', toggleDrawer);
    bindPopover('notificationsButton', 'notificationsPanel');
    bindUserMenu();
    document.getElementById('logoutButton').addEventListener('click', function () { window.GT.session.logout(); window.location.href = 'login.html'; });
    document.getElementById('switchRole').addEventListener('click', function () { closeUserMenu(false); switchDemoRole(); });
  }

  function closeUserMenu(returnFocus) {
    var button = document.getElementById('userMenuButton');
    var menu = document.getElementById('userDropdown');
    if (!button || !menu) return;
    menu.classList.remove('open');
    button.setAttribute('aria-expanded', 'false');
    if (returnFocus) button.focus({ preventScroll: true });
  }

  function bindUserMenu() {
    if (removeUserMenuListeners) removeUserMenuListeners();
    var button = document.getElementById('userMenuButton');
    var menu = document.getElementById('userDropdown');
    if (!button || !menu) return;

    function items() { return Array.from(menu.querySelectorAll('[role="menuitem"]')); }
    function position() {
      var buttonRect = button.getBoundingClientRect();
      var menuRect = menu.getBoundingClientRect();
      menu.style.left = Math.max(8, Math.min(buttonRect.right - menuRect.width, window.innerWidth - menuRect.width - 8)) + 'px';
      menu.style.top = Math.max(8, Math.min(buttonRect.bottom + 8, window.innerHeight - menuRect.height - 8)) + 'px';
    }
    function open(focusFirst) {
      menu.classList.add('open');
      button.setAttribute('aria-expanded', 'true');
      position();
      if (focusFirst && items()[0]) items()[0].focus({ preventScroll: true });
    }
    function toggle() {
      if (menu.classList.contains('open')) closeUserMenu(false);
      else open(false);
    }
    function onButtonKeydown(event) {
      if (event.key === 'ArrowDown') { event.preventDefault(); open(true); }
      if (event.key === 'Escape' && menu.classList.contains('open')) { event.preventDefault(); closeUserMenu(true); }
    }
    function onMenuKeydown(event) {
      var menuItems = items();
      var current = menuItems.indexOf(document.activeElement);
      if (event.key === 'Escape') { event.preventDefault(); closeUserMenu(true); return; }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].indexOf(event.key) === -1) return;
      event.preventDefault();
      if (event.key === 'Home') current = 0;
      else if (event.key === 'End') current = menuItems.length - 1;
      else if (event.key === 'ArrowDown') current = current < 0 || current === menuItems.length - 1 ? 0 : current + 1;
      else current = current <= 0 ? menuItems.length - 1 : current - 1;
      if (menuItems[current]) menuItems[current].focus({ preventScroll: true });
    }
    function onOutside(event) {
      if (menu.classList.contains('open') && !menu.contains(event.target) && !button.contains(event.target)) closeUserMenu(false);
    }
    function onViewportChange() { if (menu.classList.contains('open')) closeUserMenu(false); }

    button.addEventListener('click', toggle);
    button.addEventListener('keydown', onButtonKeydown);
    menu.addEventListener('keydown', onMenuKeydown);
    document.addEventListener('pointerdown', onOutside);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    removeUserMenuListeners = function () {
      document.removeEventListener('pointerdown', onOutside);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
      removeUserMenuListeners = null;
    };
  }

  function bindPopover(buttonId, panelId) {
    var button = document.getElementById(buttonId);
    if (!button) return;
    button.addEventListener('click', function () {
      var panel = document.getElementById(panelId);
      panel.classList.toggle('open');
      this.setAttribute('aria-expanded', panel.classList.contains('open'));
    });
  }

  // This switcher is prototype-only and deliberately reads the seeded users table.
  function switchDemoRole() {
    var options = window.GT.session.users().map(function (user) {
      return '<option value="' + user.id + '">' + escapeText(user.name) + ' — ' + window.GT.session.roleLabel(user.role) + '</option>';
    }).join('');
    window.GT.components.openModal({ title: 'Demo: switch role', content: '<p>This prototype control is not part of the production system.</p><select class="form-select" id="demoRoleSelect">' + options + '</select><div class="gt-modal-actions"><button class="btn btn-primary" type="button" id="applyDemoRole">Switch user</button></div>' });
    document.getElementById('applyDemoRole').addEventListener('click', function () {
      window.GT.session.loginAsUser(document.getElementById('demoRoleSelect').value);
      window.location.hash = '#/dashboard';
      window.location.reload();
    });
  }

  function toggleDrawer() {
    document.getElementById('appSidebar').classList.toggle('open');
    document.getElementById('sidebarScrim').classList.toggle('open');
  }

  function closeDrawer() {
    document.getElementById('appSidebar').classList.remove('open');
    document.getElementById('sidebarScrim').classList.remove('open');
  }

  function setPageTitle(label) {
    document.title = label + ' | ' + window.GT.settings.businessName;
    var route = window.GT.router.match(window.location.hash || '#/dashboard');
    var baseRoute = route ? route.route.baseRoute : (window.location.hash || '#/dashboard');
    var trail = window.GT.navigation.trail(baseRoute);
    var current = document.querySelector('#pageContent h1');
    var currentLabel = current ? current.textContent.trim() : label;
    var parts = [];
    if (trail && trail.group) parts.push('<a href="' + escapeText(trail.groupRoute) + '">' + escapeText(trail.group) + '</a>');
    if (trail && trail.item && trail.item.label !== currentLabel) parts.push('<a href="' + escapeText(trail.item.route) + '">' + escapeText(trail.item.label) + '</a>');
    parts.push('<strong aria-current="page">' + escapeText(currentLabel) + '</strong>');
    var context = document.getElementById('topbarContext');
    context.innerHTML = '<nav class="topbar-breadcrumb" aria-label="Breadcrumb">' + parts.join('<span aria-hidden="true">/</span>') + '</nav><span class="topbar-mobile-title">' + escapeText(currentLabel) + '</span>';
  }

  function markActiveRoute(route) {
    var sidebar = document.getElementById('appSidebar');
    var links = Array.from(sidebar.querySelectorAll('[data-route]'));
    var active = links.find(function (link) { return link.dataset.route === route; }) || links[0];
    links.forEach(function (link) {
      link.classList.toggle('active', link === active);
      if (link === active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    // UI_CHECKLIST.md shell rule: a direct URL or in-app link reveals its active group.
    if (active) setGroupOpen(active.closest('.nav-group'), true);
  }

  function renderPage() {
    var route = window.location.hash || '#/dashboard';
    var routeMatch = window.GT.router.match(route);
    var routeConfig = routeMatch ? routeMatch.route : null;
    var activeRoute = window.GT.navigation.findRoute(route) ? route : (routeConfig ? routeConfig.baseRoute : route);
    markActiveRoute(activeRoute);
    var item = window.GT.navigation.findRoute(route) || (routeConfig ? window.GT.navigation.findRoute(routeConfig.baseRoute) : null);
    var content = document.getElementById('pageContent');
    if (!item) {
      content.innerHTML = '<section class="page-placeholder"><h1>Page not found</h1><p>The address does not match a Genuine Textiles page.</p><a class="btn btn-primary" href="#/dashboard">Go to dashboard</a></section>';
      setPageTitle('Page not found');
      return;
    }
    var permission = routeConfig ? routeConfig.permission : item.permission;
    var permissionAction = routeConfig ? (routeConfig.action || 'V') : 'V';
    if (!window.GT.permissions.can(permission, permissionAction)) {
      content.innerHTML = '<section class="page-placeholder"><h1>Access denied</h1><p>Your role does not have permission to view this page.</p></section>';
      setPageTitle('Access denied');
      return;
    }
    if (routeConfig) {
      content.innerHTML = routeConfig.module.render(routeConfig.view, routeMatch.params);
      routeConfig.module.bind(routeConfig.view, routeMatch.params);
    } else if (window.GT.adminData.handles(route)) {
      content.innerHTML = window.GT.adminData.render(route);
      window.GT.adminData.bind(route);
    } else {
      content.innerHTML = '<section class="page-placeholder"><h1>' + item.label + '</h1><p>' + (item.description || 'This screen is planned for a later phase.') + '</p><span class="badge text-bg-light border">Built in a later phase</span></section>';
    }
    setPageTitle(routeConfig ? routeConfig.title : item.label);
    closeDrawer();
    window.GT.components.refreshIcons();
  }

  function handleRouteChange() {
    var nextRoute = window.location.hash || '#/dashboard';
    if (window.GT.forms.hasUnsavedChanges() && !window.confirm('You have unsaved changes. Leave this page?')) {
      window.history.replaceState({}, '', window.location.pathname + window.location.search + currentRoute);
      return;
    }
    window.GT.forms.clearDirty();
    currentRoute = nextRoute;
    renderPage();
    window.scrollTo(0, 0);
  }

  function refreshChrome() {
    renderSidebar();
    renderTopbar();
    var footer = document.getElementById('footerBusinessName');
    if (footer) footer.textContent = window.GT.settings.businessName;
    var matched = window.GT.router.match(window.location.hash || '#/dashboard');
    var route = window.location.hash || '#/dashboard';
    markActiveRoute(window.GT.navigation.findRoute(route) ? route : (matched ? matched.route.baseRoute : route));
    var heading = document.querySelector('#pageContent h1');
    if (heading) setPageTitle(heading.textContent.trim());
    window.GT.components.refreshIcons();
  }

  function showResetNotice() {
    var query = new URLSearchParams(window.location.search);
    if (!query.has('demo_reset')) return;
    window.GT.components.showToast('Demo data restored to seed ' + window.GT.store.version + '.', 'success');
    window.history.replaceState({}, '', 'index.html' + window.location.hash);
  }

  function handleStockChanged() {
    refreshChrome();
    var route = window.location.hash || '';
    if (route === '#/inventory/materials' || /^#\/inventory\/materials\/\d+$/.test(route) || route === '#/inventory/movements' || route === '#/inventory/alerts') renderPage();
  }

  function start() {
    if (!window.GT.session.currentUser()) { window.location.href = 'login.html'; return; }
    renderSidebar();
    renderTopbar();
    document.getElementById('sidebarScrim').addEventListener('click', closeDrawer);
    currentRoute = window.location.hash || '#/dashboard';
    window.addEventListener('hashchange', handleRouteChange);
    window.addEventListener('gt:stock-changed', handleStockChanged);
    window.addEventListener('gt:adjustment-changed', function () { refreshChrome(); if ((window.location.hash || '').indexOf('#/inventory/adjustments') === 0) renderPage(); });
    window.addEventListener('gt:debtor-changed', function () { refreshChrome(); if (/^#\/(debtors|ageing|statements|reminders)/.test(window.location.hash || '')) renderPage(); });
    window.addEventListener('gt:receipt-changed', function () { refreshChrome(); if (/^#\/(debtors|ageing|statements|reminders)/.test(window.location.hash || '')) renderPage(); });
    window.addEventListener('gt:material-issue-changed', function () { refreshChrome(); });
    window.addEventListener('gt:expense-changed', function () { refreshChrome(); });
    renderPage();
    showResetNotice();
    window.GT.components.refreshIcons();
    window.setTimeout(window.GT.components.refreshIcons, 500);
  }

  return { start: start, renderPage: renderPage, refreshChrome: refreshChrome };
}());
