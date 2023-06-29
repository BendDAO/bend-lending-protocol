// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import "forge-std/Test.sol";

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../contracts/interfaces/ILendPoolAddressesProvider.sol";
import "../../contracts/interfaces/ILendPoolConfigurator.sol";
import "../../contracts/interfaces/ILendPool.sol";
import "../../contracts/interfaces/IPunkGateway.sol";
import "../../contracts/interfaces/IPunks.sol";
import "../../contracts/interfaces/IIncentivesController.sol";
import "../../contracts/interfaces/IBToken.sol";
import "../../contracts/interfaces/IDebtToken.sol";

import "../../contracts/libraries/proxy/BendProxyAdmin.sol";
import "../../contracts/libraries/proxy/BendUpgradeableProxy.sol";
import "../../contracts/libraries/types/ConfigTypes.sol";
import "../../contracts/protocol/InterestRate.sol";
import "../../contracts/protocol/ReserveOracle.sol";
import "../../contracts/protocol/LendPoolConfigurator.sol";
import "../../contracts/misc/BendProtocolDataProvider.sol";
import "../../contracts/protocol/PunkGateway.sol";

contract ListingUSDTForkTest is Test {
  using SafeERC20 for IERC20;

  // the address of the contract on the mainnet fork
  address constant multisigOwnerAddress = 0x652DB942BE3Ab09A8Fd6F14776a52ed2A73bF214;
  address constant timelockController7DAddress = 0x4e4C314E2391A58775be6a15d7A05419ba7D2B6e;
  address constant timelockController24HAddress = 0x652DB942BE3Ab09A8Fd6F14776a52ed2A73bF214;
  address constant poolProviderAddress = 0x24451F47CaF13B24f4b5034e1dF6c0E401ec0e46;
  address constant bendCollectorAddress = 0x43078AbfB76bd24885Fd64eFFB22049f92a8c495;
  address constant proxyAdminAddress = 0x501c991E0D31D408c25bCf00da27BdF2759A394a;
  address constant punkGatewayAddress = 0xeD01f8A737813F0bDA2D4340d191DBF8c2Cbcf30;
  address constant wethGatewayAddress = 0x3B968D2D299B895A5Fcf3BBa7A64ad0F566e6F88;
  // usdt reserve related addresses
  address constant usdtTokenAddress = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
  address constant usdtAggregatorAddress = 0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46;
  address constant reserveOracleAddress = 0x16ca3E500dA893cF2EEBb6b401247e68ca5BC072;
  // contracts
  BendProxyAdmin public proxyAdminPool;
  ILendPoolAddressesProvider public addressProvider;
  BendProtocolDataProvider public dataProvider;
  IBToken public bendUSDTToken;
  IDebtToken public debtUSDTToken;

  // how to run this testcase
  // forge test --match-contract ListingUSDTForkTest --fork-url https://RPC --fork-block-number 17577548

  function setUp() public {
    proxyAdminPool = BendProxyAdmin(proxyAdminAddress);
    addressProvider = ILendPoolAddressesProvider(poolProviderAddress);
    dataProvider = BendProtocolDataProvider(addressProvider.getBendDataProvider());
  }

  function testFork_ListingUSDT() public {
    // configure usdt asset in oracle
    ReserveOracle reserveOracle = ReserveOracle(reserveOracleAddress);
    vm.prank(multisigOwnerAddress);
    reserveOracle.addAggregator(usdtTokenAddress, usdtAggregatorAddress);

    uint256 usdtEthPrice = reserveOracle.getAssetPrice(usdtTokenAddress);
    assertGt(usdtEthPrice, 0, "failed to get USDT / ETH price");
    console.log("USDT / ETH price: ", usdtEthPrice);

    // config usdt asset in configurator, decimals is 27
    InterestRate usdtInterestRate = new InterestRate(
      ILendPoolAddressesProvider(poolProviderAddress),
      650000000000000000000000000, // optimalUtilizationRate, 65%
      100000000000000000000000000, // baseVariableBorrowRate, 10%
      160000000000000000000000000, // variableRateSlope1, 16%
      2000000000000000000000000000 // variableRateSlope2, 200%
    );

    LendPoolConfigurator configurator = LendPoolConfigurator(addressProvider.getLendPoolConfigurator());
    ConfigTypes.InitReserveInput[] memory initInputs = new ConfigTypes.InitReserveInput[](1);
    initInputs[0] = ConfigTypes.InitReserveInput({
      bTokenImpl: 0x8364d03349e76386263005ce79517A1776ddfF45,
      debtTokenImpl: 0x3f1735b33a0ED1b5c00230F3C162D6B23CA60C3C,
      underlyingAssetDecimals: 6,
      interestRateAddress: address(usdtInterestRate),
      underlyingAsset: usdtTokenAddress,
      treasury: bendCollectorAddress,
      underlyingAssetName: "USDT",
      bTokenName: "Bend interest bearing USDT",
      bTokenSymbol: "bendUSDT",
      debtTokenName: "Bend debt bearing USDT",
      debtTokenSymbol: "bendDebtUSDT"
    });
    vm.prank(timelockController7DAddress);
    configurator.batchInitReserve(initInputs);

    ILendPoolConfigurator.ConfigReserveInput[] memory cfgInputs = new ILendPoolConfigurator.ConfigReserveInput[](1);
    cfgInputs[0] = ILendPoolConfigurator.ConfigReserveInput({asset: usdtTokenAddress, reserveFactor: 3000});
    vm.prank(timelockController7DAddress);
    configurator.batchConfigReserve(cfgInputs);

    address[] memory assets = new address[](1);
    assets[0] = usdtTokenAddress;
    vm.prank(timelockController7DAddress);
    configurator.setBorrowingFlagOnReserve(assets, true);

    // config usdt asset in incentive controller
    IIncentivesController incentiveController = IIncentivesController(addressProvider.getIncentivesController());
    BendProtocolDataProvider.ReserveTokenData memory reserveTokenData = dataProvider.getReserveTokenData(
      usdtTokenAddress
    );
    bendUSDTToken = IBToken(reserveTokenData.bTokenAddress);
    debtUSDTToken = IDebtToken(reserveTokenData.debtTokenAddress);
    vm.prank(multisigOwnerAddress);
    address[] memory icAssets = new address[](2);
    icAssets[0] = reserveTokenData.bTokenAddress;
    icAssets[1] = reserveTokenData.debtTokenAddress;
    uint256[] memory icEmissions = new uint256[](2);
    incentiveController.configureAssets(icAssets, icEmissions);

    // upgrade punk gateway
    _upgradePunkGateway();

    // check results
    _checkReserveData(usdtTokenAddress);

    _checkDepositReserve(usdtTokenAddress);

    _checkBorrowAndRepayForERC721(usdtTokenAddress);

    _checkBorrowAndRepayForPunk(usdtTokenAddress);
  }

  function _upgradePunkGateway() internal {
    PunkGateway punkGatewayImpl = new PunkGateway();

    console.log("====_upgradePunkGateway====");

    vm.prank(timelockController7DAddress);
    proxyAdminPool.upgrade(BendUpgradeableProxy(payable(punkGatewayAddress)), address(punkGatewayImpl));

    PunkGateway punkGateway = PunkGateway(payable(punkGatewayAddress));
    address[] memory assets = new address[](1);
    assets[0] = usdtTokenAddress;
    vm.prank(timelockController24HAddress);
    punkGateway.authorizeLendPoolERC20(assets);
  }

  function _checkReserveData(address reserve) internal {
    (uint256 decimals, uint256 reserveFactor, bool borrowingEnabled, bool isActive, bool isFrozen) = dataProvider
      .getReserveConfigurationData(reserve);

    assertEq(decimals, 6, "decimals not match");
    assertEq(reserveFactor, 3000, "reserveFactor not match");
    assertEq(borrowingEnabled, true, "borrowingEnabled not match");
    assertEq(isActive, true, "isActive not match");
    assertEq(isFrozen, false, "isFrozen not match");
  }

  function _checkDepositReserve(address reserve) internal {
    address testWallet = 0x4D62360CEcF722A7888b1f97D4c7e8b170071248;
    ILendPool pool = ILendPool(addressProvider.getLendPool());

    console.log("====_checkDepositReserve====");

    vm.startPrank(testWallet);

    // deposit some usdt
    console.log("USDT balanceOf(testWallet)", IERC20(reserve).balanceOf(testWallet));
    IERC20(reserve).safeApprove(address(pool), type(uint256).max);
    pool.deposit(reserve, 10000 * 1e6, testWallet, 0);

    vm.stopPrank();
  }

  function _checkBorrowAndRepayForERC721(address reserve) internal {
    address testWallet = 0x4D62360CEcF722A7888b1f97D4c7e8b170071248;
    ILendPool pool = ILendPool(addressProvider.getLendPool());

    console.log("====_checkBorrowAndRepayForERC721====");

    vm.startPrank(testWallet);

    uint256 usdtBalanceBeforeBorrow = IERC20(reserve).balanceOf(address(bendUSDTToken));
    console.log("USDT balanceOf(bendUSDT) before borrow", usdtBalanceBeforeBorrow);

    // moonbirds
    address nftAsset = 0x23581767a106ae21c074b2276D25e5C3e136a68b;
    uint256 nftTokenId = 939;
    (, , , uint256 availableBorrowsInReserve, , , ) = pool.getNftCollateralData(nftAsset, reserve);
    if (availableBorrowsInReserve > usdtBalanceBeforeBorrow) {
      availableBorrowsInReserve = usdtBalanceBeforeBorrow;
    }
    availableBorrowsInReserve = availableBorrowsInReserve * 99 / 100;
    IERC721(nftAsset).setApprovalForAll(address(pool), true);
    pool.borrow(reserve, availableBorrowsInReserve, nftAsset, nftTokenId, testWallet, 0);

    console.log("USDT balanceOf(bendUSDT) after borrow", IERC20(reserve).balanceOf(address(bendUSDTToken)));

    (, address debtReserveAsset, , uint256 totalDebt, , uint256 healthFactor) = pool.getNftDebtData(
      nftAsset,
      nftTokenId
    );
    assertEq(debtReserveAsset, reserve, "debtReserveAsset not match");
    assertGe(totalDebt, availableBorrowsInReserve, "totalDebt not match");
    assertGt(healthFactor, 1.0, "healthFactor not match");

    pool.repay(nftAsset, nftTokenId, totalDebt);
    assertEq(IERC721(nftAsset).ownerOf(nftTokenId), testWallet, "ownerOf not match");

    console.log("USDT balanceOf(bendUSDT) after repay", IERC20(reserve).balanceOf(address(bendUSDTToken)));

    vm.stopPrank();
  }

  function _checkBorrowAndRepayForPunk(address reserve) internal {
    address testWallet = 0x4D62360CEcF722A7888b1f97D4c7e8b170071248;
    ILendPool pool = ILendPool(addressProvider.getLendPool());
    PunkGateway punkGateway = PunkGateway(payable(punkGatewayAddress));
    IPunks punk = IPunks(punkGateway.punks());

    console.log("====_checkBorrowAndRepayForPunk====");

    vm.startPrank(testWallet);

    debtUSDTToken.approveDelegation(address(punkGateway), type(uint256).max);

    uint256 usdtBalanceBeforeBorrow = IERC20(reserve).balanceOf(address(bendUSDTToken));
    console.log("USDT balanceOf(bendUSDT) before borrow", usdtBalanceBeforeBorrow);

    // punks
    address nftAsset = address(punkGateway.wrappedPunks());
    uint256 punkIdex = 8580;
    punk.offerPunkForSaleToAddress(punkIdex, 0, address(punkGateway));
    (, , , uint256 availableBorrowsInReserve, , , ) = pool.getNftCollateralData(nftAsset, reserve);
    if (availableBorrowsInReserve > usdtBalanceBeforeBorrow) {
      availableBorrowsInReserve = usdtBalanceBeforeBorrow;
    }
    availableBorrowsInReserve = availableBorrowsInReserve * 99 / 100;
    punkGateway.borrow(reserve, availableBorrowsInReserve, punkIdex, testWallet, 0);

    console.log("USDT balanceOf(bendUSDT) after borrow", IERC20(reserve).balanceOf(address(bendUSDTToken)));

    (, address debtReserveAsset, , uint256 totalDebt, , uint256 healthFactor) = pool.getNftDebtData(nftAsset, punkIdex);
    assertEq(debtReserveAsset, reserve, "debtReserveAsset not match");
    assertGe(totalDebt, availableBorrowsInReserve, "totalDebt not match");
    assertGt(healthFactor, 1.0, "healthFactor not match");

    IERC20(reserve).safeApprove(address(punkGateway), type(uint256).max);
    IERC721(nftAsset).setApprovalForAll(address(punkGateway), true);
    punkGateway.repay(punkIdex, totalDebt);
    assertEq(punk.punkIndexToAddress(punkIdex), testWallet, "ownerOf not match");

    console.log("USDT balanceOf(bendUSDT) after repay", IERC20(reserve).balanceOf(address(bendUSDTToken)));

    vm.stopPrank();
  }
}
