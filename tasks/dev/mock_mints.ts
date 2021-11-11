import { task } from "hardhat/config";
import { eNetwork, eContractid } from "../../helpers/types";
import {
  getCryptoPunksMarket,
  getFirstSigner,
  getMintableERC20,
  getMintableERC721,
  getWrappedPunk,
} from "../../helpers/contracts-getters";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import { convertToCurrencyDecimals, convertToCurrencyUnits, getParamPerNetwork } from "../../helpers/contracts-helpers";
import { waitForTx } from "../../helpers/misc-utils";

const MockAddresses = {
  PUNK: "0x6AB60B1E965d9Aa445d637Ac5034Eba605FF0b82", //Not ERC721
  WPUNK: "0xBe410D495B843e4874a029580B7eAA6F3611107B", //ERC721
  BAYC: "0x6f9a28ACE211122CfD6f115084507b44FDBc12C7", //ERC721

  DAI: "0x28E0bd32f9B1c5060A1F8498e1c1EDa585F09162", //ERC20
  USDC: "0xB2428A65347eF2954e58e186f7adab951C0a3A6f", //ERC20
};

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

    const deployerSigner = await getFirstSigner();
    const deployerAddress = await deployerSigner.getAddress();

    // PUNK
    const cryptoPunksMarket = await getCryptoPunksMarket(MockAddresses.PUNK);
    if (index <= 1) {
      // first time to open market to public
      await waitForTx(await cryptoPunksMarket.allInitialOwnersAssigned());
    }

    // for (let punkIndex = Number(index); punkIndex < Number(index) + Number(amount); punkIndex++) {
    //   console.log("Mint PUNK:", punkIndex);
    //   await waitForTx(await cryptoPunksMarket.getPunk(punkIndex));
    //   await waitForTx(await cryptoPunksMarket.transferPunk(user, punkIndex));
    // }
    // console.log("PUNK Balances:", (await cryptoPunksMarket.balanceOf(user)).toString());

    //const wpunk = await getWrappedPunk(MockAddresses.WPUNK);
    //await waitForTx(await wpunk.registerProxy());

    // BAYC
    const bayc = await getMintableERC721(MockAddresses.BAYC);
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

    const deployerSigner = await getFirstSigner();
    const deployerAddress = await deployerSigner.getAddress();

    // DAI
    const dai = await getMintableERC20(MockAddresses.DAI);
    const daiAmountToMint = await convertToCurrencyDecimals(dai.address, amount);
    await waitForTx(await dai.mint(daiAmountToMint));
    await waitForTx(await dai.transfer(user, daiAmountToMint));
    console.log("DAI Balances:", (await dai.balanceOf(user)).toString());

    // USDC
    const usdc = await getMintableERC20(MockAddresses.USDC);
    const usdcAmountToMint = await convertToCurrencyDecimals(usdc.address, amount);
    await waitForTx(await usdc.mint(usdcAmountToMint));
    await waitForTx(await usdc.transfer(user, usdcAmountToMint));
    console.log("USDC Balances:", (await dai.balanceOf(user)).toString());
  });
