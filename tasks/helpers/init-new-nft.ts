import { BigNumberish } from "@ethersproject/bignumber";
import { task } from "hardhat/config";
import { ConfigNames, getProviderRegistryAddress, loadPoolConfig } from "../../helpers/configuration";
import {
  getBNFTRegistryProxy,
  getLendPoolAddressesProvider,
  getLendPoolAddressesProviderRegistry,
  getLendPoolConfiguratorProxy,
} from "../../helpers/contracts-getters";
import { getNowTimeInSeconds, notFalsyOrZeroAddress, waitForTx } from "../../helpers/misc-utils";
import { eContractid, eNetwork } from "../../helpers/types";
import { strategyNftParams } from "../../markets/bend/nftsConfigs";

task("init-new-nft", "Init and config new nft asset to lend pool")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("asset", "Address of underlying nft asset contract")
  .addParam("strategy", "Name of nft strategy, supported: ClassA, ClassB, ClassC")
  .setAction(async ({ pool, asset, strategy }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);

    const providerRegistryAddress = await getProviderRegistryAddress(poolConfig);
    if (providerRegistryAddress == undefined || !notFalsyOrZeroAddress(providerRegistryAddress)) {
      throw new Error("The address of provider registry is not exist");
    }
    const providerRegistry = await getLendPoolAddressesProviderRegistry(providerRegistryAddress);
    const addressProviders = providerRegistry.getAddressesProvidersList();

    const addressesProvider = await getLendPoolAddressesProvider(addressProviders[0]);

    const lendPoolConfiguratorProxy = await getLendPoolConfiguratorProxy(
      await addressesProvider.getLendPoolConfigurator()
    );

    const bnftRegistryProxyAddress = await addressesProvider.getBNFTRegistry();
    const bnftRegistry = await getBNFTRegistryProxy(bnftRegistryProxyAddress);
    const { bNftProxy } = await bnftRegistry.getBNFTAddresses(asset);
    if (bNftProxy == undefined || !notFalsyOrZeroAddress(bNftProxy)) {
      throw new Error("The BNFT of asset is not created");
    }

    const nftParam = strategyNftParams[strategy];
    if (nftParam == undefined) {
      throw new Error("The strategy of asset is not exist");
    }

    console.log("Initialize nft to lend pool");
    const initInputParams: {
      underlyingAsset: string;
    }[] = [
      {
        underlyingAsset: asset,
      },
    ];
    await waitForTx(await lendPoolConfiguratorProxy.batchInitNft(initInputParams));

    console.log("Configure nft to lend pool");
    await waitForTx(
      await lendPoolConfiguratorProxy.configureNftAsCollateral(
        asset,
        nftParam.baseLTVAsCollateral,
        nftParam.liquidationThreshold,
        nftParam.liquidationBonus
      )
    );
  });
