// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "../interfaces/INFTLoan.sol";
import "../interfaces/ILendPool.sol";
import "../libraries/helpers/Errors.sol";
import {WadRayMath} from "../libraries/math/WadRayMath.sol";
import "./LendPoolStorage.sol";

contract NFTLoan is ILendPool, LendPoolStorage {}
