import { task } from "hardhat/config";
import { ConfigNames } from "../../helpers/configuration";
import { getBNFTRegistryProxy, getLendPoolAddressesProvider } from "../../helpers/contracts-getters";
import { waitForTx } from "../../helpers/misc-utils";

task("create-new-bnft", "Create BNFT for new nft asset")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("asset", "Address of underlying nft asset contract")
  .setAction(async ({ pool, asset }, DRE) => {
    await DRE.run("set-DRE");

    const addressesProvider = await getLendPoolAddressesProvider();

    const bnftRegistryProxyAddress = await addressesProvider.getBNFTRegistry();
    const bnftRegistry = await getBNFTRegistryProxy(bnftRegistryProxyAddress);
    await waitForTx(await bnftRegistry.createBNFT(asset, []));

    const { bNftProxy } = await bnftRegistry.getBNFTAddresses(asset);
    console.log("Created new bnft, address:", bNftProxy);
  });
