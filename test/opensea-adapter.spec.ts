import { TestEnv, makeSuite, SignerWithAddress } from "./helpers/make-suite";
import { BigNumber, constants } from "ethers";
const { expect } = require("chai");
import { parseEther } from "ethers/lib/utils";
import { approveERC20, deposit, mintERC20, mintERC721, setApprovalForAll } from "./helpers/actions";
import {
  MintableERC20Factory,
  TokenTransferProxyFactory,
  MockOpenseaExchange,
  MockOpenseaExchangeFactory,
  MockAaveLendPool,
  MockAaveLendPoolFactory,
  MockAaveLendPoolAddressesProviderFactory,
  MerkleValidator,
  MerkleValidatorFactory,
  TokenTransferProxy,
  ProxyRegistry,
  ProxyRegistryFactory,
  AuthenticatedProxyFactory,
  OpenseaDownpaymentBuyAdapter,
  OpenseaDownpaymentBuyAdapterFactory,
  MintableERC721,
  DebtToken,
  BToken,
} from "../types";
import { timeLatest, DRE, getNowTimeInSeconds } from "../helpers/misc-utils";
import {
  buildAtomicMatchParams,
  buildFlashloanParams,
  createSellOrder,
  makeBuyOrder,
  Order,
  signOrder,
} from "./helpers/opensea";
import { getNftAddressFromSymbol } from "./helpers/utils/helpers";
import { configuration as calculationsConfiguration } from "./helpers/utils/calculations";
import { BendPools, iBendPoolAssets, IReserveParams } from "../helpers/types";
import { getReservesConfigByPool } from "../helpers/configuration";
import { accounts } from "../test-wallets";
import { getBToken, getDebtToken, getMintableERC721 } from "../helpers/contracts-getters";
import { ProtocolErrors } from "../helpers/types";
import { ECDSASignature } from "ethereumjs-util";

export const NULL_BLOCK_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

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

makeSuite("opensea downpayment adapter tests", (testEnv: TestEnv) => {
  let openseaExchange: MockOpenseaExchange;
  let transferProxy: TokenTransferProxy;
  let proxyRegistry: ProxyRegistry;
  let target: MerkleValidator;
  let secretKeys: string[];
  let downpaymentAdapter: OpenseaDownpaymentBuyAdapter;
  let chainId: number;
  let aaveLendingPool: MockAaveLendPool;
  const snapshots = new Snapshots();

  before(async () => {
    const { deployer, users } = testEnv;
    secretKeys = accounts.map((a) => a.secretKey);
    chainId = (await DRE.ethers.provider.getNetwork()).chainId;
    let openseaToken = await new MintableERC20Factory(deployer.signer).deploy("opensea token", "opensea token", 18);
    transferProxy = await new TokenTransferProxyFactory(deployer.signer).deploy();
    proxyRegistry = await new ProxyRegistryFactory(deployer.signer).deploy();

    let authenticatedProxy = await new AuthenticatedProxyFactory(deployer.signer).deploy();

    openseaExchange = await new MockOpenseaExchangeFactory(deployer.signer).deploy(
      proxyRegistry.address,
      transferProxy.address,
      openseaToken.address,
      deployer.address
    );
    await proxyRegistry.mock(openseaExchange.address, authenticatedProxy.address);

    let aaveAddressProvider = await new MockAaveLendPoolAddressesProviderFactory(deployer.signer).deploy();
    aaveLendingPool = new MockAaveLendPoolFactory(deployer.signer).attach(await aaveAddressProvider.getLendingPool());

    target = await new MerkleValidatorFactory(deployer.signer).deploy();
    let user = users[0];

    downpaymentAdapter = await new OpenseaDownpaymentBuyAdapterFactory(deployer.signer).deploy();
    await downpaymentAdapter.initialize(
      100,
      testEnv.addressesProvider.address,
      aaveAddressProvider.address,
      openseaExchange.address,
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

  async function prepareSellOrder(
    seller: SignerWithAddress,
    nftSymbol: string,
    nftTokenId: number,
    ethPrice: BigNumber
  ) {
    await mintERC721(testEnv, seller, nftSymbol, nftTokenId.toString());
    const nftToken = await getMintableERC721(await getNftAddressFromSymbol(nftSymbol));
    const nftAsset = { tokenId: nftTokenId.toString(), tokenAddress: nftToken.address };
    await setApprovalForAll(testEnv, seller, nftSymbol);
    let now = BigNumber.from((await timeLatest()).toString());
    return {
      sellOrder: createSellOrder(
        openseaExchange.address,
        nftAsset,
        seller.address,
        ethPrice,
        now,
        target.address,
        testEnv.deployer.address
      ),
      nftToken,
    };
  }

  async function prepareSignOrder(user: string, privateKey: string, order: Order) {
    let nonce = await openseaExchange.nonces(user);
    return signOrder(privateKey, order, chainId, nonce.toNumber());
  }

  it("opensea atomic match", async () => {
    const seller = testEnv.users[1];
    const tokenId = testEnv.tokenIdTracker++;
    const { sellOrder, nftToken } = await prepareSellOrder(seller, "BAYC", tokenId, parseEther("100"));
    const sellSig = await prepareSignOrder(seller.address, secretKeys[2], sellOrder);

    const buyer = testEnv.users[2];
    const buyOrder = makeBuyOrder(sellOrder, buyer.address, testEnv.deployer.address, sellOrder.listingTime);
    const buySig = await prepareSignOrder(buyer.address, secretKeys[3], buyOrder);

    const params = buildAtomicMatchParams(buyOrder, buySig, sellOrder, sellSig, NULL_BLOCK_HASH);

    await proxyRegistry.connect(seller.signer).registerProxy();

    await nftToken.connect(seller.signer).approve(await proxyRegistry.proxies(seller.address), tokenId);

    await openseaExchange.atomicMatch_(
      params.addrs,
      params.uints,
      params.feeMethodsSidesKindsHowToCalls,
      params.calldataBuy,
      params.calldataSell,
      params.replacementPatternBuy,
      params.replacementPatternSell,
      params.staticExtradataBuy,
      params.staticExtradataSell,
      params.vs,
      params.rssMetadata,
      { value: parseEther("100") }
    );

    expect(await nftToken.ownerOf(tokenId)).to.be.equal(buyer.address);
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
    let nftToken: MintableERC721;

    let buyPrice: BigNumber;
    let sellOrder: Order;
    let sellSig: ECDSASignature;
    let buyOrder: Order;
    let buySig: ECDSASignature;
    let debtWETH: DebtToken;
    let bWETH: BToken;

    async function approveBuyerWeth() {
      await testEnv.weth.connect(buyer.signer).approve(downpaymentAdapter.address, constants.MaxUint256);
    }

    async function approveBuyerDebtWeth() {
      await debtWETH.connect(buyer.signer).approveDelegation(downpaymentAdapter.address, constants.MaxUint256);
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
      let order = await prepareSellOrder(seller, "BAYC", tokenId, buyPrice);
      sellOrder = order.sellOrder;
      nftToken = order.nftToken;
      sellSig = await prepareSignOrder(seller.address, secretKeys[2], sellOrder);
      await proxyRegistry.connect(seller.signer).registerProxy();
      await nftToken.connect(seller.signer).approve(await proxyRegistry.proxies(seller.address), tokenId);

      await testEnv.nftOracle.setAssetData(nftToken.address, parseEther("100"), lastTime, lastTime);

      buyOrder = makeBuyOrder(sellOrder, downpaymentAdapter.address, testEnv.deployer.address, sellOrder.listingTime);
      //empty sig
      buySig = {
        v: 0,
        r: Buffer.from(NULL_BLOCK_HASH.substring(2), "hex"),
        s: Buffer.from(NULL_BLOCK_HASH.substring(2), "hex"),
      };
    });

    async function expectDownpaymentSuccessed(borowAmount: BigNumber) {
      const aaveWethBalanceBefore = await testEnv.weth.balanceOf(aaveLendingPool.address);
      const buyerWethBalance = await testEnv.weth.balanceOf(buyer.address);
      await aaveLendingPool
        .connect(buyer.signer)
        .flashLoan(
          downpaymentAdapter.address,
          [testEnv.weth.address],
          [borowAmount],
          [0],
          constants.AddressZero,
          buildFlashloanParams(nftToken.address, tokenId, buyOrder, buySig, sellOrder, sellSig, NULL_BLOCK_HASH),
          0
        );

      const aaveWethBalanceAfter = await testEnv.weth.balanceOf(aaveLendingPool.address);

      const aaveFee = borowAmount.mul(9).div(10000);
      const bendFee = buyPrice.mul(1).div(100);
      expect(await nftToken.ownerOf(tokenId)).to.be.equal(testEnv.bBAYC.address);
      expect(await testEnv.bBAYC.ownerOf(tokenId)).to.be.equal(buyer.address);
      expect(aaveWethBalanceAfter).to.be.equal(aaveWethBalanceBefore.add(aaveFee));
      expect((await testEnv.pool.getNftDebtData(nftToken.address, tokenId)).totalDebt).to.be.equal(borowAmount);
      expect(await bWETH.balanceOf(testEnv.bendCollector.address)).to.be.equal(bendFee);
      expect(await testEnv.weth.balanceOf(buyer.address)).to.be.equal(
        buyerWethBalance.sub(buyPrice.sub(borowAmount)).sub(aaveFee).sub(bendFee)
      );
    }

    function exceptDownpaymentReverted(borowAmount: BigNumber) {
      return expect(
        aaveLendingPool
          .connect(buyer.signer)
          .flashLoan(
            downpaymentAdapter.address,
            [testEnv.weth.address],
            [borowAmount],
            [0],
            constants.AddressZero,
            buildFlashloanParams(nftToken.address, tokenId, buyOrder, buySig, sellOrder, sellSig, NULL_BLOCK_HASH),
            0
          )
      );
    }

    it("downpayment buy", async () => {
      const borowAmount = parseEther("40");

      buyOrder.maker = testEnv.users[3].address;
      await exceptDownpaymentReverted(borowAmount).to.revertedWith("Buyer must be this contract");
      buyOrder.maker = downpaymentAdapter.address;

      buyOrder.paymentToken = testEnv.weth.address;
      await exceptDownpaymentReverted(borowAmount).to.revertedWith("Buyer payment token should be ETH");
      buyOrder.paymentToken = constants.AddressZero;

      sellOrder.saleKind = 1;
      await exceptDownpaymentReverted(borowAmount).to.revertedWith("Order must be fixed price sale kind");
      sellOrder.saleKind = 0;

      buyOrder.basePrice = buyOrder.basePrice.sub(parseEther("1"));
      await exceptDownpaymentReverted(borowAmount).to.revertedWith("Order price must be same");
      buyOrder.basePrice = sellOrder.basePrice;

      await exceptDownpaymentReverted(borowAmount).to.revertedWith("Insufficient payment");
      await testEnv.weth.connect(buyer.signer).deposit({ value: parseEther("62") });
      await exceptDownpaymentReverted(borowAmount).to.revertedWith("Insufficient payment");
      await approveBuyerWeth();

      buyOrder.feeMethod = 0;
      await exceptDownpaymentReverted(borowAmount).to.revertedWith("order not matched");
      buyOrder.feeMethod = 1;

      let _calldata = buyOrder.calldata;
      buyOrder.calldata = _calldata.replace("f", "0");
      await exceptDownpaymentReverted(borowAmount).to.be.reverted;
      buyOrder.calldata = _calldata;

      await exceptDownpaymentReverted(borowAmount).to.be.reverted;
      await approveBuyerDebtWeth();
      await expectDownpaymentSuccessed(borowAmount);
    });
  });
});
