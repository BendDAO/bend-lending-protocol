import { expect } from "chai";
import { makeSuite, TestEnv } from "./helpers/make-suite";
import { ProtocolErrors, eContractid } from "../helpers/types";
import { deployContract, getContract } from "../helpers/contracts-helpers";
import { ZERO_ADDRESS } from "../helpers/constants";
import { getFirstSigner, getBToken, getLendPoolLoanProxy } from "../helpers/contracts-getters";
import { BTokenFactory, LendPoolLoanFactory, LendPoolLoan, BToken } from "../types";

makeSuite("Upgradeability", (testEnv: TestEnv) => {
  const { CALLER_NOT_POOL_ADMIN } = ProtocolErrors;
  let newBTokenInstance: BToken;
  let newLoanInstance: LendPoolLoan;

  before("deploying instances", async () => {
    newBTokenInstance = await new BTokenFactory(await getFirstSigner()).deploy();

    newLoanInstance = await new LendPoolLoanFactory(await getFirstSigner()).deploy();
  });

  it("Tries to update the DAI BToken implementation with a different address than the configuator", async () => {
    const { dai, configurator, users } = testEnv;

    const updateBTokenInputParams: {
      asset: string;
      treasury: string;
      incentivesController: string;
      name: string;
      symbol: string;
      implementation: string;
      params: string;
    } = {
      asset: dai.address,
      treasury: ZERO_ADDRESS,
      incentivesController: ZERO_ADDRESS,
      name: "Bend Market DAI updated",
      symbol: "bDAI",
      implementation: newBTokenInstance.address,
      params: "0x10",
    };
    await expect(configurator.connect(users[1].signer).updateBToken(updateBTokenInputParams)).to.be.revertedWith(
      CALLER_NOT_POOL_ADMIN
    );
  });

  it("Upgrades the DAI BToken implementation ", async () => {
    const { dai, configurator, bDai } = testEnv;

    const updateBTokenInputParams: {
      asset: string;
      treasury: string;
      incentivesController: string;
      name: string;
      symbol: string;
      implementation: string;
      params: string;
    } = {
      asset: dai.address,
      treasury: ZERO_ADDRESS,
      incentivesController: ZERO_ADDRESS,
      name: "Bend Market DAI updated",
      symbol: "bDAI",
      implementation: newBTokenInstance.address,
      params: "0x10",
    };
    await configurator.updateBToken(updateBTokenInputParams);

    const tokenName = await bDai.name();
    expect(tokenName).to.be.eq("Bend Market DAI updated", "Invalid token name");
  });

  it("Tries to update the LendPoolLoan implementation with a different address than the address provider", async () => {
    const { addressesProvider, users } = testEnv;

    await expect(
      addressesProvider.connect(users[1].signer).setLendPoolLoanImpl(newLoanInstance.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("Upgrades the LendPoolLoan implementation ", async () => {
    const { addressesProvider } = testEnv;

    const loanProxyAddressBefore = await addressesProvider.getLendPoolLoan();
    const loanProxyBefore = await getLendPoolLoanProxy(loanProxyAddressBefore);

    await addressesProvider.setLendPoolLoanImpl(newLoanInstance.address);

    const loanProxyAddressAfter = await addressesProvider.getLendPoolLoan();
    const loanProxyAfter = await getLendPoolLoanProxy(loanProxyAddressAfter);

    expect(loanProxyAddressAfter).to.be.eq(loanProxyAddressBefore, "Invalid addresses provider");
  });
});
