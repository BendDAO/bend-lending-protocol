// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
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
  uint256 public constant DEFAULT_MAX_SLIPPAGE = 100; // 1%

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

    aaveAddressesProvider = IAaveLendPoolAddressesProvider(aaveAddressesProvider_);
    aaveLendPool = IAaveLendPool(aaveAddressesProvider.getLendingPool());

    bendAddressesProvider = ILendPoolAddressesProvider(bendAddressesProvider_);
    bendLendPool = ILendPool(bendAddressesProvider.getLendPool());
    bendLendLoan = ILendPoolLoan(bendAddressesProvider.getLendPoolLoan());
    bendReserveOracle = IReserveOracleGetter(bendAddressesProvider.getReserveOracle());
    bendDataProvider = BendProtocolDataProvider(bendAddressesProvider.getBendDataProvider());

    swapRouter = ISwapRouter(swapRouter_);
  }

  struct SwapParams {
    address[] nftAssets;
    uint256[] nftTokenIds;
    address toDebtReserve;
    address[] toDebtAmounts;
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
    uint256[] paramsNewDebtAmounts;
    address[] aaveAssets;
    uint256[] aaveAmounts;
    uint256[] aaveModes;
    bytes aaveParms;
  }

  function swap(SwapParams calldata swapParams) public whenNotPaused nonReentrant {
    SwapLocaVars memory vars;

    require(swapParams.nftTokenIds.length > 0, "U3DSA: empty token ids");
    require(swapParams.nftAssets.length == swapParams.nftTokenIds.length, "U3DSA: inconsistent assets and token ids");

    vars.aaveFlashLoanFeeRatio = aaveLendPool.FLASHLOAN_PREMIUM_TOTAL();

    vars.aaveAssets = new address[](1);
    vars.aaveAmounts = new uint256[](1);
    vars.aaveModes = new uint256[](1);

    vars.paramsNewDebtAmounts = new uint256[](swapParams.nftTokenIds.length);

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
      vars.aaveFlashLoanPremium =
        ((vars.oldDebtAmount + vars.bidFine) * vars.aaveFlashLoanFeeRatio) /
        PERCENTAGE_FACTOR;
      vars.aaveFlashLoanAllSumPremium += vars.aaveFlashLoanPremium;
      vars.paramsNewDebtAmounts[i] = (vars.oldDebtAmount + vars.bidFine) + vars.aaveFlashLoanPremium;
      vars.aaveAmounts[0] += (vars.oldDebtAmount + vars.bidFine);
    }
    // because of the math rounding, we need to add delta (1) wei to the first debt amount
    vars.aaveFlashLoanTotalPremium = (vars.aaveAmounts[0] * vars.aaveFlashLoanFeeRatio) / PERCENTAGE_FACTOR;
    if (vars.aaveFlashLoanTotalPremium > vars.aaveFlashLoanAllSumPremium) {
      vars.paramsNewDebtAmounts[0] += (vars.aaveFlashLoanTotalPremium - vars.aaveFlashLoanAllSumPremium);
    }

    vars.aaveParms = abi.encode(vars.paramsBorrower, nftAssets, nftTokenIds, vars.paramsNewDebtAmounts);

    aaveLendPool.flashLoan(
      address(this),
      vars.aaveAssets,
      vars.aaveAmounts,
      vars.aaveModes,
      address(0),
      vars.aaveParms,
      0
    );
  }

  struct ExecuteOperationLocalVars {
    address aaveFlashLoanAsset;
    uint256 aaveFlashLoanFeeRatio;
    address[] nftAssets;
    uint256[] nftTokenIds;
    address toReserve;
  }

  function executeOperation(
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata premiums,
    address initiator,
    bytes calldata params
  ) external override returns (bool) {
    ExecuteOperationLocalVars execOpVars;

    // only aave and this contract can call this function
    require(msg.sender == address(aaveLendPool), "U3DSA: caller must be aave lending pool");
    require(initiator == address(this), "U3DSA: initiator must be this contract");

    require(assets.length == 1 && amounts.length == 1 && premiums.length == 1, "U3DSA: multiple assets not supported");

    execOpVars.aaveFlashLoanAsset = assets[0];
    execOpVars.aaveFlashLoanFeeRatio = aaveLendPool.FLASHLOAN_PREMIUM_TOTAL();

    (execOpVars.nftAssets, execOpVars.nftTokenIds, execOpVars.toReserve) = abi.decode(
      params,
      (address[], uint256[], address)
    );
    require(execOpVars.nftAssets.length == execOpVars.nftTokenIds.length, "U3DSA: inconsistent assets and token ids");

    IERC20Upgradeable(assets[0]).safeApprove(address(bendLendPool), amounts[0]);

    for (uint256 i = 0; i < execOpVars.nftTokenIds.length; i++) {
      SwapOneNftLocaVars memory swapOneNftVars;

      swapOneNftVars.nftAsset = execOpVars.nftAssets[i];
      swapOneNftVars.nftTokenId = execOpVars.nftTokenIds[i];

      _swapOneNft(execOpVars, swapOneNftVars);
    }

    IERC20Upgradeable(assets[0]).safeApprove(address(bendLendPool), 0);

    IERC20Upgradeable(assets[0]).safeApprove(msg.sender, (amounts[0] + premiums[0]));

    return true;
  }

  struct SwapOneNftLocaVars {
    address nftAsset;
    uint256 nftTokenId;
    address toDebtReserve;
    uint256 toDebtAmount;
    uint256 fromLoanId;
    address fromBorrower;
    address fromDebtReserve;
    uint256 fromDebtAmount;
    uint256 fromReserveBalanceBeforeRepay;
    uint256 toReserveBalanceBeforeBorrow;
    uint256 toReserveBalanceAfterBorrow;
    uint256 swapAmountOutMinimum;
  }

  function _swapOneNft(ExecuteOperationLocalVars execOpVars, SwapOneNftLocaVars memory vars) internal {
    // query current debt
    (vars.fromLoanId, vars.fromDebtReserve, , vars.fromDebtAmount, , ) = bendLendPool.getNftDebtData(
      vars.nftAsset,
      vars.nftTokenId
    );
    vars.fromBorrower = bendLendLoan.borrowerOf(vars.fromLoanId);
    vars.fromBalanceBeforeRepay = IERC20Upgradeable(vars.fromDebtReserve).balanceOf(address(this));

    require(vars.fromDebtReserve == execOpVars.aaveFlashLoanAsset, "U3DSA: invalid flash loan asset");
    require(vars.fromDebtAmount <= vars.fromBalanceBeforeRepay, "U3DSA: insufficent to repay debt");

    // repay all the old debt
    bendLendPool.repay(vars.nftAsset, vars.nftTokenId, vars.fromDebtAmount);

    // transfer nft to this contract
    IERC721Upgradeable(vars.nftAsset).safeTransferFrom(vars.borrower, address(address(this)), vars.nftTokenId);

    // borrow new debt with nft
    vars.toReserveBalanceBeforeBorrow = IERC20Upgradeable(vars.toDebtReserve).balanceOf(address(this));

    bendLendPool.borrow(vars.toDebtReserve, vars.toDebtAmount, vars.nftAsset, vars.nftTokenId, vars.fromBorrower, 0);

    vars.toReserveBalanceAfterBorrow = IERC20Upgradeable(vars.toDebtReserve).balanceOf(address(this));
    require(
      vars.toReserveBalanceAfterBorrow == (vars.toReserveBalanceBeforeBorrow + vars.toDebtAmount),
      "U3DSA: borrow amount mismatch after borrow"
    );

    // swap new debt to old debt
    IERC20Upgradeable(vars.toDebtReserve).safeApprove(address(swapRouter), vars.toDebtAmount);
    vars.swapAmountOutMinimum = _getTokenOutAmount(vars.toDebtReserve, vars.toDebtAmount, vars.fromDebtReserve);
    uint256 amountOut = swapRouter.exactInputSingle(
      ISwapRouter.ExactInputSingleParams({
        tokenIn: vars.toDebtReserve,
        tokenOut: vars.fromDebtReserve,
        fee: 3000, // 0.3% tier is 3000, 0.01% tier is 100
        recipient: address(this),
        deadline: block.timestamp,
        amountIn: vars.toDebtAmount,
        amountOutMinimum: vars.swapAmountOutMinimum,
        sqrtPriceLimitX96: 0
      })
    );
  }

  function _getTokenOutAmount(
    address tokenIn,
    address amountIn,
    address tokenOut
  ) internal view returns (uint256 amountOut) {
    BendProtocolDataProvider.ReserveTokenData resDataIn = bendDataProvider.getReserveTokenData(tokenIn);
    BendProtocolDataProvider.ReserveTokenData resDataOut = bendDataProvider.getReserveTokenData(tokenOut);

    uint256 priceIn = bendReserveOracle.getAssetPrice(tokenIn);
    uint256 priceOut = bendReserveOracle.getAssetPrice(tokenOut);
    uint256 ethIn = (priceIn * amountIn) / (10**IBToken(resDataIn.bTokenAddress).decimals());
    amountOut = ((ethIn * (10**IBToken(resDataOut.bTokenAddress).decimals())) / priceOut);
    amountOut = amountOut.percentMul(PERCENTAGE_FACTOR - DEFAULT_MAX_SLIPPAGE);
  }
}
