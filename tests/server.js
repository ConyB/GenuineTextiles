// Tiny dependency-free static server used only while Playwright runs the prototype.
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const types = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.jpeg': 'image/jpeg', '.png': 'image/png' };
function createServer() { return http.createServer((request, response) => {
  const urlPath = decodeURIComponent(request.url.split('?')[0]);
  const requested = path.resolve(root, '.' + (urlPath === '/' ? '/login.html' : urlPath));
  if (!requested.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return; }
  fs.readFile(requested, (error, file) => {
    if (error) { response.writeHead(404); response.end('Not found'); return; }
    response.writeHead(200, { 'Content-Type': types[path.extname(requested)] || 'application/octet-stream' });
    response.end(file);
  });
}); }

// Keep direct use available for manual local browsing.
if (require.main === module) createServer().listen(4173, '127.0.0.1');
module.exports = createServer;
