import { TestEnv, makeSuite } from "./helpers/make-suite";
import { Contract, BigNumber, constants } from "ethers";
const { expect } = require("chai");
import { ProtocolErrors } from "../helpers/types";
import { BendCollector } from "../types";
import { MintableERC20, MintableERC20Factory } from "../types";
import { parseEther, parseUnits } from "ethers/lib/utils";
makeSuite("BendCollector reverts", (testEnv: TestEnv) => {
  it("set bad token", async () => {
    const { bendCollector, users, deployer } = testEnv;
    const { BL_INVALID_REWARDS_TOKEN_ADDRESS } = ProtocolErrors;
    await expect(bendCollector.connect(users[0].signer).setRewardToken(constants.AddressZero)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
    console.log(await bendCollector.owner());
    await expect(bendCollector.setRewardToken(constants.AddressZero)).to.be.revertedWith(
      BL_INVALID_REWARDS_TOKEN_ADDRESS
    );
  });
  it("set zero address fee distributor", async () => {
    const { bendCollector, users, deployer } = testEnv;
    const { BL_INVALID_FEE_DISTRIBUTOR_ADDRESS } = ProtocolErrors;
    await expect(
      bendCollector.connect(users[0].signer).setFeeDistributorAddress(constants.AddressZero)
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(bendCollector.setFeeDistributorAddress(constants.AddressZero)).to.be.revertedWith(
      BL_INVALID_FEE_DISTRIBUTOR_ADDRESS
    );
  });

  it("set zero address treasury", async () => {
    const { bendCollector, users, deployer } = testEnv;
    const { BL_INVALID_TREASURY_ADDRESS } = ProtocolErrors;
    await expect(bendCollector.connect(users[0].signer).setTreasuryAddress(constants.AddressZero)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
    await expect(bendCollector.setTreasuryAddress(constants.AddressZero)).to.be.revertedWith(
      BL_INVALID_TREASURY_ADDRESS
    );
  });
  it("set bad refer pecentage  ", async () => {
    const { bendCollector, users, deployer } = testEnv;
    const { BL_INVALID_REFER_PERCENTAGE } = ProtocolErrors;
    await expect(bendCollector.connect(users[0].signer).setReferRewardsPercentage(1)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
    await expect(bendCollector.setReferRewardsPercentage(10001)).to.be.revertedWith(BL_INVALID_REFER_PERCENTAGE);
  });

  it("withdraw refer rewards to zero treasury", async () => {
    const { bendCollector, users, deployer } = testEnv;
    const { BL_INVALID_TREASURY_ADDRESS } = ProtocolErrors;

    await expect(bendCollector.withdrawReferRewards()).to.be.revertedWith(BL_INVALID_TREASURY_ADDRESS);
  });
});

makeSuite("BendCollector tests", (testEnv: TestEnv) => {
  let token: MintableERC20;
  before(async () => {
    const { bendCollector, users, deployer } = testEnv;
    token = await new MintableERC20Factory(deployer.signer).deploy("Mock reward token", "Mock reward token", 18);
    await token.mint(parseEther("10000"));
    await bendCollector.setRewardToken(token.address);
    await bendCollector.setTreasuryAddress(users[1].address);
    await bendCollector.setFeeDistributorAddress(users[0].address);
    await bendCollector.setReferRewardsPercentage(2000);
  });

  it("unapprove", async () => {
    const { bendCollector, users, deployer } = testEnv;
    let feeDistributor = users[0].address;
    await expect(bendCollector.connect(users[0].signer).unapprove(feeDistributor)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );

    await bendCollector.unapprove(feeDistributor);

    expect(await token.allowance(bendCollector.address, feeDistributor)).to.be.zero;
  });

  it("distribute", async () => {
    const { bendCollector, users, deployer } = testEnv;
    await token.transfer(bendCollector.address, parseEther("100"));
    let preBalance = await token.balanceOf(users[0].address);
    await bendCollector.distribute();
    let afterBalance = await token.balanceOf(users[0].address);
    expect(afterBalance.sub(preBalance)).to.be.equal(parseEther("80"));
    expect(await bendCollector.referRewards()).to.be.equal(parseEther("20"));
  });

  it("distribute 2", async () => {
    const { bendCollector, users, deployer } = testEnv;
    await token.transfer(bendCollector.address, parseEther("120"));
    let preBalance = await token.balanceOf(users[0].address);
    await bendCollector.distribute();
    let afterBalance = await token.balanceOf(users[0].address);

    expect(afterBalance.sub(preBalance)).to.be.equal(parseEther("96"));

    expect(await bendCollector.referRewards()).to.be.equal(parseEther("44"));
  });

  it(" withdraw refer rewards", async () => {
    const { bendCollector, users, deployer } = testEnv;

    await expect(bendCollector.connect(users[0].signer).withdrawReferRewards()).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
    let preBalance = await token.balanceOf(users[1].address);
    await bendCollector.withdrawReferRewards();
    let afterBalance = await token.balanceOf(users[1].address);

    expect(afterBalance.sub(preBalance)).to.be.equal(parseEther("44"));

    expect(await bendCollector.referRewards()).to.be.equal(0);
  });

  it("distribute 3", async () => {
    const { bendCollector, users, deployer } = testEnv;
    await token.transfer(bendCollector.address, parseEther("200"));
    let preBalance = await token.balanceOf(users[0].address);
    await bendCollector.distribute();
    let afterBalance = await token.balanceOf(users[0].address);

    expect(afterBalance.sub(preBalance)).to.be.equal(parseEther("160"));

    expect(await bendCollector.referRewards()).to.be.equal(parseEther("40"));
  });
});
