import { task } from "hardhat/config";
import { printContracts } from "../../helpers/misc-utils";

task("print-contracts", "Print all contracts").setAction(async ({}, localBRE) => {
  await localBRE.run("set-DRE");
  printContracts();
});
