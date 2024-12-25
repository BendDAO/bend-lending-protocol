import { task } from "hardhat/config";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import { eContractid, eNetwork } from "../../helpers/types";
import { deployBendTokenVoting } from "../../helpers/contracts-deployments";

task("helpers:deploy-bendtoken-voting", "Deploy new voting contract")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("bend", "Address of BEND token contract")
  .addParam("vebend", "Address of veBEND token contract")
  .setAction(async ({ pool, bend, vebend }, DRE) => {
    console.log("set-DRE");
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);

    console.log("deployBendTokenVoting");
    const voting = await deployBendTokenVoting(bend, vebend, true);
    console.log("BendTokenVoting address:", voting.address);
  });
