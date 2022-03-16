// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {IIncentivesController} from "../interfaces/IIncentivesController.sol";
import {ILendPoolAddressesProvider} from "../interfaces/ILendPoolAddressesProvider.sol";

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {IERC20MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";

/**
 * @title IncentivizedERC20
 * @notice Add Incentivized Logic to ERC20 implementation
 * @author Bend
 **/
abstract contract IncentivizedERC20 is Initializable, IERC20MetadataUpgradeable, ERC20Upgradeable {
  uint8 private _customDecimals;

  function __IncentivizedERC20_init(
    string memory name_,
    string memory symbol_,
    uint8 decimals_
  ) internal initializer {
    __ERC20_init(name_, symbol_);

    _customDecimals = decimals_;
  }

  /**
   * @dev Returns the decimals of the token.
   */
  function decimals() public view virtual override(ERC20Upgradeable, IERC20MetadataUpgradeable) returns (uint8) {
    return _customDecimals;
  }

  /**
   * @return Abstract function implemented by the child bToken/debtToken.
   * Done this way in order to not break compatibility with previous versions of bTokens/debtTokens
   **/
  function _getIncentivesController() internal view virtual returns (IIncentivesController);

  function _getUnderlyingAssetAddress() internal view virtual returns (address);

  function _transfer(
    address sender,
    address recipient,
    uint256 amount
  ) internal virtual override {
    uint256 oldSenderBalance = super.balanceOf(sender);
    uint256 oldRecipientBalance = super.balanceOf(recipient);

    super._transfer(sender, recipient, amount);

    if (address(_getIncentivesController()) != address(0)) {
      uint256 currentTotalSupply = super.totalSupply();
      _getIncentivesController().handleAction(sender, currentTotalSupply, oldSenderBalance);
      if (sender != recipient) {
        _getIncentivesController().handleAction(recipient, currentTotalSupply, oldRecipientBalance);
      }
    }
  }

  function _mint(address account, uint256 amount) internal virtual override {
    uint256 oldTotalSupply = super.totalSupply();
    uint256 oldAccountBalance = super.balanceOf(account);

    super._mint(account, amount);

    if (address(_getIncentivesController()) != address(0)) {
      _getIncentivesController().handleAction(account, oldTotalSupply, oldAccountBalance);
    }
  }

  function _burn(address account, uint256 amount) internal virtual override {
    uint256 oldTotalSupply = super.totalSupply();
    uint256 oldAccountBalance = super.balanceOf(account);

    super._burn(account, amount);

    if (address(_getIncentivesController()) != address(0)) {
      _getIncentivesController().handleAction(account, oldTotalSupply, oldAccountBalance);
    }
  }

  uint256[45] private __gap;
}
