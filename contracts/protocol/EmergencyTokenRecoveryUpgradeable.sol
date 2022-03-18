// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";

import {IPunks} from "../interfaces/IPunks.sol";

/**
 * @title EmergencyTokenRecovery
 * @notice Add Emergency Recovery Logic to contract implementation
 * @author Bend
 **/
abstract contract EmergencyTokenRecoveryUpgradeable is OwnableUpgradeable {
  event EmergencyEtherTransfer(address indexed to, uint256 amount);

  function __EmergencyTokenRecovery_init() internal onlyInitializing {
    __Ownable_init();
  }

  /**
   * @dev transfer ERC20 from the utility contract, for ERC20 recovery in case of stuck tokens due
   * direct transfers to the contract address.
   * @param token token to transfer
   * @param to recipient of the transfer
   * @param amount amount to send
   */
  function emergencyERC20Transfer(
    address token,
    address to,
    uint256 amount
  ) external onlyOwner {
    IERC20Upgradeable(token).transfer(to, amount);
  }

  /**
   * @dev transfer ERC721 from the utility contract, for ERC721 recovery in case of stuck tokens due
   * direct transfers to the contract address.
   * @param token token to transfer
   * @param to recipient of the transfer
   * @param id token id to send
   */
  function emergencyERC721Transfer(
    address token,
    address to,
    uint256 id
  ) external onlyOwner {
    IERC721Upgradeable(token).safeTransferFrom(address(this), to, id);
  }

  /**
   * @dev transfer CryptoPunks from the utility contract, for punks recovery in case of stuck punks
   * due direct transfers to the contract address.
   * @param to recipient of the transfer
   * @param index punk index to send
   */
  function emergencyPunksTransfer(
    address punks,
    address to,
    uint256 index
  ) external onlyOwner {
    IPunks(punks).transferPunk(to, index);
  }

  /**
   * @dev transfer native Ether from the utility contract, for native Ether recovery in case of stuck Ether
   * due selfdestructs or transfer ether to pre-computated contract address before deployment.
   * @param to recipient of the transfer
   * @param amount amount to send
   */
  function emergencyEtherTransfer(address to, uint256 amount) external onlyOwner {
    (bool success, ) = to.call{value: amount}(new bytes(0));
    require(success, "ETH_TRANSFER_FAILED");
    emit EmergencyEtherTransfer(to, amount);
  }

  uint256[50] private __gap;
}
