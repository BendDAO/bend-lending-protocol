import { task } from "hardhat/config";
import { eNetwork, eContractid } from "../../helpers/types";
import {
  getCryptoPunksMarket,
  getDeploySigner,
  getMintableERC20,
  getMintableERC721,
  getWrappedPunk,
} from "../../helpers/contracts-getters";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import {
  convertToCurrencyDecimals,
  convertToCurrencyUnits,
  getContractAddressInDb,
  getParamPerNetwork,
} from "../../helpers/contracts-helpers";
import { waitForTx } from "../../helpers/misc-utils";

task("dev:mint-mock-nfts", "Mint mock nfts for dev enviroment")
  .addParam("index", "NFT Index of start")
  .addParam("amount", "NFT Amount (<=10)")
  .addParam("user", "Targe user address")
  .setAction(async ({ index, amount, user }, DRE) => {
    await DRE.run("set-DRE");
    const network = <eNetwork>DRE.network.name;
    if (network.includes("main")) {
      throw new Error("Mint mock not used at mainnet configuration.");
    }

    const deployerSigner = await getDeploySigner();
    const deployerAddress = await deployerSigner.getAddress();

    // PUNK
    const cryptoPunksMarket = await getCryptoPunksMarket();
    if (index <= 1) {
      // first time to open market to public
      await waitForTx(await cryptoPunksMarket.allInitialOwnersAssigned());
    }

    for (let punkIndex = Number(index); punkIndex < Number(index) + Number(amount); punkIndex++) {
      console.log("Mint PUNK:", punkIndex);
      await waitForTx(await cryptoPunksMarket.getPunk(punkIndex));
      await waitForTx(await cryptoPunksMarket.transferPunk(user, punkIndex));
    }
    console.log("PUNK Balances:", (await cryptoPunksMarket.balanceOf(user)).toString());

    //const wpunkAddress = await getContractAddressInDb("WPUNK");
    //const wpunk = await getWrappedPunk(wpunkAddress);
    //await waitForTx(await wpunk.registerProxy());

    // BAYC
    const baycAddress = await getContractAddressInDb("BAYC");
    const bayc = await getMintableERC721(baycAddress);
    if (index <= 1) {
      // first time to set base uri
      await waitForTx(await bayc.setBaseURI("ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/"));
    }
    for (let tokenIndex = Number(index); tokenIndex < Number(index) + Number(amount); tokenIndex++) {
      console.log("Mint BAYC:", tokenIndex);
      await waitForTx(await bayc.mint(tokenIndex));
      await waitForTx(await bayc["safeTransferFrom(address,address,uint256)"](deployerAddress, user, tokenIndex));
    }
    console.log("BAYC Balances:", (await bayc.balanceOf(user)).toString());
  });

task("dev:mint-mock-reserves", "Mint mock reserves for dev enviroment")
  .addParam("amount", "Token Amount without decimals (<=1000000)")
  .addParam("user", "Targe user address")
  .setAction(async ({ amount, user }, DRE) => {
    await DRE.run("set-DRE");
    const network = <eNetwork>DRE.network.name;
    if (network.includes("main")) {
      throw new Error("Mint mock not used at mainnet configuration.");
    }

    const deployerSigner = await getDeploySigner();
    const deployerAddress = await deployerSigner.getAddress();

    // DAI
    const daiAddress = await getContractAddressInDb("DAI");
    const dai = await getMintableERC20(daiAddress);
    const daiAmountToMint = await convertToCurrencyDecimals(dai.address, amount);
    await waitForTx(await dai.mint(daiAmountToMint));
    await waitForTx(await dai.transfer(user, daiAmountToMint));
    console.log("DAI Balances:", (await dai.balanceOf(user)).toString());

    // USDC
    const usdcAddress = await getContractAddressInDb("USDC");
    const usdc = await getMintableERC20(usdcAddress);
    const usdcAmountToMint = await convertToCurrencyDecimals(usdc.address, amount);
    await waitForTx(await usdc.mint(usdcAmountToMint));
    await waitForTx(await usdc.transfer(user, usdcAmountToMint));
    console.log("USDC Balances:", (await dai.balanceOf(user)).toString());
  });
