import BigNumber from "bignumber.js";
import { task } from "hardhat/config";
import { ConfigNames, getEmergencyAdmin, loadPoolConfig } from "../../helpers/configuration";
import {
  MOCK_NFT_AGGREGATORS_PRICES,
  USD_ADDRESS,
  MAX_UINT_AMOUNT,
  ZERO_ADDRESS,
  oneEther,
} from "../../helpers/constants";
import {
  getBendProtocolDataProvider,
  getBToken,
  getCryptoPunksMarket,
  getDeploySigner,
  getLendPool,
  getLendPoolAddressesProvider,
  getLendPoolConfiguratorProxy,
  getMintableERC20,
  getMintableERC721,
  getNFTOracle,
  getPunkGateway,
  getReserveOracle,
  getUIPoolDataProvider,
  getWalletProvider,
  getWETHGateway,
  getWETHMocked,
  getWrappedPunk,
} from "../../helpers/contracts-getters";
import { convertToCurrencyDecimals, getContractAddressInDb, getEthersSigners } from "../../helpers/contracts-helpers";
import { getNowTimeInSeconds, waitForTx } from "../../helpers/misc-utils";
import { eContractid, eNetwork, PoolConfiguration } from "../../helpers/types";

task("dev:cryptopunks-init", "Doing CryptoPunks init task").setAction(async ({}, DRE) => {
  await DRE.run("set-DRE");

  const punks = await getCryptoPunksMarket();
  await punks.allInitialOwnersAssigned();

  await waitForTx(await punks.allInitialOwnersAssigned());
});

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
  .addParam("amount", "Amount to deposit, like 0.01")
  .setAction(async ({ pool, amount }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();

    const signer = await getDeploySigner();

    const wethGateway = await getWETHGateway();

    const wethAddress = await getContractAddressInDb("WETH");
    const weth = await getMintableERC20(wethAddress);
    await waitForTx(await weth.approve(wethGateway.address, MAX_UINT_AMOUNT));

    const amountDecimals = await convertToCurrencyDecimals(weth.address, amount);

    await waitForTx(await wethGateway.depositETH(await signer.getAddress(), "0", { value: amountDecimals }));
  });

task("dev:withdraw-eth", "Doing custom task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("amount", "Amount to withdraw, like 0.01")
  .setAction(async ({ pool, amount }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();

    const signer = await getDeploySigner();

    const lendPool = await getLendPool(await addressesProvider.getLendPool());

    const wethGateway = await getWETHGateway();

    const wethAddress = await getContractAddressInDb("WETH");
    const weth = await getMintableERC20(wethAddress);

    const wethResData = await lendPool.getReserveData(weth.address);
    const bWeth = await getBToken(wethResData.bTokenAddress);
    await waitForTx(await bWeth.approve(wethGateway.address, MAX_UINT_AMOUNT));

    const amountDecimals = await convertToCurrencyDecimals(weth.address, amount);

    await waitForTx(await wethGateway.withdrawETH(amountDecimals, await signer.getAddress()));
  });

task("dev:borrow-eth-using-bayc", "Doing custom task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ pool }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();

    const signer = await getDeploySigner();

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

    const signer = await getDeploySigner();

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
  .addParam("id", "Punk index of CryptoPunks")
  .addParam("amount", "Amount to borrow, like 0.01")
  .addFlag("borrowMore", "Borrow more ETH using existed NFT")
  .setAction(async ({ pool, id, amount, borrowMore }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();

    const signer = await getDeploySigner();

    const punk = await getCryptoPunksMarket();
    const wpunk = await getWrappedPunk();
    const punkGateway = await getPunkGateway();

    const wethAddress = await getContractAddressInDb("WETH");
    const weth = await getMintableERC20(wethAddress);

    const isApproveOk = await wpunk.isApprovedForAll(await signer.getAddress(), punkGateway.address);
    if (!isApproveOk) {
      console.log("setApprovalForAll");
      await waitForTx(await wpunk.setApprovalForAll(punkGateway.address, true));
    }

    const amountDecimals = await convertToCurrencyDecimals(weth.address, amount);

    if (!borrowMore) {
      console.log("punkIndexToAddress:", await punk.punkIndexToAddress(id));

      console.log("mint punk");
      await waitForTx(await punk.getPunk(id));
      await waitForTx(await punk.offerPunkForSaleToAddress(id, "0", punkGateway.address));

      console.log("borrow ETH at first time");
      const txBorrow = await waitForTx(await punkGateway.borrowETH(amountDecimals, id, await signer.getAddress(), "0")); // 0.05 ETH
      console.log("txBorrow:", txBorrow.transactionHash);
    } else {
      console.log("ownerOf:", await wpunk.ownerOf(id));

      console.log("borrow more ETH");
      const txBorrow = await waitForTx(await punkGateway.borrowETH(amountDecimals, id, await signer.getAddress(), "0")); // 0.05 ETH
      console.log("txBorrow:", txBorrow.transactionHash);
    }
  });

task("dev:borrow-usdc-using-punk", "Doing custom task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ pool }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();

    const signer = await getDeploySigner();

    const daiAddress = await getContractAddressInDb("DAI");

    const punk = await getCryptoPunksMarket();
    const punkGateway = await getPunkGateway();

    await waitForTx(await punk.getPunk("5002"));
    await waitForTx(await punk.offerPunkForSaleToAddress("5002", "0", punkGateway.address));
    await waitForTx(
      await punkGateway.borrow(daiAddress, "100000000000000000000", "5002", await signer.getAddress(), "0")
    ); // 100 DAI
  });

task("dev:print-ui-reserve-data", "Doing custom task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("user", "Address of user")
  .setAction(async ({ pool, user }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();
    const dataProvider = await getBendProtocolDataProvider();
    const uiProvider = await getUIPoolDataProvider();

    console.log("--------------------------------------------------------------------------------");
    console.log("SimpleReservesData:");
    const simpleReservesData = await uiProvider.getSimpleReservesData(addressesProvider.address);
    console.log(simpleReservesData);

    console.log("--------------------------------------------------------------------------------");
    console.log("UserReservesData:");
    const userReserveData = await uiProvider.getUserReservesData(addressesProvider.address, user);
    console.log(userReserveData);
  });

task("dev:print-ui-nft-data", "Doing custom task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("user", "Address of user")
  .setAction(async ({ pool, user }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();
    const dataProvider = await getBendProtocolDataProvider();
    const uiProvider = await getUIPoolDataProvider();

    console.log("--------------------------------------------------------------------------------");
    console.log("SimpleNftsData:");
    const simpleNftsData = await uiProvider.getSimpleNftsData(addressesProvider.address);
    console.log(simpleNftsData);

    console.log("--------------------------------------------------------------------------------");
    console.log("UserNftsData:");
    const userNftData = await uiProvider.getUserNftsData(addressesProvider.address, user);
    console.log(userNftData);
  });

task("dev:print-ui-loan-data", "Doing custom task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("token", "Address of token")
  .addParam("id", "ID of token")
  .setAction(async ({ pool, token, id }, DRE) => {
    await DRE.run("set-DRE");

    const addressesProvider = await getLendPoolAddressesProvider();
    const uiProvider = await getUIPoolDataProvider();

    const simpleLoansData = await uiProvider.getSimpleLoansData(addressesProvider.address, [token], [id]);
    console.log(simpleLoansData);
  });

task("dev:print-wallet-balance", "Doing custom task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("method", "Name of method")
  .addParam("user", "Address of user")
  .addParam("token", "Address of token")
  .addOptionalParam("start", "Start offset of token id range")
  .addOptionalParam("count", "Count of token id range(<=2000)")
  .setAction(async ({ pool, method, user, token, start, count }, DRE) => {
    await DRE.run("set-DRE");

    const walletProvider = await getWalletProvider();

    if (method == "batchPunkOfOwner") {
      const punkIndexs = await walletProvider.batchPunkOfOwner(user, token, start, count);
      console.log("batchPunkOfOwner:", punkIndexs.join(","));
    } else if (method == "batchTokenOfOwner") {
      const tokenIds = await walletProvider.batchTokenOfOwner(user, token, start, count);
      console.log("batchTokenOfOwner:", tokenIds.join(","));
    } else if (method == "batchTokenOfOwnerByIndex") {
      const tokenIds = await walletProvider.batchTokenOfOwnerByIndex(user, token);
      console.log("batchTokenOfOwnerByIndex:", tokenIds.join(","));
    }
  });

task("dev:purge-all-eths", "Doing purge all ETHs in pool task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("id", "id of BAYC token")
  .addParam("to", "Address of target user")
  .setAction(async ({ pool, id, to }, DRE) => {
    await DRE.run("set-DRE");

    const deployerSigner = await getDeploySigner();
    const deployerAddress = await deployerSigner.getAddress();

    const addressesProvider = await getLendPoolAddressesProvider();
    const lendPool = await getLendPool();
    const weth = await getWETHMocked();
    const wethGateway = await getWETHGateway();

    const wethReserveData = await lendPool.getReserveData(weth.address);
    const bwethToken = await getBToken(wethReserveData.bTokenAddress);
    const availableBalance = await weth.balanceOf(bwethToken.address);
    console.log("Available Balance:", availableBalance.toString());
    if (new BigNumber(availableBalance.toString()).lt(oneEther.div(100))) {
      return;
    }

    const baycAddress = await getContractAddressInDb("BAYC");
    const bayc = await getMintableERC721(baycAddress);
    await waitForTx(await bayc.mint(id));

    const approved = await bayc.isApprovedForAll(deployerAddress, wethGateway.address);
    if (!approved) {
      await waitForTx(await bayc.setApprovalForAll(wethGateway.address, true));
    }

    await waitForTx(await wethGateway.borrowETH(availableBalance, bayc.address, id, to, "0"));
  });
