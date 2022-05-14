// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {ILendPoolConfigurator} from "../interfaces/ILendPoolConfigurator.sol";

import {LendPoolAddressesProvider} from "../protocol/LendPoolAddressesProvider.sol";
import {LendPoolConfigurator} from "../protocol/LendPoolConfigurator.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract BTokensAndBNFTsHelper is Ownable {
  LendPoolAddressesProvider public addressesProvider;

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
    uint256 redeemThreshold;
    uint256 minBidFine;
  }

  constructor(address _addressesProvider) {
    addressesProvider = LendPoolAddressesProvider(_addressesProvider);
  }

  function configureReserves(ConfigureReserveInput[] calldata inputParams) external onlyOwner {
    LendPoolConfigurator configurator = LendPoolConfigurator(addressesProvider.getLendPoolConfigurator());

    address[] memory assets = new address[](1);
    ILendPoolConfigurator.ConfigReserveInput[] memory cfgInputs = new ILendPoolConfigurator.ConfigReserveInput[](
      inputParams.length
    );

    for (uint256 i = 0; i < inputParams.length; i++) {
      assets[0] = inputParams[i].asset;
      if (inputParams[i].borrowingEnabled) {
        configurator.setBorrowingFlagOnReserve(assets, true);
      }

      cfgInputs[i].asset = inputParams[i].asset;
      cfgInputs[i].reserveFactor = inputParams[i].reserveFactor;
    }

    configurator.batchConfigReserve(cfgInputs);
  }

  function configureNfts(ConfigureNftInput[] calldata inputParams) external onlyOwner {
    LendPoolConfigurator configurator = LendPoolConfigurator(addressesProvider.getLendPoolConfigurator());

    ILendPoolConfigurator.ConfigNftInput[] memory cfgInputs = new ILendPoolConfigurator.ConfigNftInput[](
      inputParams.length
    );

    for (uint256 i = 0; i < inputParams.length; i++) {
      cfgInputs[i].asset = inputParams[i].asset;

      cfgInputs[i].baseLTV = inputParams[i].baseLTV;
      cfgInputs[i].liquidationThreshold = inputParams[i].liquidationThreshold;
      cfgInputs[i].liquidationBonus = inputParams[i].liquidationBonus;

      cfgInputs[i].redeemDuration = inputParams[i].redeemDuration;
      cfgInputs[i].auctionDuration = inputParams[i].auctionDuration;
      cfgInputs[i].redeemFine = inputParams[i].redeemFine;
      cfgInputs[i].redeemThreshold = inputParams[i].redeemThreshold;
      cfgInputs[i].minBidFine = inputParams[i].minBidFine;
    }

    configurator.batchConfigNft(cfgInputs);
  }
}
