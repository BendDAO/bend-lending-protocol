import { task } from "hardhat/config";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import {
  getBendProtocolDataProvider,
  getLendPoolAddressesProvider,
  //getLendPoolAddressesProviderRegistry,
} from "../../helpers/contracts-getters";
import { getParamPerNetwork } from "../../helpers/contracts-helpers";
import { DRE } from "../../helpers/misc-utils";
import { eEthereumNetwork, eNetwork } from "../../helpers/types";

task("print-config", "Inits the DRE, to have access to all the plugins")
  .addParam("dataProvider", "Address of BendProtocolDataProvider")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ pool, dataProvider }, localBRE) => {
    await localBRE.run("set-DRE");
    const network = process.env.FORK ? (process.env.FORK as eNetwork) : (localBRE.network.name as eNetwork);
    console.log(network);
    const poolConfig = loadPoolConfig(pool);

    const addressesProvider = await getLendPoolAddressesProvider(poolConfig.MarketId); // Checks first provider

    console.log("Address Provider: ", addressesProvider.address);
    console.log("Market Id: ", await addressesProvider.getMarketId());
    console.log("LendPool Proxy:", await addressesProvider.getLendPool());
    console.log("Lend Pool Loan Proxy", await addressesProvider.getLendPoolLoan());
    console.log("Lend Pool Configurator proxy", await addressesProvider.getLendPoolConfigurator());
    console.log("Pool admin", await addressesProvider.getPoolAdmin());
    console.log("Emergency admin", await addressesProvider.getEmergencyAdmin());
    console.log("Reserve Oracle", await addressesProvider.getReserveOracle());
    console.log("NFT Oracle", await addressesProvider.getNFTOracle());
    console.log("Lend Pool Data Provider", dataProvider);
    const protocolDataProvider = await getBendProtocolDataProvider(dataProvider);

    const reserveFields = ["decimals", "reserveFactor", "borrowingEnabled", "isActive", "isFrozen"];
    const reserveTokensFields = ["bTokenAddress"];
    const reserveAssets = getParamPerNetwork(poolConfig.ReserveAssets, network as eNetwork);
    for (const [symbol, address] of Object.entries(reserveAssets)) {
      console.log(`- ${symbol} reserve config`);
      console.log(`  - reserve address: ${address}`);

      const reserveData = await protocolDataProvider.getReserveConfigurationData(address);
      const reserveTokensAddresses = await protocolDataProvider.getReserveTokensAddresses(address);
      reserveFields.forEach((field, index) => {
        console.log(`  - ${field}:`, reserveData[field].toString());
      });
      reserveTokensFields.forEach((field, index) => {
        console.log(`  - ${field}:`, reserveTokensAddresses[index]);
      });
    }

    const nftFields = ["ltv", "liquidationThreshold", "liquidationBonus", "isActive", "isFrozen"];
    const nftTokensFields = ["bNftAddress"];
    const nftsAsset = getParamPerNetwork(poolConfig.NftsAssets, network as eNetwork);
    for (const [symbol, address] of Object.entries(nftsAsset)) {
      console.log(`- ${symbol} nft config`);
      console.log(`  - nft address: ${address}`);

      const nftData = await protocolDataProvider.getNftConfigurationData(address);
      const nftTokensAddresses = await protocolDataProvider.getNftTokensAddresses(address);
      nftFields.forEach((field, index) => {
        console.log(`  - ${field}:`, nftData[field].toString());
      });
      nftTokensFields.forEach((field, index) => {
        console.log(`  - ${field}:`, nftTokensAddresses[index]);
      });
    }
  });
