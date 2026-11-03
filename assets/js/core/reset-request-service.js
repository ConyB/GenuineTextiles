/* A-106 and A-107: anonymous reset requests reveal no account status. */
window.GT = window.GT || {};
window.GT.resetRequests = (function () {
  function request(identifier) {
    var value = String(identifier || '').trim().slice(0, 100);
    if (!value) return false;
    var now = Date.now();
    var repeated = GT.store.where('audit_logs', { action: 'password_reset_requested' }).some(function (row) {
      var previous;
      try { previous = JSON.parse(row.after_json || '{}'); } catch (error) { return false; }
      var age = now - Date.parse(row.created_at);
      return age >= 0 && age < 60000 && String(previous.identifier || '').trim().toLowerCase() === value.toLowerCase();
    });
    if (!repeated) GT.audit.log('password_reset_requested', 'password_reset_request', 0, null, { identifier: value });
    return true;
  }
  return { request: request };
}());
