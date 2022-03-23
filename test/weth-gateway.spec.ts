import BigNumber from "bignumber.js";
import { BigNumber as BN } from "ethers";
import { parseEther } from "ethers/lib/utils";
import DRE from "hardhat";

import { getReservesConfigByPool } from "../helpers/configuration";
import { MAX_UINT_AMOUNT, oneEther, ONE_DAY } from "../helpers/constants";
import { deploySelfdestructTransferMock } from "../helpers/contracts-deployments";
import { convertToCurrencyDecimals, convertToCurrencyUnits } from "../helpers/contracts-helpers";
import { getNowTimeInSeconds, increaseTime, waitForTx } from "../helpers/misc-utils";
import { BendPools, iBendPoolAssets, IReserveParams, ProtocolLoanState } from "../helpers/types";
import {
  borrow,
  configuration as actionsConfiguration,
  mintERC721,
  setApprovalForAll,
  setApprovalForAllWETHGateway,
  setNftAssetPrice,
  setNftAssetPriceForDebt,
} from "./helpers/actions";
import { makeSuite, TestEnv } from "./helpers/make-suite";
import { configuration as calculationsConfiguration } from "./helpers/utils/calculations";
import { getLoanData, getNftAddressFromSymbol } from "./helpers/utils/helpers";
import { NETWORKS_DEFAULT_GAS } from "../helper-hardhat-config";
import { getDebtToken } from "../helpers/contracts-getters";

const chai = require("chai");
const { expect } = chai;

makeSuite("WETHGateway", (testEnv: TestEnv) => {
  let baycInitPrice: BN;

  const zero = BN.from(0);
  const depositSize = parseEther("5");
  const depositSize500 = parseEther("500");
  const GAS_PRICE = NETWORKS_DEFAULT_GAS[DRE.network.name];

  before("Initializing configuration", async () => {
    // Sets BigNumber for this suite, instead of globally
    BigNumber.config({
      DECIMAL_PLACES: 0,
      ROUNDING_MODE: BigNumber.ROUND_DOWN,
    });

    actionsConfiguration.skipIntegrityCheck = false; //set this to true to execute solidity-coverage

    calculationsConfiguration.reservesParams = <iBendPoolAssets<IReserveParams>>(
      getReservesConfigByPool(BendPools.proto)
    );

    baycInitPrice = await testEnv.nftOracle.getAssetPrice(testEnv.bayc.address);
  });
  after("Reset", () => {
    // Reset BigNumber
    BigNumber.config({
      DECIMAL_PLACES: 20,
      ROUNDING_MODE: BigNumber.ROUND_HALF_UP,
    });
  });

  it("Deposit WETH via WethGateway ", async () => {
    const { users, wethGateway, bWETH, pool } = testEnv;

    const depositor = users[0];
    const user = users[1];

    // Deposit liquidity with native ETH
    await wethGateway.connect(depositor.signer).depositETH(depositor.address, "0", { value: depositSize });

    // Deposit with native ETH
    await wethGateway.connect(user.signer).depositETH(user.address, "0", { value: depositSize });

    const bTokensBalance = await bWETH.balanceOf(user.address);

    expect(bTokensBalance).to.be.gt(zero);
    expect(bTokensBalance).to.be.gte(depositSize);
  });

  it("Withdraw WETH - Partial", async () => {
    const { users, wethGateway, bWETH, pool } = testEnv;

    const user = users[1];
    const priorEthersBalance = await user.signer.getBalance();
    const bTokensBalance = await bWETH.balanceOf(user.address);

    expect(bTokensBalance).to.be.gt(zero, "User should have bTokens.");

    // Partially withdraw native ETH
    const partialWithdraw = await convertToCurrencyDecimals(bWETH.address, "2");

    // Approve the bTokens to Gateway so Gateway can withdraw and convert to Ether
    const approveTx = await bWETH.connect(user.signer).approve(wethGateway.address, MAX_UINT_AMOUNT);
    const { gasUsed: approveGas } = await waitForTx(approveTx);

    // Partial Withdraw and send native Ether to user
    const { gasUsed: withdrawGas } = await waitForTx(
      await wethGateway.connect(user.signer).withdrawETH(partialWithdraw, user.address)
    );

    const afterPartialEtherBalance = await user.signer.getBalance();
    const afterPartialBTokensBalance = await bWETH.balanceOf(user.address);
    const gasCosts = approveGas.add(withdrawGas).mul(GAS_PRICE);

    expect(afterPartialEtherBalance).to.be.equal(
      priorEthersBalance.add(partialWithdraw).sub(gasCosts),
      "User ETHER balance should contain the partial withdraw"
    );
    expect(afterPartialBTokensBalance).to.be.equal(
      bTokensBalance.sub(partialWithdraw),
      "User bWETH balance should be substracted"
    );
  });

  it("Withdraw WETH - Full", async () => {
    const { users, bWETH, wethGateway, pool } = testEnv;

    const user = users[1];
    const priorEthersBalance = await user.signer.getBalance();
    const bTokensBalance = await bWETH.balanceOf(user.address);

    expect(bTokensBalance).to.be.gt(zero, "User should have bTokens.");

    // Approve the bTokens to Gateway so Gateway can withdraw and convert to Ether
    const approveTx = await bWETH.connect(user.signer).approve(wethGateway.address, MAX_UINT_AMOUNT);
    const { gasUsed: approveGas } = await waitForTx(approveTx);

    // Full withdraw
    const { gasUsed: withdrawGas } = await waitForTx(
      await wethGateway.connect(user.signer).withdrawETH(MAX_UINT_AMOUNT, user.address)
    );

    const afterFullEtherBalance = await user.signer.getBalance();
    const afterFullBTokensBalance = await bWETH.balanceOf(user.address);
    const gasCosts = approveGas.add(withdrawGas).mul(GAS_PRICE);

    expect(afterFullEtherBalance).to.be.eq(
      priorEthersBalance.add(bTokensBalance).sub(gasCosts),
      "User ETHER balance should contain the full withdraw"
    );
    expect(afterFullBTokensBalance).to.be.eq(0, "User bWETH balance should be zero");
  });

  it("Borrow WETH and Full Repay with ETH", async () => {
    const { users, wethGateway, pool, loan, bWETH, bayc, dataProvider } = testEnv;
    const depositor = users[0];
    const user = users[1];
    const borrowSize = parseEther("1");
    const repaySize = borrowSize.add(borrowSize.mul(5).div(100));

    // Deposit with native ETH
    await waitForTx(
      await wethGateway.connect(depositor.signer).depositETH(depositor.address, "0", { value: depositSize })
    );

    const bTokensBalance = await bWETH.balanceOf(depositor.address);
    expect(bTokensBalance).to.be.gte(depositSize);

    // Start loan
    const nftAsset = await getNftAddressFromSymbol("BAYC");
    const tokenIdNum = testEnv.tokenIdTracker++;
    const tokenId = tokenIdNum.toString();
    await mintERC721(testEnv, user, "BAYC", tokenId);
    await setApprovalForAll(testEnv, user, "BAYC");
    const getDebtBalance = async () => {
      const loan = await getLoanData(pool, dataProvider, nftAsset, tokenId, "0");

      return BN.from(loan.currentAmount.toFixed(0));
    };

    // Borrow with NFT
    await borrow(testEnv, user, "WETH", "1", "BAYC", tokenId, user.address, "365", "success", "");

    const debtBalance = await getDebtBalance();
    expect(debtBalance).to.be.gte(borrowSize);

    // Repay with antive ETH
    // Partial Repay WETH loan with native ETH
    const partialPayment = repaySize.div(2);
    await waitForTx(
      await wethGateway.connect(user.signer).repayETH(nftAsset, tokenId, partialPayment, {
        value: partialPayment,
      })
    );
    expect(await getDebtBalance()).to.be.lt(debtBalance);

    // Full Repay WETH loan with native ETH
    await waitForTx(
      await wethGateway.connect(user.signer).repayETH(nftAsset, tokenId, MAX_UINT_AMOUNT, {
        value: repaySize,
      })
    );
    expect(await getDebtBalance()).to.be.eq(zero);

    const tokenOwner = await bayc.ownerOf(tokenId);
    expect(tokenOwner).to.be.equal(user.address, "Invalid token owner after repay");
  });

  it("Borrow ETH and Full Repay with ETH", async () => {
    const { users, wethGateway, pool, loan, weth, bWETH, bayc, dataProvider } = testEnv;
    const depositor = users[0];
    const borrower = users[1];
    const borrowSize1 = parseEther("1");
    const borrowSize2 = parseEther("2");
    const borrowSizeAll = borrowSize1.add(borrowSize2);
    const repaySize = borrowSizeAll.add(borrowSizeAll.mul(5).div(100));

    // Deposit with native ETH
    await waitForTx(
      await wethGateway.connect(depositor.signer).depositETH(depositor.address, "0", { value: depositSize })
    );

    const bTokensBalance = await bWETH.balanceOf(depositor.address);
    expect(bTokensBalance, "bTokensBalance not gte depositSize").to.be.gte(depositSize);

    // Delegates borrowing power of WETH to WETHGateway
    const reserveData = await pool.getReserveData(weth.address);
    const debtToken = await getDebtToken(reserveData.debtTokenAddress);
    await waitForTx(await debtToken.connect(borrower.signer).approveDelegation(wethGateway.address, borrowSizeAll));

    // Start loan
    const nftAsset = await getNftAddressFromSymbol("BAYC");
    const tokenIdNum = testEnv.tokenIdTracker++;
    const tokenId = tokenIdNum.toString();
    await mintERC721(testEnv, borrower, "BAYC", tokenId);
    await setApprovalForAll(testEnv, borrower, "BAYC");
    await setApprovalForAllWETHGateway(testEnv, borrower, "BAYC");
    const getDebtBalance = async () => {
      const loan = await getLoanData(pool, dataProvider, nftAsset, tokenId, "0");

      return BN.from(loan.currentAmount.toFixed(0));
    };

    const ethBalanceBefore = await borrower.signer.getBalance();

    console.log("Borrow first ETH with NFT");
    await waitForTx(
      await wethGateway.connect(borrower.signer).borrowETH(borrowSize1, nftAsset, tokenId, borrower.address, "0")
    );

    console.log("Borrow more ETH with NFT");
    await waitForTx(
      await wethGateway.connect(borrower.signer).borrowETH(borrowSize2, nftAsset, tokenId, borrower.address, "0")
    );

    expect(await borrower.signer.getBalance(), "current eth balance shoud increase").to.be.gt(ethBalanceBefore);

    const debtBalance = await getDebtBalance();
    expect(debtBalance, "debt should gte borrowSize").to.be.gte(borrowSizeAll);

    // Repay with antive ETH
    console.log("Partial Repay ETH loan with native ETH");
    const partialPayment = repaySize.div(2);
    await waitForTx(
      await wethGateway.connect(borrower.signer).repayETH(nftAsset, tokenId, partialPayment, {
        value: partialPayment,
      })
    );
    expect(await getDebtBalance()).to.be.lt(debtBalance);

    console.log("Full Repay ETH loan with native ETH");
    await waitForTx(
      await wethGateway.connect(borrower.signer).repayETH(nftAsset, tokenId, MAX_UINT_AMOUNT, {
        value: repaySize,
      })
    );
    expect(await getDebtBalance()).to.be.eq(zero);

    const tokenOwner = await bayc.ownerOf(tokenId);
    expect(tokenOwner).to.be.equal(borrower.address, "Invalid token owner after repay");
  });

  it("Should revert if receiver function receives Ether if not WETH", async () => {
    const { users, wethGateway } = testEnv;
    const user = users[0];
    const amount = parseEther("1");

    // Call receiver function (empty data + value)
    await expect(
      user.signer.sendTransaction({
        to: wethGateway.address,
        value: amount,
        gasLimit: DRE.network.config.gas,
      })
    ).to.be.revertedWith("Receive not allowed");
  });

  it("Should revert if fallback functions is called with Ether", async () => {
    const { users, wethGateway } = testEnv;
    const user = users[0];
    const amount = parseEther("1");
    const fakeABI = ["function wantToCallFallback()"];
    const abiCoder = new DRE.ethers.utils.Interface(fakeABI);
    const fakeMethodEncoded = abiCoder.encodeFunctionData("wantToCallFallback", []);

    // Call fallback function with value
    await expect(
      user.signer.sendTransaction({
        to: wethGateway.address,
        data: fakeMethodEncoded,
        value: amount,
        gasLimit: DRE.network.config.gas,
      })
    ).to.be.revertedWith("Fallback not allowed");
  });

  it("Should revert if fallback functions is called", async () => {
    const { users, wethGateway } = testEnv;
    const user = users[0];

    const fakeABI = ["function wantToCallFallback()"];
    const abiCoder = new DRE.ethers.utils.Interface(fakeABI);
    const fakeMethodEncoded = abiCoder.encodeFunctionData("wantToCallFallback", []);

    // Call fallback function without value
    await expect(
      user.signer.sendTransaction({
        to: wethGateway.address,
        data: fakeMethodEncoded,
        gasLimit: DRE.network.config.gas,
      })
    ).to.be.revertedWith("Fallback not allowed");
  });

  it("Owner can do emergency ERC20 recovery", async () => {
    const { users, dai, wethGateway, deployer } = testEnv;
    const user = users[0];
    const amount = parseEther("1");

    await dai.connect(user.signer).mint(amount);
    const daiBalanceAfterMint = await dai.balanceOf(user.address);

    await dai.connect(user.signer).transfer(wethGateway.address, amount);
    const daiBalanceAfterBadTransfer = await dai.balanceOf(user.address);
    expect(daiBalanceAfterBadTransfer).to.be.eq(
      daiBalanceAfterMint.sub(amount),
      "User should have lost the funds here."
    );

    await wethGateway.connect(deployer.signer).emergencyERC20Transfer(dai.address, user.address, amount);
    const daiBalanceAfterRecovery = await dai.balanceOf(user.address);

    expect(daiBalanceAfterRecovery).to.be.eq(
      daiBalanceAfterMint,
      "User should recover the funds due emergency transfer"
    );
  });

  it("Owner can do emergency ERC721 recovery", async () => {
    const { users, bayc, wethGateway, deployer } = testEnv;
    const user = users[0];

    const tokenId = testEnv.tokenIdTracker++;
    await bayc.connect(user.signer).mint(tokenId);

    await bayc
      .connect(user.signer)
      ["safeTransferFrom(address,address,uint256)"](user.address, wethGateway.address, tokenId);
    const tokenOwnerAfterBadTransfer = await bayc.ownerOf(tokenId);
    expect(tokenOwnerAfterBadTransfer).to.be.eq(wethGateway.address, "User should have lost the token here.");

    await wethGateway.connect(deployer.signer).emergencyERC721Transfer(bayc.address, user.address, tokenId);
    const tokenOwnerAfterRecovery = await bayc.ownerOf(tokenId);

    expect(tokenOwnerAfterRecovery).to.be.eq(user.address, "User should recover the token due emergency transfer");
  });

  it("Owner can do emergency native ETH recovery", async () => {
    const { users, wethGateway, deployer } = testEnv;
    const user = users[0];
    const amount = parseEther("1");
    const userBalancePriorCall = await user.signer.getBalance();

    // Deploy contract with payable selfdestruct contract
    const selfdestructContract = await deploySelfdestructTransferMock();

    // Selfdestruct the mock, pointing to WETHGateway address
    const callTx = await selfdestructContract
      .connect(user.signer)
      .destroyAndTransfer(wethGateway.address, { value: amount });
    const { gasUsed } = await waitForTx(callTx);
    const gasFees = gasUsed.mul(GAS_PRICE);
    const userBalanceAfterCall = await user.signer.getBalance();

    expect(userBalanceAfterCall).to.be.eq(userBalancePriorCall.sub(amount).sub(gasFees), "");
    ("User should have lost the funds");

    // Recover the funds from the contract and sends back to the user
    await wethGateway.connect(deployer.signer).emergencyEtherTransfer(user.address, amount);

    const userBalanceAfterRecovery = await user.signer.getBalance();
    const wethGatewayAfterRecovery = await DRE.ethers.provider.getBalance(wethGateway.address);

    expect(userBalanceAfterRecovery).to.be.eq(
      userBalancePriorCall.sub(gasFees),
      "User should recover the funds due emergency eth transfer."
    );
    expect(wethGatewayAfterRecovery).to.be.eq("0", "WETHGateway ether balance should be zero.");
  });
});
