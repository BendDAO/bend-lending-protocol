// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/************
@title IReserveOracle interface
@notice Interface for Reserve price oracle.*/
interface IReserveOracle {
    // get latest price
    function getAssetPrice(bytes32 _priceFeedKey)
        external
        view
        returns (uint256);

    // get twap price depending on _period
    function getTwapPrice(bytes32 _priceFeedKey, uint256 _interval)
        external
        view
        returns (uint256);
}
