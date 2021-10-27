import { task } from "hardhat/config";
import { DRE, setDRE } from "../../helpers/misc-utils";
import { HardhatRuntimeEnvironment } from "hardhat/types";

task(`set-DRE`, `Inits the DRE, to have access to all the plugins' objects`).setAction(async (_, _DRE) => {
  if (DRE) {
    return;
  }

  console.log("- Enviroment");
  if (process.env.FORK) {
    console.log("  - Fork Mode activated at network: ", process.env.FORK);
    if (_DRE?.config?.networks?.hardhat?.forking?.url) {
      console.log("  - Provider URL:", _DRE.config.networks.hardhat.forking?.url?.split("/")[2]);
    } else {
      console.error(
        `[FORK][Error], missing Provider URL for "${_DRE.network.name}" network. Fill the URL at './helper-hardhat-config.ts' file`
      );
    }
  }
  console.log("  - Network :", _DRE.network.name);

  setDRE(_DRE);
  return _DRE;
});
