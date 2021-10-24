// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IBendOracleGetter} from "../interfaces/IBendOracleGetter.sol";

contract BendOracle is IBendOracleGetter, Initializable, OwnableUpgradeable {
    event SetAssetOracle(address asset, address oracle);

    mapping(address => address) public assetOracleContract;

    function initialize() public initializer {
        __Ownable_init();
    }

    function setOracleContract(address _asset, address _oracle)
        external
        onlyOwner
    {
        require(_asset != address(0), "asset not existed");
        require(_oracle != address(0), "oracle not existed");
        assetOracleContract[_asset] = _oracle;
        emit SetAssetOracle(_asset, _oracle);
    }

    function getAssetPrice(address _asset)
        external
        view
        override
        returns (uint256)
    {
        address oracle = assetOracleContract[_asset];
        require(oracle != address(0), "asset not existed");
        uint256 price = IBendOracleGetter(oracle).getAssetPrice(_asset);
        return price;
    }
}
