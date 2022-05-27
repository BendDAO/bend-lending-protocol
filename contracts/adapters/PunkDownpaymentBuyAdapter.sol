// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import "./interfaces/ICryptoPunksMarket.sol";
import "../interfaces/IWrappedPunks.sol";

import "../libraries/math/PercentageMath.sol";

import "./BaseDownpaymentBuyAdapter.sol";

contract PunkDownpaymentBuyAdapter is BaseDownpaymentBuyAdapter {
  using PercentageMath for uint256;

  string public constant NAME = "Punk Downpayment Buy Adapter";
  string public constant VERSION = "1.0";

  bytes32 private constant _PARAMS_TYPEHASH = keccak256("Params(uint256 punkIndex,uint256 buyPrice,uint256 nonce)");

  ICryptoPunksMarket public punksMarket;
  IWrappedPunks public wrappedPunks;
  address public wpunkProxy;

  struct Params {
    uint256 punkIndex;
    uint256 buyPrice;
    uint8 v;
    bytes32 r;
    bytes32 s;
  }

  function initialize(
    address _aaveAddressesProvider,
    address _bendAddressesProvider,
    address _weth,
    address _bendCollector,
    uint256 _fee,
    address _cryptoPunksMarket,
    address _wrappedPunks
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

    punksMarket = ICryptoPunksMarket(_cryptoPunksMarket);
    wrappedPunks = IWrappedPunks(_wrappedPunks);
    wrappedPunks.registerProxy();
    wpunkProxy = wrappedPunks.proxyInfo(address(this));
  }

  struct CheckOrderParamsLocalVars {
    bytes32 paramsHash;
    uint256 buyPrice;
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
    Sig memory _sig = Sig({v: _orderParams.v, r: _orderParams.r, s: _orderParams.s});
    _checkSig(vars.paramsHash, _sig, _buyer);

    ICryptoPunksMarket.Offer memory _sellOffer = punksMarket.punksOfferedForSale(_orderParams.punkIndex);

    // Check order params
    require(_sellOffer.isForSale, "Punk not actually for sale");
    require(_orderParams.buyPrice == _sellOffer.minValue, "Order price must be same");
    require(_sellOffer.onlySellTo == address(0), "Order must sell to zero address");

    return
      BaseOrderParam({
        nftAsset: address(wrappedPunks),
        nftTokenId: _orderParams.punkIndex,
        salePrice: _sellOffer.minValue
      });
  }

  function _hashParams(Params memory _orderParams, uint256 _nonce) internal pure returns (bytes32) {
    return keccak256(abi.encode(_PARAMS_TYPEHASH, _orderParams.punkIndex, _orderParams.buyPrice, _nonce));
  }

  function _exchange(bytes calldata _params, uint256 _value) internal override {
    _value;

    Params memory _orderParams = _decodeParams(_params);

    punksMarket.buyPunk{value: _orderParams.buyPrice}(_orderParams.punkIndex);
  }

  function _beforeBorrowWETH(
    address _nftAsset,
    uint256 _nftTokenId,
    address _onBehalfOf,
    uint256 _amount
  ) internal override {
    _nftAsset;
    _nftTokenId;
    _onBehalfOf;
    _amount;

    require(address(wrappedPunks) == _nftAsset, "Not wpunks contract");
    require(punksMarket.punkIndexToAddress(_nftTokenId) == address(this), "Not owner of punkIndex");
    punksMarket.transferPunk(wpunkProxy, _nftTokenId);
    wrappedPunks.mint(_nftTokenId);
  }

  function _decodeParams(bytes memory _params) internal pure returns (Params memory) {
    return abi.decode(_params, (Params));
  }
}
