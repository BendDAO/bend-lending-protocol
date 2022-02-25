import { BigNumberish, Signer } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { task } from "hardhat/config";
import { MOCK_NFT_BASE_URIS } from "../../helpers/constants";
import { deployAllMockNfts, deployMintableERC721 } from "../../helpers/contracts-deployments";
import { getDeploySigner, getCryptoPunksMarket, getMintableERC721 } from "../../helpers/contracts-getters";
import {
  getContractAddressInDb,
  getEthersSigners,
  registerContractInJsonDb,
  tryGetContractAddressInDb,
} from "../../helpers/contracts-helpers";
import { notFalsyOrZeroAddress, waitForTx } from "../../helpers/misc-utils";
import { NftContractId } from "../../helpers/types";
import { MintableERC721 } from "../../types";

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
      console.log(`Symbol: ${tokenSymbol}, Address: ${tokens[tokenSymbol]}`);
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

      const baseURI = MOCK_NFT_BASE_URIS[tokenSymbol];
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

task("dev:mint-top-punks", "Mint top sale punks for dev enviroment")
  .addParam("target", "Address of target user")
  .addParam("ids", "Indexs of Punk")
  .setAction(async ({ target, ids }, localBRE) => {
    await localBRE.run("set-DRE");

    const punks = await getCryptoPunksMarket();

    const idSplits = new String(ids).split(",");

    const topSalePunkIndexs = idSplits;

    let topSalePunkOwners: string[] = [];
    for (const punkIndex of topSalePunkIndexs) {
      topSalePunkOwners.push(target);
    }

    console.log("Total Minted CryptoPunks: %d", topSalePunkIndexs.length);
    await waitForTx(await punks.setInitialOwners(topSalePunkOwners, topSalePunkIndexs));
    console.log("Total Balance of Target: %d", punks.balanceOf(target));
  });

task("dev:mint-top-tokens", "Mint top sale tokens for dev enviroment")
  .addParam("symbol", "Token symbol of ERC721")
  .addParam("target", "Address of target user")
  .addParam("ids", "Token ids of ERC721")
  .setAction(async ({ symbol, ids, target }, localBRE) => {
    await localBRE.run("set-DRE");

    const deployerSigner = await getDeploySigner();
    const allSingers = await getEthersSigners();

    const tokenAddress = await getContractAddressInDb(symbol);
    const erc721Token = await getMintableERC721(tokenAddress);

    const idSplits = new String(ids).split(",");

    const topSaleTokenIds: BigNumberish[] = idSplits;

    console.log("Deployer Balance:", (await deployerSigner.getBalance()).toString());
    console.log("Total Minted Tokens: %d", topSaleTokenIds.length);

    let minterIndex: number = 0;
    let minterSigner: Signer = allSingers[0];
    let minterAddress: string = "";
    let minterLimit: number = -1;
    const minBalance = parseEther("0.1");
    for (const tokenId of topSaleTokenIds) {
      console.log("Try to mint token: %d", tokenId);

      if (minterLimit < 0 || minterLimit >= 10) {
        for (; minterIndex < allSingers.length; minterIndex++) {
          minterSigner = allSingers[minterIndex];
          minterAddress = await minterSigner.getAddress();
          const tmpLimit = (await erc721Token.mintCounts(minterAddress)).toNumber();
          if (tmpLimit < 10) {
            minterLimit = tmpLimit;
            break;
          }
          console.log("Minter reach limit:", minterIndex, minterAddress);
        }
        if (minterIndex == allSingers.length) {
          break;
        }

        const minterBalance = await minterSigner.getBalance();
        if (minterBalance.lt(minBalance)) {
          waitForTx(
            await deployerSigner.sendTransaction({
              to: minterAddress,
              value: parseEther("0.5"),
            })
          );
        }
        console.log("Minter balance:", (await minterSigner.getBalance()).toString());
      }

      let tokenOwner: string;
      try {
        tokenOwner = await erc721Token.ownerOf(tokenId);
        if (tokenOwner == minterAddress) {
          await waitForTx(await erc721Token.connect(minterSigner).transferFrom(minterAddress, target, tokenId));
        } else {
          console.log("Token owner is not our:", tokenOwner);
        }
      } catch {
        await waitForTx(await erc721Token.connect(minterSigner).mint(tokenId));
        await waitForTx(await erc721Token.connect(minterSigner).transferFrom(minterAddress, target, tokenId));
        minterLimit++;
      }
    }

    console.log("Total Balance of Target: %d", await erc721Token.balanceOf(target));
  });
