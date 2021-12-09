import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ConfigNames, getEmergencyAdmin, loadPoolConfig } from "../../helpers/configuration";
import { MOCK_NFT_AGGREGATORS_PRICES, USD_ADDRESS, MAX_UINT_AMOUNT } from "../../helpers/constants";
import { deployBNFTRegistry, deployGenericBNFTImpl, deployLendPool } from "../../helpers/contracts-deployments";
import {
  getBendProtocolDataProvider,
  getBendProxyAdminByAddress,
  getBNFTRegistryProxy,
  getBToken,
  getCryptoPunksMarket,
  getFirstSigner,
  getLendPool,
  getLendPoolAddressesProvider,
  getLendPoolConfiguratorProxy,
  getMintableERC20,
  getMintableERC721,
  getNFTOracle,
  getPunkGateway,
  getReserveOracle,
  getThirdSigner,
  getUIPoolDataProvider,
  getWalletProvider,
  getWETHGateway,
  getWrappedPunk,
} from "../../helpers/contracts-getters";
import {
  getContractAddressInDb,
  getEthersSigners,
  getParamPerNetwork,
  verifyContract,
} from "../../helpers/contracts-helpers";
import { getNowTimeInSeconds, waitForTx } from "../../helpers/misc-utils";
import { eContractid, eNetwork, PoolConfiguration } from "../../helpers/types";
import { LendPoolAddressesProvider, MintableERC721Factory } from "../../types";

task("dev:generate-subgraph-events", "Doing custom task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("nftTokenId", "Token ID of NFT")
  .setAction(async ({ pool, nftTokenId }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();

    const allSigners = await getEthersSigners();
    const depositer = allSigners[5];
    const depositerAddress = await depositer.getAddress();
    const borrower = allSigners[6];
    const borrowerAddress = await borrower.getAddress();

    const lendPool = await getLendPool(await addressesProvider.getLendPool());
    const depositerPool = lendPool.connect(depositer);
    const borrowerPool = lendPool.connect(borrower);

    // deposit
    console.log("deposit");
    const dai = await getMintableERC20(await getContractAddressInDb("DAI"));
    const depositerDai = dai.connect(depositer);
    const borrowerDai = dai.connect(borrower);
    await waitForTx(await depositerDai.approve(lendPool.address, "100000000000000000000000000000"));
    await waitForTx(await depositerDai.mint("1000000000000000000000")); // 1000 DAI, 18 decimals
    await waitForTx(await depositerPool.deposit(dai.address, "1000000000000000000000", depositerAddress, "0"));

    // borrow
    console.log("borrow");
    const bayc = await getMintableERC721(await getContractAddressInDb("BAYC"));
    const borrowerBayc = bayc.connect(borrower);
    await waitForTx(await borrowerBayc.setApprovalForAll(lendPool.address, true));
    await waitForTx(await borrowerBayc.mint(nftTokenId));
    await waitForTx(
      await borrowerPool.borrow(dai.address, "500000000000000000000", bayc.address, nftTokenId, borrowerAddress, "0")
    ); // 500 DAI

    // repay partly
    console.log("repay partly");
    await waitForTx(await borrowerDai.approve(lendPool.address, "100000000000000000000000000000"));
    await waitForTx(await borrowerDai.mint("1000000000000000000000")); // 1000 DAI, 18 decimals
    await waitForTx(await borrowerPool.repay(bayc.address, nftTokenId, "100000000000000000000")); // 100 DAI

    // withdraw partly
    console.log("withdraw partly");
    await waitForTx(await depositerPool.withdraw(dai.address, "100000000000000000000", depositerAddress)); // 100 DAI
  });

task("dev:deposit-eth", "Doing custom task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ pool }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();

    const signer = await getFirstSigner();

    const wethGateway = await getWETHGateway();

    const wethAddress = await getContractAddressInDb("WETH");
    const weth = await getMintableERC20(wethAddress);
    await waitForTx(await weth.approve(wethGateway.address, MAX_UINT_AMOUNT));

    await waitForTx(await wethGateway.depositETH(await signer.getAddress(), "0", { value: "100000000000000000" })); // 0.1 ETH
  });

task("dev:withdraw-eth", "Doing custom task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ pool }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();

    const signer = await getFirstSigner();

    const lendPool = await getLendPool(await addressesProvider.getLendPool());

    const wethGateway = await getWETHGateway();

    const wethAddress = await getContractAddressInDb("WETH");
    const weth = await getMintableERC20(wethAddress);

    const wethResData = await lendPool.getReserveData(weth.address);
    const bWeth = await getBToken(wethResData.bTokenAddress);
    await waitForTx(await bWeth.approve(wethGateway.address, MAX_UINT_AMOUNT));

    await waitForTx(await wethGateway.withdrawETH("10000000000000000", await signer.getAddress())); // 0.01 ETH
  });

task("dev:borrow-eth-using-bayc", "Doing custom task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ pool }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();

    const signer = await getFirstSigner();

    const wethGateway = await getWETHGateway();
    const baycAddress = await getContractAddressInDb("BAYC");

    const bayc = await getMintableERC721(baycAddress);
    await waitForTx(await bayc.setApprovalForAll(wethGateway.address, true));

    const tokenId = 5002;
    await waitForTx(await bayc.mint(tokenId));
    await waitForTx(
      await wethGateway.borrowETH("100000000000000000", bayc.address, tokenId, await signer.getAddress(), "0")
    );
  });

task("dev:borrow-usdc-using-bayc", "Doing custom task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ pool }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();

    const signer = await getFirstSigner();

    const lendPool = await getLendPool(await addressesProvider.getLendPool());

    const usdcAddress = await getContractAddressInDb("USDC");
    const usdc = await getMintableERC20(usdcAddress);

    const baycAddress = await getContractAddressInDb("BAYC");
    const bayc = await getMintableERC721(baycAddress);
    await waitForTx(await bayc.setApprovalForAll(lendPool.address, true));
    await waitForTx(await bayc.mint(5003));

    await waitForTx(
      await lendPool.borrow(usdc.address, "100000000", bayc.address, "5003", await signer.getAddress(), "0")
    ); // 100 USDC
  });

task("dev:borrow-eth-using-punk", "Doing custom task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ pool }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();

    const signer = await getFirstSigner();

    const punk = await getCryptoPunksMarket();
    const punkGateway = await getPunkGateway();

    await waitForTx(await punk.getPunk("5001"));
    await waitForTx(await punk.offerPunkForSaleToAddress("5001", "0", punkGateway.address));
    await waitForTx(await punkGateway.borrowETH("50000000000000000", "5001", await signer.getAddress(), "0")); // 0.05 ETH
  });

task("dev:borrow-usdc-using-punk", "Doing custom task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ pool }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();

    const signer = await getFirstSigner();

    const daiAddress = await getContractAddressInDb("DAI");

    const punk = await getCryptoPunksMarket();
    const punkGateway = await getPunkGateway();

    await waitForTx(await punk.getPunk("5002"));
    await waitForTx(await punk.offerPunkForSaleToAddress("5002", "0", punkGateway.address));
    await waitForTx(
      await punkGateway.borrow(daiAddress, "100000000000000000000", "5002", await signer.getAddress(), "0")
    ); // 100 DAI
  });

const printUISimpleData = async (addressesProvider: LendPoolAddressesProvider) => {
  const dataProvider = await getBendProtocolDataProvider();
  const uiProvider = await getUIPoolDataProvider();

  console.log("--------------------------------------------------------------------------------");
  const simpleNftsData = await uiProvider.getSimpleNftsData(addressesProvider.address);
  console.log(simpleNftsData);

  console.log("--------------------------------------------------------------------------------");
  const userNftData = await uiProvider.getUserNftsData(
    addressesProvider.address,
    "0xafF5C36642385b6c7Aaf7585eC785aB2316b5db6"
  );
  console.log(userNftData);

  console.log("--------------------------------------------------------------------------------");
  const simpleReservesData = await uiProvider.getSimpleReservesData(addressesProvider.address);
  console.log(simpleReservesData);

  console.log("--------------------------------------------------------------------------------");
  const userReserveData = await uiProvider.getUserReservesData(
    addressesProvider.address,
    "0xafF5C36642385b6c7Aaf7585eC785aB2316b5db6"
  );
  console.log(userReserveData);

  console.log("--------------------------------------------------------------------------------");
  const baycAddress = await getContractAddressInDb("BAYC");
  const simpleLoansData = await uiProvider.getSimpleLoansData(addressesProvider.address, [baycAddress], ["5001"]);
  console.log(simpleLoansData);
};

const printWalletBatchToken = async () => {
  const user0signer = await getFirstSigner();
  const user0Address = await user0signer.getAddress();
  const user = "0x8b04B42962BeCb429a4dBFb5025b66D3d7D31d27";

  const walletProvider = await getWalletProvider("0xcdAeD24a337CC35006b5CF79a7A858561686E783");
  {
    const punkIndexs = await walletProvider.batchPunkOfOwner(
      user,
      "0x6AB60B1E965d9Aa445d637Ac5034Eba605FF0b82",
      0,
      2000
    );
    console.log("batchPunkOfOwner:", punkIndexs.join(","));
  }
  {
    const tokenIds = await walletProvider.batchTokenOfOwner(
      user,
      "0x6f9a28ACE211122CfD6f115084507b44FDBc12C7",
      0,
      2000
    );
    console.log("batchTokenOfOwner(BAYC):", tokenIds.join(","));
  }
  {
    const tokenIds = await walletProvider.batchTokenOfOwnerByIndex(user, "0xEF307D349b242b6967a75A4f19Cdb692170F1106");
    console.log("batchTokenOfOwnerByIndex(COOL):", tokenIds.join(","));
  }

  {
    const tokenIds = await walletProvider.batchTokenOfOwner(
      user0Address,
      "0x42258A4ab69a6570381277d384D6F1419d765fEA",
      5000,
      2000
    );
    console.log("batchTokenOfOwner(bBAYC):", tokenIds.join(","));
  }
  {
    const tokenIds = await walletProvider.batchTokenOfOwnerByIndex(
      user0Address,
      "0x42258A4ab69a6570381277d384D6F1419d765fEA"
    );
    console.log("batchTokenOfOwnerByIndex(bBAYC):", tokenIds.join(","));
  }
};
