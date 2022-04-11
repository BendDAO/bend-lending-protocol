// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

contract MaliciousLendPoolLiquidator {
  function auction(
    address, /*nftAsset*/
    uint256, /*nftTokenId*/
    uint256, /*bidPrice*/
    address /*onBehalfOf*/
  ) external {
    selfdestruct(payable(address(this)));
  }
}

contract MaliciousLendPoolAddressProvider {
  MaliciousLendPoolLiquidator private immutable LIQUIDATOR = new MaliciousLendPoolLiquidator();

  function getLendPoolLiquidator() external view returns (MaliciousLendPoolLiquidator) {
    return LIQUIDATOR;
  }
}
