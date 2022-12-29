import { task } from "hardhat/config";
import { deployPausableTimelockController } from "../../helpers/contracts-deployments";
import { eNetwork } from "../../helpers/types";

task("deploy:pausable-timelock", "Doing timelock admin task")
  .addParam("id", "Contract ID")
  .addParam("mindelay", "Minimum delay in seconds")
  .addParam("proposers", "Addresses of proposers")
  .addParam("executors", "Addresses of executors")
  .addParam("pausers", "Addresses of pausers")
  .addParam("admin", "Account of admin")
  .setAction(async ({ id, mindelay, proposers, executors, pausers, admin }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;

    const proposerList = new String(proposers).split(",");
    const executorList = new String(executors).split(",");
    const pauserList = new String(pausers).split(",");

    if (id == "" || id == undefined) {
      id = "PausableTimelockController" + mindelay;
    }

    const timelock = await deployPausableTimelockController(
      id,
      mindelay,
      proposerList,
      executorList,
      pauserList,
      admin,
      true
    );

    console.log("id:", id, timelock.address);
  });
