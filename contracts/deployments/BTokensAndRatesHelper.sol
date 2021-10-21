// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {LendPool} from "../protocol/LendPool.sol";
import {LendPoolAddressesProvider} from "../protocol/LendPoolAddressesProvider.sol";
import {LendPoolConfigurator} from "../protocol/LendPoolConfigurator.sol";
import {BToken} from "../protocol/BToken.sol";
import {InterestRate} from "../protocol/InterestRate.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract BTokensAndRatesHelper is Ownable {
    address payable private pool;
    address private addressesProvider;
    address private poolConfigurator;

    event deployedContracts(address bToken, address rate);

    struct InitDeploymentInput {
        address asset;
        uint256[4] rates;
    }

    struct ConfigureReserveInput {
        address asset;
        uint256 baseLTV;
        uint256 liquidationThreshold;
        uint256 liquidationBonus;
        uint256 reserveFactor;
        bool borrowingEnabled;
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

    function initDeployment(InitDeploymentInput[] calldata inputParams)
        external
        onlyOwner
    {
        for (uint256 i = 0; i < inputParams.length; i++) {
            emit deployedContracts(
                address(new BToken()),
                address(
                    new InterestRate(
                        LendPoolAddressesProvider(addressesProvider),
                        inputParams[i].rates[0],
                        inputParams[i].rates[1],
                        inputParams[i].rates[2],
                        inputParams[i].rates[3]
                    )
                )
            );
        }
    }

    function configureReserves(ConfigureReserveInput[] calldata inputParams)
        external
        onlyOwner
    {
        LendPoolConfigurator configurator = LendPoolConfigurator(
            poolConfigurator
        );
        for (uint256 i = 0; i < inputParams.length; i++) {
            /* not support reserve as collateral
      configurator.configureReserveAsCollateral(
        inputParams[i].asset,
        inputParams[i].baseLTV,
        inputParams[i].liquidationThreshold,
        inputParams[i].liquidationBonus
      );
      */

            if (inputParams[i].borrowingEnabled) {
                configurator.enableBorrowingOnReserve(inputParams[i].asset);
            }
            configurator.setReserveFactor(
                inputParams[i].asset,
                inputParams[i].reserveFactor
            );
        }
    }
}
