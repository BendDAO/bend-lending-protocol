// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {ILendPool} from "../interfaces/ILendPool.sol";
import {IWToken} from "../interfaces/IWToken.sol";
import {IIncentivesController} from "../interfaces/IIncentivesController.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {WadRayMath} from "../libraries/math/WadRayMath.sol";
import {Errors} from "../libraries/helpers/Errors.sol";

/**
 * @title NFTLend ERC20 WToken
 * @dev Implementation of the interest bearing token for the NFTLend protocol
 * @author NFTLend
 */
contract WToken is IWToken, ERC20 {
    using WadRayMath for uint256;
    using SafeERC20 for IERC20;

    uint8 private _decimals;

    ILendPool internal _pool;
    address internal _treasury;
    address internal _underlyingAsset;
    IIncentivesController internal _incentivesController;

    modifier onlyLendPool() {
        require(
            _msgSender() == address(_pool),
            Errors.CT_CALLER_MUST_BE_LENDING_POOL
        );
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) ERC20(name_, symbol_) {
        _decimals = decimals_;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @dev Initializes the aToken
     * @param pool The address of the lending pool where this aToken will be used
     * @param treasury The address of the Aave treasury, receiving the fees on this aToken
     * @param underlyingAsset The address of the underlying asset of this aToken (E.g. WETH for aWETH)
     * @param incentivesController The smart contract managing potential incentives distribution
     */
    function initialize(
        ILendPool pool,
        address treasury,
        address underlyingAsset,
        IIncentivesController incentivesController,
        bytes calldata params
    ) external {
        uint256 chainId;

        //solium-disable-next-line
        assembly {
            chainId := chainid()
        }

        _pool = pool;
        _treasury = treasury;
        _underlyingAsset = underlyingAsset;
        _incentivesController = incentivesController;
    }

    /**
     * @dev Burns aTokens from `user` and sends the equivalent amount of underlying to `receiverOfUnderlying`
     * - Only callable by the LendingPool, as extra state updates there need to be managed
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
    ) external override onlyLendPool {
        uint256 oldTotalSupply = super.totalSupply();
        uint256 oldAccountBalance = super.balanceOf(user);

        uint256 amountScaled = amount.rayDiv(index);
        require(amountScaled != 0, Errors.CT_INVALID_BURN_AMOUNT);
        _burn(user, amountScaled);

        if (address(_getIncentivesController()) != address(0)) {
            _getIncentivesController().handleAction(
                user,
                oldTotalSupply,
                oldAccountBalance
            );
        }

        IERC20(_underlyingAsset).safeTransfer(receiverOfUnderlying, amount);

        emit Transfer(user, address(0), amount);
        emit Burn(user, receiverOfUnderlying, amount, index);
    }

    /**
     * @dev Mints `amount` aTokens to `user`
     * - Only callable by the LendingPool, as extra state updates there need to be managed
     * @param user The address receiving the minted tokens
     * @param amount The amount of tokens getting minted
     * @param index The new liquidity index of the reserve
     * @return `true` if the the previous balance of the user was 0
     */
    function mint(
        address user,
        uint256 amount,
        uint256 index
    ) external override onlyLendPool returns (bool) {
        uint256 previousTotal = super.totalSupply();
        uint256 previousBalance = super.balanceOf(user);

        uint256 amountScaled = amount.rayDiv(index);
        require(amountScaled != 0, Errors.CT_INVALID_MINT_AMOUNT);
        _mint(user, amountScaled);

        if (address(_getIncentivesController()) != address(0)) {
            _getIncentivesController().handleAction(
                user,
                previousTotal,
                previousBalance
            );
        }

        emit Transfer(address(0), user, amount);
        emit Mint(user, amount, index);

        return previousBalance == 0;
    }

    /**
     * @dev Mints aTokens to the reserve treasury
     * - Only callable by the LendingPool
     * @param amount The amount of tokens getting minted
     * @param index The new liquidity index of the reserve
     */
    function mintToTreasury(uint256 amount, uint256 index)
        external
        override
        onlyLendPool
    {
        if (amount == 0) {
            return;
        }

        address treasury = _treasury;

        // Compared to the normal mint, we don't check for rounding errors.
        // The amount to mint can easily be very small since it is a fraction of the interest ccrued.
        // In that case, the treasury will experience a (very small) loss, but it
        // wont cause potentially valid transactions to fail.
        _mint(treasury, amount.rayDiv(index));

        emit Transfer(address(0), treasury, amount);
        emit Mint(treasury, amount, index);
    }

    /**
     * @dev Calculates the balance of the user: principal balance + interest generated by the principal
     * @param user The user whose balance is calculated
     * @return The balance of the user
     **/
    function balanceOf(address user)
        public
        view
        override(IERC20, ERC20)
        returns (uint256)
    {
        return
            super.balanceOf(user).rayMul(
                _pool.getReserveNormalizedIncome(_underlyingAsset)
            );
    }

    /**
     * @dev Returns the scaled balance of the user. The scaled balance is the sum of all the
     * updated stored balance divided by the reserve's liquidity index at the moment of the update
     * @param user The user whose balance is calculated
     * @return The scaled balance of the user
     **/
    function scaledBalanceOf(address user) external view returns (uint256) {
        return super.balanceOf(user);
    }

    /**
     * @dev Returns the scaled balance of the user and the scaled total supply.
     * @param user The address of the user
     * @return The scaled balance of the user
     * @return The scaled balance and the scaled total supply
     **/
    function getScaledUserBalanceAndSupply(address user)
        external
        view
        returns (uint256, uint256)
    {
        return (super.balanceOf(user), super.totalSupply());
    }

    /**
     * @dev calculates the total supply of the specific aToken
     * since the balance of every single user increases over time, the total supply
     * does that too.
     * @return the current total supply
     **/
    function totalSupply()
        public
        view
        override(IERC20, ERC20)
        returns (uint256)
    {
        uint256 currentSupplyScaled = super.totalSupply();

        if (currentSupplyScaled == 0) {
            return 0;
        }

        return
            currentSupplyScaled.rayMul(
                _pool.getReserveNormalizedIncome(_underlyingAsset)
            );
    }

    /**
     * @dev Returns the scaled total supply of the variable debt token. Represents sum(debt/index)
     * @return the scaled total supply
     **/
    function scaledTotalSupply() public view virtual returns (uint256) {
        return super.totalSupply();
    }

    /**
     * @dev Returns the address of the Aave treasury, receiving the fees on this aToken
     **/
    function RESERVE_TREASURY_ADDRESS() public view returns (address) {
        return _treasury;
    }

    /**
     * @dev Returns the address of the underlying asset of this aToken (E.g. WETH for aWETH)
     **/
    function UNDERLYING_ASSET_ADDRESS() public view override returns (address) {
        return _underlyingAsset;
    }

    /**
     * @dev Returns the address of the lending pool where this aToken is used
     **/
    function POOL() public view returns (ILendPool) {
        return _pool;
    }

    /**
     * @dev For internal usage in the logic of the parent contract IncentivizedERC20
     **/
    function _getIncentivesController()
        internal
        view
        returns (IIncentivesController)
    {
        return _incentivesController;
    }

    /**
     * @dev Returns the address of the incentives controller contract
     **/
    function getIncentivesController()
        external
        view
        override
        returns (IIncentivesController)
    {
        return _getIncentivesController();
    }

    /**
     * @dev Transfers the underlying asset to `target`. Used by the LendingPool to transfer
     * assets in borrow(), withdraw() and flashLoan()
     * @param target The recipient of the aTokens
     * @param amount The amount getting transferred
     * @return The amount transferred
     **/
    function transferUnderlyingTo(address target, uint256 amount)
        external
        override
        onlyLendPool
        returns (uint256)
    {
        IERC20(_underlyingAsset).safeTransfer(target, amount);
        return amount;
    }

    /**
     * @dev Invoked to execute actions on the aToken side after a repayment.
     * @param user The user executing the repayment
     * @param amount The amount getting repaid
     **/
    function handleRepayment(address user, uint256 amount)
        external
        override
        onlyLendPool
    {}

    /**
     * @dev Transfers the aTokens between two users. Validates the transfer
     * (ie checks for valid HF after the transfer) if required
     * @param from The source address
     * @param to The destination address
     * @param amount The amount getting transferred
     * @param validate `true` if the transfer needs to be validated
     **/
    function _transfer(
        address from,
        address to,
        uint256 amount,
        bool validate
    ) internal {
        address underlyingAsset = _underlyingAsset;
        ILendPool pool = _pool;

        uint256 index = pool.getReserveNormalizedIncome(underlyingAsset);

        uint256 fromBalanceBefore = super.balanceOf(from).rayMul(index);
        uint256 toBalanceBefore = super.balanceOf(to).rayMul(index);

        super._transfer(from, to, amount.rayDiv(index));

        if (address(_getIncentivesController()) != address(0)) {
            uint256 currentTotalSupply = super.totalSupply();
            _getIncentivesController().handleAction(
                from,
                currentTotalSupply,
                fromBalanceBefore
            );
            if (from != to) {
                _getIncentivesController().handleAction(
                    to,
                    currentTotalSupply,
                    toBalanceBefore
                );
            }
        }

        if (validate) {
            pool.finalizeTransfer(
                underlyingAsset,
                from,
                to,
                amount,
                fromBalanceBefore,
                toBalanceBefore
            );
        }

        emit BalanceTransfer(from, to, amount, index);
    }

    /**
     * @dev Overrides the parent _transfer to force validated transfer() and transferFrom()
     * @param from The source address
     * @param to The destination address
     * @param amount The amount getting transferred
     **/
    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        _transfer(from, to, amount, true);
    }
}
