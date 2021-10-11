// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {ILendPool} from "./ILendPool.sol";
import {IIncentivesController} from "./IIncentivesController.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IWToken is IERC20 {
    /**
     * @dev Emitted when an wToken is initialized
     * @param underlyingAsset The address of the underlying asset
     * @param pool The address of the associated lending pool
     * @param treasury The address of the treasury
     * @param incentivesController The address of the incentives controller for this wToken
     * @param params A set of encoded parameters for additional initialization
     **/
    event Initialized(
        address indexed underlyingAsset,
        address indexed pool,
        address treasury,
        address incentivesController,
        bytes params
    );

    /**
     * @dev Initializes the wToken
     * @param pool The address of the lending pool where this wToken will be used
     * @param treasury The address of the Aave treasury, receiving the fees on this wToken
     * @param underlyingAsset The address of the underlying asset of this wToken (E.g. WETH for wWETH)
     * @param incentivesController The smart contract managing potential incentives distribution
     */
    function initialize(
        ILendPool pool,
        address treasury,
        address underlyingAsset,
        IIncentivesController incentivesController,
        bytes calldata params
    ) external;

    /**
     * @dev Emitted after the mint action
     * @param from The address performing the mint
     * @param value The amount being
     * @param index The new liquidity index of the reserve
     **/
    event Mint(address indexed from, uint256 value, uint256 index);

    /**
     * @dev Mints `amount` aTokens to `user`
     * @param user The address receiving the minted tokens
     * @param amount The amount of tokens getting minted
     * @param index The new liquidity index of the reserve
     * @return `true` if the the previous balance of the user was 0
     */
    function mint(
        address user,
        uint256 amount,
        uint256 index
    ) external returns (bool);

    /**
     * @dev Emitted after aTokens are burned
     * @param from The owner of the aTokens, getting them burned
     * @param target The address that will receive the underlying
     * @param value The amount being burned
     * @param index The new liquidity index of the reserve
     **/
    event Burn(
        address indexed from,
        address indexed target,
        uint256 value,
        uint256 index
    );

    /**
     * @dev Emitted during the transfer action
     * @param from The user whose tokens are being transferred
     * @param to The recipient
     * @param value The amount being transferred
     * @param index The new liquidity index of the reserve
     **/
    event BalanceTransfer(
        address indexed from,
        address indexed to,
        uint256 value,
        uint256 index
    );

    /**
     * @dev Burns aTokens from `user` and sends the equivalent amount of underlying to `receiverOfUnderlying`
     * @param user The owner of the aTokens, getting them burned
     * @param receiverOfUnderlying The address that will receive the underlying
     * @param amount The amount being burned
     * @param index The new liquidity index of the reserve
     **/
    function burn(
        address user,
        address receiverOfUnderlying,
        uint256 amount,
        uint256 index
    ) external;

    /**
     * @dev Mints aTokens to the reserve treasury
     * @param amount The amount of tokens getting minted
     * @param index The new liquidity index of the reserve
     */
    function mintToTreasury(uint256 amount, uint256 index) external;

    /**
     * @dev Transfers the underlying asset to `target`. Used by the LendingPool to transfer
     * assets in borrow(), withdraw() and flashLoan()
     * @param user The recipient of the underlying
     * @param amount The amount getting transferred
     * @return The amount transferred
     **/
    function transferUnderlyingTo(address user, uint256 amount)
        external
        returns (uint256);

    /**
     * @dev Invoked to execute actions on the aToken side after a repayment.
     * @param user The user executing the repayment
     * @param amount The amount getting repaid
     **/
    function handleRepayment(address user, uint256 amount) external;

    /**
     * @dev Returns the address of the incentives controller contract
     **/
    function getIncentivesController()
        external
        view
        returns (IIncentivesController);

    /**
     * @dev Returns the address of the underlying asset of this aToken (E.g. WETH for aWETH)
     **/
    function UNDERLYING_ASSET_ADDRESS() external view returns (address);
}
