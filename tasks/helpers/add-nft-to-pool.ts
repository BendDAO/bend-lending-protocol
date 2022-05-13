import { BigNumberish } from "@ethersproject/bignumber";
import { task } from "hardhat/config";
import { ConfigNames, getProviderRegistryAddress, loadPoolConfig } from "../../helpers/configuration";
import { ADDRESS_ID_WETH_GATEWAY } from "../../helpers/constants";
import {
  getBNFTRegistryProxy,
  getBTokensAndBNFTsHelper,
  getIErc721Detailed,
  getLendPoolAddressesProvider,
  getLendPoolAddressesProviderRegistry,
  getLendPoolConfiguratorProxy,
  getWETHGateway,
} from "../../helpers/contracts-getters";
import { getEthersSignerByAddress } from "../../helpers/contracts-helpers";
import { getNowTimeInSeconds, notFalsyOrZeroAddress, waitForTx } from "../../helpers/misc-utils";
import { eContractid, eNetwork, INftParams } from "../../helpers/types";
import { strategyNftParams } from "../../markets/bend/nftsConfigs";

task("add-nft-to-pool", "Add and config new nft asset to lend pool")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("asset", "Address of underlying nft asset contract")
  .addOptionalParam("strategy", "Name of nft strategy, supported: ClassA, ClassB, ClassC, ClassD, ClassE")
  .setAction(async ({ pool, asset, strategy }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);

    const addressesProvider = await getLendPoolAddressesProvider();

    const poolAdminSigner = await getEthersSignerByAddress(await addressesProvider.getPoolAdmin());

    const lendPoolConfiguratorProxy = await getLendPoolConfiguratorProxy(
      await addressesProvider.getLendPoolConfigurator()
    );

    const bnftRegistryProxyAddress = await addressesProvider.getBNFTRegistry();
    const bnftRegistry = await getBNFTRegistryProxy(bnftRegistryProxyAddress);
    const { bNftProxy } = await bnftRegistry.getBNFTAddresses(asset);
    if (bNftProxy == undefined || !notFalsyOrZeroAddress(bNftProxy)) {
      throw new Error("The BNFT of asset is not created");
    }

    const wethGateway = await getWETHGateway(await addressesProvider.getAddress(ADDRESS_ID_WETH_GATEWAY));

    const nftContract = await getIErc721Detailed(asset);
    const nftSymbol = await nftContract.symbol();
    console.log("NFT:", nftSymbol);

    let nftParam: INftParams;
    if (strategy != undefined && strategy != "") {
      nftParam = strategyNftParams[strategy];
    } else {
      nftParam = poolConfig.NftsConfig[nftSymbol];
    }
    if (nftParam == undefined) {
      throw new Error("The strategy of asset is not exist");
    }

    console.log("NFT Strategy:", nftParam);

    console.log("Initialize nft to lend pool");
    const initInputParams: {
      underlyingAsset: string;
    }[] = [
      {
        underlyingAsset: asset,
      },
    ];
    await waitForTx(await lendPoolConfiguratorProxy.connect(poolAdminSigner).batchInitNft(initInputParams));

    console.log("Configure nft collateral parameters to lend pool");
    await waitForTx(
      await lendPoolConfiguratorProxy
        .connect(poolAdminSigner)
        .configureNftAsCollateral(
          asset,
          nftParam.baseLTVAsCollateral,
          nftParam.liquidationThreshold,
          nftParam.liquidationBonus
        )
    );

    console.log("Configure nft auction parameters to lend pool");
    await waitForTx(
      await lendPoolConfiguratorProxy
        .connect(poolAdminSigner)
        .configureNftAsAuction(asset, nftParam.redeemDuration, nftParam.auctionDuration, nftParam.redeemFine)
    );
    await waitForTx(
      await lendPoolConfiguratorProxy.connect(poolAdminSigner).setNftRedeemThreshold(asset, nftParam.redeemThreshold)
    );
    await waitForTx(
      await lendPoolConfiguratorProxy.connect(poolAdminSigner).setNftMinBidFine(asset, nftParam.minBidFine)
    );

    console.log("WETHGateway authorizeLendPoolNFT");
    await waitForTx(await wethGateway.authorizeLendPoolNFT([asset]));

    console.log("OK");
  });
