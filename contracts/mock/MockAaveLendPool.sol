// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IAaveFlashLoanReceiver} from "../adapters/interfaces/IAaveFlashLoanReceiver.sol";

contract MockAaveLendPool {
  using SafeERC20 for IERC20;
  string public constant LP_INVALID_FLASH_LOAN_EXECUTOR_RETURN = "66";

  event FlashLoan(
    address indexed target,
    address indexed initiator,
    address indexed asset,
    uint256 amount,
    uint256 premium,
    uint16 referralCode
  );

  function flashLoan(
    address receiverAddress,
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata, // modes
    address, // onBehalfOf
    bytes calldata params,
    uint16 referralCode
  ) external {
    uint256[] memory premiums = new uint256[](assets.length);
    for (uint256 i = 0; i < assets.length; i++) {
      premiums[i] = (amounts[i] * 9) / 10000;
      IERC20(assets[i]).safeTransfer(receiverAddress, amounts[i]);
    }

    require(
      IAaveFlashLoanReceiver(receiverAddress).executeOperation(assets, amounts, premiums, msg.sender, params),
      LP_INVALID_FLASH_LOAN_EXECUTOR_RETURN
    );

    for (uint256 i = 0; i < assets.length; i++) {
      premiums[i] = (amounts[i] * 9) / 10000;
      IERC20(assets[i]).safeTransferFrom(receiverAddress, address(this), amounts[i] + premiums[i]);
      emit FlashLoan(receiverAddress, msg.sender, assets[i], amounts[i], premiums[i], referralCode);
    }
  }
}
