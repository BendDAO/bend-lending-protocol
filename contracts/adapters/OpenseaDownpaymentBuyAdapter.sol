// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import "./interfaces/IOpenseaExchage.sol";

import "../libraries/math/PercentageMath.sol";

import "./BaseDownpaymentBuyAdapter.sol";

contract OpenseaDownpaymentBuyAdapter is BaseDownpaymentBuyAdapter {
  using PercentageMath for uint256;

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

  IOpenseaExchage public openseaExchange;

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

  function initialize(
    address _aaveAddressesProvider,
    address _bendAddressesProvider,
    address _weth,
    address _bendCollector,
    uint256 _fee,
    address _openseaExchange
  ) external initializer {
    __BaseDownpaymentBuyAdapter_init(
      NAME,
      VERSION,
      _aaveAddressesProvider,
      _bendAddressesProvider,
      _weth,
      _bendCollector,
      _fee
    );

    openseaExchange = IOpenseaExchage(_openseaExchange);
  }

  struct CheckOrderParamsLocalVars {
    bytes32 paramsHash;
    address buyerpaymentToken;
    address sellerpaymentToken;
    uint256 buyPrice;
    uint256 sellPrice;
    uint256 salePrice;
  }

  function _checkOrderParams(
    address _buyer,
    bytes calldata _params,
    uint256 _nonce
  ) internal view override returns (BaseOrderParam memory) {
    CheckOrderParamsLocalVars memory vars;

    Params memory _orderParams = _decodeParams(_params);

    vars.paramsHash = _hashParams(_orderParams, _nonce);
    Sig memory _sig = Sig({v: _orderParams.vs[0], r: _orderParams.rssMetadata[0], s: _orderParams.rssMetadata[1]});
    _checkSig(vars.paramsHash, _sig, _buyer);

    // Check order params
    require(address(this) == _orderParams.addrs[1], "Buyer must be this contract");
    vars.buyerpaymentToken = _orderParams.addrs[6];
    vars.sellerpaymentToken = _orderParams.addrs[13];
    require(address(0) == vars.buyerpaymentToken, "Buyer payment token should be ETH");
    require(address(0) == vars.sellerpaymentToken, "Seller payment token should be ETH");
    require(
      _orderParams.feeMethodsSidesKindsHowToCalls[2] == _orderParams.feeMethodsSidesKindsHowToCalls[6] &&
        0 == _orderParams.feeMethodsSidesKindsHowToCalls[2],
      "Order must be fixed price sale kind"
    );

    vars.buyPrice = _orderParams.uints[4];
    vars.sellPrice = _orderParams.uints[13];
    require(vars.buyPrice == vars.sellPrice, "Order price must be same");

    return
      BaseOrderParam({nftAsset: _orderParams.nftAsset, nftTokenId: _orderParams.nftTokenId, salePrice: vars.sellPrice});
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

  function _exchange(bytes calldata _params, uint256 _value) internal override {
    Params memory _orderParams = _decodeParams(_params);

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

  function _decodeParams(bytes memory _params) public pure returns (Params memory) {
    return abi.decode(_params, (Params));
  }
}
