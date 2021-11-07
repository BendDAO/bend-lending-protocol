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
  PUNK: "0x292F693048208184320C01e0C223D624268e5EE7", //Not ERC721
  WPUNK: "0x57D3B7C7962F8d9E9acAf055472deC111ebBdA0c", //ERC721
  BAYC: "0x2e308F03bFd57B1b36570aDC710C6A130C27366E", //ERC721

  DAI: "0x19063932dF866BbA02Eef150e9371d168253243C", //ERC20
  USDC: "0xAC4aDe046140E9D45D47BB2B2eB40c23D167ed92", //ERC20
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
    await waitForTx(await cryptoPunksMarket.allInitialOwnersAssigned());

    for (let punkIndex = index; punkIndex < index + amount; punkIndex++) {
      console.log("Mint PUNK:", punkIndex);
      await waitForTx(await cryptoPunksMarket.getPunk(punkIndex));
      await waitForTx(await cryptoPunksMarket.transferPunk(user, punkIndex));
    }
    console.log("PUNK Balances:", (await cryptoPunksMarket.balanceOf(user)).toString());

    //const wpunk = await getWrappedPunk(MockAddresses.WPUNK);
    //await waitForTx(await wpunk.registerProxy());

    //const wpunk = await getMintableERC721(MockAddresses.WPUNK);
    //await waitForTx(await wpunk.setBaseURI("https://wrappedpunks.com:3000/api/punks/metadata/"));

    // BAYC
    const bayc = await getMintableERC721(MockAddresses.BAYC);
    //await waitForTx(await bayc.setBaseURI("ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/"));
    for (let tokenIndex = 0; tokenIndex < index + amount; tokenIndex++) {
      console.log("Mint BAYC:", tokenIndex);
      await waitForTx(await bayc.mint(tokenIndex));
      await waitForTx(await bayc.transferFrom(deployerAddress, user, tokenIndex));
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
