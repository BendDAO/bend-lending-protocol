const accounts = require(`./test-wallets.js`).accounts;

module.exports = {
  skipFiles: ['./mocks', './interfaces'],
  mocha: {
    enableTimeouts: false,
  },
  providerOptions: {
    accounts,
  },
};
