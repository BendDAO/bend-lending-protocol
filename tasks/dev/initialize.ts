import { task } from "hardhat/config";
import {
  deployWalletBalancerProvider,
  deployBendProtocolDataProvider,
  deployUiPoolDataProvider,
} from "../../helpers/contracts-deployments";
import { getParamPerNetwork } from "../../helpers/contracts-helpers";
import { eNetwork } from "../../helpers/types";
import { ConfigNames, getTreasuryAddress, loadPoolConfig } from "../../helpers/configuration";

import { tEthereumAddress, BendPools, eContractid } from "../../helpers/types";
import { waitForTx, filterMapBy, notFalsyOrZeroAddress } from "../../helpers/misc-utils";
import {
  configureReservesByHelper,
  initReservesByHelper,
  configureNftsByHelper,
  initNftsByHelper,
} from "../../helpers/init-helpers";
import { getAllTokenAddresses, getAllNftAddresses } from "../../helpers/mock-helpers";
import { ZERO_ADDRESS } from "../../helpers/constants";
import {
  getAllMockedTokens,
  getAllMockedNfts,
  getLendPoolAddressesProvider,
  getWETHGateway,
  getPunkGateway,
} from "../../helpers/contracts-getters";
import { insertContractAddressInDb } from "../../helpers/contracts-helpers";

task("dev:initialize-lend-pool", "Initialize lend pool configuration.")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run("set-DRE");
    const network = <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const {
      BTokenNamePrefix,
      BTokenSymbolPrefix,
      DebtTokenNamePrefix,
      DebtTokenSymbolPrefix,
      BNftNamePrefix,
      BNftSymbolPrefix,
      ReservesConfig,
      NftsConfig,
    } = poolConfig;
    const addressesProvider = await getLendPoolAddressesProvider();
    const admin = await addressesProvider.getPoolAdmin();
    const treasuryAddress = await getTreasuryAddress(poolConfig);
    if (treasuryAddress == undefined || !notFalsyOrZeroAddress(treasuryAddress)) {
      throw Error("Invalid treasury address in pool config");
    }

    const dataProvider = await deployBendProtocolDataProvider(addressesProvider.address, verify);
    await insertContractAddressInDb(eContractid.BendProtocolDataProvider, dataProvider.address);

    ////////////////////////////////////////////////////////////////////////////
    // Init & Config Reserve assets
    const mockTokens = await getAllMockedTokens();
    const allTokenAddresses = getAllTokenAddresses(mockTokens);

    await initReservesByHelper(
      ReservesConfig,
      allTokenAddresses,
      BTokenNamePrefix,
      BTokenSymbolPrefix,
      DebtTokenNamePrefix,
      DebtTokenSymbolPrefix,
      admin,
      treasuryAddress,
      pool,
      verify
    );
    await configureReservesByHelper(ReservesConfig, allTokenAddresses, admin);

    ////////////////////////////////////////////////////////////////////////////
    // Init & Config NFT assets
    const mockNfts = await getAllMockedNfts();
    const allNftAddresses = getAllNftAddresses(mockNfts);

    await initNftsByHelper(
      NftsConfig,
      allNftAddresses,
      BNftNamePrefix,
      BNftSymbolPrefix,
      admin,
      ConfigNames.Bend,
      verify
    );

    await configureNftsByHelper(NftsConfig, allNftAddresses, admin);

    //////////////////////////////////////////////////////////////////////////
    // Deploy some data provider for backend
    const reserveOracle = await addressesProvider.getReserveOracle();
    const nftOracle = await addressesProvider.getNFTOracle();

    const walletBalanceProvider = await deployWalletBalancerProvider(verify);
    console.log("WalletBalancerProvider deployed at:", walletBalanceProvider.address);

    // this contract is not support upgrade, just deploy new contract
    const bendProtocolDataProvider = await deployBendProtocolDataProvider(addressesProvider.address, verify);
    console.log("BendProtocolDataProvider deployed at:", bendProtocolDataProvider.address);

    const uiPoolDataProvider = await deployUiPoolDataProvider(reserveOracle, nftOracle, verify);
    console.log("UiPoolDataProvider deployed at:", uiPoolDataProvider.address);

    ////////////////////////////////////////////////////////////////////////////
    const lendPoolAddress = await addressesProvider.getLendPool();

    ////////////////////////////////////////////////////////////////////////////
    const wethGateway = await getWETHGateway();
    for (const [assetSymbol, assetAddress] of Object.entries(allNftAddresses) as [string, string][]) {
      await waitForTx(await wethGateway.authorizeLendPoolNFT(assetAddress));
    }

    ////////////////////////////////////////////////////////////////////////////
    const punkGateway = await getPunkGateway();
    for (const [assetSymbol, assetAddress] of Object.entries(allTokenAddresses) as [string, string][]) {
      await waitForTx(await punkGateway.authorizeLendPoolERC20(assetAddress));
    }
  });
