// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "../libraries/types/DataTypes.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface INFTLoan is IERC721 {
    /**
     * @dev Emitted on mintLoan()
     * @param user The address initiating the deposit
     * @param amount The amount minted
     **/
    event MintLoan(
        address indexed user,
        address nftTokenAddress,
        uint256 nftTokenId,
        address assetAddress,
        uint256 amount,
        uint256 borrowIndex
    );

    /**
     * @dev Emitted on burnLoan()
     * @param user The address initiating the burn
     * @param amount The amount burned
     **/
    event BurnLoan(
        address indexed user,
        uint256 indexed loanId,
        address nftTokenAddress,
        uint256 nftTokenId,
        address assetAddress,
        uint256 amount
    );

    /**
     * @dev Emitted on updateLoan()
     * @param user The address initiating the burn
     * @param amountAdded The amount added
     **/
    event UpdateLoan(
        address indexed user,
        uint256 indexed loanId,
        address assetAddress,
        uint256 amountAdded,
        uint256 amountTaken,
        uint256 borrowIndex
    );

    function mintLoan(
        address user,
        address nftTokenAddress,
        uint256 nftTokenId,
        address assetAddress,
        uint256 amount,
        uint256 borrowIndex
    ) external returns (uint256, uint256);

    function burnLoan(
        address user,
        uint256 loanId,
        uint256 borrowIndex
    ) external returns (uint256);

    function updateLoan(
        address user,
        uint256 loanId,
        uint256 amountAdded,
        uint256 amountTaken,
        uint256 borrowIndex
    ) external returns (uint256);

    function getLoan(uint256 loanId)
        external
        view
        returns (DataTypes.LoanData calldata loanData);

    function getLoanReserve(uint256 loanId) external view returns (address);

    function getLoanScaledAmount(uint256 loanId)
        external
        view
        returns (uint256);

    function getLoanAmount(uint256 loanId) external view returns (uint256);

    function getLoanCollateral(uint256 loanId)
        external
        view
        returns (address, uint256);
}
