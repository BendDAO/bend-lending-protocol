// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {IFlashLoanReceiver} from "../interfaces/IFlashLoanReceiver.sol";
import {IBNFT} from "../interfaces/IBNFT.sol";

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract MockFlashLoanReceiverDummy is IFlashLoanReceiver {
  address _bnftRegistry;

  constructor(address bnftRegistry_) {
    _bnftRegistry = bnftRegistry_;
  }

  function executeOperation(
    address asset,
    uint256[] memory tokenIds,
    address initiator,
    address operator,
    bytes memory params
  ) public override returns (bool) {
    asset;
    tokenIds;
    initiator;
    operator;
    params;

    IERC721(asset).setApprovalForAll(operator, true);

    return true;
  }
}
