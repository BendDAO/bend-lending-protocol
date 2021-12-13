import { task } from "hardhat/config";
import { loadPoolConfig, ConfigNames } from "../../helpers/configuration";
import {
  getCryptoPunksMarket,
  getWrappedPunk,
  getWETHMocked,
  getMintableERC721,
  getMintableERC20,
} from "../../helpers/contracts-getters";
import { verifyContract, getParamPerNetwork } from "../../helpers/contracts-helpers";
import { notFalsyOrZeroAddress } from "../../helpers/misc-utils";
import { eContractid, eNetwork, ICommonConfiguration } from "../../helpers/types";

task("verify:mocks", "Verify mock contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ all, pool }, localDRE) => {
    await localDRE.run("set-DRE");
    const network = localDRE.network.name as eNetwork;
    if (network.includes("main")) {
      throw new Error("Mocks not used at mainnet configuration.");
    }
    const poolConfig = loadPoolConfig(pool);
    const { CryptoPunksMarket, WrappedPunkToken, WrappedNativeToken } = poolConfig as ICommonConfiguration;

    const punkAddress = getParamPerNetwork(CryptoPunksMarket, network);
    const wpunkAddress = getParamPerNetwork(WrappedPunkToken, network);
    const wethAddress = getParamPerNetwork(WrappedNativeToken, network);

    {
      console.log("\n- Verifying Mocked CryptoPunksMarket...\n");
      const punkImpl = await getCryptoPunksMarket(punkAddress);
      await verifyContract(eContractid.CryptoPunksMarket, punkImpl, []);
    }

    {
      console.log("\n- Verifying Mocked WPUNKS...\n");
      const wpunkImpl = await getWrappedPunk(wpunkAddress);
      await verifyContract(eContractid.WrappedPunk, wpunkImpl, [punkAddress]);
    }

    const mockNfts = getParamPerNetwork(poolConfig.NftsAssets, network);
    const mockTokens = getParamPerNetwork(poolConfig.ReserveAssets, network);
    console.log("mockNfts", mockNfts, "mockTokens", mockTokens);

    for (const nftSymbol of Object.keys(mockNfts)) {
      if (nftSymbol == "WPUNKS") {
        continue;
      }
      console.log(`\n- Verifying Mocked ${nftSymbol}...\n`);
      const mockedBAYC = await getMintableERC721(mockNfts[nftSymbol]);
      await verifyContract(eContractid.MintableERC721, mockedBAYC, [
        await mockedBAYC.name(),
        await mockedBAYC.symbol(),
      ]);
    }

    {
      console.log("\n- Verifying Mocked WETH...\n");
      const wethImpl = await getWETHMocked(wethAddress);
      await verifyContract(eContractid.WETHMocked, wethImpl, []);
    }

    for (const tokenSymbol of Object.keys(mockTokens)) {
      if (tokenSymbol == "WETH") {
        continue;
      }
      console.log(`\n- Verifying Mocked ${tokenSymbol}...\n`);
      const mockedDAI = await getMintableERC20(mockTokens[tokenSymbol]);
      await verifyContract(eContractid.MintableERC20, mockedDAI, [
        await mockedDAI.name(),
        await mockedDAI.symbol(),
        (await mockedDAI.decimals()).toString(),
      ]);
    }

    console.log("Finished verifications.");
  });
