// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {INFTOracle} from "../interfaces/INFTOracle.sol";
import {BlockContext} from "../utils/BlockContext.sol";

contract NFTOracle is INFTOracle, Initializable, OwnableUpgradeable, BlockContext {
  modifier onlyAdmin() {
    require(_msgSender() == priceFeedAdmin, "NFTOracle: !admin");
    _;
  }

  event AssetAdded(address indexed asset);
  event AssetRemoved(address indexed asset);
  event FeedAdminUpdated(address indexed admin);
  event SetAssetData(address indexed asset, uint256 price, uint256 timestamp, uint256 roundId);
  event SetAssetTwapPrice(address indexed asset, uint256 price, uint256 timestamp);

  struct NFTPriceData {
    uint256 roundId;
    uint256 price;
    uint256 timestamp;
  }

  struct NFTPriceFeed {
    bool registered;
    NFTPriceData[] nftPriceData;
  }

  address public priceFeedAdmin;

  // key is nft contract address
  mapping(address => NFTPriceFeed) public nftPriceFeedMap;
  address[] public nftPriceFeedKeys;

  // data validity check parameters
  uint256 private constant DECIMAL_PRECISION = 10**18;
  // Maximum deviation allowed between two consecutive oracle prices. 18-digit precision.
  uint256 public maxPriceDeviation; // 20%,18-digit precision.
  // The maximum allowed deviation between two consecutive oracle prices within a certain time frame. 18-bit precision.
  uint256 public maxPriceDeviationWithTime; // 10%
  uint256 public timeIntervalWithPrice; // 30 minutes
  uint256 public minUpdateTime; // 10 minutes

  mapping(address => bool) public nftPaused;

  modifier whenNotPaused(address _nftContract) {
    _whenNotPaused(_nftContract);
    _;
  }

  uint256 public twapInterval;
  mapping(address => uint256) public twapPriceMap;

  function _whenNotPaused(address _nftContract) internal view {
    bool _paused = nftPaused[_nftContract];
    require(!_paused, "NFTOracle: nft price feed paused");
  }

  function initialize(
    address _admin,
    uint256 _maxPriceDeviation,
    uint256 _maxPriceDeviationWithTime,
    uint256 _timeIntervalWithPrice,
    uint256 _minUpdateTime,
    uint256 _twapInterval
  ) public initializer {
    __Ownable_init();
    priceFeedAdmin = _admin;
    maxPriceDeviation = _maxPriceDeviation;
    maxPriceDeviationWithTime = _maxPriceDeviationWithTime;
    timeIntervalWithPrice = _timeIntervalWithPrice;
    minUpdateTime = _minUpdateTime;
    twapInterval = _twapInterval;
  }

  function setPriceFeedAdmin(address _admin) external onlyOwner {
    priceFeedAdmin = _admin;
    emit FeedAdminUpdated(_admin);
  }

  function setAssets(address[] calldata _nftContracts) external onlyOwner {
    for (uint256 i = 0; i < _nftContracts.length; i++) {
      _addAsset(_nftContracts[i]);
    }
  }

  function addAsset(address _nftContract) external onlyOwner {
    _addAsset(_nftContract);
  }

  function _addAsset(address _nftContract) internal {
    requireKeyExisted(_nftContract, false);
    nftPriceFeedMap[_nftContract].registered = true;
    nftPriceFeedKeys.push(_nftContract);
    emit AssetAdded(_nftContract);
  }

  function removeAsset(address _nftContract) external onlyOwner {
    requireKeyExisted(_nftContract, true);
    delete nftPriceFeedMap[_nftContract];

    uint256 length = nftPriceFeedKeys.length;
    for (uint256 i = 0; i < length; i++) {
      if (nftPriceFeedKeys[i] == _nftContract) {
        nftPriceFeedKeys[i] = nftPriceFeedKeys[length - 1];
        nftPriceFeedKeys.pop();
        break;
      }
    }
    emit AssetRemoved(_nftContract);
  }

  function setAssetData(address _nftContract, uint256 _price) external override onlyAdmin whenNotPaused(_nftContract) {
    uint256 _timestamp = _blockTimestamp();
    _setAssetData(_nftContract, _price, _timestamp);
  }

  function setMultipleAssetsData(address[] calldata _nftContracts, uint256[] calldata _prices)
    external
    override
    onlyAdmin
  {
    require(_nftContracts.length == _prices.length, "NFTOracle: data length not match");
    uint256 _timestamp = _blockTimestamp();
    for (uint256 i = 0; i < _nftContracts.length; i++) {
      bool _paused = nftPaused[_nftContracts[i]];
      if (!_paused) {
        _setAssetData(_nftContracts[i], _prices[i], _timestamp);
      }
    }
  }

  function _setAssetData(
    address _nftContract,
    uint256 _price,
    uint256 _timestamp
  ) internal {
    requireKeyExisted(_nftContract, true);
    require(_timestamp > getLatestTimestamp(_nftContract), "NFTOracle: incorrect timestamp");
    require(_price > 0, "NFTOracle: price can not be 0");
    bool dataValidity = checkValidityOfPrice(_nftContract, _price, _timestamp);
    require(dataValidity, "NFTOracle: invalid price data");
    uint256 len = getPriceFeedLength(_nftContract);
    NFTPriceData memory data = NFTPriceData({price: _price, timestamp: _timestamp, roundId: len});
    nftPriceFeedMap[_nftContract].nftPriceData.push(data);

    uint256 twapPrice = calculateTwapPrice(_nftContract);
    twapPriceMap[_nftContract] = twapPrice;

    emit SetAssetData(_nftContract, _price, _timestamp, len);
    emit SetAssetTwapPrice(_nftContract, twapPrice, _timestamp);
  }

  function getAssetPrice(address _nftContract) external view override returns (uint256) {
    require(isExistedKey(_nftContract), "NFTOracle: key not existed");
    uint256 len = getPriceFeedLength(_nftContract);
    require(len > 0, "NFTOracle: no price data");
    uint256 twapPrice = twapPriceMap[_nftContract];
    if (twapPrice == 0) {
      return nftPriceFeedMap[_nftContract].nftPriceData[len - 1].price;
    } else {
      return twapPrice;
    }
  }

  function getLatestTimestamp(address _nftContract) public view override returns (uint256) {
    require(isExistedKey(_nftContract), "NFTOracle: key not existed");
    uint256 len = getPriceFeedLength(_nftContract);
    if (len == 0) {
      return 0;
    }
    return nftPriceFeedMap[_nftContract].nftPriceData[len - 1].timestamp;
  }

  function calculateTwapPrice(address _nftContract) public view returns (uint256) {
    require(isExistedKey(_nftContract), "NFTOracle: key not existed");
    require(twapInterval != 0, "NFTOracle: interval can't be 0");

    uint256 len = getPriceFeedLength(_nftContract);
    require(len > 0, "NFTOracle: Not enough history");
    uint256 round = len - 1;
    NFTPriceData memory priceRecord = nftPriceFeedMap[_nftContract].nftPriceData[round];
    uint256 latestTimestamp = priceRecord.timestamp;
    uint256 baseTimestamp = _blockTimestamp() - twapInterval;
    // if latest updated timestamp is earlier than target timestamp, return the latest price.
    if (latestTimestamp < baseTimestamp || round == 0) {
      return priceRecord.price;
    }

    // rounds are like snapshots, latestRound means the latest price snapshot. follow chainlink naming
    uint256 cumulativeTime = _blockTimestamp() - latestTimestamp;
    uint256 previousTimestamp = latestTimestamp;
    uint256 weightedPrice = priceRecord.price * cumulativeTime;
    while (true) {
      if (round == 0) {
        // if cumulative time is less than requested interval, return current twap price
        return weightedPrice / cumulativeTime;
      }

      round = round - 1;
      // get current round timestamp and price
      priceRecord = nftPriceFeedMap[_nftContract].nftPriceData[round];
      uint256 currentTimestamp = priceRecord.timestamp;
      uint256 price = priceRecord.price;

      // check if current round timestamp is earlier than target timestamp
      if (currentTimestamp <= baseTimestamp) {
        // weighted time period will be (target timestamp - previous timestamp). For example,
        // now is 1000, twapInterval is 100, then target timestamp is 900. If timestamp of current round is 970,
        // and timestamp of NEXT round is 880, then the weighted time period will be (970 - 900) = 70,
        // instead of (970 - 880)
        weightedPrice = weightedPrice + (price * (previousTimestamp - baseTimestamp));
        break;
      }

      uint256 timeFraction = previousTimestamp - currentTimestamp;
      weightedPrice = weightedPrice + price * timeFraction;
      cumulativeTime = cumulativeTime + timeFraction;
      previousTimestamp = currentTimestamp;
    }
    return weightedPrice / twapInterval;
  }

  function getPreviousPrice(address _nftContract, uint256 _numOfRoundBack) public view override returns (uint256) {
    require(isExistedKey(_nftContract), "NFTOracle: key not existed");

    uint256 len = getPriceFeedLength(_nftContract);
    require(len > 0 && _numOfRoundBack < len, "NFTOracle: Not enough history");
    return nftPriceFeedMap[_nftContract].nftPriceData[len - _numOfRoundBack - 1].price;
  }

  function getPreviousTimestamp(address _nftContract, uint256 _numOfRoundBack) public view override returns (uint256) {
    require(isExistedKey(_nftContract), "NFTOracle: key not existed");

    uint256 len = getPriceFeedLength(_nftContract);
    require(len > 0 && _numOfRoundBack < len, "NFTOracle: Not enough history");
    return nftPriceFeedMap[_nftContract].nftPriceData[len - _numOfRoundBack - 1].timestamp;
  }

  function getPriceFeedLength(address _nftContract) public view returns (uint256 length) {
    return nftPriceFeedMap[_nftContract].nftPriceData.length;
  }

  function getLatestRoundId(address _nftContract) public view returns (uint256) {
    uint256 len = getPriceFeedLength(_nftContract);
    if (len == 0) {
      return 0;
    }
    return nftPriceFeedMap[_nftContract].nftPriceData[len - 1].roundId;
  }

  function isExistedKey(address _nftContract) private view returns (bool) {
    return nftPriceFeedMap[_nftContract].registered;
  }

  function requireKeyExisted(address _key, bool _existed) private view {
    if (_existed) {
      require(isExistedKey(_key), "NFTOracle: key not existed");
    } else {
      require(!isExistedKey(_key), "NFTOracle: key existed");
    }
  }

  function checkValidityOfPrice(
    address _nftContract,
    uint256 _price,
    uint256 _timestamp
  ) private view returns (bool) {
    uint256 len = getPriceFeedLength(_nftContract);
    if (len > 0) {
      uint256 price = nftPriceFeedMap[_nftContract].nftPriceData[len - 1].price;
      if (_price == price) {
        return true;
      }
      uint256 timestamp = nftPriceFeedMap[_nftContract].nftPriceData[len - 1].timestamp;
      uint256 percentDeviation;
      if (_price > price) {
        percentDeviation = ((_price - price) * DECIMAL_PRECISION) / price;
      } else {
        percentDeviation = ((price - _price) * DECIMAL_PRECISION) / price;
      }
      uint256 timeDeviation = _timestamp - timestamp;
      if (percentDeviation > maxPriceDeviation) {
        return false;
      } else if (timeDeviation < minUpdateTime) {
        return false;
      } else if ((percentDeviation > maxPriceDeviationWithTime) && (timeDeviation < timeIntervalWithPrice)) {
        return false;
      }
    }
    return true;
  }

  function setDataValidityParameters(
    uint256 _maxPriceDeviation,
    uint256 _maxPriceDeviationWithTime,
    uint256 _timeIntervalWithPrice,
    uint256 _minUpdateTime
  ) external onlyOwner {
    maxPriceDeviation = _maxPriceDeviation;
    maxPriceDeviationWithTime = _maxPriceDeviationWithTime;
    timeIntervalWithPrice = _timeIntervalWithPrice;
    minUpdateTime = _minUpdateTime;
  }

  function setPause(address _nftContract, bool val) external override onlyOwner {
    nftPaused[_nftContract] = val;
  }

  function setTwapInterval(uint256 _twapInterval) external override onlyOwner {
    twapInterval = _twapInterval;
  }
}
