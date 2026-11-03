/* Browser fake database. This is the only project file allowed to access localStorage. */
window.GT.store = (function () {
  var version = window.GT.mockData.version;
  var rootPrefix = 'gt.store.';
  var prefix = rootPrefix + version + '.';
  var versionKey = rootPrefix + 'seed_version';

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function tableInfo(name) {
    var info = window.GT.schema.find(name);
    if (!info) throw new Error('Unknown table: ' + name);
    return info;
  }

  function key(name) {
    tableInfo(name);
    return prefix + name;
  }

  function read(name) {
    var stored = localStorage.getItem(key(name));
    return stored ? JSON.parse(stored) : [];
  }

  function write(name, rows) {
    localStorage.setItem(key(name), JSON.stringify(rows));
  }

  function seed() {
    var seededAt = window.GT.mockData.seededAt;
    window.GT.schema.tables.forEach(function (info) {
      var rows = window.GT.mockData.tables[info.name] || [];
      write(info.name, rows.map(function (record) {
        var copy = clone(record);
        copy.created_at = copy.created_at || seededAt;
        copy.updated_at = copy.updated_at || seededAt;
        return copy;
      }));
    });
    localStorage.setItem(versionKey, version);
  }

  function clearStoreKeys() {
    var keys = [];
    for (var index = 0; index < localStorage.length; index += 1) {
      var storedKey = localStorage.key(index);
      if (storedKey && storedKey.indexOf(rootPrefix) === 0) keys.push(storedKey);
    }
    keys.forEach(function (storedKey) { localStorage.removeItem(storedKey); });
  }

  function init() {
    if (localStorage.getItem(versionKey) !== version) {
      clearStoreKeys();
      seed();
    }
    window.GT.schema.tables.forEach(function (info) {
      if (localStorage.getItem(key(info.name)) === null) write(info.name, []);
    });
    return api;
  }

  function all(name) {
    return clone(read(name));
  }

  function find(name, id) {
    var match = read(name).find(function (record) { return Number(record.id) === Number(id); });
    return match ? clone(match) : null;
  }

  function where(name, filter) {
    var rows = read(name);
    var predicate = typeof filter === 'function' ? filter : function (record) {
      return Object.keys(filter || {}).every(function (field) { return record[field] === filter[field]; });
    };
    return clone(rows.filter(predicate));
  }

  function create(name, record) {
    var rows = read(name);
    var now = new Date().toISOString();
    var nextId = rows.reduce(function (highest, item) { return Math.max(highest, Number(item.id) || 0); }, 0) + 1;
    var created = Object.assign({}, clone(record), { id: nextId, created_at: now, updated_at: now });
    rows.push(created);
    write(name, rows);
    return clone(created);
  }

  function update(name, id, changes) {
    var rows = read(name);
    var index = rows.findIndex(function (record) { return Number(record.id) === Number(id); });
    if (index === -1) return null;
    var safeChanges = clone(changes || {});
    delete safeChanges.id;
    rows[index] = Object.assign({}, rows[index], safeChanges, { updated_at: new Date().toISOString() });
    write(name, rows);
    return clone(rows[index]);
  }

  function remove(name, id) {
    if (tableInfo(name).protected) throw new Error(name + ' is protected; void it instead.');
    var rows = read(name);
    var kept = rows.filter(function (record) { return Number(record.id) !== Number(id); });
    if (kept.length === rows.length) return false;
    write(name, kept);
    return true;
  }

  function count(name) {
    return read(name).length;
  }

  function transaction(work) {
    // Document posting spans several protected tables. Snapshot them so a thrown
    // validation or stock error cannot leave a half-posted document in the prototype.
    var snapshots = {};
    window.GT.schema.tables.forEach(function (info) { snapshots[info.name] = read(info.name); });
    try { return work(api); }
    catch (error) {
      Object.keys(snapshots).forEach(function (name) { write(name, snapshots[name]); });
      throw error;
    }
  }

  function reset() {
    clearStoreKeys();
    seed();
    return api;
  }

  var api = { init: init, all: all, find: find, where: where, create: create, update: update, remove: remove, count: count, transaction: transaction, reset: reset, version: version };
  return api;
}());

window.GT.store.init();
