// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {IBNFT} from "../interfaces/IBNFT.sol";
import {IBNFTRegistry} from "../interfaces/IBNFTRegistry.sol";
import {ILendPoolLoan} from "../interfaces/ILendPoolLoan.sol";
import {ILendPool} from "../interfaces/ILendPool.sol";
import {ILendPoolAddressesProvider} from "../interfaces/ILendPoolAddressesProvider.sol";
import {ILoanRepaidInterceptor} from "../interfaces/ILoanRepaidInterceptor.sol";
import {Errors} from "../libraries/helpers/Errors.sol";
import {DataTypes} from "../libraries/types/DataTypes.sol";
import {WadRayMath} from "../libraries/math/WadRayMath.sol";

import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import {IERC721ReceiverUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import {CountersUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

contract LendPoolLoan is Initializable, ILendPoolLoan, ContextUpgradeable, IERC721ReceiverUpgradeable {
  using WadRayMath for uint256;
  using CountersUpgradeable for CountersUpgradeable.Counter;

  ILendPoolAddressesProvider private _addressesProvider;

  CountersUpgradeable.Counter private _loanIdTracker;
  mapping(uint256 => DataTypes.LoanData) private _loans;

  // nftAsset + nftTokenId => loanId
  mapping(address => mapping(uint256 => uint256)) private _nftToLoanIds;
  mapping(address => uint256) private _nftTotalCollateral;
  mapping(address => mapping(address => uint256)) private _userNftCollateral;

  // interceptor whitelist
  mapping(address => bool) private _loanRepaidInterceptorWhitelist;
  // Mapping from token to approved burn interceptor addresses
  mapping(address => mapping(uint256 => address[])) private _loanRepaidInterceptors;
  // locker whitelist
  mapping(address => bool) private _flashLoanLockerWhitelist;

  /**
   * @dev Only lending pool can call functions marked by this modifier
   **/
  modifier onlyLendPool() {
    require(_msgSender() == address(_getLendPool()), Errors.CT_CALLER_MUST_BE_LEND_POOL);
    _;
  }

  modifier onlyLendPoolConfigurator() {
    require(_msgSender() == _addressesProvider.getLendPoolConfigurator(), Errors.LP_CALLER_NOT_LEND_POOL_CONFIGURATOR);
    _;
  }

  modifier onlyLoanRepaidInterceptor() {
    require(_loanRepaidInterceptorWhitelist[_msgSender()], Errors.LP_CALLER_NOT_VALID_INTERCEPTOR);
    _;
  }

  modifier onlyFlashLoanLocker() {
    require(_flashLoanLockerWhitelist[_msgSender()], Errors.LP_CALLER_NOT_VALID_LOCKER);
    _;
  }

  // called once by the factory at time of deployment
  function initialize(ILendPoolAddressesProvider provider) external initializer {
    __Context_init();

    _addressesProvider = provider;

    // Avoid having loanId = 0
    _loanIdTracker.increment();

    emit Initialized(address(_getLendPool()));
  }

  function initNft(address nftAsset, address bNftAddress) external override onlyLendPool {
    IERC721Upgradeable(nftAsset).setApprovalForAll(bNftAddress, true);
  }

  /**
   * @inheritdoc ILendPoolLoan
   */
  function createLoan(
    address initiator,
    address onBehalfOf,
    address nftAsset,
    uint256 nftTokenId,
    address bNftAddress,
    address reserveAsset,
    uint256 amount,
    uint256 borrowIndex
  ) external override onlyLendPool returns (uint256) {
    require(_nftToLoanIds[nftAsset][nftTokenId] == 0, Errors.LP_NFT_HAS_USED_AS_COLLATERAL);

    // index is expressed in Ray, so:
    // amount.wadToRay().rayDiv(index).rayToWad() => amount.rayDiv(index)
    uint256 amountScaled = amount.rayDiv(borrowIndex);

    uint256 loanId = _loanIdTracker.current();
    _loanIdTracker.increment();

    _nftToLoanIds[nftAsset][nftTokenId] = loanId;

    // transfer underlying NFT asset to pool and mint bNFT to onBehalfOf
    IERC721Upgradeable(nftAsset).safeTransferFrom(_msgSender(), address(this), nftTokenId);

    IBNFT(bNftAddress).mint(onBehalfOf, nftTokenId);

    // Save Info
    DataTypes.LoanData storage loanData = _loans[loanId];
    loanData.loanId = loanId;
    loanData.state = DataTypes.LoanState.Active;
    loanData.borrower = onBehalfOf;
    loanData.nftAsset = nftAsset;
    loanData.nftTokenId = nftTokenId;
    loanData.reserveAsset = reserveAsset;
    loanData.scaledAmount = amountScaled;

    _userNftCollateral[onBehalfOf][nftAsset] += 1;

    _nftTotalCollateral[nftAsset] += 1;

    emit LoanCreated(initiator, onBehalfOf, loanId, nftAsset, nftTokenId, reserveAsset, amount, borrowIndex);

    return (loanId);
  }

  /**
   * @inheritdoc ILendPoolLoan
   */
  function updateLoan(
    address initiator,
    uint256 loanId,
    uint256 amountAdded,
    uint256 amountTaken,
    uint256 borrowIndex
  ) external override onlyLendPool {
    // Must use storage to change state
    DataTypes.LoanData storage loan = _loans[loanId];

    // Ensure valid loan state
    require(loan.state == DataTypes.LoanState.Active, Errors.LPL_INVALID_LOAN_STATE);

    uint256 amountScaled = 0;

    if (amountAdded > 0) {
      amountScaled = amountAdded.rayDiv(borrowIndex);
      require(amountScaled != 0, Errors.LPL_INVALID_LOAN_AMOUNT);

      loan.scaledAmount += amountScaled;
    }

    if (amountTaken > 0) {
      amountScaled = amountTaken.rayDiv(borrowIndex);
      require(amountScaled != 0, Errors.LPL_INVALID_TAKEN_AMOUNT);

      require(loan.scaledAmount >= amountScaled, Errors.LPL_AMOUNT_OVERFLOW);
      loan.scaledAmount -= amountScaled;
    }

    emit LoanUpdated(
      initiator,
      loanId,
      loan.nftAsset,
      loan.nftTokenId,
      loan.reserveAsset,
      amountAdded,
      amountTaken,
      borrowIndex
    );
  }

  /**
   * @inheritdoc ILendPoolLoan
   */
  function repayLoan(
    address initiator,
    uint256 loanId,
    address bNftAddress,
    uint256 amount,
    uint256 borrowIndex
  ) external override onlyLendPool {
    // Must use storage to change state
    DataTypes.LoanData storage loan = _loans[loanId];

    // Ensure valid loan state
    require(loan.state == DataTypes.LoanState.Active, Errors.LPL_INVALID_LOAN_STATE);

    _handleBeforeLoanRepaid(loan.nftAsset, loan.nftTokenId);

    // state changes and cleanup
    // NOTE: these must be performed before assets are released to prevent reentrance
    _loans[loanId].state = DataTypes.LoanState.Repaid;

    _nftToLoanIds[loan.nftAsset][loan.nftTokenId] = 0;

    require(_userNftCollateral[loan.borrower][loan.nftAsset] >= 1, Errors.LP_INVALIED_USER_NFT_AMOUNT);
    _userNftCollateral[loan.borrower][loan.nftAsset] -= 1;

    require(_nftTotalCollateral[loan.nftAsset] >= 1, Errors.LP_INVALIED_NFT_AMOUNT);
    _nftTotalCollateral[loan.nftAsset] -= 1;

    // burn bNFT and transfer underlying NFT asset to user
    IBNFT(bNftAddress).burn(loan.nftTokenId);

    IERC721Upgradeable(loan.nftAsset).safeTransferFrom(address(this), _msgSender(), loan.nftTokenId);

    emit LoanRepaid(initiator, loanId, loan.nftAsset, loan.nftTokenId, loan.reserveAsset, amount, borrowIndex);

    _handleAfterLoanRepaid(loan.nftAsset, loan.nftTokenId);
  }

  /**
   * @inheritdoc ILendPoolLoan
   */
  function auctionLoan(
    address initiator,
    uint256 loanId,
    address onBehalfOf,
    uint256 bidPrice,
    uint256 borrowAmount,
    uint256 borrowIndex
  ) external override onlyLendPool {
    // Must use storage to change state
    DataTypes.LoanData storage loan = _loans[loanId];
    address previousBidder = loan.bidderAddress;
    uint256 previousPrice = loan.bidPrice;

    // Ensure valid loan state
    if (loan.bidStartTimestamp == 0) {
      require(loan.state == DataTypes.LoanState.Active, Errors.LPL_INVALID_LOAN_STATE);

      loan.state = DataTypes.LoanState.Auction;
      loan.bidStartTimestamp = block.timestamp;
      loan.firstBidderAddress = onBehalfOf;
    } else {
      require(loan.state == DataTypes.LoanState.Auction, Errors.LPL_INVALID_LOAN_STATE);

      require(bidPrice > loan.bidPrice, Errors.LPL_BID_PRICE_LESS_THAN_HIGHEST_PRICE);
    }

    loan.bidBorrowAmount = borrowAmount;
    loan.bidderAddress = onBehalfOf;
    loan.bidPrice = bidPrice;

    emit LoanAuctioned(
      initiator,
      loanId,
      loan.nftAsset,
      loan.nftTokenId,
      loan.bidBorrowAmount,
      borrowIndex,
      onBehalfOf,
      bidPrice,
      previousBidder,
      previousPrice
    );
  }

  /**
   * @inheritdoc ILendPoolLoan
   */
  function redeemLoan(
    address initiator,
    uint256 loanId,
    uint256 amountTaken,
    uint256 borrowIndex
  ) external override onlyLendPool {
    // Must use storage to change state
    DataTypes.LoanData storage loan = _loans[loanId];

    // Ensure valid loan state
    require(loan.state == DataTypes.LoanState.Auction, Errors.LPL_INVALID_LOAN_STATE);

    uint256 amountScaled = amountTaken.rayDiv(borrowIndex);
    require(amountScaled != 0, Errors.LPL_INVALID_TAKEN_AMOUNT);

    require(loan.scaledAmount >= amountScaled, Errors.LPL_AMOUNT_OVERFLOW);
    loan.scaledAmount -= amountScaled;

    loan.state = DataTypes.LoanState.Active;
    loan.bidStartTimestamp = 0;
    loan.bidBorrowAmount = 0;
    loan.bidderAddress = address(0);
    loan.bidPrice = 0;
    loan.firstBidderAddress = address(0);

    emit LoanRedeemed(initiator, loanId, loan.nftAsset, loan.nftTokenId, loan.reserveAsset, amountTaken, borrowIndex);
  }

  /**
   * @inheritdoc ILendPoolLoan
   */
  function liquidateLoan(
    address initiator,
    uint256 loanId,
    address bNftAddress,
    uint256 borrowAmount,
    uint256 borrowIndex
  ) external override onlyLendPool {
    // Must use storage to change state
    DataTypes.LoanData storage loan = _loans[loanId];

    // Ensure valid loan state
    require(loan.state == DataTypes.LoanState.Auction, Errors.LPL_INVALID_LOAN_STATE);

    _handleBeforeLoanRepaid(loan.nftAsset, loan.nftTokenId);

    // state changes and cleanup
    // NOTE: these must be performed before assets are released to prevent reentrance
    _loans[loanId].state = DataTypes.LoanState.Defaulted;
    _loans[loanId].bidBorrowAmount = borrowAmount;

    _nftToLoanIds[loan.nftAsset][loan.nftTokenId] = 0;

    require(_userNftCollateral[loan.borrower][loan.nftAsset] >= 1, Errors.LP_INVALIED_USER_NFT_AMOUNT);
    _userNftCollateral[loan.borrower][loan.nftAsset] -= 1;

    require(_nftTotalCollateral[loan.nftAsset] >= 1, Errors.LP_INVALIED_NFT_AMOUNT);
    _nftTotalCollateral[loan.nftAsset] -= 1;

    // burn bNFT and transfer underlying NFT asset to user
    IBNFT(bNftAddress).burn(loan.nftTokenId);

    IERC721Upgradeable(loan.nftAsset).safeTransferFrom(address(this), _msgSender(), loan.nftTokenId);

    emit LoanLiquidated(
      initiator,
      loanId,
      loan.nftAsset,
      loan.nftTokenId,
      loan.reserveAsset,
      borrowAmount,
      borrowIndex
    );

    _handleAfterLoanRepaid(loan.nftAsset, loan.nftTokenId);
  }

  function approveLoanRepaidInterceptor(address interceptor, bool approved) public override onlyLendPoolConfigurator {
    _loanRepaidInterceptorWhitelist[interceptor] = approved;
  }

  function isLoanRepaidInterceptorApproved(address interceptor) public view override returns (bool) {
    return _loanRepaidInterceptorWhitelist[interceptor];
  }

  function purgeLoanRepaidInterceptor(
    address nftAsset,
    uint256[] calldata tokenIds,
    address interceptor
  ) public override onlyLendPoolConfigurator {
    for (uint256 i = 0; i < tokenIds.length; i++) {
      address[] storage interceptors = _loanRepaidInterceptors[nftAsset][tokenIds[i]];
      for (uint256 findIndex = 0; findIndex < interceptors.length; findIndex++) {
        if (interceptors[findIndex] == interceptor) {
          _deleteLoanRepaidInterceptor(nftAsset, tokenIds[i], findIndex);
          break;
        }
      }
    }
  }

  function addLoanRepaidInterceptor(address nftAsset, uint256 tokenId) public override onlyLoanRepaidInterceptor {
    address interceptor = _msgSender();
    address[] storage interceptors = _loanRepaidInterceptors[nftAsset][tokenId];
    for (uint256 i = 0; i < interceptors.length; i++) {
      if (interceptors[i] == interceptor) {
        return;
      }
    }
    interceptors.push(interceptor);
    emit LoanRepaidInterceptorUpdated(nftAsset, tokenId, interceptor, true);
  }

  function deleteLoanRepaidInterceptor(address nftAsset, uint256 tokenId) public override onlyLoanRepaidInterceptor {
    address interceptor = _msgSender();
    address[] storage interceptors = _loanRepaidInterceptors[nftAsset][tokenId];

    bool isFind = false;
    uint256 findIndex = 0;
    for (; findIndex < interceptors.length; findIndex++) {
      if (interceptors[findIndex] == interceptor) {
        isFind = true;
        break;
      }
    }

    if (isFind) {
      _deleteLoanRepaidInterceptor(nftAsset, tokenId, findIndex);
    }
  }

  function getLoanRepaidInterceptors(address nftAsset, uint256 tokenId)
    public
    view
    override
    returns (address[] memory)
  {
    return _loanRepaidInterceptors[nftAsset][tokenId];
  }

  function approveFlashLoanLocker(address locker, bool approved) public override onlyLendPoolConfigurator {
    _flashLoanLockerWhitelist[locker] = approved;
  }

  function isFlashLoanLockerApproved(address locker) public view override returns (bool) {
    return _flashLoanLockerWhitelist[locker];
  }

  function setFlashLoanLocking(
    address nftAsset,
    uint256 tokenId,
    bool locked
  ) public override onlyFlashLoanLocker {
    (address bnftProxy, ) = IBNFTRegistry(_addressesProvider.getBNFTRegistry()).getBNFTAddresses(nftAsset);

    IBNFT(bnftProxy).setFlashLoanLocking(tokenId, _msgSender(), locked);
  }

  function purgeFlashLoanLocking(
    address nftAsset,
    uint256[] calldata tokenIds,
    address locker
  ) public override onlyLendPoolConfigurator {
    (address bnftProxy, ) = IBNFTRegistry(_addressesProvider.getBNFTRegistry()).getBNFTAddresses(nftAsset);

    for (uint256 i = 0; i < tokenIds.length; i++) {
      IBNFT(bnftProxy).setFlashLoanLocking(tokenIds[i], locker, false);
    }
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

  function borrowerOf(uint256 loanId) external view override returns (address) {
    return _loans[loanId].borrower;
  }

  function getCollateralLoanId(address nftAsset, uint256 nftTokenId) external view override returns (uint256) {
    return _nftToLoanIds[nftAsset][nftTokenId];
  }

  function getLoan(uint256 loanId) external view override returns (DataTypes.LoanData memory loanData) {
    return _loans[loanId];
  }

  function getLoanCollateralAndReserve(uint256 loanId)
    external
    view
    override
    returns (
      address nftAsset,
      uint256 nftTokenId,
      address reserveAsset,
      uint256 scaledAmount
    )
  {
    return (
      _loans[loanId].nftAsset,
      _loans[loanId].nftTokenId,
      _loans[loanId].reserveAsset,
      _loans[loanId].scaledAmount
    );
  }

  function getLoanReserveBorrowAmount(uint256 loanId) external view override returns (address, uint256) {
    uint256 scaledAmount = _loans[loanId].scaledAmount;
    if (scaledAmount == 0) {
      return (_loans[loanId].reserveAsset, 0);
    }
    uint256 amount = scaledAmount.rayMul(_getLendPool().getReserveNormalizedVariableDebt(_loans[loanId].reserveAsset));

    return (_loans[loanId].reserveAsset, amount);
  }

  function getLoanReserveBorrowScaledAmount(uint256 loanId) external view override returns (address, uint256) {
    return (_loans[loanId].reserveAsset, _loans[loanId].scaledAmount);
  }

  function getLoanHighestBid(uint256 loanId) external view override returns (address, uint256) {
    return (_loans[loanId].bidderAddress, _loans[loanId].bidPrice);
  }

  function getNftCollateralAmount(address nftAsset) external view override returns (uint256) {
    return _nftTotalCollateral[nftAsset];
  }

  function getUserNftCollateralAmount(address user, address nftAsset) external view override returns (uint256) {
    return _userNftCollateral[user][nftAsset];
  }

  function getCurrentLoanId() public view returns (uint256) {
    return _loanIdTracker.current();
  }

  function _getLendPool() internal view returns (ILendPool) {
    return ILendPool(_addressesProvider.getLendPool());
  }

  function _deleteLoanRepaidInterceptor(
    address nftAsset,
    uint256 tokenId,
    uint256 findIndex
  ) internal {
    address[] storage interceptors = _loanRepaidInterceptors[nftAsset][tokenId];
    address findInterceptor = interceptors[findIndex];
    uint256 lastInterceptorIndex = interceptors.length - 1;
    // When the token to delete is the last item, the swap operation is unnecessary.
    // Move the last interceptor to the slot of the to-delete interceptor
    if (findIndex < lastInterceptorIndex) {
      address lastInterceptorAddr = interceptors[lastInterceptorIndex];
      interceptors[findIndex] = lastInterceptorAddr;
    }
    interceptors.pop();
    emit LoanRepaidInterceptorUpdated(nftAsset, tokenId, findInterceptor, false);
  }

  function _handleBeforeLoanRepaid(address nftAsset, uint256 tokenId) internal {
    // CAUTION: interceptor maybe deleted in the called function
    address[] memory interceptors = getLoanRepaidInterceptors(nftAsset, tokenId);
    for (uint256 i = 0; i < interceptors.length; i++) {
      bool checkHandle = ILoanRepaidInterceptor(interceptors[i]).beforeLoanRepaid(nftAsset, tokenId);
      require(checkHandle, "BNFT: call interceptor before token burn failed");
    }
  }

  function _handleAfterLoanRepaid(address nftAsset, uint256 tokenId) internal {
    // CAUTION: interceptor maybe deleted in the called function
    address[] memory interceptors = getLoanRepaidInterceptors(nftAsset, tokenId);
    for (uint256 i = 0; i < interceptors.length; i++) {
      bool checkHandle = ILoanRepaidInterceptor(interceptors[i]).afterLoanRepaid(nftAsset, tokenId);
      require(checkHandle, "BNFT: call interceptor after token burn failed");
    }
  }
}
