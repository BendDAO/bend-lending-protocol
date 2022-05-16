// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {IERC721ReceiverUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import {IAaveFlashLoanReceiver} from "./interfaces/IAaveFlashLoanReceiver.sol";
import {IOpenseaExchage} from "./interfaces/IOpenseaExchage.sol";
import {ILendPool} from "../interfaces/ILendPool.sol";
import {ILendPoolAddressesProvider} from "../interfaces/ILendPoolAddressesProvider.sol";
import {IAaveLendPoolAddressesProvider} from "./interfaces/IAaveLendPoolAddressesProvider.sol";
import {IWETH} from "../interfaces/IWETH.sol";
import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import {PercentageMath} from "../libraries/math/PercentageMath.sol";
import {MathUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import {EIP712Upgradeable, ECDSAUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol";
import {CountersUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";

contract OpenseaDownpaymentBuyAdapter is
  IAaveFlashLoanReceiver,
  OwnableUpgradeable,
  PausableUpgradeable,
  EIP712Upgradeable,
  ReentrancyGuardUpgradeable,
  IERC721ReceiverUpgradeable
{
  event FeeCharged(address indexed payer, uint256 fee);

  event FeeUpdated(uint256 indexed newFee);

  using PercentageMath for uint256;
  using CountersUpgradeable for CountersUpgradeable.Counter;

  string public constant NAME = "Opensea Downpayment Buy Adapter";
  string public constant VERSION = "1.0";

  bytes32 private constant _PARAMS_TYPEHASH =
    keccak256(
      "Params(address nftAsset,uint256 nftTokenId,Order buy,Order sell,Sig sellSig,bytes32 metadata,uint256 nonce)Order(address exchange,address maker,address taker,uint256 makerRelayerFee,uint256 takerRelayerFee,uint256 makerProtocolFee,uint256 takerProtocolFee,address feeRecipient,uint8 feeMethod,uint8 side,uint8 saleKind,address target,uint8 howToCall,bytes calldata,bytes replacementPattern,address staticTarget,bytes staticExtradata,address paymentToken,uint256 basePrice,uint256 extra,uint256 listingTime,uint256 expirationTime,uint256 salt)Sig(uint8 v,bytes32 r,bytes32 s)"
    );

  bytes32 private constant _ORDER_TYPEHASH =
    keccak256(
      "Order(address exchange,address maker,address taker,uint256 makerRelayerFee,uint256 takerRelayerFee,uint256 makerProtocolFee,uint256 takerProtocolFee,address feeRecipient,uint8 feeMethod,uint8 side,uint8 saleKind,address target,uint8 howToCall,bytes calldata,bytes replacementPattern,address staticTarget,bytes staticExtradata,address paymentToken,uint256 basePrice,uint256 extra,uint256 listingTime,uint256 expirationTime,uint256 salt)"
    );

  bytes32 private constant _SIGNATURE_TYPEHASH = keccak256("Sig(uint8 v,bytes32 r,bytes32 s)");

  mapping(address => CountersUpgradeable.Counter) private _nonces;

  ILendPoolAddressesProvider public bendAddressesProvider;
  IAaveLendPoolAddressesProvider public aaveAddressedProvider;
  IOpenseaExchage public openseaExchange;
  IWETH public WETH;
  uint256 public fee;
  address public bendCollector;

  struct Params {
    // bend params
    address nftAsset;
    uint256 nftTokenId;
    // opensea params
    address[14] addrs;
    uint256[18] uints;
    uint8[8] feeMethodsSidesKindsHowToCalls;
    bytes calldataBuy;
    bytes calldataSell;
    bytes replacementPatternBuy;
    bytes replacementPatternSell;
    bytes staticExtradataBuy;
    bytes staticExtradataSell;
    uint8[2] vs;
    bytes32[5] rssMetadata;
  }

  struct Order {
    address exchange;
    address maker;
    address taker;
    uint256 makerRelayerFee;
    uint256 takerRelayerFee;
    uint256 makerProtocolFee;
    uint256 takerProtocolFee;
    address feeRecipient;
    uint8 feeMethod;
    uint8 side;
    uint8 saleKind;
    address target;
    uint8 howToCall;
    bytes data;
    bytes replacementPattern;
    address staticTarget;
    bytes staticExtradata;
    address paymentToken;
    uint256 basePrice;
    uint256 extra;
    uint256 listingTime;
    uint256 expirationTime;
    uint256 salt;
  }

  struct Sig {
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
    address _openseaExchange,
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
    openseaExchange = IOpenseaExchage(_openseaExchange);
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
    _checkParams(_assets, _amounts, _premiums, _buyer, _orderParams, _useNonce(_buyer));

    uint256 _flashBorrowedAmount = _amounts[0];
    uint256 _flashFee = _premiums[0];
    uint256 _flashLoanDebt = _flashBorrowedAmount + _flashFee;
    uint256 _salePrice = _orderParams.uints[13];
    uint256 _bendFeeAmount = _salePrice.percentMul(fee);
    uint256 _buyerPayment = _bendFeeAmount + _flashFee + _salePrice - _flashBorrowedAmount;

    // Prepare ETH, need buyer approve WETH to this contract
    require(WETH.transferFrom(_buyer, address(this), _buyerPayment), "WETH transfer failed");
    WETH.withdraw(_salePrice);

    // Do opensea exchange
    _exchange(_orderParams, _salePrice);

    // Borrow WETH from bend, need buyer approve NFT to this contract
    _borrowWETH(_orderParams.nftAsset, _orderParams.nftTokenId, _buyer, _flashBorrowedAmount);

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
    // Check order params
    require(address(this) == _orderParams.addrs[1], "Buyer must be this contract");
    address _buyerpaymentToken = _orderParams.addrs[6];
    address _sellerpaymentToken = _orderParams.addrs[13];
    require(address(0) == _buyerpaymentToken, "Buyer payment token should be ETH");
    require(address(0) == _sellerpaymentToken, "Seller payment token should be ETH");
    require(
      _orderParams.feeMethodsSidesKindsHowToCalls[2] == _orderParams.feeMethodsSidesKindsHowToCalls[6] &&
        0 == _orderParams.feeMethodsSidesKindsHowToCalls[2],
      "Order must be fixed price sale kind"
    );

    uint256 _buyPrice = _orderParams.uints[4];
    uint256 _sellPrice = _orderParams.uints[13];
    require(_buyPrice == _sellPrice, "Order price must be same");

    uint256 _flashBorrowedAmount = _amounts[0];
    require(_flashBorrowedAmount <= WETH.balanceOf(address(this)), "Flash loan error");

    // Check if the flash loan can be paid off
    uint256 _flashFee = _premiums[0];

    // Check payment sufficient
    uint256 _salePrice = _orderParams.uints[13];
    uint256 _bendFeeAmount = _salePrice.percentMul(fee);
    uint256 _buyerBalance = MathUpgradeable.min(WETH.balanceOf(_buyer), WETH.allowance(_buyer, address(this)));
    uint256 _buyerPayment = _bendFeeAmount + _flashFee + _salePrice - _flashBorrowedAmount;

    require(_buyerBalance >= _buyerPayment, "Insufficient payment");
  }

  function _hashParams(Params memory _orderParams, uint256 _nonce) internal pure returns (bytes32) {
    Order memory buy;
    {
      buy.exchange = _orderParams.addrs[0];
      buy.maker = _orderParams.addrs[1];
      buy.taker = _orderParams.addrs[2];
      buy.makerRelayerFee = _orderParams.uints[0];
      buy.takerRelayerFee = _orderParams.uints[1];
      buy.makerProtocolFee = _orderParams.uints[2];
      buy.takerProtocolFee = _orderParams.uints[3];
      buy.feeRecipient = _orderParams.addrs[3];
      buy.feeMethod = _orderParams.feeMethodsSidesKindsHowToCalls[0];
      buy.side = _orderParams.feeMethodsSidesKindsHowToCalls[1];
      buy.saleKind = _orderParams.feeMethodsSidesKindsHowToCalls[2];
      buy.target = _orderParams.addrs[4];
      buy.howToCall = _orderParams.feeMethodsSidesKindsHowToCalls[3];
      buy.data = _orderParams.calldataBuy;
      buy.replacementPattern = _orderParams.replacementPatternBuy;
      buy.staticTarget = _orderParams.addrs[5];
      buy.staticExtradata = _orderParams.staticExtradataBuy;
      buy.paymentToken = _orderParams.addrs[6];
      buy.basePrice = _orderParams.uints[4];
      buy.extra = _orderParams.uints[5];
      buy.listingTime = _orderParams.uints[6];
      buy.expirationTime = _orderParams.uints[7];
      buy.salt = _orderParams.uints[8];
    }
    Order memory sell;
    {
      sell.exchange = _orderParams.addrs[7];
      sell.maker = _orderParams.addrs[8];
      sell.taker = _orderParams.addrs[9];
      sell.makerRelayerFee = _orderParams.uints[9];
      sell.takerRelayerFee = _orderParams.uints[10];
      sell.makerProtocolFee = _orderParams.uints[11];
      sell.takerProtocolFee = _orderParams.uints[12];
      sell.feeRecipient = _orderParams.addrs[10];
      sell.feeMethod = _orderParams.feeMethodsSidesKindsHowToCalls[4];
      sell.side = _orderParams.feeMethodsSidesKindsHowToCalls[5];
      sell.saleKind = _orderParams.feeMethodsSidesKindsHowToCalls[6];
      sell.target = _orderParams.addrs[11];
      sell.howToCall = _orderParams.feeMethodsSidesKindsHowToCalls[7];
      sell.data = _orderParams.calldataSell;
      sell.replacementPattern = _orderParams.replacementPatternSell;
      sell.staticTarget = _orderParams.addrs[12];
      sell.staticExtradata = _orderParams.staticExtradataSell;
      sell.paymentToken = _orderParams.addrs[13];
      sell.basePrice = _orderParams.uints[13];
      sell.extra = _orderParams.uints[14];
      sell.listingTime = _orderParams.uints[15];
      sell.expirationTime = _orderParams.uints[16];
      sell.salt = _orderParams.uints[17];
    }

    Sig memory sellSig;
    {
      sellSig.v = _orderParams.vs[1];
      sellSig.r = _orderParams.rssMetadata[2];
      sellSig.s = _orderParams.rssMetadata[3];
    }
    return
      keccak256(
        abi.encode(
          _PARAMS_TYPEHASH,
          _orderParams.nftAsset,
          _orderParams.nftTokenId,
          _hashOrder(buy),
          _hashOrder(sell),
          _hashSig(sellSig),
          _orderParams.rssMetadata[4],
          _nonce
        )
      );
  }

  function _hashOrder(Order memory order) internal pure returns (bytes32) {
    return
      keccak256(
        bytes.concat(
          abi.encode(
            _ORDER_TYPEHASH,
            order.exchange,
            order.maker,
            order.taker,
            order.makerRelayerFee,
            order.takerRelayerFee,
            order.makerProtocolFee,
            order.takerProtocolFee,
            order.feeRecipient,
            order.feeMethod,
            order.side,
            order.saleKind,
            order.target,
            order.howToCall
          ),
          abi.encode(
            keccak256(order.data),
            keccak256(order.replacementPattern),
            order.staticTarget,
            keccak256(order.staticExtradata),
            order.paymentToken,
            order.basePrice,
            order.extra,
            order.listingTime,
            order.expirationTime,
            order.salt
          )
        )
      );
  }

  function _hashSig(Sig memory sig) internal pure returns (bytes32) {
    return keccak256(abi.encode(_SIGNATURE_TYPEHASH, sig.v, sig.r, sig.s));
  }

  function _checkSig(
    Params memory _orderParams,
    address _buyer,
    uint256 _nonce
  ) internal view {
    bytes32 paramsHash = _hashParams(_orderParams, _nonce);
    bytes32 hash = _hashTypedDataV4(paramsHash);
    address signer = ECDSAUpgradeable.recover(
      hash,
      _orderParams.vs[0],
      _orderParams.rssMetadata[0],
      _orderParams.rssMetadata[1]
    );
    require(signer == _buyer, "Invalid signature");
  }

  function _exchange(Params memory _orderParams, uint256 _value) internal {
    openseaExchange.atomicMatch_{value: _value}(
      _orderParams.addrs,
      _orderParams.uints,
      _orderParams.feeMethodsSidesKindsHowToCalls,
      _orderParams.calldataBuy,
      _orderParams.calldataSell,
      _orderParams.replacementPatternBuy,
      _orderParams.replacementPatternSell,
      _orderParams.staticExtradataBuy,
      _orderParams.staticExtradataSell,
      _orderParams.vs,
      _orderParams.rssMetadata
    );
  }

  function _borrowWETH(
    address _nftAsset,
    uint256 _nftTokenId,
    address _onBehalfOf,
    uint256 _amount
  ) internal {
    ILendPool _pool = _getBendLendPool();
    IERC721Upgradeable _nftERC721 = IERC721Upgradeable(_nftAsset);

    require(_nftERC721.ownerOf(_nftTokenId) == address(this), "Not own nft");
    _nftERC721.approve(address(_pool), _nftTokenId);
    _pool.borrow(address(WETH), _amount, _nftAsset, _nftTokenId, _onBehalfOf, 0);
  }

  function _getBendLendPool() internal view returns (ILendPool) {
    return ILendPool(bendAddressesProvider.getLendPool());
  }

  function _decodeParams(bytes memory _params) public pure returns (Params memory) {
    return abi.decode(_params, (Params));
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
   * @dev Only WETH contract is allowed to transfer ETH here. Prevent other addresses to send Ether to this contract.
   */
  receive() external payable {
    require(msg.sender == address(WETH), "Receive not allowed");
  }
}
