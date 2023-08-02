// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ISwapRouter} from "../adapters/interfaces/ISwapRouter.sol";

contract MockUniswapV3SwapRouter is ISwapRouter {
  using SafeERC20 for IERC20;

  uint256 public amountOutDeltaRatio;

  function setSmountOutDeltaRatio(uint256 deltaRatio) external {
    amountOutDeltaRatio = deltaRatio;
  }

  function exactInputSingle(ExactInputSingleParams calldata params)
    external
    payable
    override
    returns (uint256 amountOut)
  {
    params;

    IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);

    if (amountOutDeltaRatio > 0) {
      amountOut = (params.amountOutMinimum * amountOutDeltaRatio) / 100;
    } else {
      amountOut = params.amountOutMinimum;
    }
    IERC20(params.tokenOut).safeTransfer(params.recipient, amountOut);

    return amountOut;
  }

  function exactInput(ExactInputParams calldata params) external payable override returns (uint256 amountOut) {
    params;
    return 0;
  }

  function exactOutputSingle(ExactOutputSingleParams calldata params)
    external
    payable
    override
    returns (uint256 amountIn)
  {
    params;
    return 0;
  }

  function exactOutput(ExactOutputParams calldata params) external payable override returns (uint256 amountIn) {
    params;
    return 0;
  }

  function uniswapV3SwapCallback(
    int256 amount0Delta,
    int256 amount1Delta,
    bytes calldata data
  ) external override {}
}
