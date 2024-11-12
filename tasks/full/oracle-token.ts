import { task } from "hardhat/config";
import {
  getParamPerNetwork,
  insertContractAddressInDb,
  tryGetContractAddressInDb,
} from "../../helpers/contracts-helpers";
import { deployBendUpgradeableProxy, deployTokenOracle } from "../../helpers/contracts-deployments";
import { ICommonConfiguration, eNetwork, eContractid } from "../../helpers/types";
import { waitForTx, notFalsyOrZeroAddress } from "../../helpers/misc-utils";
import { ConfigNames, loadPoolConfig, getGenesisPoolAdmin } from "../../helpers/configuration";
import { getTokenOracle, getBendUpgradeableProxy, getBendProxyAdminById } from "../../helpers/contracts-getters";
import { NFTOracle, BendUpgradeableProxy } from "../../types";
import { BigNumber as BN } from "ethers";

task("full:deploy-oracle-token", "Deploy erc20 token oracle for full enviroment")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addOptionalParam("feedAdmin", "Address of price feed")
  .setAction(async ({ pool, feedAdmin }, DRE) => {
    try {
      await DRE.run("set-DRE");
      await DRE.run("compile");

      const network = <eNetwork>DRE.network.name;
      const poolConfig = loadPoolConfig(pool);

      const proxyAdmin = await getBendProxyAdminById(eContractid.BendV2ProxyAdmin);
      if (proxyAdmin == undefined || !notFalsyOrZeroAddress(proxyAdmin.address)) {
        throw Error("Invalid pool proxy admin in config");
      }
      const proxyAdminOwnerAddress = await proxyAdmin.owner();
      const proxyAdminOwnerSigner = DRE.ethers.provider.getSigner(proxyAdminOwnerAddress);

      if (feedAdmin == undefined || !notFalsyOrZeroAddress(feedAdmin)) {
        feedAdmin = await getGenesisPoolAdmin(poolConfig);
      }

      const tokenOracleAddress = await tryGetContractAddressInDb(eContractid.TokenOracle);

      const tokenOracleImpl = await deployTokenOracle(true);
      const initEncodedData = tokenOracleImpl.interface.encodeFunctionData("initialize", [
        feedAdmin,
        BN.from(2).mul(BN.from(10).pow(7)), //2e7
        BN.from(1).mul(BN.from(10).pow(7)), //1e7
        1800,
        600,
        21600,
        8,
      ]);

      let tokenOracle: NFTOracle;
      let tokenOracleProxy: BendUpgradeableProxy;

      if (tokenOracleAddress != undefined && notFalsyOrZeroAddress(tokenOracleAddress)) {
        console.log("Upgrading exist token oracle proxy to new implementation...");

        await insertContractAddressInDb(eContractid.TokenOracle, tokenOracleAddress);

        tokenOracleProxy = await getBendUpgradeableProxy(tokenOracleAddress);

        // only proxy admin can do upgrading
        await waitForTx(
          await proxyAdmin.connect(proxyAdminOwnerSigner).upgrade(tokenOracleProxy.address, tokenOracleImpl.address)
        );

        tokenOracle = await getTokenOracle(tokenOracleProxy.address);
      } else {
        console.log("Deploying new token oracle proxy & implementation...");

        tokenOracleProxy = await deployBendUpgradeableProxy(
          eContractid.TokenOracle,
          proxyAdmin.address,
          tokenOracleImpl.address,
          initEncodedData,
          true
        );

        tokenOracle = await getTokenOracle(tokenOracleProxy.address);
      }

      console.log("Token Oracle: proxy %s, implementation %s", tokenOracle.address, tokenOracleImpl.address);
    } catch (error) {
      throw error;
    }
  });
