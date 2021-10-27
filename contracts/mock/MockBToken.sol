// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {BToken} from "../protocol/BToken.sol";
import {ILendPool} from "../interfaces/ILendPool.sol";
import {IIncentivesController} from "../interfaces/IIncentivesController.sol";

contract MockBToken is BToken {}
