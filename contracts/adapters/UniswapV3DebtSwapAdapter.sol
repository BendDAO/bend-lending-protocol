// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";

import {IAaveLendPoolAddressesProvider} from "./interfaces/IAaveLendPoolAddressesProvider.sol";
import {IAaveLendPool} from "./interfaces/IAaveLendPool.sol";
import {IAaveFlashLoanReceiver} from "./interfaces/IAaveFlashLoanReceiver.sol";
import {ILendPoolAddressesProvider} from "../interfaces/ILendPoolAddressesProvider.sol";
import {ILendPool} from "../interfaces/ILendPool.sol";
import {ILendPoolLoan} from "../interfaces/ILendPoolLoan.sol";
import {ISwapRouter} from "./interfaces/ISwapRouter.sol";

/**
 * @title UniswapV3DebtSwapAdapter
 * @notice Uniswap V3 Adapter to swap debt.
 * @author BendDAO
 **/
contract UniswapV3DebtSwapAdapter is IAaveFlashLoanReceiver, OwnableUpgradeable, ReentrancyGuardUpgradeable {
  IAaveLendPoolAddressesProvider public aaveAddressesProvider;
  IAaveLendPool public aaveLendPool;
  ILendPoolAddressesProvider public bendAddressesProvider;
  ILendPool public bendLendPool;
  ILendPoolLoan public bendLendLoan;
  ISwapRouter public swapRouter;

  function initialize(
    address aaveAddressesProvider_,
    address bendAddressesProvider_,
    address swapRouter_
  ) external initializer {
    __Ownable_init();
    __ReentrancyGuard_init();

    aaveAddressesProvider = IAaveLendPoolAddressesProvider(aaveAddressesProvider_);
    aaveLendPool = IAaveLendPool(aaveAddressesProvider.getLendingPool());

    bendAddressesProvider = ILendPoolAddressesProvider(bendAddressesProvider_);
    bendLendPool = ILendPool(bendAddressesProvider.getLendPool());
    bendLendLoan = ILendPoolLoan(bendAddressesProvider.getLendPoolLoan());

    swapRouter = ISwapRouter(swapRouter_);
  }

  function executeOperation(
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata premiums,
    address initiator,
    bytes calldata params
  ) external override returns (bool) {
    require(msg.sender == address(aaveLendPool), "DSA: caller must be aave lending pool");
    require(assets.length == 1 && amounts.length == 1 && premiums.length == 1, "DSA: multiple assets not supported");

    (address[] memory nftAssets, uint256[] memory nftTokenIds, address newReserve) = abi.decode(
      params,
      (address[], uint256[], address)
    );
    require(nftAssets.length == nftTokenIds.length, "DSA: inconsistent assets and token ids");

    uint256 aaveFlashLoanFeeRatio = aaveLendPool.FLASHLOAN_PREMIUM_TOTAL();

    IERC20Upgradeable(assets[0]).approve(address(bendLendPool), type(uint256).max);

    SwapLocaVars memory swapSars;
    swapSars.tokenIn = newReserve;
    swapSars.tokenOut = assets[0];

    for (uint256 i = 0; i < nftTokenIds.length; i++) {
      RepayAndBorrowLocaVars memory vars;
      vars.nftAsset = nftAssets[i];
      vars.nftTokenId = nftTokenIds[i];
      vars.flashLoanAsset = assets[0];
      vars.flashLoanFeeRatio = aaveFlashLoanFeeRatio;

      _repayAndBorrowPerNft(vars);
    }

    IERC20Upgradeable(assets[0]).approve(address(bendLendPool), 0);

    IERC20Upgradeable(assets[0]).approve(msg.sender, (amounts[0] + premiums[0]));

    return true;
  }

  struct RepayAndBorrowLocaVars {
    address nftAsset;
    uint256 nftTokenId;
    address flashLoanAsset;
    uint256 flashLoanFeeRatio;
    uint256 loanId;
    address borrower;
    address debtReserve;
    uint256 debtTotalAmount;
    uint256 debtRemainAmount;
    uint256 redeemAmount;
    uint256 bidFine;
    uint256 debtTotalAmountWithBidFine;
    uint256 balanceBeforeRepay;
    uint256[] nftTokenIds;
    uint256 flashLoanPremium;
    uint256 debtBorrowAmountWithFee;
    uint256 balanceBeforeBorrow;
    uint256 balanceAfterBorrow;
  }

  function _repayAndBorrowPerNft(RepayAndBorrowLocaVars memory vars) internal {
    (vars.loanId, , , , vars.bidFine) = bendLendPool.getNftAuctionData(vars.nftAsset, vars.nftTokenId);
    (, vars.debtReserve, , vars.debtTotalAmount, , ) = bendLendPool.getNftDebtData(vars.nftAsset, vars.nftTokenId);
    vars.debtTotalAmountWithBidFine = vars.debtTotalAmount + vars.bidFine;

    vars.borrower = bendLendLoan.borrowerOf(vars.loanId);
    vars.balanceBeforeRepay = IERC20Upgradeable(vars.debtReserve).balanceOf(address(this));

    require(vars.debtReserve == vars.flashLoanAsset, "DSA: invalid flash loan asset");
    require(vars.debtTotalAmountWithBidFine <= vars.balanceBeforeRepay, "DSA: insufficent to repay debt");

    // redeem first if nft is in auction
    if (vars.bidFine > 0) {
      vars.redeemAmount = (vars.debtTotalAmount * 2) / 3;
      bendLendPool.redeem(vars.nftAsset, vars.nftTokenId, vars.redeemAmount, vars.bidFine);

      (, , , vars.debtRemainAmount, , ) = bendLendPool.getNftDebtData(vars.nftAsset, vars.nftTokenId);
    } else {
      vars.debtRemainAmount = vars.debtTotalAmount;
    }

    // repay all the old debt
    bendLendPool.repay(vars.nftAsset, vars.nftTokenId, vars.debtRemainAmount);

    // stake original nft to the staking pool
    IERC721Upgradeable(vars.nftAsset).safeTransferFrom(vars.borrower, address(address(this)), vars.nftTokenId);

    // borrow new debt with original nft
    vars.balanceBeforeBorrow = IERC20Upgradeable(vars.debtReserve).balanceOf(address(this));

    vars.flashLoanPremium = (vars.debtTotalAmountWithBidFine * vars.flashLoanFeeRatio) / 10000;
    vars.debtBorrowAmountWithFee = vars.debtTotalAmountWithBidFine + vars.flashLoanPremium;
    bendLendPool.borrow(
      vars.debtReserve,
      vars.debtBorrowAmountWithFee,
      vars.nftAsset,
      vars.nftTokenId,
      vars.borrower,
      0
    );

    vars.balanceAfterBorrow = IERC20Upgradeable(vars.debtReserve).balanceOf(address(this));
    require(vars.balanceAfterBorrow == (vars.balanceBeforeBorrow + vars.debtBorrowAmountWithFee));
  }

  struct SwapLocaVars {
    address tokenIn;
    address tokenOut;
    uint256 fee;
    uint256 amountIn;
    uint256 amountOutMinimum;
  }

  function _swapNewReserveToOldReserve(SwapLocaVars memory vars) internal {
    uint256 amountOut = swapRouter.exactInputSingle(
      ISwapRouter.ExactInputSingleParams({
        tokenIn: vars.tokenIn,
        tokenOut: vars.tokenOut,
        fee: 3000,
        recipient: address(this),
        deadline: block.timestamp,
        amountIn: vars.debtTotalAmountWithBidFine,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0
      })
    );
  }

  function onERC721Received(
    address,
    address,
    uint256,
    bytes memory
  ) public virtual returns (bytes4) {
    return this.onERC721Received.selector;
  }
}
