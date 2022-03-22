// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {IDebtToken} from "../interfaces/IDebtToken.sol";
import {ILendPool} from "../interfaces/ILendPool.sol";
import {ILendPoolAddressesProvider} from "../interfaces/ILendPoolAddressesProvider.sol";
import {ILendPoolConfigurator} from "../interfaces/ILendPoolConfigurator.sol";
import {IIncentivesController} from "../interfaces/IIncentivesController.sol";
import {IncentivizedERC20} from "./IncentivizedERC20.sol";
import {WadRayMath} from "../libraries/math/WadRayMath.sol";
import {Errors} from "../libraries/helpers/Errors.sol";

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title DebtToken
 * @notice Implements a debt token to track the borrowing positions of users
 * @author Bend
 **/
contract DebtToken is Initializable, IDebtToken, IncentivizedERC20 {
  using WadRayMath for uint256;

  ILendPoolAddressesProvider internal _addressProvider;
  address internal _underlyingAsset;

  mapping(address => mapping(address => uint256)) internal _borrowAllowances;

  modifier onlyLendPool() {
    require(_msgSender() == address(_getLendPool()), Errors.CT_CALLER_MUST_BE_LEND_POOL);
    _;
  }

  modifier onlyLendPoolConfigurator() {
    require(_msgSender() == address(_getLendPoolConfigurator()), Errors.LP_CALLER_NOT_LEND_POOL_CONFIGURATOR);
    _;
  }

  event BorrowAllowanceDelegated(address indexed fromUser, address indexed toUser, address asset, uint256 amount);

  /**
   * @dev Initializes the debt token.
   * @param addressProvider The address of the lend pool
   * @param underlyingAsset The address of the underlying asset
   * @param debtTokenDecimals The decimals of the debtToken, same as the underlying asset's
   * @param debtTokenName The name of the token
   * @param debtTokenSymbol The symbol of the token
   */
  function initialize(
    ILendPoolAddressesProvider addressProvider,
    address underlyingAsset,
    uint8 debtTokenDecimals,
    string memory debtTokenName,
    string memory debtTokenSymbol
  ) public override initializer {
    __IncentivizedERC20_init(debtTokenName, debtTokenSymbol, debtTokenDecimals);

    _underlyingAsset = underlyingAsset;

    _addressProvider = addressProvider;

    emit Initialized(
      underlyingAsset,
      address(_getLendPool()),
      address(_getIncentivesController()),
      debtTokenDecimals,
      debtTokenName,
      debtTokenSymbol
    );
  }

  /**
   * @dev Mints debt token to the `user` address
   * -  Only callable by the LendPool
   * @param initiator The address calling borrow
   * @param amount The amount of debt being minted
   * @param index The variable debt index of the reserve
   * @return `true` if the the previous balance of the user is 0
   **/
  function mint(
    address initiator,
    address onBehalfOf,
    uint256 amount,
    uint256 index
  ) external override onlyLendPool returns (bool) {
    if (initiator != onBehalfOf) {
      _decreaseBorrowAllowance(onBehalfOf, initiator, amount);
    }

    uint256 previousBalance = super.balanceOf(onBehalfOf);
    // index is expressed in Ray, so:
    // amount.wadToRay().rayDiv(index).rayToWad() => amount.rayDiv(index)
    uint256 amountScaled = amount.rayDiv(index);
    require(amountScaled != 0, Errors.CT_INVALID_MINT_AMOUNT);

    _mint(onBehalfOf, amountScaled);

    emit Transfer(address(0), onBehalfOf, amount);
    emit Mint(onBehalfOf, amount, index);

    return previousBalance == 0;
  }

  /**
   * @dev Burns user variable debt
   * - Only callable by the LendPool
   * @param user The user whose debt is getting burned
   * @param amount The amount getting burned
   * @param index The variable debt index of the reserve
   **/
  function burn(
    address user,
    uint256 amount,
    uint256 index
  ) external override onlyLendPool {
    uint256 amountScaled = amount.rayDiv(index);
    require(amountScaled != 0, Errors.CT_INVALID_BURN_AMOUNT);

    _burn(user, amountScaled);

    emit Transfer(user, address(0), amount);
    emit Burn(user, amount, index);
  }

  /**
   * @dev Calculates the accumulated debt balance of the user
   * @return The debt balance of the user
   **/
  function balanceOf(address user) public view virtual override returns (uint256) {
    uint256 scaledBalance = super.balanceOf(user);

    if (scaledBalance == 0) {
      return 0;
    }

    ILendPool pool = _getLendPool();
    return scaledBalance.rayMul(pool.getReserveNormalizedVariableDebt(_underlyingAsset));
  }

  /**
   * @dev Returns the principal debt balance of the user from
   * @return The debt balance of the user since the last burn/mint action
   **/
  function scaledBalanceOf(address user) public view virtual override returns (uint256) {
    return super.balanceOf(user);
  }

  /**
   * @dev Returns the total supply of the variable debt token. Represents the total debt accrued by the users
   * @return The total supply
   **/
  function totalSupply() public view virtual override returns (uint256) {
    ILendPool pool = _getLendPool();
    return super.totalSupply().rayMul(pool.getReserveNormalizedVariableDebt(_underlyingAsset));
  }

  /**
   * @dev Returns the scaled total supply of the variable debt token. Represents sum(debt/index)
   * @return the scaled total supply
   **/
  function scaledTotalSupply() public view virtual override returns (uint256) {
    return super.totalSupply();
  }

  /**
   * @dev Returns the principal balance of the user and principal total supply.
   * @param user The address of the user
   * @return The principal balance of the user
   * @return The principal total supply
   **/
  function getScaledUserBalanceAndSupply(address user) external view override returns (uint256, uint256) {
    return (super.balanceOf(user), super.totalSupply());
  }

  /**
   * @dev Returns the address of the underlying asset of this bToken
   **/
  function UNDERLYING_ASSET_ADDRESS() public view returns (address) {
    return _underlyingAsset;
  }

  /**
   * @dev Returns the address of the incentives controller contract
   **/
  function getIncentivesController() external view override returns (IIncentivesController) {
    return _getIncentivesController();
  }

  /**
   * @dev Returns the address of the lend pool where this token is used
   **/
  function POOL() public view returns (ILendPool) {
    return _getLendPool();
  }

  function _getIncentivesController() internal view override returns (IIncentivesController) {
    return IIncentivesController(_addressProvider.getIncentivesController());
  }

  function _getUnderlyingAssetAddress() internal view override returns (address) {
    return _underlyingAsset;
  }

  function _getLendPool() internal view returns (ILendPool) {
    return ILendPool(_addressProvider.getLendPool());
  }

  function _getLendPoolConfigurator() internal view returns (ILendPoolConfigurator) {
    return ILendPoolConfigurator(_addressProvider.getLendPoolConfigurator());
  }

  /**
   * @dev Being non transferrable, the debt token does not implement any of the
   * standard ERC20 functions for transfer and allowance.
   **/
  function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
    recipient;
    amount;
    revert("TRANSFER_NOT_SUPPORTED");
  }

  function allowance(address owner, address spender) public view virtual override returns (uint256) {
    owner;
    spender;
    revert("ALLOWANCE_NOT_SUPPORTED");
  }

  function approve(address spender, uint256 amount) public virtual override returns (bool) {
    spender;
    amount;
    revert("APPROVAL_NOT_SUPPORTED");
  }

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) public virtual override returns (bool) {
    sender;
    recipient;
    amount;
    revert("TRANSFER_NOT_SUPPORTED");
  }

  function increaseAllowance(address spender, uint256 addedValue) public virtual override returns (bool) {
    spender;
    addedValue;
    revert("ALLOWANCE_NOT_SUPPORTED");
  }

  function decreaseAllowance(address spender, uint256 subtractedValue) public virtual override returns (bool) {
    spender;
    subtractedValue;
    revert("ALLOWANCE_NOT_SUPPORTED");
  }

  /**
   * @dev delegates borrowing power to a user on the specific debt token
   * @param delegatee the address receiving the delegated borrowing power
   * @param amount the maximum amount being delegated. Delegation will still
   * respect the liquidation constraints (even if delegated, a delegatee cannot
   * force a delegator HF to go below 1)
   **/
  function approveDelegation(address delegatee, uint256 amount) external override {
    _borrowAllowances[_msgSender()][delegatee] = amount;
    emit BorrowAllowanceDelegated(_msgSender(), delegatee, _getUnderlyingAssetAddress(), amount);
  }

  /**
   * @dev returns the borrow allowance of the user
   * @param fromUser The user to giving allowance
   * @param toUser The user to give allowance to
   * @return the current allowance of toUser
   **/
  function borrowAllowance(address fromUser, address toUser) external view override returns (uint256) {
    return _borrowAllowances[fromUser][toUser];
  }

  function _decreaseBorrowAllowance(
    address delegator,
    address delegatee,
    uint256 amount
  ) internal {
    require(_borrowAllowances[delegator][delegatee] >= amount, Errors.CT_BORROW_ALLOWANCE_NOT_ENOUGH);

    uint256 newAllowance = _borrowAllowances[delegator][delegatee] - amount;
    _borrowAllowances[delegator][delegatee] = newAllowance;

    emit BorrowAllowanceDelegated(delegator, delegatee, _getUnderlyingAssetAddress(), newAllowance);
  }
}
