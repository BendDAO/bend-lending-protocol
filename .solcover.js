const accounts = require(`./test-wallets.js`).accounts;

module.exports = {
  silent: true,
  configureYulOptimizer: true,
  skipFiles: ['./mocks', './interfaces'],
  mocha: {
    enableTimeouts: false,
  },
  providerOptions: {
    accounts,
  },
};
