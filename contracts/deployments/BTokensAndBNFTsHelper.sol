// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {LendPool} from "../protocol/LendPool.sol";
import {LendPoolAddressesProvider} from "../protocol/LendPoolAddressesProvider.sol";
import {LendPoolConfigurator} from "../protocol/LendPoolConfigurator.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract BTokensAndBNFTsHelper is Ownable {
  address payable private pool;
  address private addressesProvider;
  address private poolConfigurator;

  struct ConfigureReserveInput {
    address asset;
    uint256 reserveFactor;
    bool borrowingEnabled;
  }

  struct ConfigureNftInput {
    address asset;
    uint256 baseLTV;
    uint256 liquidationThreshold;
    uint256 liquidationBonus;
    uint256 redeemDuration;
    uint256 auctionDuration;
    uint256 redeemFine;
  }

  constructor(
    address payable _pool,
    address _addressesProvider,
    address _poolConfigurator
  ) {
    pool = _pool;
    addressesProvider = _addressesProvider;
    poolConfigurator = _poolConfigurator;
  }

  function configureReserves(ConfigureReserveInput[] calldata inputParams) external onlyOwner {
    LendPoolConfigurator configurator = LendPoolConfigurator(poolConfigurator);
    for (uint256 i = 0; i < inputParams.length; i++) {
      if (inputParams[i].borrowingEnabled) {
        configurator.enableBorrowingOnReserve(inputParams[i].asset);
      }
      configurator.setReserveFactor(inputParams[i].asset, inputParams[i].reserveFactor);
    }
  }

  function configureNfts(ConfigureNftInput[] calldata inputParams) external onlyOwner {
    LendPoolConfigurator configurator = LendPoolConfigurator(poolConfigurator);
    for (uint256 i = 0; i < inputParams.length; i++) {
      configurator.configureNftAsCollateral(
        inputParams[i].asset,
        inputParams[i].baseLTV,
        inputParams[i].liquidationThreshold,
        inputParams[i].liquidationBonus
      );
      configurator.configureNftAsAuction(
        inputParams[i].asset,
        inputParams[i].redeemDuration,
        inputParams[i].auctionDuration,
        inputParams[i].redeemFine
      );
    }
  }
}
