// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {IAaveFlashLoanReceiver} from "./interfaces/IAaveFlashLoanReceiver.sol";
import {ICryptoPunksMarket} from "./interfaces/ICryptoPunksMarket.sol";
import {IWrappedPunks} from "../interfaces/IWrappedPunks.sol";
import {IAaveLendPoolAddressesProvider} from "./interfaces/IAaveLendPoolAddressesProvider.sol";
import {IWETH} from "../interfaces/IWETH.sol";
import {PercentageMath} from "../libraries/math/PercentageMath.sol";
import {MathUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import {ILendPool} from "../interfaces/ILendPool.sol";
import {ILendPoolAddressesProvider} from "../interfaces/ILendPoolAddressesProvider.sol";
import {EIP712Upgradeable, ECDSAUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol";
import {CountersUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";

contract PunkDownpaymentBuyAdapter is
  IAaveFlashLoanReceiver,
  OwnableUpgradeable,
  PausableUpgradeable,
  ReentrancyGuardUpgradeable,
  EIP712Upgradeable
{
  event FeeCharged(address indexed payer, uint256 fee);

  event FeeUpdated(uint256 indexed newFee);

  using PercentageMath for uint256;
  using CountersUpgradeable for CountersUpgradeable.Counter;

  string public constant NAME = "Punk Downpayment Buy Adapter";
  string public constant VERSION = "1.0";

  bytes32 private constant _PARAMS_TYPEHASH = keccak256("Params(uint256 punkIndex,uint256 buyPrice,uint256 nonce)");

  mapping(address => CountersUpgradeable.Counter) private _nonces;

  ILendPoolAddressesProvider public bendAddressesProvider;
  IAaveLendPoolAddressesProvider public aaveAddressedProvider;
  ICryptoPunksMarket public punksMarket;
  IWrappedPunks public wrappedPunks;
  address public wpunkProxy;
  IWETH public WETH;
  uint256 public fee;
  address public bendCollector;

  struct Params {
    uint256 punkIndex;
    uint256 buyPrice;
    uint8 v;
    bytes32 r;
    bytes32 s;
  }

  modifier onlyAaveLendPool() {
    require(msg.sender == aaveAddressedProvider.getLendingPool(), "Caller must be aave lending pool");
    _;
  }

  function initialize(
    uint256 _fee,
    address _bendAddressesProvider,
    address _aaveAddressesProvider,
    address _cryptoPunksMarket,
    address _wrappedPunks,
    address _weth,
    address _bendCollector
  ) external initializer {
    __Pausable_init();
    __Ownable_init();
    __ReentrancyGuard_init();
    __EIP712_init_unchained(NAME, VERSION);
    fee = _fee;
    bendAddressesProvider = ILendPoolAddressesProvider(_bendAddressesProvider);
    aaveAddressedProvider = IAaveLendPoolAddressesProvider(_aaveAddressesProvider);
    WETH = IWETH(_weth);
    punksMarket = ICryptoPunksMarket(_cryptoPunksMarket);
    wrappedPunks = IWrappedPunks(_wrappedPunks);
    wrappedPunks.registerProxy();
    wpunkProxy = wrappedPunks.proxyInfo(address(this));
    bendCollector = _bendCollector;
    WETH.approve(bendAddressesProvider.getLendPool(), type(uint256).max);
  }

  function nonces(address owner) public view returns (uint256) {
    return _nonces[owner].current();
  }

  function _useNonce(address owner) internal returns (uint256 current) {
    CountersUpgradeable.Counter storage nonce = _nonces[owner];
    current = nonce.current();
    nonce.increment();
  }

  function pause() external onlyOwner whenNotPaused {
    _pause();
  }

  function unpause() external onlyOwner whenPaused {
    _unpause();
  }

  function updateFee(uint256 _newFee) external onlyOwner {
    require(_newFee <= PercentageMath.PERCENTAGE_FACTOR, "Fee overflow");
    fee = _newFee;
    emit FeeUpdated(fee);
  }

  function executeOperation(
    address[] calldata _assets,
    uint256[] calldata _amounts,
    uint256[] calldata _premiums,
    address _initiator,
    bytes calldata _params
  ) external override nonReentrant whenNotPaused onlyAaveLendPool returns (bool) {
    Params memory _orderParams = _decodeParams(_params);
    address _buyer = _initiator;
    _checkParams(_assets, _amounts, _premiums, _initiator, _orderParams, _useNonce(_buyer));

    uint256 _flashBorrowedAmount = _amounts[0];
    uint256 _flashFee = _premiums[0];
    uint256 _flashLoanDebt = _flashBorrowedAmount + _flashFee;
    uint256 _buyPrice = _orderParams.buyPrice;
    uint256 _bendFeeAmount = _buyPrice.percentMul(fee);
    uint256 _buyerPayment = _bendFeeAmount + _flashFee + _buyPrice - _flashBorrowedAmount;

    // Prepare ETH, need buyer approve WETH to this contract
    require(WETH.transferFrom(_buyer, address(this), _buyerPayment), "WETH transfer failed");
    WETH.withdraw(_buyPrice);

    // Do punk exchange
    _exchange(_orderParams);

    // Borrow WETH from bend, need buyer approve NFT to this contract
    _borrowWETH(_orderParams.punkIndex, _buyer, _flashBorrowedAmount);

    // Charge fee, sent to bend collector
    _chargeFee(_buyer, _bendFeeAmount);

    // Repay flash loan
    WETH.approve(aaveAddressedProvider.getLendingPool(), 0);
    WETH.approve(aaveAddressedProvider.getLendingPool(), _flashLoanDebt);
    return true;
  }

  function _chargeFee(address _payer, uint256 _amount) internal {
    if (_amount > 0) {
      _getBendLendPool().deposit(address(WETH), _amount, bendCollector, 0);
      emit FeeCharged(_payer, _amount);
    }
  }

  function _checkParams(
    address[] calldata _assets,
    uint256[] calldata _amounts,
    uint256[] calldata _premiums,
    address _buyer,
    Params memory _orderParams,
    uint256 _nonce
  ) internal view {
    _checkSig(_orderParams, _buyer, _nonce);
    require(_assets.length == 1 && _amounts.length == 1 && _premiums.length == 1, "Multiple assets not supported");
    require(_assets[0] == address(WETH), "Only WETH borrowing allowed");
    ICryptoPunksMarket.Offer memory _sellOffer = punksMarket.punksOfferedForSale(_orderParams.punkIndex);

    // Check order params
    require(_sellOffer.isForSale, "Punk not actually for sale");
    require(_orderParams.buyPrice == _sellOffer.minValue, "Order price must be same");
    require(_sellOffer.onlySellTo == address(0), "Order must sell to zero address");

    uint256 _flashBorrowedAmount = _amounts[0];
    require(_flashBorrowedAmount <= WETH.balanceOf(address(this)), "Flash loan error");

    // Check if the flash loan can be paid off
    uint256 _flashFee = _premiums[0];

    // Check payment sufficient
    uint256 _salePrice = _sellOffer.minValue;
    uint256 _bendFeeAmount = _salePrice.percentMul(fee);
    uint256 _buyerBalance = MathUpgradeable.min(WETH.balanceOf(_buyer), WETH.allowance(_buyer, address(this)));
    uint256 _buyerPayment = _bendFeeAmount + _flashFee + _salePrice - _flashBorrowedAmount;

    require(_buyerBalance >= _buyerPayment, "Insufficient payment");
  }

  function _hashParams(Params memory _orderParams, uint256 _nonce) internal pure returns (bytes32) {
    return keccak256(abi.encode(_PARAMS_TYPEHASH, _orderParams.punkIndex, _orderParams.buyPrice, _nonce));
  }

  function _checkSig(
    Params memory _orderParams,
    address _buyer,
    uint256 _nonce
  ) internal view {
    bytes32 paramsHash = _hashParams(_orderParams, _nonce);
    bytes32 hash = _hashTypedDataV4(paramsHash);
    address signer = ECDSAUpgradeable.recover(hash, _orderParams.v, _orderParams.r, _orderParams.s);
    require(signer == _buyer, "Invalid signature");
  }

  function _exchange(Params memory _orderParams) internal {
    punksMarket.buyPunk{value: _orderParams.buyPrice}(_orderParams.punkIndex);
  }

  function _borrowWETH(
    uint256 _punkIndex,
    address _onBehalfOf,
    uint256 _amount
  ) internal {
    require(punksMarket.punkIndexToAddress(_punkIndex) == address(this), "Not owner of punkIndex");
    punksMarket.transferPunk(wpunkProxy, _punkIndex);
    wrappedPunks.mint(_punkIndex);
    ILendPool _pool = _getBendLendPool();
    wrappedPunks.approve(address(_pool), _punkIndex);
    _pool.borrow(address(WETH), _amount, address(wrappedPunks), _punkIndex, _onBehalfOf, 0);
  }

  function _getBendLendPool() internal view returns (ILendPool) {
    return ILendPool(bendAddressesProvider.getLendPool());
  }

  function _decodeParams(bytes memory _params) internal pure returns (Params memory) {
    return abi.decode(_params, (Params));
  }

  /**
   * @dev Only WETH contract is allowed to transfer ETH here. Prevent other addresses to send Ether to this contract.
   */
  receive() external payable {
    require(msg.sender == address(WETH), "Receive not allowed");
  }
}
