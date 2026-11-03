/* Demo authentication reads users from GT.store and is the only owner of sessionStorage access. */
window.GT.session = (function () {
  var storageKey = 'gt_logged_in_user_id';

  function roleName(roleId) {
    var role = window.GT.store.find('roles', roleId);
    return role ? role.name : '';
  }

  function roleLabel(role) {
    return String(role || '').split('_').map(function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
  }

  function safeUser(user) {
    if (!user) return null;
    return { id: user.id, name: user.name, email: user.email, phone: user.phone, role_id: user.role_id, location_id: user.location_id, role: roleName(user.role_id) };
  }

  function users() {
    return window.GT.store.where('users', { active: true }).map(safeUser);
  }

  function setUser(user) {
    sessionStorage.setItem(storageKey, String(user.id));
    return safeUser(user);
  }

  function currentUser() {
    var id = Number(sessionStorage.getItem(storageKey));
    var user = id ? window.GT.store.find('users', id) : null;
    return user && user.active ? safeUser(user) : null;
  }

  function loginAsUser(id) {
    var user = window.GT.store.find('users', id);
    return user && user.active ? setUser(user) : null;
  }

  // UI_UX_SYSTEM.md sidebar state is session-only and belongs to the signed-in user.
  function uiStateKey(name) {
    return 'gt_ui_' + (sessionStorage.getItem(storageKey) || 'guest') + '_' + name;
  }

  function getUiState(name) {
    var value = sessionStorage.getItem(uiStateKey(name));
    if (value === null) return null;
    try { return JSON.parse(value); } catch (error) { return null; }
  }

  function setUiState(name, value) {
    sessionStorage.setItem(uiStateKey(name), JSON.stringify(value));
  }

  return {
    users: users,
    login: function (email, password) {
      var enteredEmail = String(email || '').toLowerCase();
      var user = window.GT.store.all('users').find(function (item) {
        return item.active && item.email.toLowerCase() === enteredEmail && item.password === password;
      });
      return user ? setUser(user) : null;
    },
    loginAsUser: loginAsUser,
    loginAsRole: function (role) {
      var roleRow = window.GT.store.where('roles', { name: role })[0];
      var user = roleRow && window.GT.store.where('users', { role_id: roleRow.id, active: true })[0];
      return user ? setUser(user) : null;
    },
    currentUser: currentUser,
    getUiState: getUiState,
    setUiState: setUiState,
    logout: function () { sessionStorage.removeItem(storageKey); },
    roleLabel: roleLabel
  };
}());
