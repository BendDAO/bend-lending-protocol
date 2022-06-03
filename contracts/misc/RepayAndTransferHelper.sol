// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "../interfaces/ILendPoolAddressesProvider.sol";
import "../interfaces/ILendPool.sol";
import "../interfaces/ILendPoolLoan.sol";
import "../interfaces/IWETHGateway.sol";

contract RepayAndTransferHelper is ReentrancyGuard, Ownable {
  bytes32 public constant ADDRESS_ID_WETH_GATEWAY = 0xADDE000000000000000000000000000000000000000000000000000000000001;

  ILendPoolAddressesProvider public addressProvider;

  constructor(address addressProvider_) {
    addressProvider = ILendPoolAddressesProvider(addressProvider_);
  }

  function repayETHAndTransferERC721(
    address nftAsset,
    uint256 nftTokenId,
    address target
  ) public payable nonReentrant {
    require(target != address(0), "zero target address");

    ILendPoolLoan poolLoan = ILendPoolLoan(addressProvider.getLendPoolLoan());
    IWETHGateway wethGateway = IWETHGateway(addressProvider.getAddress(ADDRESS_ID_WETH_GATEWAY));

    uint256 loanId = poolLoan.getCollateralLoanId(nftAsset, nftTokenId);
    require(loanId != 0, "loan not exist");

    address borrower = poolLoan.borrowerOf(loanId);

    (, uint256 totalDebt) = poolLoan.getLoanReserveBorrowAmount(loanId);
    require(msg.value >= totalDebt, "insufficient eth balance");

    (uint256 repayAmount, ) = wethGateway.repayETH{value: totalDebt}(nftAsset, nftTokenId, totalDebt);

    // refund remaining dust eth
    if (msg.value > repayAmount) {
      _safeTransferETH(msg.sender, msg.value - repayAmount);
    }

    IERC721(nftAsset).safeTransferFrom(borrower, target, nftTokenId);

    require(IERC721(nftAsset).ownerOf(nftTokenId) == target, "owner is not target");
  }

  function emergencyEtherTransfer(address to, uint256 amount) external onlyOwner {
    _safeTransferETH(to, amount);
  }

  function _safeTransferETH(address to, uint256 value) internal {
    (bool success, ) = to.call{value: value}(new bytes(0));
    require(success, "ETH_TRANSFER_FAILED");
  }

  function getNftDebtData(address nftAsset, uint256 nftTokenId) public view returns (address, uint256) {
    ILendPoolLoan poolLoan = ILendPoolLoan(addressProvider.getLendPoolLoan());
    uint256 loanId = poolLoan.getCollateralLoanId(nftAsset, nftTokenId);

    address borrower = poolLoan.borrowerOf(loanId);
    (, uint256 totalDebt) = poolLoan.getLoanReserveBorrowAmount(loanId);

    return (borrower, totalDebt);
  }
}
