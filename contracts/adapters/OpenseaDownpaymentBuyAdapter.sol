// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {IERC721ReceiverUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import {IAaveFlashLoanReceiver} from "./interfaces/IAaveFlashLoanReceiver.sol";
import {IOpenseaExchage} from "./interfaces/IOpenseaExchage.sol";
import {ILendPool} from "../interfaces/ILendPool.sol";
import {ILendPoolAddressesProvider} from "../interfaces/ILendPoolAddressesProvider.sol";
import {IAaveLendPoolAddressesProvider} from "./interfaces/IAaveLendPoolAddressesProvider.sol";
import {IWETH} from "../interfaces/IWETH.sol";
import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import {PercentageMath} from "../libraries/math/PercentageMath.sol";
import {MathUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";

contract OpenseaDownpaymentBuyAdapter is
  IAaveFlashLoanReceiver,
  OwnableUpgradeable,
  PausableUpgradeable,
  ReentrancyGuardUpgradeable,
  IERC721ReceiverUpgradeable
{
  event FeeCharged(address indexed payer, uint256 fee);

  event FeeUpdated(uint256 indexed newFee);

  using PercentageMath for uint256;
  ILendPoolAddressesProvider public bendAddressesProvider;
  IAaveLendPoolAddressesProvider public aaveAddressedProvider;
  IOpenseaExchage public openseaExchange;
  IWETH public WETH;
  uint256 public fee;
  address public bendCollector;

  struct Params {
    // bend params
    address nftAsset;
    uint256 nftTokenId;
    // opensea params
    address[14] addrs;
    uint256[18] uints;
    uint8[8] feeMethodsSidesKindsHowToCalls;
    bytes calldataBuy;
    bytes calldataSell;
    bytes replacementPatternBuy;
    bytes replacementPatternSell;
    bytes staticExtradataBuy;
    bytes staticExtradataSell;
    uint8[2] vs;
    bytes32[5] rssMetadata;
  }

  modifier onlyAaveLendPool() {
    require(msg.sender == aaveAddressedProvider.getLendingPool(), "Caller must be aave lending pool");
    _;
  }

  function initialize(
    uint256 _fee,
    address _bendAddressesProvider,
    address _aaveAddressesProvider,
    address _openseaExchange,
    address _weth,
    address _bendCollector
  ) external initializer {
    __Pausable_init();
    __Ownable_init();
    __ReentrancyGuard_init();
    fee = _fee;
    bendAddressesProvider = ILendPoolAddressesProvider(_bendAddressesProvider);
    aaveAddressedProvider = IAaveLendPoolAddressesProvider(_aaveAddressesProvider);
    WETH = IWETH(_weth);
    openseaExchange = IOpenseaExchage(_openseaExchange);
    bendCollector = _bendCollector;
    WETH.approve(bendAddressesProvider.getLendPool(), type(uint256).max);
  }

  function pause() external onlyOwner whenNotPaused {
    _pause();
  }

  function unpause() external onlyOwner whenPaused {
    _unpause();
  }

  function updateFee(uint256 _newFee) external onlyOwner {
    require(_newFee <= PercentageMath.PERCENTAGE_FACTOR, "Fee overflow");
    fee = _newFee;
    emit FeeUpdated(fee);
  }

  function executeOperation(
    address[] calldata _assets,
    uint256[] calldata _amounts,
    uint256[] calldata _premiums,
    address _initiator,
    bytes calldata _params
  ) external override nonReentrant whenNotPaused onlyAaveLendPool returns (bool) {
    Params memory _orderParams = _decodeParams(_params);
    _checkParams(_assets, _amounts, _premiums, _initiator, _orderParams);

    address _buyer = _initiator;
    uint256 _flashBorrowedAmount = _amounts[0];
    uint256 _flashFee = _premiums[0];
    uint256 _flashLoanDebt = _flashBorrowedAmount + _flashFee;
    uint256 _salePrice = _orderParams.uints[13];
    uint256 _bendFeeAmount = _salePrice.percentMul(fee);
    uint256 _buyerPayment = _bendFeeAmount + _flashFee + _salePrice - _flashBorrowedAmount;

    // Prepare ETH, need buyer approve WETH to this contract
    require(WETH.transferFrom(_buyer, address(this), _buyerPayment), "WETH transfer failed");
    WETH.withdraw(_salePrice);

    // Do opensea exchange
    _exchange(_orderParams, _salePrice);

    // Borrow WETH from bend, need buyer approve NFT to this contract
    _borrowWETH(_orderParams.nftAsset, _orderParams.nftTokenId, _buyer, _flashBorrowedAmount);

    // Charge fee, sent to bend collector
    _chargeFee(_buyer, _bendFeeAmount);

    // Repay flash loan
    WETH.approve(aaveAddressedProvider.getLendingPool(), 0);
    WETH.approve(aaveAddressedProvider.getLendingPool(), _flashLoanDebt);
    return true;
  }

  function _chargeFee(address _payer, uint256 _amount) internal {
    if (_amount > 0) {
      _getBendLendPool().deposit(address(WETH), _amount, bendCollector, 0);
      emit FeeCharged(_payer, _amount);
    }
  }

  function _checkParams(
    address[] calldata _assets,
    uint256[] calldata _amounts,
    uint256[] calldata _premiums,
    address _initiator,
    Params memory _orderParams
  ) internal view {
    require(_assets.length == 1 && _amounts.length == 1 && _premiums.length == 1, "Multiple assets not supported");
    require(_assets[0] == address(WETH), "Only WETH borrowing allowed");
    // Check order params
    require(address(this) == _orderParams.addrs[1], "Buyer must be this contract");
    address _buyerpaymentToken = _orderParams.addrs[6];
    address _sellerpaymentToken = _orderParams.addrs[13];
    require(address(0) == _buyerpaymentToken, "Buyer payment token should be ETH");
    require(address(0) == _sellerpaymentToken, "Seller payment token should be ETH");
    require(
      _orderParams.feeMethodsSidesKindsHowToCalls[2] == _orderParams.feeMethodsSidesKindsHowToCalls[6] &&
        0 == _orderParams.feeMethodsSidesKindsHowToCalls[2],
      "Order must be fixed price sale kind"
    );

    uint256 _buyPrice = _orderParams.uints[4];
    uint256 _sellPrice = _orderParams.uints[13];
    require(_buyPrice == _sellPrice, "Order price must be same");

    uint256 _flashBorrowedAmount = _amounts[0];
    require(_flashBorrowedAmount <= WETH.balanceOf(address(this)), "Flash loan error");

    // Check if the flash loan can be paid off
    uint256 _flashFee = _premiums[0];

    // Check payment sufficient
    address _buyer = _initiator;
    uint256 _salePrice = _orderParams.uints[13];
    uint256 _bendFeeAmount = _salePrice.percentMul(fee);
    uint256 _buyerBalance = MathUpgradeable.min(WETH.balanceOf(_buyer), WETH.allowance(_buyer, address(this)));
    uint256 _buyerPayment = _bendFeeAmount + _flashFee + _salePrice - _flashBorrowedAmount;

    require(_buyerBalance >= _buyerPayment, "Insufficient payment");
  }

  function _exchange(Params memory _orderParams, uint256 _value) internal {
    openseaExchange.atomicMatch_{value: _value}(
      _orderParams.addrs,
      _orderParams.uints,
      _orderParams.feeMethodsSidesKindsHowToCalls,
      _orderParams.calldataBuy,
      _orderParams.calldataSell,
      _orderParams.replacementPatternBuy,
      _orderParams.replacementPatternSell,
      _orderParams.staticExtradataBuy,
      _orderParams.staticExtradataSell,
      _orderParams.vs,
      _orderParams.rssMetadata
    );
  }

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

  function _getBendLendPool() internal view returns (ILendPool) {
    return ILendPool(bendAddressesProvider.getLendPool());
  }

  function _decodeParams(bytes memory _params) internal pure returns (Params memory) {
    return abi.decode(_params, (Params));
  }

  function onERC721Received(
    address operator,
    address from,
    uint256 tokenId,
    bytes calldata data
  ) external pure override returns (bytes4) {
    operator;
    from;
    tokenId;
    data;
    return IERC721ReceiverUpgradeable.onERC721Received.selector;
  }

  /**
   * @dev Only WETH contract is allowed to transfer ETH here. Prevent other addresses to send Ether to this contract.
   */
  receive() external payable {
    require(msg.sender == address(WETH), "Receive not allowed");
  }
}
