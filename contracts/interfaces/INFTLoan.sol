// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

interface INFTLoan {
  /**
   * @dev Emitted on mint()
   * @param user The address initiating the deposit
   * @param onBehalfOf The beneficiary of the deposit, receiving the aTokens
   * @param amount The amount minted
   **/
  event MintLoan(
    address user,
    address indexed onBehalfOf,
    uint256 tokenId,
    address indexed wToken,
    uint256 amount,
    uint256 index
  );

  /**
   * @dev Emitted on burn()
   * @param user The address initiating the burn
   * @param amount The amount burned
   **/
  event BurnLoan(
    address indexed user,
    uint256 tokenId,
    uint256 amount,
    uint256 index
  );
}
