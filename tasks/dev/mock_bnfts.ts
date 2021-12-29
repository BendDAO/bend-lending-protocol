import { task } from "hardhat/config";
import { notFalsyOrZeroAddress, waitForTx } from "../../helpers/misc-utils";
import { eContractid, tEthereumAddress, BendPools } from "../../helpers/types";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import {
  deployBNFTRegistry,
  deployGenericBNFTImpl,
  deployBendUpgradeableProxy,
} from "../../helpers/contracts-deployments";
import {
  getLendPoolAddressesProvider,
  getBNFTRegistryProxy,
  getBendProxyAdminById,
  getConfigMockedNfts,
  getProxyAdminSigner,
} from "../../helpers/contracts-getters";
import { MintableERC721 } from "../../types";

task("dev:deploy-mock-bnft-registry", "Deploy bnft registry for dev enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run("set-DRE");

    const proxyAdminAddress = await (await getProxyAdminSigner()).getAddress();

    const poolConfig = loadPoolConfig(pool);

    const bnftGenericImpl = await deployGenericBNFTImpl(verify);

    const bnftRegistryImpl = await deployBNFTRegistry(verify);

    const initEncodedData = bnftRegistryImpl.interface.encodeFunctionData("initialize", [
      bnftGenericImpl.address,
      poolConfig.Mocks.BNftNamePrefix,
      poolConfig.Mocks.BNftSymbolPrefix,
    ]);

    const bnftRegistryProxy = await deployBendUpgradeableProxy(
      eContractid.BNFTRegistry,
      proxyAdminAddress,
      bnftRegistryImpl.address,
      initEncodedData,
      verify
    );
  });

task("dev:deploy-mock-bnft-tokens", "Deploy bnft tokens for dev enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run("set-DRE");

    const poolConfig = loadPoolConfig(pool);

    const bnftRegistryProxy = await getBNFTRegistryProxy();

    const mockedNfts = await getConfigMockedNfts(poolConfig);

    for (const [nftSymbol, mockedNft] of Object.entries(mockedNfts) as [string, MintableERC721][]) {
      await waitForTx(await bnftRegistryProxy.createBNFT(mockedNft.address));
      const { bNftProxy } = await bnftRegistryProxy.getBNFTAddresses(mockedNft.address);
      console.log("BNFT Token:", nftSymbol, bNftProxy);
    }
  });
