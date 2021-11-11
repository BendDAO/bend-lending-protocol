import { task } from "hardhat/config";
import { loadPoolConfig, ConfigNames } from "../../helpers/configuration";
import {
  getCryptoPunksMarket,
  getWrappedPunk,
  getWETHMocked,
  getAllMockedNfts,
  getAllMockedTokens,
} from "../../helpers/contracts-getters";
import { verifyContract, getParamPerNetwork } from "../../helpers/contracts-helpers";
import { notFalsyOrZeroAddress } from "../../helpers/misc-utils";
import { eContractid, eNetwork, ICommonConfiguration } from "../../helpers/types";

task("verify:mocks", "Verify mock contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ all, pool }, localDRE) => {
    await localDRE.run("set-DRE");
    const network = localDRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const { CryptoPunksMarket, WrappedPunkToken, WrappedNativeToken } = poolConfig as ICommonConfiguration;

    const punkAddress = getParamPerNetwork(CryptoPunksMarket, network);
    const wpunkAddress = getParamPerNetwork(WrappedPunkToken, network);
    const wethAddress = getParamPerNetwork(WrappedNativeToken, network);

    const punkImpl = await getCryptoPunksMarket(punkAddress);
    const wpunkImpl = await getWrappedPunk(wpunkAddress);
    const wethImpl = await getWETHMocked(wethAddress);

    console.log("\n- Verifying CryptoPunksMarket...\n");
    await verifyContract(eContractid.CryptoPunksMarket, punkImpl, []);

    console.log("\n- Verifying WrappedPunk...\n");
    await verifyContract(eContractid.WrappedPunk, wpunkImpl, [punkImpl.address]);

    console.log("\n- Verifying WETHMocked...\n");
    await verifyContract(eContractid.WETHMocked, wethImpl, []);

    const mockNfts = await getAllMockedNfts();
    {
      console.log("\n- Verifying Mocked BAYC...\n");
      const mockedBAYC = mockNfts["BAYC"];
      await verifyContract(eContractid.MintableERC721, mockedBAYC, [
        await mockedBAYC.name(),
        await mockedBAYC.symbol(),
      ]);
    }

    const mockTokens = await getAllMockedTokens();
    {
      console.log("\n- Verifying Mocked DAI...\n");
      const mockedDAI = mockTokens["DAI"];
      await verifyContract(eContractid.MintableERC20, mockedDAI, [
        await mockedDAI.name(),
        await mockedDAI.symbol(),
        (await mockedDAI.decimals()).toString(),
      ]);
    }
    {
      console.log("\n- Verifying Mocked USDC...\n");
      const mockedUSDC = mockTokens["USDC"];
      await verifyContract(eContractid.MintableERC20, mockedUSDC, [
        await mockedUSDC.name(),
        await mockedUSDC.symbol(),
        (await mockedUSDC.decimals()).toString(),
      ]);
    }

    console.log("Finished verifications.");
  });
