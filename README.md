[![Build pass](https://github.com/BendDAO/bend-protocol/actions/workflows/node.js.yml/badge.svg)](https://github.com/BendDAO/bend-protocol/actions/workflows/node.js.yml)
[![codecov](https://codecov.io/gh/BendDAO/bend-protocol/branch/main/graph/badge.svg?token=Z4Y9S158JS)](https://codecov.io/gh/BendDAO/bend-protocol)

```
'########::'########:'##::: ##:'########::
 ##.... ##: ##.....:: ###:: ##: ##.... ##:
 ##:::: ##: ##::::::: ####: ##: ##:::: ##:
 ########:: ######::: ## ## ##: ##:::: ##:
 ##.... ##: ##...:::: ##. ####: ##:::: ##:
 ##:::: ##: ##::::::: ##:. ###: ##:::: ##:
 ########:: ########: ##::. ##: ########::
........:::........::..::::..::........:::                              
```

# Bend Protocol

This repository contains the smart contracts source code and markets configuration for Bend Protocol. The repository uses Hardhat as development enviroment for compilation, testing and deployment tasks.

## What is Bend?

Bend is a decentralized non-custodial NFT lending protocol where users can participate as depositors or borrowers. Depositors provide liquidity to the market to earn a passive income, while borrowers are able to borrow in an overcollateralized fashion, using NFTs as collaterl.

## Documentation

The documentation of Bend Protocol is in the following [Bend documentation](https://docs.benddao.xyz) link. At the documentation you can learn more about the protocol, see the contract interfaces, integration guides and audits.

For getting the latest contracts addresses, please check the [Deployed contracts](https://docs.benddao.xyz/developers/deployed-contracts) page at the documentation to stay up to date.

## Audits
1. [Verilog Solutions Online Report](https://hackmd.io/@verilog/benddao-audit).
2. [Certik Online Report](https://www.certik.com/projects/bend-dao).

## Thanks
Bend protocol refers to the architecture design and adopts some of the code of [AAVE](https://github.com/aave).
We are very grateful to AAVE for providing us with an excellent DeFi platform.

## Connect with the community

You can join at the [Discord](https://discord.gg/benddao) channel or at the [Governance](https://snapshot.org/#/benddao.eth) for asking questions about the protocol or talk about Bend with other peers.

## Getting Started

You can install `@benddao/bend-protocol` as an NPM package in your Hardhat, Buidler or Truffle project to import the contracts and interfaces:

`npm install @benddao/bend-protocol`

Import at Solidity files:

```
import {ILendPool} from "@benddao/bend-protocol/contracts/interfaces/ILendPool.sol";

contract Misc {

  function deposit(address pool, address token, address user, uint256 amount) public {
    ILendPool(pool).deposit(token, amount, user, 0);
    {...}
  }
}
```

The JSON artifacts with the ABI and Bytecode are also included into the bundled NPM package at `artifacts/` directory.

Import JSON file via Node JS `require`:

```
const LendPoolArtifact = require('@benddao/bend-protocol/artifacts/contracts/protocol/LendPool.sol/LendPool.json');

// Log the ABI into console
console.log(LendPoolArtifact.abi)
```

## Setup

The repository uses Docker Compose to manage sensitive keys and load the configuration. Prior any action like test or deploy, you must run `docker-compose up` to start the `contracts-env` container, and then connect to the container console via `docker-compose exec contracts-env bash`.

Follow the next steps to setup the repository:

- Install `docker` and `docker-compose`
- Create an enviroment file named `.env` and fill the next enviroment variables

```
# Mnemonic, only first address will be used
MNEMONIC=""

# Add Alchemy or Infura provider keys, alchemy takes preference at the config level
ALCHEMY_KEY=""
INFURA_KEY=""

# Optional Etherscan key, for automatize the verification of the contracts at Etherscan
ETHERSCAN_KEY=""

```

## Markets configuration

The configurations related with the Bend Markets are located at `markets` directory. You can follow the `IBendConfiguration` interface to create new Markets configuration or extend the current Bend configuration.

Each market should have his own Market configuration file, and their own set of deployment tasks, using the Bend market config and tasks as a reference.

## Test

You can run the full test suite with the following commands:

```
# In one terminal
docker-compose up

# Open another tab or terminal
docker-compose exec contracts-env bash

# install dependencies
yarn install

# A new Bash terminal is prompted, connected to the container
npm run test
```

## Deployments

For deploying Bend Protocol, you can use the available scripts located at `package.json`. For a complete list, run `npm run` to see all the tasks.

### Prepare
```
# In one terminal
docker-compose up

# Open another tab or terminal
docker-compose exec contracts-env bash

# install dependencies
yarn install

# Runing NPM task
# npm run xxx
```

### Localhost dev deployment
```
# In first terminal
npm run hardhat:node

# In second terminal
npm run bend:localhost:dev:migration
```

### Localhost full deployment
```
# In first terminal
npm run hardhat:node

# In second terminal
npx hardhat --network localhost "dev:deploy-mock-reserves"
# then update pool config reserve address

npx hardhat --network localhost "dev:deploy-mock-nfts"
# then update pool config nft address

npx hardhat --network localhost "dev:deploy-mock-aggregators" --pool Bend
# then update pool config reserve aggregators address

npx hardhat --network localhost "dev:deploy-mock-bnft-registry" --pool Bend
# then update pool config bnft registry address

npx hardhat --network localhost "dev:deploy-mock-bnft-tokens" --pool Bend
```

### Rinkeby full deployment
```
# In one terminal
npm run bend:rinkeby:full:migration
```

## Interact with Bend in Mainnet via console

You can interact with Bend at Mainnet network using the Hardhat console, in the scenario where the frontend is down or you want to interact directly. You can check the deployed addresses at [deployed-contracts](https://docs.benddao.xyz/developers/deployed-contracts).

Run the Hardhat console pointing to the Mainnet network:

```
npx hardhat --network main console
```

At the Hardhat console, you can interact with the protocol:

```
// Load the HRE into helpers to access signers
run("set-DRE")

// Import getters to instance any Bend contract
const contractGetters = require('./helpers/contracts-getters');

// Load the first signer
const signer = await contractGetters.getFirstSigner();

// Lend pool instance
const lendPool = await contractGetters.getLendPool("0x3AF6fC17EbD751E4D11F5A1d6823b2aE64723B87");

// ERC20 token WETH Mainnet instance
const WETH = await contractGetters.getIErc20Detailed("0xbe4d36E2C69Aa9658e937f6cC584E60167484381");

// Approve 10 WETH to LendPool address
await WETH.connect(signer).approve(lendPool.address, ethers.utils.parseUnits('10'));

// Deposit 10 WETH
await lendPool.connect(signer).deposit(DAI.address, ethers.utils.parseUnits('10'), await signer.getAddress(), '0');
```

## Tools

This project integrates other tools commonly used alongside Hardhat in the ecosystem.

It also comes with a variety of other tools, preconfigured to work with the project code.

Try running some of the following tasks:

```shell
npx hardhat accounts
npx hardhat compile
npx hardhat clean
npx hardhat test
npx hardhat node
npx hardhat help
REPORT_GAS=true npx hardhat test
npx hardhat coverage
npx hardhat run scripts/deploy.js
node scripts/deploy.js
npx eslint '**/*.js'
npx eslint '**/*.js' --fix
npx prettier '**/*.{json,sol,md}' --check
npx prettier '**/*.{json,sol,md}' --write
npx solhint 'contracts/**/*.sol'
npx solhint 'contracts/**/*.sol' --fix
```

## Etherscan verification

To try out Etherscan verification, you first need to deploy a contract to an Ethereum network that's supported by Etherscan, such as Ropsten.

In this project, copy the .env.template file to a file named .env, and then edit it to fill in the details. Enter your Etherscan API key, your Ropsten node URL (eg from Alchemy), and the private key of the account which will send the deployment transaction. With a valid .env file in place, first deploy your contract:

```shell
hardhat run --network ropsten scripts/deploy.js
```

Then, copy the deployment address and paste it in to replace `DEPLOYED_CONTRACT_ADDRESS` in this command:

```shell
npx hardhat verify --network ropsten DEPLOYED_CONTRACT_ADDRESS "Hello, Hardhat!"
```
