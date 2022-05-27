// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";

import "./interfaces/IAaveFlashLoanReceiver.sol";
import "../interfaces/ILendPool.sol";
import "../interfaces/ILendPoolAddressesProvider.sol";
import "./interfaces/IAaveLendPoolAddressesProvider.sol";
import "../interfaces/IWETH.sol";
import "../libraries/math/PercentageMath.sol";

abstract contract BaseDownpaymentBuyAdapter is
  IAaveFlashLoanReceiver,
  OwnableUpgradeable,
  PausableUpgradeable,
  ReentrancyGuardUpgradeable,
  EIP712Upgradeable,
  ERC721HolderUpgradeable
{
  event FeeCharged(address indexed payer, uint256 fee);

  event FeeUpdated(uint256 indexed newFee);

  using PercentageMath for uint256;
  using CountersUpgradeable for CountersUpgradeable.Counter;

  struct Sig {
    uint8 v;
    bytes32 r;
    bytes32 s;
  }

  struct BaseOrderParam {
    address nftAsset;
    uint256 nftTokenId;
    uint256 salePrice;
  }

  bytes32 internal constant _SIGNATURE_TYPEHASH = keccak256("Sig(uint8 v,bytes32 r,bytes32 s)");

  IAaveLendPoolAddressesProvider public aaveAddressedProvider;
  ILendPoolAddressesProvider public bendAddressesProvider;
  IWETH public WETH;
  address public bendCollector;
  uint256 public bendFeeRatio;
  mapping(address => CountersUpgradeable.Counter) internal _nonces;

  uint256[44] private __gap;

  modifier onlyAaveLendPool() {
    require(msg.sender == aaveAddressedProvider.getLendingPool(), "Caller must be aave lending pool");
    _;
  }

  function __BaseDownpaymentBuyAdapter_init(
    string memory _name,
    string memory _version,
    address _aaveAddressesProvider,
    address _bendAddressesProvider,
    address _weth,
    address _bendCollector,
    uint256 _fee
  ) internal onlyInitializing {
    __Ownable_init();
    __Pausable_init();
    __ReentrancyGuard_init();
    __EIP712_init_unchained(_name, _version);

    aaveAddressedProvider = IAaveLendPoolAddressesProvider(_aaveAddressesProvider);
    bendAddressesProvider = ILendPoolAddressesProvider(_bendAddressesProvider);
    WETH = IWETH(_weth);
    bendCollector = _bendCollector;
    bendFeeRatio = _fee;

    WETH.approve(bendAddressesProvider.getLendPool(), type(uint256).max);
  }

  function executeOperation(
    address[] calldata _assets,
    uint256[] calldata _amounts,
    uint256[] calldata _premiums,
    address _initiator,
    bytes calldata _params
  ) external override nonReentrant whenNotPaused onlyAaveLendPool returns (bool) {
    require(_assets.length == 1 && _amounts.length == 1 && _premiums.length == 1, "Multiple assets not supported");
    require(_assets[0] == address(WETH), "Only WETH borrowing allowed");

    address _buyer = _initiator;

    BaseOrderParam memory baseOrderParam = _checkParams(_amounts[0], _premiums[0], _buyer, _params, _useNonce(_buyer));

    uint256 _flashBorrowedAmount = _amounts[0];
    uint256 _flashFee = _premiums[0];
    uint256 _flashLoanDebt = _flashBorrowedAmount + _flashFee;
    uint256 _bendFeeAmount = baseOrderParam.salePrice.percentMul(bendFeeRatio);
    uint256 _buyerPayment = _bendFeeAmount + _flashFee + baseOrderParam.salePrice - _flashBorrowedAmount;

    // Prepare ETH, need buyer approve WETH to this contract
    require(WETH.transferFrom(_buyer, address(this), _buyerPayment), "WETH transfer failed");
    WETH.withdraw(baseOrderParam.salePrice);

    // Do opensea exchange
    _exchange(_params, baseOrderParam.salePrice);

    _beforeBorrowWETH(baseOrderParam.nftAsset, baseOrderParam.nftTokenId, _buyer, _flashBorrowedAmount);

    // Borrow WETH from bend, need buyer approve NFT to this contract
    _borrowWETH(baseOrderParam.nftAsset, baseOrderParam.nftTokenId, _buyer, _flashBorrowedAmount);

    _afterBorrowWETH(baseOrderParam.nftAsset, baseOrderParam.nftTokenId, _buyer, _flashBorrowedAmount);

    // Charge fee, sent to bend collector
    _chargeFee(_buyer, _bendFeeAmount);

    // Repay flash loan
    _repayFlashLoan(_flashLoanDebt);
    return true;
  }

  function nonces(address owner) public view returns (uint256) {
    return _nonces[owner].current();
  }

  function _useNonce(address owner) internal returns (uint256 current) {
    CountersUpgradeable.Counter storage nonce = _nonces[owner];
    current = nonce.current();
    nonce.increment();
  }

  function pause() external onlyOwner whenNotPaused {
    _pause();
  }

  function unpause() external onlyOwner whenPaused {
    _unpause();
  }

  function updateFee(uint256 _newFee) external onlyOwner {
    require(_newFee <= PercentageMath.PERCENTAGE_FACTOR, "Fee overflow");
    bendFeeRatio = _newFee;
    emit FeeUpdated(bendFeeRatio);
  }

  function _chargeFee(address _payer, uint256 _amount) internal {
    if (_amount > 0) {
      _getBendLendPool().deposit(address(WETH), _amount, bendCollector, 0);
      emit FeeCharged(_payer, _amount);
    }
  }

  struct CheckBaseParamsLocalVars {
    uint256 bendFeeAmount;
    uint256 buyerBalance;
    uint256 buyerPayment;
    uint256 buyerAllowance;
  }

  function _checkParams(
    uint256 _flashBorrowedAmount,
    uint256 _flashFee,
    address _buyer,
    bytes calldata _params,
    uint256 _nonce
  ) internal view returns (BaseOrderParam memory) {
    CheckBaseParamsLocalVars memory vars;
    BaseOrderParam memory baseParam = _checkOrderParams(_buyer, _params, _nonce);

    require(_flashBorrowedAmount <= WETH.balanceOf(address(this)), "Insufficient flash loan");

    // Check if the flash loan can be paid off and payment sufficient
    vars.bendFeeAmount = baseParam.salePrice.percentMul(bendFeeRatio);
    vars.buyerBalance = WETH.balanceOf(_buyer);

    vars.buyerPayment = vars.bendFeeAmount + _flashFee + baseParam.salePrice - _flashBorrowedAmount;
    require(vars.buyerBalance >= vars.buyerPayment, "Insufficient balance");

    vars.buyerAllowance = WETH.allowance(_buyer, address(this));
    require(vars.buyerAllowance >= vars.buyerPayment, "Insufficient allowance");

    return baseParam;
  }

  function _checkOrderParams(
    address _buyer,
    bytes calldata _params,
    uint256 _nonce
  ) internal view virtual returns (BaseOrderParam memory) {}

  function _exchange(bytes calldata _params, uint256 _value) internal virtual {}

  function _beforeBorrowWETH(
    address _nftAsset,
    uint256 _nftTokenId,
    address _onBehalfOf,
    uint256 _amount
  ) internal virtual {}

  function _borrowWETH(
    address _nftAsset,
    uint256 _nftTokenId,
    address _onBehalfOf,
    uint256 _amount
  ) internal {
    ILendPool _pool = _getBendLendPool();
    IERC721Upgradeable _nftERC721 = IERC721Upgradeable(_nftAsset);

    require(_nftERC721.ownerOf(_nftTokenId) == address(this), "Not own nft");
    _nftERC721.approve(address(_pool), _nftTokenId);
    _pool.borrow(address(WETH), _amount, _nftAsset, _nftTokenId, _onBehalfOf, 0);
  }

  function _afterBorrowWETH(
    address _nftAsset,
    uint256 _nftTokenId,
    address _onBehalfOf,
    uint256 _amount
  ) internal virtual {}

  function _repayFlashLoan(uint256 _flashLoanDebt) internal {
    WETH.approve(aaveAddressedProvider.getLendingPool(), 0);
    WETH.approve(aaveAddressedProvider.getLendingPool(), _flashLoanDebt);
  }

  function _hashSig(Sig memory sig) internal pure returns (bytes32) {
    return keccak256(abi.encode(_SIGNATURE_TYPEHASH, sig.v, sig.r, sig.s));
  }

  function _checkSig(
    bytes32 paramsHash,
    Sig memory sig,
    address _buyer
  ) internal view {
    bytes32 hash = _hashTypedDataV4(paramsHash);
    address signer = ECDSAUpgradeable.recover(hash, sig.v, sig.r, sig.s);
    require(signer == _buyer, "Invalid signature");
  }

  function _getBendLendPool() internal view returns (ILendPool) {
    return ILendPool(bendAddressesProvider.getLendPool());
  }

  /**
   * @dev Only WETH contract is allowed to transfer ETH here. Prevent other addresses to send Ether to this contract.
   */
  receive() external payable {
    require(msg.sender == address(WETH), "Receive not allowed");
  }
}
