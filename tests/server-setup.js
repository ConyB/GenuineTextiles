// Playwright owns this in-process server so Windows teardown does not need taskkill.
const createServer = require('./server');

module.exports = async function startTestServer() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(4173, '127.0.0.1', resolve);
  });
  return async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  };
};
