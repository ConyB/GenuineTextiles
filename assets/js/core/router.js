/* Tiny hash-route registry. Static segments match literally and :name segments become params. */
window.GT = window.GT || {};
window.GT.router = (function () {
  var routes = [];

  function segments(value) {
    return String(value || '').replace(/^#\/?/, '').replace(/\/$/, '').split('/').filter(Boolean);
  }

  function register(pattern, config) {
    routes.push({ pattern: pattern, segments: segments(pattern), config: config });
  }

  function match(hash) {
    var path = String(hash || '').split('?')[0];
    var pathSegments = segments(path);
    for (var index = 0; index < routes.length; index += 1) {
      var route = routes[index];
      if (route.segments.length !== pathSegments.length) continue;
      var params = {};
      var matches = route.segments.every(function (part, partIndex) {
        if (part.charAt(0) === ':') {
          params[part.slice(1)] = decodeURIComponent(pathSegments[partIndex]);
          return true;
        }
        return part === pathSegments[partIndex];
      });
      if (matches) return { route: route.config, params: params, pattern: route.pattern };
    }
    return null;
  }

  return { register: register, match: match };
}());
