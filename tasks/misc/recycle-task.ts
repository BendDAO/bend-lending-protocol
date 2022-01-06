import BigNumber from "bignumber.js";
import { task } from "hardhat/config";
import { ConfigNames } from "../../helpers/configuration";
import { oneEther } from "../../helpers/constants";
import {
  getAllMockedNfts,
  getAllMockedTokens,
  getBToken,
  getDeploySigner,
  getLendPool,
  getLendPoolAddressesProvider,
  getMintableERC721,
  getWETHGateway,
  getWETHMocked,
} from "../../helpers/contracts-getters";
import { getContractAddressInDb, getEthersSigners } from "../../helpers/contracts-helpers";
import { waitForTx } from "../../helpers/misc-utils";

task("dev:recycle-pool-eths", "Doing recycle all ETHs in pool task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("id", "id of BAYC token")
  .addParam("to", "Address of target user")
  .setAction(async ({ pool, id, to }, DRE) => {
    await DRE.run("set-DRE");

    const deployerSigner = await getDeploySigner();
    const deployerAddress = await deployerSigner.getAddress();

    const addressesProvider = await getLendPoolAddressesProvider();
    const lendPool = await getLendPool();
    const weth = await getWETHMocked();
    const wethGateway = await getWETHGateway();

    const wethReserveData = await lendPool.getReserveData(weth.address);
    const bwethToken = await getBToken(wethReserveData.bTokenAddress);
    const availableBalance = await weth.balanceOf(bwethToken.address);
    console.log("Available Balance:", availableBalance.toString());
    if (new BigNumber(availableBalance.toString()).lt(oneEther.div(100))) {
      return;
    }

    const baycAddress = await getContractAddressInDb("BAYC");
    const bayc = await getMintableERC721(baycAddress);
    await waitForTx(await bayc.mint(id));

    const approved = await bayc.isApprovedForAll(deployerAddress, wethGateway.address);
    if (!approved) {
      await waitForTx(await bayc.setApprovalForAll(wethGateway.address, true));
    }

    await waitForTx(await wethGateway.borrowETH(availableBalance, bayc.address, id, to, "0"));
  });

task("dev:recycle-signer-tokens", "Doing recycle all ETHs and Tokens in signers")
  .addParam("to", "Address of target user")
  .setAction(async ({ to }, DRE) => {
    await DRE.run("set-DRE");

    const deployerSigner = await getDeploySigner();
    const deployerAddress = await deployerSigner.getAddress();

    const allSigners = await getEthersSigners();

    console.log("Recycle all ERC20s");
    for (const signer of allSigners) {
      const signerAddress = await signer.getAddress();
      if (signerAddress == deployerAddress) {
        continue;
      }

      const allMockERC20s = await getAllMockedTokens();
      for (const erc20Symbol of Object.keys(allMockERC20s)) {
        console.log("Recycle ERC20:", signerAddress, erc20Symbol);
        const erc20Token = allMockERC20s[erc20Symbol];
        const tokenBalance = await erc20Token.balanceOf(signerAddress);
        if (tokenBalance.gt(0)) {
          console.log("ERC20 Balance:", tokenBalance.toString());
          await waitForTx(await erc20Token.connect(signer).transfer(to, tokenBalance));
        }
      }
    }

    console.log("Recycle all ERC721s");
    for (const signer of allSigners) {
      const signerAddress = await signer.getAddress();
      if (signerAddress == deployerAddress) {
        continue;
      }

      const allMockNfts = await getAllMockedNfts();
      for (const nftSymbol of Object.keys(allMockNfts)) {
        console.log("Recycle ERC721:", signerAddress, nftSymbol);
        const nftToken = allMockNfts[nftSymbol];
        const tokenBalance = (await nftToken.balanceOf(signerAddress)).toNumber();
        for (let index = 0; index < tokenBalance; index++) {
          const tokenId = await nftToken.tokenOfOwnerByIndex(signerAddress, index);
          console.log("ERC721 Token:", tokenId.toString());
          await waitForTx(await nftToken.connect(signer).transferFrom(signerAddress, to, tokenId));
        }
      }
    }

    console.log("Recycle all ETHs");
    for (const signer of allSigners) {
      const signerAddress = await signer.getAddress();
      if (signerAddress == deployerAddress) {
        continue;
      }
      console.log("Recycle ETH:", signerAddress);

      const ethBalance = await signer.getBalance();
      if (ethBalance.gt(0)) {
        console.log("ETH Balance:", ethBalance.toString());

        const gasPrice = await signer.getGasPrice();
        const gasLimit = 21000;
        const ethSend = ethBalance.sub(gasPrice.mul(gasLimit));
        if (ethSend.gt(0)) {
          waitForTx(
            await signer.sendTransaction({
              to: to,
              value: ethSend,
              gasPrice: gasPrice,
              gasLimit: gasLimit,
            })
          );
        }
      }
    }
  });
