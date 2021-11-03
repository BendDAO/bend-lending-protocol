import { task } from "hardhat/config";
import {
  deployMockFlashLoanReceiver,
  deployWalletBalancerProvider,
  deployBendProtocolDataProvider,
  authorizeWETHGateway,
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
      BNftNamePrefix,
      BNftSymbolPrefix,
      WethGateway,
      ReservesConfig,
      NftsConfig,
    } = poolConfig;
    const addressesProvider = await getLendPoolAddressesProvider();
    const admin = await addressesProvider.getPoolAdmin();
    const treasuryAddress = await getTreasuryAddress(poolConfig);

    const dataProvider = await deployBendProtocolDataProvider(addressesProvider.address, verify);
    await insertContractAddressInDb(eContractid.BendProtocolDataProvider, dataProvider.address);

    ////////////////////////////////////////////////////////////////////////////
    const mockTokens = await getAllMockedTokens();
    const allTokenAddresses = getAllTokenAddresses(mockTokens);

    await initReservesByHelper(
      ReservesConfig,
      allTokenAddresses,
      BTokenNamePrefix,
      BTokenSymbolPrefix,
      admin,
      treasuryAddress,
      ZERO_ADDRESS,
      pool,
      verify
    );
    await configureReservesByHelper(ReservesConfig, allTokenAddresses, dataProvider, admin);

    ////////////////////////////////////////////////////////////////////////////
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

    await configureNftsByHelper(NftsConfig, allNftAddresses, dataProvider, admin);

    ////////////////////////////////////////////////////////////////////////////
    const bnftRegistry = await addressesProvider.getBNFTRegistry();
    const mockFlashLoanReceiver = await deployMockFlashLoanReceiver([bnftRegistry], verify);
    await insertContractAddressInDb(eContractid.MockFlashLoanReceiver, mockFlashLoanReceiver.address);

    await deployWalletBalancerProvider(verify);

    const lendPoolAddress = await addressesProvider.getLendPool();

    let gateway = getParamPerNetwork(WethGateway, network);
    if (!notFalsyOrZeroAddress(gateway)) {
      gateway = (await getWETHGateway()).address;
    }
    await authorizeWETHGateway(gateway, lendPoolAddress);
  });
