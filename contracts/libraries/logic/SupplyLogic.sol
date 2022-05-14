// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {IBToken} from "../../interfaces/IBToken.sol";

import {Errors} from "../helpers/Errors.sol";
import {DataTypes} from "../types/DataTypes.sol";

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import {ReserveLogic} from "./ReserveLogic.sol";
import {ValidationLogic} from "./ValidationLogic.sol";

/**
 * @title SupplyLogic library
 * @author Bend
 * @notice Implements the logic to supply feature
 */
library SupplyLogic {
  using SafeERC20Upgradeable for IERC20Upgradeable;
  using ReserveLogic for DataTypes.ReserveData;

  /**
   * @dev Emitted on deposit()
   * @param user The address initiating the deposit
   * @param amount The amount deposited
   * @param reserve The address of the underlying asset of the reserve
   * @param onBehalfOf The beneficiary of the deposit, receiving the bTokens
   * @param referral The referral code used
   **/
  event Deposit(
    address user,
    address indexed reserve,
    uint256 amount,
    address indexed onBehalfOf,
    uint16 indexed referral
  );

  /**
   * @dev Emitted on withdraw()
   * @param user The address initiating the withdrawal, owner of bTokens
   * @param reserve The address of the underlyng asset being withdrawn
   * @param amount The amount to be withdrawn
   * @param to Address that will receive the underlying
   **/
  event Withdraw(address indexed user, address indexed reserve, uint256 amount, address indexed to);

  /**
   * @notice Implements the supply feature. Through `deposit()`, users deposit assets to the protocol.
   * @dev Emits the `Deposit()` event.
   * @param reservesData The state of all the reserves
   * @param params The additional parameters needed to execute the deposit function
   */
  function executeDeposit(
    mapping(address => DataTypes.ReserveData) storage reservesData,
    DataTypes.ExecuteDepositParams memory params
  ) external {
    require(params.onBehalfOf != address(0), Errors.VL_INVALID_ONBEHALFOF_ADDRESS);

    DataTypes.ReserveData storage reserve = reservesData[params.asset];
    address bToken = reserve.bTokenAddress;
    require(bToken != address(0), Errors.VL_INVALID_RESERVE_ADDRESS);

    ValidationLogic.validateDeposit(reserve, params.amount);

    reserve.updateState();
    reserve.updateInterestRates(params.asset, bToken, params.amount, 0);

    IERC20Upgradeable(params.asset).safeTransferFrom(params.initiator, bToken, params.amount);

    IBToken(bToken).mint(params.onBehalfOf, params.amount, reserve.liquidityIndex);

    emit Deposit(params.initiator, params.asset, params.amount, params.onBehalfOf, params.referralCode);
  }

  /**
   * @notice Implements the supply feature. Through `withdraw()`, users withdraw assets from the protocol.
   * @dev Emits the `Withdraw()` event.
   * @param reservesData The state of all the reserves
   * @param params The additional parameters needed to execute the withdraw function
   */
  function executeWithdraw(
    mapping(address => DataTypes.ReserveData) storage reservesData,
    DataTypes.ExecuteWithdrawParams memory params
  ) external returns (uint256) {
    require(params.to != address(0), Errors.VL_INVALID_TARGET_ADDRESS);

    DataTypes.ReserveData storage reserve = reservesData[params.asset];
    address bToken = reserve.bTokenAddress;
    require(bToken != address(0), Errors.VL_INVALID_RESERVE_ADDRESS);

    uint256 userBalance = IBToken(bToken).balanceOf(params.initiator);

    uint256 amountToWithdraw = params.amount;

    if (params.amount == type(uint256).max) {
      amountToWithdraw = userBalance;
    }

    ValidationLogic.validateWithdraw(reserve, amountToWithdraw, userBalance);

    reserve.updateState();

    reserve.updateInterestRates(params.asset, bToken, 0, amountToWithdraw);

    IBToken(bToken).burn(params.initiator, params.to, amountToWithdraw, reserve.liquidityIndex);

    emit Withdraw(params.initiator, params.asset, amountToWithdraw, params.to);

    return amountToWithdraw;
  }
}
