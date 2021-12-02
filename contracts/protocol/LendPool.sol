// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {IBToken} from "../interfaces/IBToken.sol";
import {IDebtToken} from "../interfaces/IDebtToken.sol";
import {ILendPoolLoan} from "../interfaces/ILendPoolLoan.sol";
import {ILendPool} from "../interfaces/ILendPool.sol";
import {IReserveOracleGetter} from "../interfaces/IReserveOracleGetter.sol";
import {INFTOracleGetter} from "../interfaces/INFTOracleGetter.sol";
import {ILendPoolAddressesProvider} from "../interfaces/ILendPoolAddressesProvider.sol";
import {Errors} from "../libraries/helpers/Errors.sol";
import {WadRayMath} from "../libraries/math/WadRayMath.sol";
import {GenericLogic} from "../libraries/logic/GenericLogic.sol";
import {PercentageMath} from "../libraries/math/PercentageMath.sol";
import {ReserveLogic} from "../libraries/logic/ReserveLogic.sol";
import {NftLogic} from "../libraries/logic/NftLogic.sol";
import {ValidationLogic} from "../libraries/logic/ValidationLogic.sol";
import {ReserveConfiguration} from "../libraries/configuration/ReserveConfiguration.sol";
import {NftConfiguration} from "../libraries/configuration/NftConfiguration.sol";
import {DataTypes} from "../libraries/types/DataTypes.sol";
import {LendPoolStorage} from "./LendPoolStorage.sol";

import {AddressUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import {IERC721ReceiverUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

/**
 * @title LendPool contract
 * @dev Main point of interaction with an Bend protocol's market
 * - Users can:
 *   # Deposit
 *   # Withdraw
 *   # Borrow
 *   # Repay
 *   # Liquidate positions
 *   # Execute Flash Loans
 * - To be covered by a proxy contract, owned by the LendPoolAddressesProvider of the specific market
 * - All admin functions are callable by the LendPoolConfigurator contract defined also in the
 *   LendPoolAddressesProvider
 * @author Bend
 **/
contract LendPool is Initializable, ILendPool, LendPoolStorage, ContextUpgradeable, IERC721ReceiverUpgradeable {
  using WadRayMath for uint256;
  using PercentageMath for uint256;
  using SafeERC20Upgradeable for IERC20Upgradeable;
  using ReserveLogic for DataTypes.ReserveData;
  using NftLogic for DataTypes.NftData;
  using ReserveConfiguration for DataTypes.ReserveConfigurationMap;
  using NftConfiguration for DataTypes.NftConfigurationMap;

  modifier whenNotPaused() {
    _whenNotPaused();
    _;
  }

  modifier onlyLendPoolConfigurator() {
    _onlyLendPoolConfigurator();
    _;
  }

  function _whenNotPaused() internal view {
    require(!_paused, Errors.LP_IS_PAUSED);
  }

  function _onlyLendPoolConfigurator() internal view {
    require(_addressesProvider.getLendPoolConfigurator() == _msgSender(), Errors.LP_CALLER_NOT_LEND_POOL_CONFIGURATOR);
  }

  modifier onlyAddressProvider() {
    require(address(_addressesProvider) == msg.sender, Errors.CALLER_NOT_ADDRESS_PROVIDER);
    _;
  }

  /**
   * @dev Function is invoked by the proxy contract when the LendPool contract is added to the
   * LendPoolAddressesProvider of the market.
   * - Caching the address of the LendPoolAddressesProvider in order to reduce gas consumption
   *   on subsequent operations
   * @param provider The address of the LendPoolAddressesProvider
   **/
  function initialize(ILendPoolAddressesProvider provider) public initializer {
    _setAddressProvider(provider);
    _maxNumberOfReserves = 32;
    _maxNumberOfNfts = 256;
  }

  function initializeAfterUpgrade(ILendPoolAddressesProvider provider) public onlyAddressProvider {
    _setAddressProvider(provider);
  }

  function _setAddressProvider(ILendPoolAddressesProvider provider) internal {
    _addressesProvider = provider;
  }

  /**
   * @dev Deposits an `amount` of underlying asset into the reserve, receiving in return overlying bTokens.
   * - E.g. User deposits 100 USDC and gets in return 100 bUSDC
   * @param asset The address of the underlying asset to deposit
   * @param amount The amount to be deposited
   * @param onBehalfOf The address that will receive the bTokens, same as msg.sender if the user
   *   wants to receive them on his own wallet, or a different address if the beneficiary of bTokens
   *   is a different wallet
   * @param referralCode Code used to register the integrator originating the operation, for potential rewards.
   *   0 if the action is executed directly by the user, without any middle-man
   **/
  function deposit(
    address asset,
    uint256 amount,
    address onBehalfOf,
    uint16 referralCode
  ) external override whenNotPaused {
    require(onBehalfOf != address(0), Errors.VL_INVALID_ONBEHALFOF_ADDRESS);

    DataTypes.ReserveData storage reserve = _reserves[asset];
    address bToken = reserve.bTokenAddress;
    require(bToken != address(0), Errors.VL_INVALID_RESERVE_ADDRESS);

    ValidationLogic.validateDeposit(reserve, amount);

    reserve.updateState();
    reserve.updateInterestRates(asset, bToken, amount, 0);

    IERC20Upgradeable(asset).safeTransferFrom(_msgSender(), bToken, amount);

    IBToken(bToken).mint(onBehalfOf, amount, reserve.liquidityIndex);

    emit Deposit(asset, _msgSender(), onBehalfOf, amount, referralCode);
  }

  /**
   * @dev Withdraws an `amount` of underlying asset from the reserve, burning the equivalent bTokens owned
   * E.g. User has 100 bUSDC, calls withdraw() and receives 100 USDC, burning the 100 bUSDC
   * @param asset The address of the underlying asset to withdraw
   * @param amount The underlying amount to be withdrawn
   *   - Send the value type(uint256).max in order to withdraw the whole bToken balance
   * @param to Address that will receive the underlying, same as msg.sender if the user
   *   wants to receive it on his own wallet, or a different address if the beneficiary is a
   *   different wallet
   * @return The final amount withdrawn
   **/
  function withdraw(
    address asset,
    uint256 amount,
    address to
  ) external override whenNotPaused returns (uint256) {
    require(to != address(0), Errors.VL_INVALID_TARGET_ADDRESS);

    DataTypes.ReserveData storage reserve = _reserves[asset];
    address bToken = reserve.bTokenAddress;
    require(bToken != address(0), Errors.VL_INVALID_RESERVE_ADDRESS);

    uint256 userBalance = IBToken(bToken).balanceOf(_msgSender());

    uint256 amountToWithdraw = amount;

    if (amount == type(uint256).max) {
      amountToWithdraw = userBalance;
    }

    ValidationLogic.validateWithdraw(reserve, amountToWithdraw, userBalance);

    reserve.updateState();

    reserve.updateInterestRates(asset, bToken, 0, amountToWithdraw);

    IBToken(bToken).burn(_msgSender(), to, amountToWithdraw, reserve.liquidityIndex);

    emit Withdraw(asset, _msgSender(), to, amountToWithdraw);

    return amountToWithdraw;
  }

  /**
   * @dev Allows users to borrow a specific `amount` of the reserve underlying asset
   * - E.g. User borrows 100 USDC, receiving the 100 USDC in his wallet
   *   and lock collateral asset in contract
   * @param asset The address of the underlying asset to borrow
   * @param amount The amount to be borrowed
   * @param nftAsset The address of the underlying nft used as collateral
   * @param nftTokenId The token ID of the underlying nft used as collateral
   * @param onBehalfOf Address of the user who will receive the loan. Should be the address of the borrower itself
   * calling the function if he wants to borrow against his own collateral
   * @param referralCode Code used to register the integrator originating the operation, for potential rewards.
   *   0 if the action is executed directly by the user, without any middle-man
   **/
  function borrow(
    address asset,
    uint256 amount,
    address nftAsset,
    uint256 nftTokenId,
    address onBehalfOf,
    uint16 referralCode
  ) external override whenNotPaused {
    require(onBehalfOf != address(0), Errors.VL_INVALID_ONBEHALFOF_ADDRESS);

    DataTypes.ReserveData storage reserve = _reserves[asset];
    DataTypes.NftData storage nftData = _nfts[nftAsset];

    require(reserve.bTokenAddress != address(0), Errors.VL_INVALID_RESERVE_ADDRESS);
    require(nftData.bNftAddress != address(0), Errors.LPC_INVALIED_BNFT_ADDRESS);

    _executeBorrow(
      ExecuteBorrowParams(
        _msgSender(),
        onBehalfOf,
        asset,
        amount,
        reserve.bTokenAddress,
        nftAsset,
        nftTokenId,
        nftData.bNftAddress,
        referralCode,
        true
      )
    );
  }

  struct RepayLocalVars {
    address poolLoan;
    address repayer;
    address onBehalfOf;
    uint256 loanId;
    bool isUpdate;
    uint256 borrowDebt;
    uint256 halfDebt;
    uint256 paybackAmount;
    uint256 bidFine;
    uint256 bidPriceAndFine;
  }

  /**
   * @notice Repays a borrowed `amount` on a specific reserve, burning the equivalent loan owned
   * - E.g. User repays 100 USDC, burning loan and receives collateral asset
   * @param nftAsset The address of the underlying NFT used as collateral
   * @param nftTokenId The token ID of the underlying NFT used as collateral
   * @param amount The amount to repay
   **/
  function repay(
    address nftAsset,
    uint256 nftTokenId,
    uint256 amount
  ) external override whenNotPaused returns (uint256, bool) {
    RepayLocalVars memory vars;

    vars.poolLoan = _addressesProvider.getLendPoolLoan();

    vars.loanId = ILendPoolLoan(vars.poolLoan).getCollateralLoanId(nftAsset, nftTokenId);
    require(vars.loanId != 0, Errors.LP_NFT_IS_NOT_USED_AS_COLLATERAL);

    DataTypes.LoanData memory loanData = ILendPoolLoan(vars.poolLoan).getLoan(vars.loanId);

    vars.repayer = _msgSender();

    DataTypes.ReserveData storage reserve = _reserves[loanData.reserveAsset];
    DataTypes.NftData storage nftData = _nfts[loanData.nftAsset];
    require(nftData.bNftAddress != address(0), Errors.LPC_INVALIED_BNFT_ADDRESS);
    require(reserve.bTokenAddress != address(0), Errors.VL_INVALID_RESERVE_ADDRESS);

    // update state MUST BEFORE get borrow amount which is depent on latest borrow index
    reserve.updateState();

    vars.borrowDebt = ILendPoolLoan(vars.poolLoan).getLoanReserveBorrowAmount(vars.loanId);

    ValidationLogic.validateRepay(reserve, amount, vars.borrowDebt);

    // If loan state is Auction, borrower need repay half debt at least and penalty fine
    if (loanData.state == DataTypes.LoanState.Auction) {
      require(
        block.timestamp <= (loanData.bidStartTimestamp + nftData.configuration.getRedeemDuration()),
        Errors.LPL_BID_DURATION_EXCEED
      );

      vars.halfDebt = vars.borrowDebt.percentMul(PercentageMath.HALF_PERCENT);

      vars.bidFine = vars.borrowDebt.percentMul(PercentageMath.ONE_THOUSANDTH_PERCENT);
      require(amount >= (vars.halfDebt + vars.bidFine), Errors.LPL_BID_REPAY_AMOUNT_TOO_SMALL);

      vars.bidPriceAndFine = loanData.bidPrice + vars.bidFine;
    }

    vars.paybackAmount = vars.borrowDebt + vars.bidFine;
    vars.isUpdate = false;
    if (amount < vars.paybackAmount) {
      vars.isUpdate = true;
      vars.paybackAmount = amount;
    }

    if (vars.isUpdate) {
      ILendPoolLoan(vars.poolLoan).updateLoan(
        loanData.borrower,
        vars.loanId,
        0,
        vars.paybackAmount,
        reserve.variableBorrowIndex
      );
    } else {
      ILendPoolLoan(vars.poolLoan).repayLoan(
        loanData.borrower,
        vars.loanId,
        nftData.bNftAddress,
        reserve.variableBorrowIndex
      );
    }

    IDebtToken(reserve.debtTokenAddress).burn(loanData.borrower, vars.paybackAmount, reserve.variableBorrowIndex);

    // update interest rate according latest borrow amount (utilizaton)
    reserve.updateInterestRates(loanData.reserveAsset, reserve.bTokenAddress, vars.paybackAmount, 0);

    IERC20Upgradeable(loanData.reserveAsset).safeTransferFrom(vars.repayer, reserve.bTokenAddress, vars.paybackAmount);

    // Transfer bid price and penalty fine to liquidator
    if (loanData.state == DataTypes.LoanState.Auction) {
      IERC20Upgradeable(loanData.reserveAsset).safeTransferFrom(
        reserve.bTokenAddress,
        loanData.bidLiquidator,
        vars.bidPriceAndFine
      );
    }

    emit Repay(
      loanData.nftAsset,
      loanData.nftTokenId,
      loanData.reserveAsset,
      loanData.borrower,
      vars.repayer,
      vars.paybackAmount,
      vars.loanId
    );

    return (vars.paybackAmount, !vars.isUpdate);
  }

  struct AuctionLocalVars {
    address loanAddress;
    address liquidator;
    uint256 loanId;
    uint256 thresholdPrice;
    uint256 liquidatePrice;
    uint256 paybackAmount;
    address previousBidUser;
    uint256 previousBidPrice;
  }

  /**
   * @dev Function to auction a non-healthy position collateral-wise
   * - The caller (liquidator) want to buy collateral asset of the user getting liquidated
   * @param nftAsset The address of the underlying NFT used as collateral
   * @param nftTokenId The token ID of the underlying NFT used as collateral
   * @param bidPrice The bid price of the liquidator want to buy underlying NFT
   * @param onBehalfOf Address of the user who will get the underlying NFT, same as msg.sender if the user
   *   wants to receive them on his own wallet, or a different address if the beneficiary of NFT
   *   is a different wallet
   **/
  function auction(
    address nftAsset,
    uint256 nftTokenId,
    uint256 bidPrice,
    address onBehalfOf
  ) external override whenNotPaused {
    require(onBehalfOf != address(0), Errors.VL_INVALID_ONBEHALFOF_ADDRESS);

    AuctionLocalVars memory vars;
    vars.liquidator = _msgSender();

    vars.loanAddress = _addressesProvider.getLendPoolLoan();
    vars.loanId = ILendPoolLoan(vars.loanAddress).getCollateralLoanId(nftAsset, nftTokenId);
    require(vars.loanId != 0, Errors.LP_NFT_IS_NOT_USED_AS_COLLATERAL);

    DataTypes.LoanData memory loanData = ILendPoolLoan(vars.loanAddress).getLoan(vars.loanId);

    DataTypes.ReserveData storage reserveData = _reserves[loanData.reserveAsset];
    DataTypes.NftData storage nftData = _nfts[loanData.nftAsset];
    require(nftData.bNftAddress != address(0), Errors.LPC_INVALIED_BNFT_ADDRESS);
    require(reserveData.bTokenAddress != address(0), Errors.VL_INVALID_RESERVE_ADDRESS);

    ValidationLogic.validateAuction(reserveData, nftData, bidPrice);

    (vars.paybackAmount, vars.thresholdPrice, vars.liquidatePrice) = GenericLogic.calculateLoanLiquidatePrice(
      vars.loanId,
      loanData.reserveAsset,
      reserveData,
      loanData.nftAsset,
      nftData,
      vars.loanAddress,
      _addressesProvider.getReserveOracle(),
      _addressesProvider.getNFTOracle()
    );

    // first bid need more check
    if (loanData.state == DataTypes.LoanState.Active) {
      // only loan's heath factor below 1.0 can be liquidated
      require(vars.paybackAmount > vars.thresholdPrice, Errors.LP_PRICE_TOO_HIGH_TO_LIQUIDATE);
      // liquidate price must greater than total debt with interest
      require(vars.liquidatePrice >= vars.paybackAmount, Errors.LP_PRICE_TOO_LOW_TO_LIQUIDATE);

      // bid price must greater than liquidate price
      require(bidPrice >= vars.liquidatePrice, Errors.LP_PRICE_TOO_LOW_TO_LIQUIDATE);
    } else {
      require(
        block.timestamp <= loanData.bidStartTimestamp + nftData.configuration.getAuctionDuration(),
        Errors.LPL_BID_DURATION_EXCEED
      );
      require(bidPrice > loanData.bidPrice, Errors.LPL_BID_PRICE_TOO_LOW);
    }

    ILendPoolLoan(vars.loanAddress).auctionLoan(onBehalfOf, vars.loanId, bidPrice, vars.paybackAmount);

    IERC20Upgradeable(loanData.reserveAsset).safeTransferFrom(vars.liquidator, reserveData.bTokenAddress, bidPrice);
    if (vars.previousBidUser != address(0)) {
      IERC20Upgradeable(loanData.reserveAsset).safeTransferFrom(
        reserveData.bTokenAddress,
        vars.previousBidUser,
        vars.previousBidPrice
      );
    }

    emit Auction(nftAsset, nftTokenId, bidPrice, vars.liquidator, onBehalfOf, vars.loanId);
  }

  struct LiquidateLocalVars {
    address poolLoan;
    address liquidator;
    uint256 loanId;
    uint256 remainAmount;
  }

  /**
   * @dev Function to liquidate a non-healthy position collateral-wise
   * - The caller (liquidator) buy collateral asset of the user getting liquidated, and receives
   *   the collateral asset
   * @param nftAsset The address of the underlying NFT used as collateral
   * @param nftTokenId The token ID of the underlying NFT used as collateral
   **/
  function liquidate(
    address nftAsset,
    uint256 nftTokenId,
    address onBehalfOf
  ) external override whenNotPaused {
    require(onBehalfOf != address(0), Errors.VL_INVALID_ONBEHALFOF_ADDRESS);

    LiquidateLocalVars memory vars;
    vars.liquidator = _msgSender();

    vars.poolLoan = _addressesProvider.getLendPoolLoan();

    vars.loanId = ILendPoolLoan(vars.poolLoan).getCollateralLoanId(nftAsset, nftTokenId);
    require(vars.loanId != 0, Errors.LP_NFT_IS_NOT_USED_AS_COLLATERAL);

    DataTypes.LoanData memory loanData = ILendPoolLoan(vars.poolLoan).getLoan(vars.loanId);

    DataTypes.ReserveData storage reserveData = _reserves[loanData.reserveAsset];
    DataTypes.NftData storage nftData = _nfts[loanData.nftAsset];
    require(nftData.bNftAddress != address(0), Errors.LPC_INVALIED_BNFT_ADDRESS);
    require(reserveData.bTokenAddress != address(0), Errors.VL_INVALID_RESERVE_ADDRESS);

    require(loanData.state == DataTypes.LoanState.Auction, Errors.LPL_INVALID_LOAN_STATE);
    require(
      block.timestamp > loanData.bidStartTimestamp + nftData.configuration.getAuctionDuration(),
      Errors.LPL_BID_DURATION_EXCEED
    );
    require(onBehalfOf == loanData.bidLiquidator, Errors.LPL_BID_USER_NOT_SAME);

    ValidationLogic.validateLiquidate(reserveData, nftData, loanData.bidPaybackAmount);

    // update state MUST BEFORE get borrow amount which is depent on latest borrow index
    reserveData.updateState();

    if (loanData.bidPrice > loanData.bidPaybackAmount) {
      vars.remainAmount = loanData.bidPrice - loanData.bidPaybackAmount;
    } else {
      vars.remainAmount = 0;
    }

    ILendPoolLoan(vars.poolLoan).liquidateLoan(
      loanData.bidLiquidator,
      vars.loanId,
      nftData.bNftAddress,
      reserveData.variableBorrowIndex
    );

    IDebtToken(reserveData.debtTokenAddress).burn(
      loanData.borrower,
      loanData.bidPaybackAmount,
      reserveData.variableBorrowIndex
    );

    // update interest rate according latest borrow amount (utilizaton)
    reserveData.updateInterestRates(loanData.reserveAsset, reserveData.bTokenAddress, loanData.bidPaybackAmount, 0);

    // transfer remain amount to borrower, liquidator's tokens has been transfer to reserve in auction bid phase
    if (vars.remainAmount > 0) {
      IERC20Upgradeable(loanData.reserveAsset).safeTransferFrom(
        reserveData.bTokenAddress,
        loanData.borrower,
        vars.remainAmount
      );
    }

    emit Liquidate(
      loanData.nftAsset,
      loanData.nftTokenId,
      loanData.borrower,
      loanData.reserveAsset,
      loanData.bidPaybackAmount,
      vars.remainAmount,
      vars.liquidator,
      loanData.bidLiquidator,
      vars.loanId
    );
  }

  function onERC721Received(
    address operator,
    address from,
    uint256 tokenId,
    bytes calldata data
  ) external pure override returns (bytes4) {
    operator;
    from;
    tokenId;
    data;
    return IERC721ReceiverUpgradeable.onERC721Received.selector;
  }

  /**
   * @dev Returns the configuration of the reserve
   * @param asset The address of the underlying asset of the reserve
   * @return The configuration of the reserve
   **/
  function getReserveConfiguration(address asset)
    external
    view
    override
    returns (DataTypes.ReserveConfigurationMap memory)
  {
    return _reserves[asset].configuration;
  }

  /**
   * @dev Returns the configuration of the NFT
   * @param asset The address of the asset of the NFT
   * @return The configuration of the NFT
   **/
  function getNftConfiguration(address asset) external view override returns (DataTypes.NftConfigurationMap memory) {
    return _nfts[asset].configuration;
  }

  /**
   * @dev Returns the normalized income normalized income of the reserve
   * @param asset The address of the underlying asset of the reserve
   * @return The reserve's normalized income
   */
  function getReserveNormalizedIncome(address asset) external view override returns (uint256) {
    return _reserves[asset].getNormalizedIncome();
  }

  /**
   * @dev Returns the normalized variable debt per unit of asset
   * @param asset The address of the underlying asset of the reserve
   * @return The reserve normalized variable debt
   */
  function getReserveNormalizedVariableDebt(address asset) external view override returns (uint256) {
    return _reserves[asset].getNormalizedDebt();
  }

  /**
   * @dev Returns the state and configuration of the reserve
   * @param asset The address of the underlying asset of the reserve
   * @return The state of the reserve
   **/
  function getReserveData(address asset) external view override returns (DataTypes.ReserveData memory) {
    return _reserves[asset];
  }

  /**
   * @dev Returns the state and configuration of the nft
   * @param asset The address of the underlying asset of the nft
   * @return The state of the nft
   **/
  function getNftData(address asset) external view override returns (DataTypes.NftData memory) {
    return _nfts[asset];
  }

  /**
   * @dev Returns the loan data of the NFT
   * @param nftAsset The address of the NFT
   * @param nftTokenId The token id of the NFT
   * @return totalCollateralETH the total collateral in ETH of the NFT
   * @return totalDebtETH the total debt in ETH of the NFT
   * @return availableBorrowsETH the borrowing power left of the NFT
   * @return ltv the loan to value of the user
   * @return liquidationThreshold the liquidation threshold of the NFT
   * @return loanId the loan id of the NFT
   * @return healthFactor the current health factor of the NFT
   **/
  function getNftLoanData(address nftAsset, uint256 nftTokenId)
    external
    view
    override
    returns (
      uint256 totalCollateralETH,
      uint256 totalDebtETH,
      uint256 availableBorrowsETH,
      uint256 ltv,
      uint256 liquidationThreshold,
      uint256 loanId,
      uint256 healthFactor,
      address reserveAsset
    )
  {
    DataTypes.NftData storage nftData = _nfts[nftAsset];

    loanId = ILendPoolLoan(_addressesProvider.getLendPoolLoan()).getCollateralLoanId(nftAsset, nftTokenId);
    if (loanId != 0) {
      (, , reserveAsset, ) = ILendPoolLoan(_addressesProvider.getLendPoolLoan()).getLoanCollateralAndReserve(loanId);
      DataTypes.ReserveData storage reserveData = _reserves[reserveAsset];
      totalDebtETH = GenericLogic.calculateNftDebtData(
        reserveAsset,
        reserveData,
        _addressesProvider.getLendPoolLoan(),
        loanId,
        _addressesProvider.getReserveOracle()
      );
    }

    (totalCollateralETH, ltv, liquidationThreshold) = GenericLogic.calculateNftCollateralData(
      nftAsset,
      nftData,
      _addressesProvider.getNFTOracle()
    );

    availableBorrowsETH = GenericLogic.calculateAvailableBorrowsETH(totalCollateralETH, totalDebtETH, ltv);

    healthFactor = GenericLogic.calculateHealthFactorFromBalances(
      totalCollateralETH,
      totalDebtETH,
      liquidationThreshold
    );
  }

  struct GetLiquidationPriceLocalVars {
    address poolLoan;
    uint256 loanId;
    uint256 thresholdPrice;
    uint256 liquidatePrice;
    uint256 paybackAmount;
    uint256 remainAmount;
  }

  function getNftLiquidatePrice(address nftAsset, uint256 nftTokenId)
    external
    view
    override
    returns (uint256 liquidatePrice, uint256 paybackAmount)
  {
    GetLiquidationPriceLocalVars memory vars;

    vars.poolLoan = _addressesProvider.getLendPoolLoan();
    vars.loanId = ILendPoolLoan(vars.poolLoan).getCollateralLoanId(nftAsset, nftTokenId);
    require(vars.loanId > 0, Errors.LP_NFT_IS_NOT_USED_AS_COLLATERAL);

    DataTypes.LoanData memory loanData = ILendPoolLoan(vars.poolLoan).getLoan(vars.loanId);

    DataTypes.ReserveData storage reserveData = _reserves[loanData.reserveAsset];
    DataTypes.NftData storage nftData = _nfts[nftAsset];

    (vars.paybackAmount, vars.thresholdPrice, vars.liquidatePrice) = GenericLogic.calculateLoanLiquidatePrice(
      vars.loanId,
      loanData.reserveAsset,
      reserveData,
      loanData.nftAsset,
      nftData,
      vars.poolLoan,
      _addressesProvider.getReserveOracle(),
      _addressesProvider.getNFTOracle()
    );

    if (vars.liquidatePrice < vars.paybackAmount) {
      vars.liquidatePrice = vars.paybackAmount;
    }

    return (vars.liquidatePrice, vars.paybackAmount);
  }

  /**
   * @dev Validates and finalizes an bToken transfer
   * - Only callable by the overlying bToken of the `asset`
   * @param asset The address of the underlying asset of the bToken
   * @param from The user from which the bToken are transferred
   * @param to The user receiving the bTokens
   * @param amount The amount being transferred/withdrawn
   * @param balanceFromBefore The bToken balance of the `from` user before the transfer
   * @param balanceToBefore The bToken balance of the `to` user before the transfer
   */
  function finalizeTransfer(
    address asset,
    address from,
    address to,
    uint256 amount,
    uint256 balanceFromBefore,
    uint256 balanceToBefore
  ) external view override whenNotPaused {
    asset;
    from;
    to;
    amount;
    balanceFromBefore;
    balanceToBefore;

    DataTypes.ReserveData storage reserve = _reserves[asset];
    require(_msgSender() == reserve.bTokenAddress, Errors.LP_CALLER_MUST_BE_AN_BTOKEN);

    ValidationLogic.validateTransfer(from, reserve);
  }

  /**
   * @dev Returns the list of the initialized reserves
   **/
  function getReservesList() external view override returns (address[] memory) {
    address[] memory _activeReserves = new address[](_reservesCount);

    for (uint256 i = 0; i < _reservesCount; i++) {
      _activeReserves[i] = _reservesList[i];
    }
    return _activeReserves;
  }

  /**
   * @dev Returns the list of the initialized nfts
   **/
  function getNftsList() external view override returns (address[] memory) {
    address[] memory _activeNfts = new address[](_nftsCount);

    for (uint256 i = 0; i < _nftsCount; i++) {
      _activeNfts[i] = _nftsList[i];
    }
    return _activeNfts;
  }

  /**
   * @dev Set the _pause state of the pool
   * - Only callable by the LendPoolConfigurator contract
   * @param val `true` to pause the pool, `false` to un-pause it
   */
  function setPause(bool val) external override onlyLendPoolConfigurator {
    _paused = val;
    if (_paused) {
      emit Paused();
    } else {
      emit Unpaused();
    }
  }

  /**
   * @dev Returns if the LendingPool is paused
   */
  function paused() external view override returns (bool) {
    return _paused;
  }

  /**
   * @dev Returns the cached LendPoolAddressesProvider connected to this contract
   **/
  function getAddressesProvider() external view override returns (ILendPoolAddressesProvider) {
    return _addressesProvider;
  }

  function setMaxNumberOfReserves(uint256 val) external override onlyLendPoolConfigurator {
    _maxNumberOfReserves = val;
  }

  /**
   * @dev Returns the maximum number of reserves supported to be listed in this LendPool
   */
  function MAX_NUMBER_RESERVES() public view override returns (uint256) {
    return _maxNumberOfReserves;
  }

  function setMaxNumberOfNfts(uint256 val) external override onlyLendPoolConfigurator {
    _maxNumberOfNfts = val;
  }

  /**
   * @dev Returns the maximum number of nfts supported to be listed in this LendPool
   */
  function MAX_NUMBER_NFTS() public view override returns (uint256) {
    return _maxNumberOfNfts;
  }

  /**
   * @dev Initializes a reserve, activating it, assigning an bToken and nft loan and an
   * interest rate strategy
   * - Only callable by the LendingPoolConfigurator contract
   * @param asset The address of the underlying asset of the reserve
   * @param bTokenAddress The address of the bToken that will be assigned to the reserve
   * @param debtTokenAddress The address of the debtToken that will be assigned to the reserve
   * @param interestRateAddress The address of the interest rate strategy contract
   **/
  function initReserve(
    address asset,
    address bTokenAddress,
    address debtTokenAddress,
    address interestRateAddress
  ) external override onlyLendPoolConfigurator {
    require(AddressUpgradeable.isContract(asset), Errors.LP_NOT_CONTRACT);
    _reserves[asset].init(bTokenAddress, debtTokenAddress, interestRateAddress);
    _addReserveToList(asset);
  }

  /**
   * @dev Initializes a nft, activating it, assigning nft loan and an
   * interest rate strategy
   * - Only callable by the LendingPoolConfigurator contract
   * @param asset The address of the underlying asset of the nft
   **/
  function initNft(address asset, address bNftAddress) external override onlyLendPoolConfigurator {
    require(AddressUpgradeable.isContract(asset), Errors.LP_NOT_CONTRACT);
    _nfts[asset].init(bNftAddress);
    _addNftToList(asset);

    require(_addressesProvider.getLendPoolLoan() != address(0), Errors.LPC_INVALIED_LOAN_ADDRESS);
    IERC721Upgradeable(asset).setApprovalForAll(_addressesProvider.getLendPoolLoan(), true);

    ILendPoolLoan(_addressesProvider.getLendPoolLoan()).initNft(asset, bNftAddress);
  }

  /**
   * @dev Updates the address of the interest rate strategy contract
   * - Only callable by the LendPoolConfigurator contract
   * @param asset The address of the underlying asset of the reserve
   * @param rateAddress The address of the interest rate strategy contract
   **/
  function setReserveInterestRateAddress(address asset, address rateAddress)
    external
    override
    onlyLendPoolConfigurator
  {
    _reserves[asset].interestRateAddress = rateAddress;
  }

  /**
   * @dev Sets the configuration bitmap of the reserve as a whole
   * - Only callable by the LendPoolConfigurator contract
   * @param asset The address of the underlying asset of the reserve
   * @param configuration The new configuration bitmap
   **/
  function setReserveConfiguration(address asset, uint256 configuration) external override onlyLendPoolConfigurator {
    _reserves[asset].configuration.data = configuration;
  }

  /**
   * @dev Sets the configuration bitmap of the NFT as a whole
   * - Only callable by the LendPoolConfigurator contract
   * @param asset The address of the asset of the NFT
   * @param configuration The new configuration bitmap
   **/
  function setNftConfiguration(address asset, uint256 configuration) external override onlyLendPoolConfigurator {
    _nfts[asset].configuration.data = configuration;
  }

  function _addReserveToList(address asset) internal {
    uint256 reservesCount = _reservesCount;

    require(reservesCount < _maxNumberOfReserves, Errors.LP_NO_MORE_RESERVES_ALLOWED);

    bool reserveAlreadyAdded = _reserves[asset].id != 0 || _reservesList[0] == asset;

    if (!reserveAlreadyAdded) {
      _reserves[asset].id = uint8(reservesCount);
      _reservesList[reservesCount] = asset;

      _reservesCount = reservesCount + 1;
    }
  }

  function _addNftToList(address asset) internal {
    uint256 nftsCount = _nftsCount;

    require(nftsCount < _maxNumberOfNfts, Errors.LP_NO_MORE_NFTS_ALLOWED);

    bool nftAlreadyAdded = _nfts[asset].id != 0 || _nftsList[0] == asset;

    if (!nftAlreadyAdded) {
      _nfts[asset].id = uint8(nftsCount);
      _nftsList[nftsCount] = asset;

      _nftsCount = nftsCount + 1;
    }
  }

  struct ExecuteBorrowParams {
    address user;
    address onBehalfOf;
    address asset;
    uint256 amount;
    address bTokenAddress;
    address nftAsset;
    uint256 nftTokenId;
    address bNftAddress;
    uint16 referralCode;
    bool releaseUnderlying;
  }

  struct ExecuteBorrowLocalVars {
    uint256 ltv;
    uint256 liquidationThreshold;
    uint256 liquidationBonus;
    uint256 amountInETH;
    uint256 reservePrice;
    uint256 nftPrice;
    uint256 thresholdPrice;
    uint256 loanId;
    address reserveOracle;
    address nftOracle;
    address loanAddress;
  }

  function _executeBorrow(ExecuteBorrowParams memory params) internal {
    DataTypes.ReserveData storage reserve = _reserves[params.asset];
    DataTypes.NftData storage nftData = _nfts[params.nftAsset];
    ExecuteBorrowLocalVars memory vars;

    // update state MUST BEFORE get borrow amount which is depent on latest borrow index
    reserve.updateState();

    // Convert asset amount to ETH
    vars.reserveOracle = _addressesProvider.getReserveOracle();
    vars.nftOracle = _addressesProvider.getNFTOracle();
    vars.loanAddress = _addressesProvider.getLendPoolLoan();

    vars.reservePrice = IReserveOracleGetter(vars.reserveOracle).getAssetPrice(params.asset);
    vars.amountInETH = (vars.reservePrice * params.amount) / 10**reserve.configuration.getDecimals();

    vars.loanId = ILendPoolLoan(vars.loanAddress).getCollateralLoanId(params.nftAsset, params.nftTokenId);

    ValidationLogic.validateBorrow(
      params.onBehalfOf,
      params.asset,
      params.amount,
      vars.amountInETH,
      reserve,
      params.nftAsset,
      nftData,
      vars.loanAddress,
      vars.loanId,
      vars.reserveOracle,
      vars.nftOracle
    );

    if (vars.loanId == 0) {
      IERC721Upgradeable(params.nftAsset).safeTransferFrom(_msgSender(), address(this), params.nftTokenId);

      vars.loanId = ILendPoolLoan(vars.loanAddress).createLoan(
        params.user,
        params.onBehalfOf,
        params.nftAsset,
        params.nftTokenId,
        params.bNftAddress,
        params.asset,
        params.amount,
        reserve.variableBorrowIndex
      );
    } else {
      ILendPoolLoan(vars.loanAddress).updateLoan(
        params.user,
        vars.loanId,
        params.amount,
        0,
        reserve.variableBorrowIndex
      );
    }

    IDebtToken(reserve.debtTokenAddress).mint(params.onBehalfOf, params.amount, reserve.variableBorrowIndex);

    // update interest rate according latest borrow amount (utilizaton)
    reserve.updateInterestRates(params.asset, params.bTokenAddress, 0, params.releaseUnderlying ? params.amount : 0);

    if (params.releaseUnderlying) {
      IBToken(params.bTokenAddress).transferUnderlyingTo(params.user, params.amount);
    }

    emit Borrow(
      params.asset,
      params.user,
      params.onBehalfOf,
      params.amount,
      params.nftAsset,
      params.nftTokenId,
      reserve.currentVariableBorrowRate,
      vars.loanId,
      params.referralCode
    );
  }
}
