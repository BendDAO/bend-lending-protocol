// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title ERC20Mintable
 * @dev ERC20 minting logic
 */
contract MintableERC20 is ERC20, Ownable {
  uint8 private _decimals;
  mapping(address => uint256) public mintValues;
  address public faucet;

  constructor(
    string memory name,
    string memory symbol,
    uint8 decimals_
  ) ERC20(name, symbol) {
    _setupDecimals(decimals_);
  }

  function _setupDecimals(uint8 decimals_) internal {
    _decimals = decimals_;
  }

  function decimals() public view virtual override returns (uint8) {
    return _decimals;
  }

  /**
   * @dev Function to mint tokens
   * @param value The amount of tokens to mint.
   * @return A boolean that indicates if the operation was successful.
   */
  function mint(uint256 value) public returns (bool) {
    if (faucet == address(0)) {
      require((mintValues[_msgSender()] + value) <= (1000000 * (10**_decimals)), "MintableERC20: exceed mint limit");
    } else {
      require(faucet == _msgSender(), "MintableERC20: minting not allowed");
    }

    mintValues[_msgSender()] += value;

    _mint(_msgSender(), value);
    return true;
  }

  function setFaucet(address faucet_) public onlyOwner {
    faucet = faucet_;
  }
}
