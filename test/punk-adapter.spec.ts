import { TestEnv, makeSuite, SignerWithAddress } from "./helpers/make-suite";
import { BigNumber, constants, ethers } from "ethers";
const { expect } = require("chai");
import { parseEther } from "ethers/lib/utils";
import { approveERC20, deposit, mintERC20 } from "./helpers/actions";
import {
  CryptoPunksMarket,
  MockAaveLendPool,
  MockAaveLendPoolFactory,
  MockAaveLendPoolAddressesProviderFactory,
  PunkDownpaymentBuyAdapter,
  PunkDownpaymentBuyAdapterFactory,
  DebtToken,
  BToken,
} from "../types";
import { DRE, getNowTimeInSeconds } from "../helpers/misc-utils";
import { configuration as calculationsConfiguration } from "./helpers/utils/calculations";
import { BendPools, iBendPoolAssets, IReserveParams } from "../helpers/types";
import { getReservesConfigByPool } from "../helpers/configuration";
import { getBToken, getDebtToken } from "../helpers/contracts-getters";
import { ProtocolErrors } from "../helpers/types";
import { ECDSASignature } from "ethereumjs-util";
import { getSignatureFromTypedData } from "./helpers/opensea";
import { accounts } from "../test-wallets";

export class Snapshots {
  ids = new Map<string, string>();

  async capture(tag: string) {
    this.ids.set(tag, await this.evmSnapshot());
  }

  async revert(tag: string) {
    await this.evmRevert(this.ids.get(tag) || "1");
    await this.capture(tag);
  }

  async evmSnapshot() {
    return await DRE.ethers.provider.send("evm_snapshot", []);
  }

  async evmRevert(id: string) {
    return await DRE.ethers.provider.send("evm_revert", [id]);
  }
}

export const signFlashLoanParams = (
  privateKey: string,
  chainId: number,
  nonce: string,
  adapter: string,
  punkIndex: string,
  buyPrice: string
) => {
  const message = {
    types: EIP_712_PARAMS_TYPES,
    domain: {
      name: EIP_712_ADAPTER_DOMAIN_NAME,
      version: EIP_712_ADAPTER_DOMAIN_VERSION,
      chainId,
      verifyingContract: adapter,
    },
    primaryType: "Params",
    message: {
      punkIndex,
      buyPrice,
      nonce,
    },
  };
  return getSignatureFromTypedData(privateKey, message);
};

export const EIP_712_PARAMS_TYPES = {
  EIP712Domain: [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ],
  Params: [
    { name: "punkIndex", type: "uint256" },
    { name: "buyPrice", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ],
};

export const EIP_712_ADAPTER_DOMAIN_NAME = "Punk Downpayment Buy Adapter";
export const EIP_712_ADAPTER_DOMAIN_VERSION = "1.0";

makeSuite("punk downpayment adapter tests", (testEnv: TestEnv) => {
  let punkMarket: CryptoPunksMarket;
  let downpaymentAdapter: PunkDownpaymentBuyAdapter;
  let aaveLendingPool: MockAaveLendPool;
  const snapshots = new Snapshots();
  let secretKeys: string[];
  let chainId: number;

  before(async () => {
    const { deployer, users } = testEnv;
    punkMarket = testEnv.cryptoPunksMarket;
    secretKeys = accounts.map((a) => a.secretKey);
    chainId = (await DRE.ethers.provider.getNetwork()).chainId;
    let aaveAddressProvider = await new MockAaveLendPoolAddressesProviderFactory(deployer.signer).deploy();
    aaveLendingPool = new MockAaveLendPoolFactory(deployer.signer).attach(await aaveAddressProvider.getLendingPool());
    let user = users[0];
    downpaymentAdapter = await new PunkDownpaymentBuyAdapterFactory(deployer.signer).deploy();
    await downpaymentAdapter.initialize(
      100,
      testEnv.addressesProvider.address,
      aaveAddressProvider.address,
      testEnv.cryptoPunksMarket.address,
      testEnv.wrappedPunk.address,
      testEnv.weth.address,
      testEnv.bendCollector.address
    );

    await testEnv.weth.connect(deployer.signer).deposit({ value: parseEther("10001") });

    await testEnv.weth.connect(deployer.signer).transfer(aaveLendingPool.address, parseEther("10000"));

    calculationsConfiguration.reservesParams = <iBendPoolAssets<IReserveParams>>(
      getReservesConfigByPool(BendPools.proto)
    );

    await mintERC20(testEnv, user, "WETH", "1000");
    await approveERC20(testEnv, user, "WETH");

    await deposit(testEnv, user, "", "WETH", "1000", user.address, "success", "");
    await snapshots.capture("init");
  });

  afterEach(async () => {
    await snapshots.revert("init");
  });

  it("access controll", async () => {
    const { INVALID_OWNER_REVERT_MSG } = ProtocolErrors;
    await expect(downpaymentAdapter.connect(testEnv.users[1].signer).updateFee(100)).to.be.revertedWith(
      INVALID_OWNER_REVERT_MSG
    );
    await expect(downpaymentAdapter.connect(testEnv.users[1].signer).pause()).to.be.revertedWith(
      INVALID_OWNER_REVERT_MSG
    );
    await expect(downpaymentAdapter.connect(testEnv.users[1].signer).unpause()).to.be.revertedWith(
      INVALID_OWNER_REVERT_MSG
    );

    await expect(downpaymentAdapter.executeOperation([], [], [], constants.AddressZero, "0x")).to.be.revertedWith(
      "Caller must be aave lending pool"
    );
  });

  it("update fee", async () => {
    expect(await downpaymentAdapter.fee()).to.be.equal(100);
    await downpaymentAdapter.updateFee(200);
    expect(await downpaymentAdapter.fee()).to.be.equal(200);
    await expect(downpaymentAdapter.updateFee(10001)).to.be.revertedWith("Fee overflow");
  });

  makeSuite("aave flash loan", (testEnv: TestEnv) => {
    let buyer: SignerWithAddress;
    let seller: SignerWithAddress;
    let tokenId: number;
    let nftToken: CryptoPunksMarket;

    let buyPrice: BigNumber;
    let debtWETH: DebtToken;
    let bWETH: BToken;

    async function approveBuyerWeth() {
      await testEnv.weth.connect(buyer.signer).approve(downpaymentAdapter.address, constants.MaxUint256);
    }

    async function approveBuyerDebtWeth() {
      await debtWETH.connect(buyer.signer).approveDelegation(downpaymentAdapter.address, constants.MaxUint256);
    }

    function buildFlashloanParams(punkIndex: number, buyPrice: BigNumber, sig: ECDSASignature) {
      return ethers.utils.defaultAbiCoder.encode(
        ["(uint256,uint256,uint8,bytes32,bytes32)"],
        [[punkIndex.toString(), buyPrice.toString(), sig.v, sig.r, sig.s]]
      );
    }

    before(async () => {
      buyer = testEnv.users[2];
      let lastTime = await getNowTimeInSeconds();

      const reserveData = await testEnv.pool.getReserveData(testEnv.weth.address);
      debtWETH = await getDebtToken(reserveData.debtTokenAddress);
      bWETH = await getBToken(reserveData.bTokenAddress);

      seller = testEnv.users[1];
      tokenId = testEnv.tokenIdTracker++;
      buyPrice = parseEther("100");
      await punkMarket.allInitialOwnersAssigned();
      await punkMarket.getPunk(tokenId);
      await punkMarket.transferPunk(seller.address, tokenId);
      await punkMarket.connect(seller.signer).offerPunkForSale(tokenId, buyPrice);

      nftToken = testEnv.cryptoPunksMarket;
      await testEnv.nftOracle.setAssetData(testEnv.wrappedPunk.address, parseEther("100"), lastTime, lastTime);

      let user = testEnv.users[0];
      await mintERC20(testEnv, user, "WETH", "1000");
      await approveERC20(testEnv, user, "WETH");

      await deposit(testEnv, user, "", "WETH", "1000", user.address, "success", "");

      await testEnv.weth.connect(testEnv.deployer.signer).deposit({ value: parseEther("10001") });

      await testEnv.weth.connect(testEnv.deployer.signer).transfer(aaveLendingPool.address, parseEther("10000"));

      await snapshots.capture("init");
    });

    async function expectDownpaymentSuccessed(borowAmount: BigNumber, nonce: string) {
      const aaveWethBalanceBefore = await testEnv.weth.balanceOf(aaveLendingPool.address);
      const buyerWethBalance = await testEnv.weth.balanceOf(buyer.address);
      const sig = signFlashLoanParams(
        secretKeys[3],
        chainId,
        nonce,
        downpaymentAdapter.address,
        tokenId.toString(),
        buyPrice.toString()
      );
      await aaveLendingPool
        .connect(buyer.signer)
        .flashLoan(
          downpaymentAdapter.address,
          [testEnv.weth.address],
          [borowAmount],
          [0],
          constants.AddressZero,
          buildFlashloanParams(tokenId, buyPrice, sig),
          0
        );

      const aaveWethBalanceAfter = await testEnv.weth.balanceOf(aaveLendingPool.address);

      const aaveFee = borowAmount.mul(9).div(10000);
      const bendFee = buyPrice.mul(1).div(100);

      expect(await nftToken.punkIndexToAddress(tokenId)).to.be.equal(testEnv.wrappedPunk.address);
      expect(await testEnv.wrappedPunk.ownerOf(tokenId)).to.be.equal(testEnv.bPUNK.address);
      expect(await testEnv.bPUNK.ownerOf(tokenId)).to.be.equal(buyer.address);

      expect(aaveWethBalanceAfter).to.be.equal(aaveWethBalanceBefore.add(aaveFee));

      expect((await testEnv.pool.getNftDebtData(testEnv.wrappedPunk.address, tokenId)).totalDebt).to.be.equal(
        borowAmount
      );

      expect(await bWETH.balanceOf(testEnv.bendCollector.address)).to.be.equal(bendFee);
      expect(await testEnv.weth.balanceOf(buyer.address)).to.be.equal(
        buyerWethBalance.sub(buyPrice.sub(borowAmount)).sub(aaveFee).sub(bendFee)
      );
    }

    function exceptDownpaymentReverted(borowAmount: BigNumber, nonce: string) {
      const sig = signFlashLoanParams(
        secretKeys[3],
        chainId,
        nonce,
        downpaymentAdapter.address,
        tokenId.toString(),
        buyPrice.toString()
      );
      return expect(
        aaveLendingPool
          .connect(buyer.signer)
          .flashLoan(
            downpaymentAdapter.address,
            [testEnv.weth.address],
            [borowAmount],
            [0],
            constants.AddressZero,
            buildFlashloanParams(tokenId, buyPrice, sig),
            0
          )
      );
    }

    it("downpayment buy", async () => {
      const borowAmount = parseEther("40");
      let nonce = (await downpaymentAdapter.nonces(buyer.address)).toString();
      let _buyPrice = buyPrice;
      buyPrice = buyPrice.sub(parseEther("1"));
      await exceptDownpaymentReverted(borowAmount, nonce).to.revertedWith("Order price must be same");
      buyPrice = _buyPrice;

      await exceptDownpaymentReverted(borowAmount, nonce).to.revertedWith("Insufficient payment");

      await approveBuyerWeth();
      await testEnv.weth.connect(buyer.signer).deposit({ value: parseEther("60") });
      await exceptDownpaymentReverted(borowAmount, nonce).to.revertedWith("Insufficient payment");

      await testEnv.weth.connect(buyer.signer).deposit({ value: parseEther("1.036") });
      await exceptDownpaymentReverted(borowAmount, nonce).to.be.reverted;

      await approveBuyerDebtWeth();
      await expectDownpaymentSuccessed(borowAmount, nonce);
    });
  });
});
