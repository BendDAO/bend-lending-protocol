import { entropyToMnemonic, getAccountPath } from "@ethersproject/hdnode";
import { formatEther } from "@ethersproject/units";
import { Wallet } from "@ethersproject/wallet";
import { task } from "hardhat/config";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import { getEthersSigners } from "../../helpers/contracts-helpers";

task("print-accounts", "Print accounts").setAction(async ({}, DRE) => {
  await DRE.run("set-DRE");

  const allSigners = await getEthersSigners();
  let index = 0;
  for (const signer of allSigners) {
    const address = await signer.getAddress();
    const balance = formatEther(await signer.getBalance());
    console.log("index:", index, "address:", address, "balance:", balance);
    index++;
  }
});

task("generate-accounts", "Generate accounts by mnemonic or random").setAction(async ({}, DRE) => {
  await DRE.run("set-DRE");
  const mnemonic = process.env.MNEMONIC;

  if (mnemonic != undefined && mnemonic != "") {
    console.log("Generating accounts by mnemonic:");
    for (let index = 0; index < 20; index++) {
      const mpath = "m/44'/60'/0'/0/" + index.toString();
      const wallet = Wallet.fromMnemonic(mnemonic, mpath);
      console.log(
        "index:",
        index,
        "address:",
        wallet.address,
        "privateKey:",
        wallet.privateKey,
        "publicKey:",
        wallet.publicKey
      );
    }
  } else {
    console.log("Generating accounts by random:");
    for (let index = 0; index < 20; index++) {
      const wallet = Wallet.createRandom();
      console.log(
        "index:",
        index,
        "address:",
        wallet.address,
        "privateKey:",
        wallet.privateKey,
        "publicKey:",
        wallet.publicKey
      );
    }
  }
});

task("generate-mnemonics", "Generate mnemonics").setAction(async ({}, DRE) => {
  await DRE.run("set-DRE");

  for (let index = 0; index < 20; index++) {
    let randomBytes = DRE.ethers.utils.randomBytes(16);
    let mnemonic = entropyToMnemonic(randomBytes);
    console.log("index:", index, "mnemonic:", mnemonic);
  }
});
