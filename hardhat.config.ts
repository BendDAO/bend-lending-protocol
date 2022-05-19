import path from "path";
import fs from "fs";
import { HardhatUserConfig } from "hardhat/types";
// @ts-ignore
import { accounts } from "./test-wallets.js";
import { eEthereumNetwork, eNetwork } from "./helpers/types";
import { BUIDLEREVM_CHAINID, COVERAGE_CHAINID } from "./helpers/buidler-constants";
import { NETWORKS_RPC_URL, NETWORKS_DEFAULT_GAS, BLOCK_TO_FORK, buildForkConfig } from "./helper-hardhat-config";

require("dotenv").config();

import {bootstrap} from 'global-agent'
if (process.env.GLOBAL_AGENT_HTTP_PROXY) {
  console.log("Enable Global Agent:", process.env.GLOBAL_AGENT_HTTP_PROXY);
  bootstrap();
}

import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-gas-reporter";
import 'hardhat-contract-sizer';
import 'hardhat-dependency-compiler';
import "solidity-coverage";
import { fork } from "child_process";
require('hardhat-storage-layout-diff');

const SKIP_LOAD = process.env.SKIP_LOAD === "true";
const DEFAULT_BLOCK_GAS_LIMIT = 12450000;
const DEFAULT_GAS_MUL = 5;
const HARDFORK = "london";
const ETHERSCAN_KEY = process.env.ETHERSCAN_KEY || "";
const MNEMONIC_PATH = "m/44'/60'/0'/0";
const MNEMONIC = process.env.MNEMONIC || "";
const UNLIMITED_BYTECODE_SIZE = process.env.UNLIMITED_BYTECODE_SIZE === "true";
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

// Prevent to load scripts before compilation and typechain
if (!SKIP_LOAD) {
  ["misc", "migrations", "dev", "full", "verifications", "deployments", "helpers"].forEach((folder) => {
    const tasksPath = path.join(__dirname, "tasks", folder);
    fs.readdirSync(tasksPath)
      .filter((pth) => pth.includes(".ts"))
      .forEach((task) => {
        require(`${tasksPath}/${task}`);
      });
  });
}

require(`${path.join(__dirname, "tasks/misc")}/set-bre.ts`);

const getCommonNetworkConfig = (networkName: eNetwork, networkId: number) => ({
  url: NETWORKS_RPC_URL[networkName],
  hardfork: HARDFORK,
  blockGasLimit: DEFAULT_BLOCK_GAS_LIMIT,
  gasMultiplier: DEFAULT_GAS_MUL,
  gasPrice: NETWORKS_DEFAULT_GAS[networkName],
  chainId: networkId,
  accounts: PRIVATE_KEY
  ? [PRIVATE_KEY]
  : {
    mnemonic: MNEMONIC,
    path: MNEMONIC_PATH,
    initialIndex: 0,
    count: 20,
  },
});

const buidlerConfig: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.4",
        settings: {
          optimizer: { enabled: true, runs: 200 },
          evmVersion: "istanbul",
        },
      },
    ],
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: false,
    disambiguatePaths: false,
  },
  typechain: {
    outDir: "types",
    target: "ethers-v5",
  },
  etherscan: {
    apiKey: ETHERSCAN_KEY,
  },
  mocha: {
    timeout: 0,
  },
  networks: {
    coverage: {
      hardfork: "istanbul",
      url: "http://localhost:8555",
      chainId: COVERAGE_CHAINID,
    },
    localhost: {
      hardfork: "london",
      url: "http://localhost:8545",
      chainId: BUIDLEREVM_CHAINID,
      accounts: accounts.map(({ secretKey, balance }: { secretKey: string; balance: string }) => (secretKey)),
    },
    develop: getCommonNetworkConfig(eEthereumNetwork.develop, 4),
    rinkeby: getCommonNetworkConfig(eEthereumNetwork.rinkeby, 4),
    kovan: getCommonNetworkConfig(eEthereumNetwork.kovan, 42),
    main: getCommonNetworkConfig(eEthereumNetwork.main, 1),
    hardhat: {
      hardfork: "london",
      blockGasLimit: DEFAULT_BLOCK_GAS_LIMIT,
      gas: DEFAULT_BLOCK_GAS_LIMIT,
      gasPrice: NETWORKS_DEFAULT_GAS[eEthereumNetwork.hardhat],
      allowUnlimitedContractSize: UNLIMITED_BYTECODE_SIZE,
      chainId: BUIDLEREVM_CHAINID,
      throwOnTransactionFailures: true,
      throwOnCallFailures: true,
      accounts: accounts.map(({ secretKey, balance }: { secretKey: string; balance: string }) => ({
        privateKey: secretKey,
        balance: balance,
      })),
      forking: buildForkConfig(),
    },
    ganache: {
      hardfork: "istanbul",
      url: "http://ganache:8545",
      accounts: {
        mnemonic: "fox sight canyon orphan hotel grow hedgehog build bless august weather swarm",
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
      },
    },
  },
};

export default buidlerConfig;
