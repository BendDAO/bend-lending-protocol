import { task } from "hardhat/config";
import { waitForTx } from "../../helpers/misc-utils";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import {
  getBNFTRegistryProxy,
  getLendPoolAddressesProvider,
  getConfigMockedNfts,
} from "../../helpers/contracts-getters";
import { MintableERC721 } from "../../types/MintableERC721";

task("dev:deploy-bnft-tokens", "Deploy bnft tokens for dev enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run("set-DRE");

    const poolConfig = loadPoolConfig(pool);

    const bnftRegistryProxy = await getBNFTRegistryProxy();

    const mockedNfts = await getConfigMockedNfts(poolConfig);

    for (const [nftSymbol, mockedNft] of Object.entries(mockedNfts) as [string, MintableERC721][]) {
      await waitForTx(await bnftRegistryProxy.createBNFT(mockedNft.address, []));
    }
  });
