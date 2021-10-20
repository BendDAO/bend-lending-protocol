// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {INFTOracle} from "../interfaces/INFTOracle.sol";
import {BlockContext} from "../utils/BlockContext.sol";

contract NFTOracle is
    INFTOracle,
    Initializable,
    OwnableUpgradeable,
    BlockContext
{
    modifier onlyAdmin() {
        require(_msgSender() == priceFeedAdmin, "!admin");
        _;
    }

    event SetAssetData(
        address indexed asset,
        uint256 price,
        uint256 timestamp,
        uint256 roundId
    );

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

    function initialize(address _admin) public initializer {
        __Ownable_init();
        priceFeedAdmin = _admin;
    }

    function setPriceFeedAdmin(address _admin) external onlyOwner {
        priceFeedAdmin = _admin;
    }

    function addAsset(address _nftContract) external onlyOwner {
        requireKeyExisted(_nftContract, false);
        nftPriceFeedMap[_nftContract].registered = true;
        nftPriceFeedKeys.push(_nftContract);
    }

    function removeAsset(address _nftContract) external onlyOwner {
        requireKeyExisted(_nftContract, true);
        delete nftPriceFeedMap[_nftContract];

        uint256 length = nftPriceFeedKeys.length;
        for (uint256 i; i < length; i++) {
            if (nftPriceFeedKeys[i] == _nftContract) {
                nftPriceFeedKeys[i] = nftPriceFeedKeys[length - 1];
                nftPriceFeedKeys.pop();
                break;
            }
        }
    }

    function setAssetData(
        address _nftContract,
        uint256 _price,
        uint256 _timestamp,
        uint256 _roundId
    ) external override onlyAdmin {
        requireKeyExisted(_nftContract, true);
        require(
            _timestamp > getLatestTimestamp(_nftContract),
            "incorrect timestamp"
        );

        NFTPriceData memory data = NFTPriceData({
            price: _price,
            timestamp: _timestamp,
            roundId: _roundId
        });
        nftPriceFeedMap[_nftContract].nftPriceData.push(data);

        emit SetAssetData(_nftContract, _price, _timestamp, _roundId);
    }

    function getAssetPrice(address _nftContract)
        external
        view
        override
        returns (uint256)
    {
        require(isExistedKey(_nftContract), "key not existed");
        uint256 len = getPriceFeedLength(_nftContract);
        require(len > 0, "no price data");
        return nftPriceFeedMap[_nftContract].nftPriceData[len - 1].price;
    }

    function getLatestTimestamp(address _nftContract)
        public
        view
        override
        returns (uint256)
    {
        require(isExistedKey(_nftContract), "key not existed");
        uint256 len = getPriceFeedLength(_nftContract);
        if (len == 0) {
            return 0;
        }
        return nftPriceFeedMap[_nftContract].nftPriceData[len - 1].timestamp;
    }

    function getTwapPrice(address _nftContract, uint256 _interval)
        external
        view
        override
        returns (uint256)
    {
        require(isExistedKey(_nftContract), "key not existed");
        require(_interval != 0, "interval can't be 0");

        uint256 len = getPriceFeedLength(_nftContract);
        require(len > 0, "Not enough history");
        uint256 round = len - 1;
        NFTPriceData memory priceRecord = nftPriceFeedMap[_nftContract]
            .nftPriceData[round];
        uint256 latestTimestamp = priceRecord.timestamp;
        uint256 baseTimestamp = _blockTimestamp() - _interval;
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
                // now is 1000, _interval is 100, then target timestamp is 900. If timestamp of current round is 970,
                // and timestamp of NEXT round is 880, then the weighted time period will be (970 - 900) = 70,
                // instead of (970 - 880)
                weightedPrice =
                    weightedPrice +
                    (price * (previousTimestamp - baseTimestamp));
                break;
            }

            uint256 timeFraction = previousTimestamp - currentTimestamp;
            weightedPrice = weightedPrice + price * timeFraction;
            cumulativeTime = cumulativeTime + timeFraction;
            previousTimestamp = currentTimestamp;
        }
        return weightedPrice / _interval;
    }

    function getPreviousPrice(address _nftContract, uint256 _numOfRoundBack)
        public
        view
        override
        returns (uint256)
    {
        require(isExistedKey(_nftContract), "key not existed");

        uint256 len = getPriceFeedLength(_nftContract);
        require(len > 0 && _numOfRoundBack < len, "Not enough history");
        return
            nftPriceFeedMap[_nftContract]
                .nftPriceData[len - _numOfRoundBack - 1]
                .price;
    }

    function getPreviousTimestamp(address _nftContract, uint256 _numOfRoundBack)
        public
        view
        override
        returns (uint256)
    {
        require(isExistedKey(_nftContract), "key not existed");

        uint256 len = getPriceFeedLength(_nftContract);
        require(len > 0 && _numOfRoundBack < len, "Not enough history");
        return
            nftPriceFeedMap[_nftContract]
                .nftPriceData[len - _numOfRoundBack - 1]
                .timestamp;
    }

    function getPriceFeedLength(address _nftContract)
        public
        view
        returns (uint256 length)
    {
        return nftPriceFeedMap[_nftContract].nftPriceData.length;
    }

    function getLatestRoundId(address _nftContract)
        internal
        view
        returns (uint256)
    {
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
            require(isExistedKey(_key), "key not existed");
        } else {
            require(!isExistedKey(_key), "key existed");
        }
    }
}