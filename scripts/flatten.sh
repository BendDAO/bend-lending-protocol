#!/bin/bash
set -x #echo on

rm -rf ./flattened/*

npx hardhat flatten contracts/protocol/LendPoolAddressesProviderRegistry.sol > ./flattened/LendPoolAddressesProviderRegistry.sol
npx hardhat flatten contracts/protocol/LendPoolAddressesProvider.sol > ./flattened/LendPoolAddressesProvider.sol
npx hardhat flatten contracts/protocol/LendPoolConfigurator.sol > ./flattened/LendPoolConfigurator.sol
npx hardhat flatten contracts/protocol/LendPool.sol > ./flattened/LendPool.sol
npx hardhat flatten contracts/protocol/LendPoolLoan.sol > ./flattened/LendPoolLoan.sol
npx hardhat flatten contracts/protocol/NFTOracle.sol > ./flattened/NFTOracle.sol
npx hardhat flatten contracts/protocol/ReserveOracle.sol > ./flattened/ReserveOracle.sol
npx hardhat flatten contracts/protocol/WETHGateway.sol > ./flattened/WETHGateway.sol
npx hardhat flatten contracts/protocol/PunkGateway.sol > ./flattened/PunkGateway.sol
npx hardhat flatten contracts/protocol/BToken.sol > ./flattened/BToken.sol
npx hardhat flatten contracts/protocol/DebtToken.sol > ./flattened/DebtToken.sol
npx hardhat flatten contracts/protocol/InterestRate.sol > ./flattened/InterestRate.sol
npx hardhat flatten contracts/protocol/BNFTRegistry.sol > ./flattened/BNFTRegistry.sol
npx hardhat flatten contracts/protocol/BNFT.sol > ./flattened/BNFT.sol
