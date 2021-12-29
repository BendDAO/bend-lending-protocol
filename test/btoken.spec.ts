import { APPROVAL_AMOUNT_LENDING_POOL, MAX_UINT_AMOUNT, ZERO_ADDRESS } from "../helpers/constants";
import { convertToCurrencyDecimals } from "../helpers/contracts-helpers";
import { expect } from "chai";
import { ethers } from "ethers";
import { ProtocolErrors } from "../helpers/types";
import { makeSuite, TestEnv } from "./helpers/make-suite";
import { CommonsConfig } from "../markets/bend/commons";
import { waitForTx } from "../helpers/misc-utils";

makeSuite("BToken", (testEnv: TestEnv) => {
  const { INVALID_FROM_BALANCE_AFTER_TRANSFER, INVALID_TO_BALANCE_AFTER_TRANSFER } = ProtocolErrors;

  afterEach("Reset", () => {
    testEnv.mockIncentivesController.resetHandleActionIsCalled();
  });

  it("Check DAI basic parameters", async () => {
    const { dai, bDai, pool } = testEnv;

    const symbol = await dai.symbol();
    const bSymbol = await bDai.symbol();
    expect(bSymbol).to.be.equal(CommonsConfig.BTokenSymbolPrefix + symbol);

    //const name = await dai.name();
    const bName = await bDai.name();
    expect(bName).to.be.equal(CommonsConfig.BTokenNamePrefix + " " + symbol);

    const decimals = await dai.decimals();
    const bDecimals = await bDai.decimals();
    expect(decimals).to.be.equal(bDecimals);

    const treasury = await bDai.RESERVE_TREASURY_ADDRESS();
    expect(treasury).to.be.not.equal(ZERO_ADDRESS);

    const underAsset = await bDai.UNDERLYING_ASSET_ADDRESS();
    expect(underAsset).to.be.equal(dai.address);

    const wantPool = await bDai.POOL();
    expect(wantPool).to.be.equal(pool.address);
  });

  it("User 0 deposits 1000 DAI, transfers bDAI to user 1", async () => {
    const { users, pool, dai, bDai } = testEnv;

    await dai.connect(users[0].signer).mint(await convertToCurrencyDecimals(dai.address, "1000"));

    await dai.connect(users[0].signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 1 deposits 1000 DAI
    const amountDeposit = await convertToCurrencyDecimals(dai.address, "1000");

    await pool.connect(users[0].signer).deposit(dai.address, amountDeposit, users[0].address, "0");

    await waitForTx(await testEnv.mockIncentivesController.resetHandleActionIsCalled());

    await bDai.connect(users[0].signer).transfer(users[1].address, amountDeposit);

    const checkResult = await testEnv.mockIncentivesController.checkHandleActionIsCalled();
    await waitForTx(await testEnv.mockIncentivesController.resetHandleActionIsCalled());
    expect(checkResult).to.be.equal(true, "IncentivesController not called");

    const fromBalance = await bDai.balanceOf(users[0].address);
    const toBalance = await bDai.balanceOf(users[1].address);

    expect(fromBalance.toString()).to.be.equal("0", INVALID_FROM_BALANCE_AFTER_TRANSFER);
    expect(toBalance.toString()).to.be.equal(amountDeposit.toString(), INVALID_TO_BALANCE_AFTER_TRANSFER);
  });

  it("User 1 receive bDAI from user 0, transfers 50% to user 2", async () => {
    const { users, pool, dai, bDai } = testEnv;

    const amountTransfer = (await bDai.balanceOf(users[1].address)).div(2);

    await bDai.connect(users[1].signer).transfer(users[2].address, amountTransfer);

    const fromBalance = await bDai.balanceOf(users[1].address);
    const toBalance = await bDai.balanceOf(users[2].address);

    expect(fromBalance.toString()).to.be.equal(amountTransfer.toString(), INVALID_FROM_BALANCE_AFTER_TRANSFER);
    expect(toBalance.toString()).to.be.equal(amountTransfer.toString(), INVALID_TO_BALANCE_AFTER_TRANSFER);

    await bDai.totalSupply();
    await bDai.getScaledUserBalanceAndSupply(users[1].address);
  });
});
