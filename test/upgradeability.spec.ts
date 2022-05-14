import { expect } from "chai";
import { makeSuite, TestEnv } from "./helpers/make-suite";
import { ProtocolErrors, eContractid } from "../helpers/types";
import { deployContract, getContract } from "../helpers/contracts-helpers";
import { MAX_UINT_AMOUNT, ZERO_ADDRESS } from "../helpers/constants";
import {
  getDeploySigner,
  getBToken,
  getLendPoolLoanProxy,
  getDebtToken,
  getBendUpgradeableProxy,
} from "../helpers/contracts-getters";
import { BTokenFactory, LendPoolLoanFactory, LendPoolLoan, BToken, DebtToken, DebtTokenFactory } from "../types";
import { BytesLike } from "@ethersproject/bytes";

makeSuite("Upgradeability", (testEnv: TestEnv) => {
  const { CALLER_NOT_POOL_ADMIN } = ProtocolErrors;
  let debtDai: DebtToken;
  let newBTokenInstance: BToken;
  let newDebtTokenInstance: DebtToken;
  let newLoanInstance: LendPoolLoan;

  before("deploying instances", async () => {
    const allReserveTokens = await testEnv.dataProvider.getAllReservesTokenDatas();
    const debtDaiAddress = allReserveTokens.find((tokenData) => tokenData.tokenSymbol === "DAI")?.debtTokenAddress;
    debtDai = await getDebtToken(debtDaiAddress);

    newBTokenInstance = await new BTokenFactory(await getDeploySigner()).deploy();
    newDebtTokenInstance = await new DebtTokenFactory(await getDeploySigner()).deploy();

    newLoanInstance = await new LendPoolLoanFactory(await getDeploySigner()).deploy();
  });

  it("Tries to update the DAI BToken implementation with a different address than the configuator", async () => {
    const { dai, configurator, users, mockIncentivesController } = testEnv;

    const updateBTokenInputParams: {
      asset: string;
      implementation: string;
      encodedCallData: BytesLike;
    }[] = [
      {
        asset: dai.address,
        implementation: newBTokenInstance.address,
        encodedCallData: [],
      },
    ];
    await expect(configurator.connect(users[1].signer).updateBToken(updateBTokenInputParams)).to.be.revertedWith(
      CALLER_NOT_POOL_ADMIN
    );
  });

  it("Upgrades the DAI BToken implementation ", async () => {
    const { dai, configurator, dataProvider } = testEnv;

    const { bTokenAddress } = await dataProvider.getReserveTokenData(dai.address);

    const updateBTokenInputParams: {
      asset: string;
      implementation: string;
      encodedCallData: BytesLike;
    }[] = [
      {
        asset: dai.address,
        implementation: newBTokenInstance.address,
        encodedCallData: [],
      },
    ];
    await configurator.updateBToken(updateBTokenInputParams);

    const checkImpl = await configurator.getTokenImplementation(bTokenAddress);
    expect(checkImpl).to.be.eq(newBTokenInstance.address, "Invalid token implementation");
  });

  it("Tries to update the DAI DebtToken implementation with a different address than the configuator", async () => {
    const { dai, configurator, users } = testEnv;

    const updateDebtTokenInputParams: {
      asset: string;
      implementation: string;
      encodedCallData: BytesLike;
    }[] = [
      {
        asset: dai.address,
        implementation: newBTokenInstance.address,
        encodedCallData: [],
      },
    ];
    await expect(configurator.connect(users[1].signer).updateDebtToken(updateDebtTokenInputParams)).to.be.revertedWith(
      CALLER_NOT_POOL_ADMIN
    );
  });

  it("Upgrades the DAI DebtToken implementation ", async () => {
    const { dai, configurator, dataProvider } = testEnv;

    const { debtTokenAddress } = await dataProvider.getReserveTokenData(dai.address);

    const updateDebtTokenInputParams: {
      asset: string;
      implementation: string;
      encodedCallData: BytesLike;
    }[] = [
      {
        asset: dai.address,
        implementation: newDebtTokenInstance.address,
        encodedCallData: [],
      },
    ];
    await configurator.updateDebtToken(updateDebtTokenInputParams);

    const checkImpl = await configurator.getTokenImplementation(debtTokenAddress);
    expect(checkImpl).to.be.eq(newDebtTokenInstance.address, "Invalid token implementation");
  });

  it("Tries to update the LendPoolLoan implementation with a different address than the address provider", async () => {
    const { addressesProvider, users } = testEnv;

    await expect(
      addressesProvider.connect(users[1].signer).setLendPoolLoanImpl(newLoanInstance.address, [])
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("Upgrades the LendPoolLoan implementation ", async () => {
    const { addressesProvider } = testEnv;

    const loanProxyAddressBefore = await addressesProvider.getLendPoolLoan();
    const loanProxyBefore = await getLendPoolLoanProxy(loanProxyAddressBefore);

    await addressesProvider.setLendPoolLoanImpl(newLoanInstance.address, []);

    const loanProxyAddressAfter = await addressesProvider.getLendPoolLoan();
    const loanProxyAfter = await getLendPoolLoanProxy(loanProxyAddressAfter);

    const checkImpl = await addressesProvider.getImplementation(loanProxyAddressBefore);

    expect(loanProxyAddressAfter).to.be.eq(loanProxyAddressBefore, "Invalid addresses provider");
    expect(checkImpl).to.be.eq(newLoanInstance.address, "Invalid loan implementation");
  });
});
