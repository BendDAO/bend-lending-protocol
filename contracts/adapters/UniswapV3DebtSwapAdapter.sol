// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {ERC721HolderUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";

import {IAaveLendPoolAddressesProvider} from "./interfaces/IAaveLendPoolAddressesProvider.sol";
import {IAaveLendPool} from "./interfaces/IAaveLendPool.sol";
import {IAaveFlashLoanReceiver} from "./interfaces/IAaveFlashLoanReceiver.sol";
import {ILendPoolAddressesProvider} from "../interfaces/ILendPoolAddressesProvider.sol";
import {ILendPool} from "../interfaces/ILendPool.sol";
import {ILendPoolLoan} from "../interfaces/ILendPoolLoan.sol";
import {IReserveOracleGetter} from "../interfaces/IReserveOracleGetter.sol";
import {IBToken} from "../interfaces/IBToken.sol";

import {DataTypes} from "../libraries/types/DataTypes.sol";
import {PercentageMath} from "../libraries/math/PercentageMath.sol";
import {BendProtocolDataProvider} from "../misc/BendProtocolDataProvider.sol";

import {ISwapRouter} from "./interfaces/ISwapRouter.sol";

/**
 * @title UniswapV3DebtSwapAdapter
 * @notice Uniswap V3 Adapter to swap debt.
 * @author BendDAO
 **/
contract UniswapV3DebtSwapAdapter is
  IAaveFlashLoanReceiver,
  OwnableUpgradeable,
  ReentrancyGuardUpgradeable,
  PausableUpgradeable,
  ERC721HolderUpgradeable
{
  using SafeERC20Upgradeable for IERC20Upgradeable;
  using PercentageMath for uint256;

  uint256 public constant PERCENTAGE_FACTOR = 1e4; // 100%
  uint256 public constant DEFAULT_SLIPPAGE = 100; // 1%
  uint256 public constant MAX_SLIPPAGE = 300; // 3%
  uint256 public constant MAX_UNISWAP_FEE = 10000; // 1% (0.3% == 3000, 0.01% == 100)

  IAaveLendPoolAddressesProvider public aaveAddressesProvider;
  IAaveLendPool public aaveLendPool;
  ILendPoolAddressesProvider public bendAddressesProvider;
  ILendPool public bendLendPool;
  ILendPoolLoan public bendLendLoan;
  IReserveOracleGetter public bendReserveOracle;
  BendProtocolDataProvider public bendDataProvider;
  ISwapRouter public swapRouter;

  function initialize(
    address aaveAddressesProvider_,
    address bendAddressesProvider_,
    address swapRouter_
  ) external initializer {
    __Ownable_init();
    __ReentrancyGuard_init();
    __Pausable_init();
    __ERC721Holder_init();

    aaveAddressesProvider = IAaveLendPoolAddressesProvider(aaveAddressesProvider_);
    aaveLendPool = IAaveLendPool(aaveAddressesProvider.getLendingPool());

    bendAddressesProvider = ILendPoolAddressesProvider(bendAddressesProvider_);
    bendLendPool = ILendPool(bendAddressesProvider.getLendPool());
    bendLendLoan = ILendPoolLoan(bendAddressesProvider.getLendPoolLoan());
    bendReserveOracle = IReserveOracleGetter(bendAddressesProvider.getReserveOracle());
    bendDataProvider = BendProtocolDataProvider(bendAddressesProvider.getBendDataProvider());

    swapRouter = ISwapRouter(swapRouter_);
  }

  function setPause(bool flag) public onlyOwner {
    if (flag) {
      _pause();
    } else {
      _unpause();
    }
  }

  struct SwapParams {
    address[] nftAssets; // nft assets, eg. BAYC
    uint256[] nftTokenIds; // nft token ids
    address toDebtReserve; // debt reserve address, eg. USDT
    uint256 maxSlippage; // max slippage percentage, eg. 100 means 1%
    uint256 uniswapFee; // uniswap fee percentage, eg. 3000 means 0.3%
  }

  struct SwapLocaVars {
    uint256 aaveFlashLoanFeeRatio;
    uint256 aaveFlashLoanPremium;
    uint256 aaveFlashLoanAllSumPremium;
    uint256 aaveFlashLoanTotalPremium;
    uint256 loanId;
    address borrower;
    address debtReserve;
    uint256 oldDebtAmount;
    uint256 bidFine;
    address paramsBorrower;
    uint256[] paramsFromDebtWithFeeAmounts;
    address[] aaveAssets;
    uint256[] aaveAmounts;
    uint256[] aaveModes;
    bytes aaveParams;
  }

  /**
   * @dev swap debt to new reserve for the nft.
   * @notice The caller must be the borrower of the nft.
   * @param swapParams The swap params
   */
  function swapDebt(SwapParams calldata swapParams) public whenNotPaused nonReentrant {
    SwapLocaVars memory vars;

    require(swapParams.nftTokenIds.length > 0, "U3DSA: empty token ids");
    require(swapParams.nftAssets.length == swapParams.nftTokenIds.length, "U3DSA: inconsistent assets and token ids");
    require(swapParams.maxSlippage <= MAX_SLIPPAGE, "U3DSA: slippage too large");
    require(swapParams.uniswapFee <= MAX_UNISWAP_FEE, "U3DSA: uniswap fee too large");

    vars.aaveFlashLoanFeeRatio = aaveLendPool.FLASHLOAN_PREMIUM_TOTAL();

    vars.aaveAssets = new address[](1);
    vars.aaveAmounts = new uint256[](1);
    vars.aaveModes = new uint256[](1);
    vars.paramsFromDebtWithFeeAmounts = new uint256[](swapParams.nftTokenIds.length);

    for (uint256 i = 0; i < swapParams.nftTokenIds.length; i++) {
      (, , , , vars.bidFine) = bendLendPool.getNftAuctionData(swapParams.nftAssets[i], swapParams.nftTokenIds[i]);
      require(vars.bidFine == 0, "U3DSA: nft in auction");

      (vars.loanId, vars.debtReserve, , vars.oldDebtAmount, , ) = bendLendPool.getNftDebtData(
        swapParams.nftAssets[i],
        swapParams.nftTokenIds[i]
      );

      vars.borrower = bendLendLoan.borrowerOf(vars.loanId);
      if (i == 0) {
        require(vars.debtReserve != swapParams.toDebtReserve, "U3DSA: old debt reserve same as new reserve");

        // check borrower must be caller
        require(vars.borrower == msg.sender, "U3DSA: caller not borrower");
        vars.aaveAssets[0] = vars.debtReserve;
        vars.paramsBorrower = vars.borrower;
      } else {
        // check borrower and asset must be same
        require(vars.aaveAssets[0] == vars.debtReserve, "U3DSA: old debt reserve not same");
        require(vars.paramsBorrower == vars.borrower, "U3DSA: borrower not same");
      }

      // new debt should cover old debt + flash loan premium
      vars.aaveAmounts[0] += vars.oldDebtAmount;

      vars.aaveFlashLoanPremium = (vars.oldDebtAmount * vars.aaveFlashLoanFeeRatio) / PERCENTAGE_FACTOR;
      vars.aaveFlashLoanAllSumPremium += vars.aaveFlashLoanPremium;
      vars.paramsFromDebtWithFeeAmounts[i] = vars.oldDebtAmount + vars.aaveFlashLoanPremium;
    }

    // because of the math rounding, we need to add some delta wei to the first debt amount
    vars.aaveFlashLoanTotalPremium = (vars.aaveAmounts[0] * vars.aaveFlashLoanFeeRatio) / PERCENTAGE_FACTOR;
    if (vars.aaveFlashLoanTotalPremium > vars.aaveFlashLoanAllSumPremium) {
      vars.paramsFromDebtWithFeeAmounts[0] += (vars.aaveFlashLoanTotalPremium - vars.aaveFlashLoanAllSumPremium);
    }

    vars.aaveParams = abi.encode(
      vars.paramsBorrower,
      swapParams.nftAssets,
      swapParams.nftTokenIds,
      vars.paramsFromDebtWithFeeAmounts,
      swapParams.toDebtReserve,
      swapParams.maxSlippage,
      swapParams.uniswapFee
    );

    aaveLendPool.flashLoan(
      address(this),
      vars.aaveAssets,
      vars.aaveAmounts,
      vars.aaveModes,
      address(0),
      vars.aaveParams,
      0
    );
  }

  struct ExecuteOperationLocalVars {
    address aaveFlashLoanAsset;
    uint256 aaveFlashLoanFeeRatio;
    address borrower;
    address[] nftAssets;
    uint256[] nftTokenIds;
    address toReserve;
    uint256[] fromDebtWithFeeAmounts;
    uint256 maxSlippage;
    uint256 uniswapFee;
    uint256[] toDebtAmounts;
    uint256 balanceBeforeSwap;
    uint256 balanceAfterSwap;
    uint256 balanceDeltaAmount;
  }

  /**
   * @dev Callback fo the Aave flash loan.
   */
  function executeOperation(
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata premiums,
    address initiator,
    bytes calldata params
  ) external override returns (bool) {
    ExecuteOperationLocalVars memory execOpVars;

    // only aave and this contract can call this function
    require(msg.sender == address(aaveLendPool), "U3DSA: caller must be aave lending pool");
    require(initiator == address(this), "U3DSA: initiator must be this contract");

    require(assets.length == 1 && amounts.length == 1 && premiums.length == 1, "U3DSA: multiple assets not supported");

    execOpVars.aaveFlashLoanAsset = assets[0];
    execOpVars.aaveFlashLoanFeeRatio = aaveLendPool.FLASHLOAN_PREMIUM_TOTAL();

    // no need to check this params which is already checked in swapDebt
    (
      execOpVars.borrower,
      execOpVars.nftAssets,
      execOpVars.nftTokenIds,
      execOpVars.fromDebtWithFeeAmounts,
      execOpVars.toReserve,
      execOpVars.maxSlippage,
      execOpVars.uniswapFee
    ) = abi.decode(params, (address, address[], uint256[], uint256[], address, uint256, uint256));

    // the balance already included the borrowed amount from aave
    execOpVars.balanceBeforeSwap = IERC20Upgradeable(assets[0]).balanceOf(address(this));

    IERC20Upgradeable(assets[0]).safeApprove(address(bendLendPool), amounts[0]);

    for (uint256 i = 0; i < execOpVars.nftTokenIds.length; i++) {
      SwapOneNftLocaVars memory swapOneNftVars;

      swapOneNftVars.nftAsset = execOpVars.nftAssets[i];
      swapOneNftVars.nftTokenId = execOpVars.nftTokenIds[i];
      swapOneNftVars.toDebtReserve = execOpVars.toReserve;
      swapOneNftVars.fromDebtWithFeeAmount = execOpVars.fromDebtWithFeeAmounts[i];

      _swapOneNft(execOpVars, swapOneNftVars);
    }

    // check the balance after swap
    // the balance should included the borrowed amount from aave plus flash loan fee
    execOpVars.balanceAfterSwap = IERC20Upgradeable(assets[0]).balanceOf(address(this));
    require(execOpVars.balanceAfterSwap > execOpVars.balanceBeforeSwap, "U3DSA: balance too small after swap");

    execOpVars.balanceDeltaAmount = execOpVars.balanceAfterSwap - execOpVars.balanceBeforeSwap;
    require(execOpVars.balanceDeltaAmount >= premiums[0], "U3DSA: insufficient balance to repay aave premiums");

    if (execOpVars.balanceDeltaAmount > premiums[0]) {
      // transfer back the extra amount to borrower
      IERC20Upgradeable(assets[0]).safeTransfer(execOpVars.borrower, execOpVars.balanceDeltaAmount - premiums[0]);
    }

    IERC20Upgradeable(assets[0]).safeApprove(address(bendLendPool), 0);

    IERC20Upgradeable(assets[0]).safeApprove(msg.sender, (amounts[0] + premiums[0]));

    return true;
  }

  struct SwapOneNftLocaVars {
    address nftAsset;
    uint256 nftTokenId;
    uint256 fromDebtWithFeeAmount;
    address toDebtReserve;
    uint256 toDebtAmount;
    uint256 fromLoanId;
    address fromBorrower;
    address fromDebtReserve;
    uint256 fromDebtAmount;
    uint256 fromReserveBalanceBeforeRepay;
    uint256 toLoanId;
    address toBorrower;
    uint256 toReserveBalanceBeforeBorrow;
    uint256 toReserveBalanceAfterBorrow;
  }

  function _swapOneNft(ExecuteOperationLocalVars memory execOpVars, SwapOneNftLocaVars memory vars) internal {
    // query current debt
    (vars.fromLoanId, vars.fromDebtReserve, , vars.fromDebtAmount, , ) = bendLendPool.getNftDebtData(
      vars.nftAsset,
      vars.nftTokenId
    );
    vars.fromBorrower = bendLendLoan.borrowerOf(vars.fromLoanId);
    vars.fromReserveBalanceBeforeRepay = IERC20Upgradeable(vars.fromDebtReserve).balanceOf(address(this));

    require(vars.fromDebtReserve == execOpVars.aaveFlashLoanAsset, "U3DSA: invalid flash loan asset");
    require(vars.fromDebtAmount <= vars.fromReserveBalanceBeforeRepay, "U3DSA: insufficent to repay debt");
    require(vars.fromDebtAmount < vars.fromDebtWithFeeAmount, "U3DSA: debt amount not cover fee");

    // repay all the old debt
    bendLendPool.repay(vars.nftAsset, vars.nftTokenId, vars.fromDebtAmount);

    // transfer nft to this contract
    IERC721Upgradeable(vars.nftAsset).safeTransferFrom(vars.fromBorrower, address(this), vars.nftTokenId);
    IERC721Upgradeable(vars.nftAsset).approve(address(bendLendPool), vars.nftTokenId);

    // borrow new debt with nft
    vars.toReserveBalanceBeforeBorrow = IERC20Upgradeable(vars.toDebtReserve).balanceOf(address(this));

    // calculate target debt amount based on the orcacle price
    vars.toDebtAmount = _getTokenOutAmount(
      vars.fromDebtReserve,
      vars.fromDebtWithFeeAmount,
      vars.toDebtReserve,
      true,
      execOpVars.maxSlippage
    );
    require(vars.toDebtAmount > 0, "U3DSA: invalid to debt amount");

    bendLendPool.borrow(vars.toDebtReserve, vars.toDebtAmount, vars.nftAsset, vars.nftTokenId, vars.fromBorrower, 0);

    vars.toReserveBalanceAfterBorrow = IERC20Upgradeable(vars.toDebtReserve).balanceOf(address(this));
    require(
      vars.toReserveBalanceAfterBorrow == (vars.toReserveBalanceBeforeBorrow + vars.toDebtAmount),
      "U3DSA: borrow amount mismatch after borrow"
    );

    vars.toLoanId = bendLendLoan.getCollateralLoanId(vars.nftAsset, vars.nftTokenId);
    vars.toBorrower = bendLendLoan.borrowerOf(vars.toLoanId);
    require(vars.fromLoanId != vars.toLoanId, "U3DSA: invalid load after borrow new debt");
    require(vars.fromBorrower == vars.toBorrower, "U3DSA: invalid borrower after borrow new debt");

    // swap new debt to old debt
    IERC20Upgradeable(vars.toDebtReserve).safeApprove(address(swapRouter), vars.toDebtAmount);
    uint256 amountOut = swapRouter.exactInputSingle(
      ISwapRouter.ExactInputSingleParams({
        tokenIn: vars.toDebtReserve,
        tokenOut: vars.fromDebtReserve,
        fee: uint24(execOpVars.uniswapFee), // 0.3% tier is 3000, 0.01% tier is 100
        recipient: address(this),
        deadline: block.timestamp,
        amountIn: vars.toDebtAmount,
        amountOutMinimum: vars.fromDebtWithFeeAmount,
        sqrtPriceLimitX96: 0
      })
    );
    require(amountOut >= vars.fromDebtWithFeeAmount, "U3DSA: swap amount out less than old debt with fee");
  }

  /**
   * @dev query debt swap out amount for the nft.
   * @param nftAssets The address of the nft tokens
   * @param nftTokenIds The id list of the nft tokens
   * @param toDebtReserve The target debt reserve address, eg. USDT
   * @param slippage The slippage percentage, eg. 100 means 1%
   */
  function getNftDebtSwapOutAmount(
    address[] calldata nftAssets,
    uint256[] calldata nftTokenIds,
    address toDebtReserve,
    uint256 slippage
  ) external view returns (uint256[] memory toAmounts) {
    require(nftAssets.length == nftTokenIds.length, "U3DSA: inconsistent assets and token ids");

    uint256 aaveFlashLoanFeeRatio = aaveLendPool.FLASHLOAN_PREMIUM_TOTAL();

    toAmounts = new uint256[](nftTokenIds.length);

    for (uint256 i = 0; i < nftTokenIds.length; i++) {
      (, address fromDebtReserve, , uint256 fromDebtAmount, , ) = bendLendPool.getNftDebtData(
        nftAssets[i],
        nftTokenIds[i]
      );

      uint256 aaveFlashLoanPremium = (fromDebtAmount * aaveFlashLoanFeeRatio) / PERCENTAGE_FACTOR;
      fromDebtAmount += aaveFlashLoanPremium;
      toAmounts[i] = _getTokenOutAmount(fromDebtReserve, fromDebtAmount, toDebtReserve, true, slippage);
    }
  }

  function _getTokenOutAmount(
    address tokenIn,
    uint256 amountIn,
    address tokenOut,
    bool isAddOrSubSlippage,
    uint256 slippage
  ) internal view returns (uint256 amountOut) {
    BendProtocolDataProvider.ReserveTokenData memory resDataIn = bendDataProvider.getReserveTokenData(tokenIn);
    BendProtocolDataProvider.ReserveTokenData memory resDataOut = bendDataProvider.getReserveTokenData(tokenOut);

    uint256 inUnit = 10**IBToken(resDataIn.bTokenAddress).decimals();
    uint256 outUnit = 10**IBToken(resDataOut.bTokenAddress).decimals();

    uint256 priceIn = bendReserveOracle.getAssetPrice(tokenIn);
    uint256 priceOut = bendReserveOracle.getAssetPrice(tokenOut);

    amountOut = (priceIn * amountIn * outUnit) / (priceOut * inUnit);

    if (slippage > 0) {
      if (isAddOrSubSlippage) {
        amountOut = amountOut.percentMul(PERCENTAGE_FACTOR + slippage);
      } else {
        amountOut = amountOut.percentMul(PERCENTAGE_FACTOR - slippage);
      }
    }
  }
}
