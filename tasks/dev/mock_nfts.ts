import { task } from "hardhat/config";
import { deployAllMockNfts, deployMintableERC721 } from "../../helpers/contracts-deployments";
import { getMintableERC721, getWrappedPunk } from "../../helpers/contracts-getters";
import { registerContractInJsonDb, tryGetContractAddressInDb } from "../../helpers/contracts-helpers";
import { notFalsyOrZeroAddress, waitForTx } from "../../helpers/misc-utils";
import { NftContractId } from "../../helpers/types";
import { MintableERC721 } from "../../types";

const TokenBaseURIs = {
  WPUNKS: "https://wrappedpunks.com:3000/api/punks/metadata/",
  BAYC: "ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/",
  DOODLE: "ipfs://QmPMc4tcBsMqLRuCQtPmPe84bpSjrC3Ky7t3JWuHXYB4aS/",
  COOL: "https://api.coolcatsnft.com/cat/",
  MEEBITS: "https://meebits.larvalabs.com/meebit/1",
  MAYC: "https://boredapeyachtclub.com/api/mutants/",
};

task("dev:deploy-mock-nfts", "Deploy mock nfts for dev enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run("set-DRE");
    await deployAllMockNfts(verify);
  });

task("dev:add-mock-nfts", "Add mock nfts for dev enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run("set-DRE");

    const tokens: { [symbol: string]: MintableERC721 } = {};

    for (const tokenSymbol of Object.keys(NftContractId)) {
      const tokenName = "Bend Mock " + tokenSymbol;
      const contractId = tokenSymbol.toUpperCase();
      const tokenAddress = await tryGetContractAddressInDb(contractId);
      if (tokenAddress != undefined && notFalsyOrZeroAddress(tokenAddress)) {
        continue;
      }
      tokens[tokenSymbol] = await deployMintableERC721([tokenName, tokenSymbol], verify);
      await registerContractInJsonDb(contractId, tokens[tokenSymbol]);
    }
  });

task("dev:set-mock-nfts", "Set mock nfts for dev enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run("set-DRE");

    for (const tokenSymbol of Object.keys(NftContractId)) {
      const contractId = tokenSymbol.toUpperCase();
      if (contractId == "WPUNKS") {
        continue;
      }

      const baseURI = TokenBaseURIs[tokenSymbol];
      if (baseURI == undefined || baseURI == "") {
        continue;
      }

      const tokenAddress = await tryGetContractAddressInDb(contractId);
      if (tokenAddress == undefined || !notFalsyOrZeroAddress(tokenAddress)) {
        continue;
      }

      const tokenContract = await getMintableERC721(tokenAddress);

      console.log(`${tokenSymbol}, ${tokenAddress}, ${baseURI}`);
      await waitForTx(await tokenContract.setBaseURI(baseURI));
    }
  });
