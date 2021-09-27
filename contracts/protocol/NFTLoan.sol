// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "../interfaces/INFTLoan.sol";
import "../interfaces/ILendPool.sol";
import "../libraries/helpers/Errors.sol";
import { WadRayMath } from "../libraries/math/WadRayMath.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract NFTLoan is INFTLoan, ERC721 {
  using WadRayMath for uint256;

  address nftToken;
  ILendPool _pool;

  struct Loan {
    uint256 tokenId;
    address wToken;
    uint256 amount;
    uint64 loanStartTime;
  }

  mapping(uint256 => Loan) public loans;

  /**
   * @dev Only lending pool can call functions marked by this modifier
   **/
  modifier onlyLendingPool() {
    require(
      _msgSender() == address(_getLendPool()),
      Errors.CT_CALLER_MUST_BE_LENDING_POOL
    );
    _;
  }

  constructor() ERC721("NFTDebtToken", "NFTD") {}

  // called once by the factory at time of deployment
  function initialize(address _nft, address _lendPool) external {
    nftToken = _nft;
    _pool = ILendPool(_lendPool);
  }

  /**
   * @dev Mints debt token to the `onBehalfOf` address
   * -  Only callable by the LendingPool
   * @param user The address receiving the borrowed underlying, being the delegatee in case
   * of credit delegate, or same as `onBehalfOf` otherwise
   * @param onBehalfOf The address receiving the debt tokens
   * @param amount The amount of debt being minted
   * @param index The variable debt index of the reserve
   **/
  function mint(
    address user,
    address onBehalfOf,
    uint256 tokenId,
    address wToken,
    uint256 amount,
    uint256 index
  ) external onlyLendingPool {
    uint256 amountScaled = amount.rayDiv(index);

    if (_exists(tokenId)) {
      Loan memory loan = loans[tokenId];
      require(loan.wToken == wToken, "NFTLoan: NONEXIST_ORDER");
      loan.amount += amountScaled;
    } else {
      // Receive Collateral Tokens
      IERC721(nftToken).transferFrom(msg.sender, address(this), tokenId);

      // Save Info
      loans[tokenId] = Loan({
        tokenId: tokenId,
        wToken: wToken,
        amount: amount,
        loanStartTime: uint64(block.timestamp)
      });

      _mint(onBehalfOf, tokenId);
    }

    emit MintLoan(user, onBehalfOf, tokenId, wToken, amount, index);
  }

  /**
   * @dev Burns user variable debt
   * - Only callable by the LendingPool
   * @param user The user whose debt is getting burned
   * @param amount The amount getting burned
   * @param index The variable debt index of the reserve
   **/
  function burn(
    address user,
    uint256 tokenId,
    uint256 amount,
    uint256 index
  ) external onlyLendingPool {
    require(_exists(tokenId), "NFTLoan: NONEXIST_ORDER");
    require(ownerOf(tokenId) == msg.sender, "NFTLoan: NOT_OWNER");

    Loan memory loan = loans[tokenId];

    uint256 amountScaled = 0;
    if (amount == type(uint256).max) {
      amountScaled = loan.amount;
    } else {
      amountScaled = amount.rayDiv(index);
      require(amountScaled != 0, "NFTLoan: invalid burn amount");
    }

    require(loan.amount >= amountScaled, "NFTLoan: burn amount exceeds");
    loan.amount -= amountScaled;
    if (loan.amount <= 0) {
      IERC721(nftToken).transferFrom(address(this), msg.sender, tokenId);

      _burn(tokenId);

      delete loans[tokenId];
    }

    emit BurnLoan(user, tokenId, amount, index);
  }

  function _getLendPool() internal view returns (ILendPool) {
    return _pool;
  }
}
