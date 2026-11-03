/* Audit writer used by modules for every create, update, state change and delete. */
window.GT = window.GT || {};
window.GT.audit = {
  log: function (action, entityType, entityId, before, after) {
    var user = window.GT.session.currentUser();
    return window.GT.store.create('audit_logs', {
      user_id: user ? user.id : null,
      action: action,
      entity_type: entityType,
      entity_id: Number(entityId),
      before_json: before ? JSON.stringify(before) : null,
      after_json: after ? JSON.stringify(after) : null
    });
  }
};
