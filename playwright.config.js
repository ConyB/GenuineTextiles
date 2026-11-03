// Playwright configuration for the static Genuine Textiles prototype.
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({ testDir: './tests/e2e', use: { baseURL: 'http://127.0.0.1:4173' }, globalSetup: require.resolve('./tests/server-setup.js') });
