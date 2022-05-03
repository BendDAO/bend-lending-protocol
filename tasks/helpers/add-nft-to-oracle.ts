import { BigNumberish } from "@ethersproject/bignumber";
import { task } from "hardhat/config";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import { getIErc721Detailed, getLendPoolAddressesProvider, getNFTOracle } from "../../helpers/contracts-getters";
import { getEthersSignerByAddress } from "../../helpers/contracts-helpers";
import { getNowTimeInSeconds, notFalsyOrZeroAddress, waitForTx } from "../../helpers/misc-utils";
import { eContractid, eNetwork } from "../../helpers/types";
import { strategyNftParams } from "../../markets/bend/nftsConfigs";

task("add-nft-to-oracle", "Add new nft asset to oracle")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("asset", "Address of underlying nft asset contract")
  .setAction(async ({ pool, asset, strategy }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);

    const addressesProvider = await getLendPoolAddressesProvider();

    const nftOracle = await getNFTOracle(await addressesProvider.getNFTOracle());
    const ownerSigner = await getEthersSignerByAddress(await nftOracle.owner());
    const adminSigner = await getEthersSignerByAddress(await nftOracle.priceFeedAdmin());

    const isExisted = await nftOracle.nftPriceFeedMap(asset);
    if (isExisted) {
      throw Error("Asset existed in oracle already");
    }

    const nftContract = await getIErc721Detailed(asset);
    const nftSymbol = await nftContract.symbol();

    const nftPrice = poolConfig.Mocks.AllNftsInitialPrices[nftSymbol];
    if (nftPrice == undefined) {
      throw Error("Invalid nft init price in pool config");
    }

    await waitForTx(await nftOracle.connect(ownerSigner).addAsset(asset));

    //const latestTime = await getNowTimeInSeconds();
    //await waitForTx(await nftOracle.connect(adminSigner).setAssetData(asset, nftPrice));

    console.log("OK");
  });
