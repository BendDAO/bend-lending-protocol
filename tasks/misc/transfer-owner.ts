import { task } from "hardhat/config";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import { getDeploySigner, getLendPoolAddressesProvider } from "../../helpers/contracts-getters";
import { getEthersSignerByAddress } from "../../helpers/contracts-helpers";
import { waitForTx } from "../../helpers/misc-utils";
import { eNetwork } from "../../helpers/types";
import { OwnableFactory } from "../../types/OwnableFactory";

task("dev:transfer-owner", "Transfer ownership")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("contract", "Contract address")
  .addParam("target", "Target owner address")
  .setAction(async ({ verify, pool, contract, target }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();

    const contractInst = OwnableFactory.connect(contract, await getDeploySigner());
    const currentOwnerAddress = await contractInst.owner();
    console.log("Current Owner Address:", currentOwnerAddress, "Target Owner Address:", target);

    const currentOwnerSigner = await getEthersSignerByAddress(currentOwnerAddress);
    await waitForTx(await contractInst.connect(currentOwnerSigner).transferOwnership(target));
  });
