import { TestEnv, makeSuite } from "./helpers/make-suite";
import {
  mintERC20,
  mintERC721,
  approveERC20,
  setApprovalForAll,
  deposit,
  borrow,
  repay,
  delegateBorrowAllowance,
} from "./helpers/actions";
import { configuration as actionsConfiguration } from "./helpers/actions";
import { configuration as calculationsConfiguration } from "./helpers/utils/calculations";
import BigNumber from "bignumber.js";
import { getReservesConfigByPool } from "../helpers/configuration";
import { BendPools, iBendPoolAssets, IReserveParams } from "../helpers/types";
import { waitForTx } from "../helpers/misc-utils";
import {
  MockAaveLendPool,
  MockAaveLendPoolAddressesProvider,
  MockAaveLendPoolAddressesProviderFactory,
  MockAaveLendPoolFactory,
  MockUniswapV3SwapRouter,
  MockUniswapV3SwapRouterFactory,
  UniswapV3DebtSwapAdapter,
  UniswapV3DebtSwapAdapterFactory,
} from "../types";
import { convertToCurrencyDecimals } from "../helpers/contracts-helpers";

const { expect } = require("chai");

makeSuite("Adapter: Uniswap v3 debt swap test cases", (testEnv: TestEnv) => {
  let mockAaveAddressProvider: MockAaveLendPoolAddressesProvider;
  let mockAavePool: MockAaveLendPool;
  let mockUniswapV3SwapRouter: MockUniswapV3SwapRouter;
  let debtSwapAdapter: UniswapV3DebtSwapAdapter;

  let testTokenId1: string;
  let testTokenId2: string;

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

    mockAaveAddressProvider = await new MockAaveLendPoolAddressesProviderFactory(testEnv.deployer.signer).deploy();
    mockAavePool = await new MockAaveLendPoolFactory(testEnv.deployer.signer).deploy();
    await waitForTx(await mockAaveAddressProvider.setLendingPool(mockAavePool.address));
    mockUniswapV3SwapRouter = await new MockUniswapV3SwapRouterFactory(testEnv.deployer.signer).deploy();

    debtSwapAdapter = await new UniswapV3DebtSwapAdapterFactory(testEnv.deployer.signer).deploy();
    await waitForTx(
      await debtSwapAdapter.initialize(
        mockAaveAddressProvider.address,
        testEnv.addressesProvider.address,
        mockUniswapV3SwapRouter.address
      )
    );

    testTokenId1 = (testEnv.tokenIdTracker++).toString();
    testTokenId2 = (testEnv.tokenIdTracker++).toString();
  });
  after("Reset", () => {
    // Reset BigNumber
    BigNumber.config({
      DECIMAL_PLACES: 20,
      ROUNDING_MODE: BigNumber.ROUND_HALF_UP,
    });
  });

  it("User 0 mint and transfer some token to mock contracts", async () => {
    const { users } = testEnv;
    const user0 = users[0];

    // mint some WETH
    const wethAmount = await convertToCurrencyDecimals(testEnv.weth.address, "200");
    await waitForTx(await testEnv.weth.connect(user0.signer).mint(wethAmount));
    await waitForTx(await testEnv.weth.connect(user0.signer).transfer(mockAavePool.address, wethAmount.div(2)));
    await waitForTx(
      await testEnv.weth.connect(user0.signer).transfer(mockUniswapV3SwapRouter.address, wethAmount.div(2))
    );
    console.log("mockAavePool WETH:", await testEnv.weth.balanceOf(mockAavePool.address));
    console.log("mockUniswapV3SwapRouter WETH:", await testEnv.weth.balanceOf(mockUniswapV3SwapRouter.address));

    // mint some USDC
    const usdcAmount = await convertToCurrencyDecimals(testEnv.usdc.address, "200000");
    await waitForTx(await testEnv.usdc.connect(user0.signer).mint(usdcAmount));
    await waitForTx(await testEnv.usdc.connect(user0.signer).transfer(mockAavePool.address, usdcAmount.div(2)));
    await waitForTx(
      await testEnv.usdc.connect(user0.signer).transfer(mockUniswapV3SwapRouter.address, usdcAmount.div(2))
    );
    console.log("mockAavePool USDC:", await testEnv.usdc.balanceOf(mockAavePool.address));
    console.log("mockUniswapV3SwapRouter USDC:", await testEnv.usdc.balanceOf(mockUniswapV3SwapRouter.address));
  });

  it("User 1 deposits WETH and USDC", async () => {
    const { users } = testEnv;
    const depositor = users[1];

    // deposit some WETH
    await mintERC20(testEnv, depositor, "WETH", "100");

    await approveERC20(testEnv, depositor, "WETH");

    await deposit(testEnv, depositor, "", "WETH", "100", depositor.address, "success", "");

    // deposit some USDC
    await mintERC20(testEnv, depositor, "USDC", "100000");

    await approveERC20(testEnv, depositor, "USDC");

    await deposit(testEnv, depositor, "", "USDC", "100000", depositor.address, "success", "");
  });

  it("User 2 uses NFT as collateral and borrows WETH", async () => {
    const { users } = testEnv;
    const borrower = users[2];

    const tokenId = testTokenId1;
    await mintERC721(testEnv, borrower, "BAYC", tokenId);

    await setApprovalForAll(testEnv, borrower, "BAYC");

    await borrow(testEnv, borrower, "WETH", "1", "BAYC", tokenId, borrower.address, "365", "success", "");
  });

  it("Hacker swap WETH debt to USDC (revert expected)", async () => {
    const { users, bayc } = testEnv;
    const hacker = users[5];

    const tokenId = testTokenId1;
    let swapParams = {
      nftAssets: [testEnv.bayc.address],
      nftTokenIds: [tokenId],
      toDebtReserve: testEnv.usdc.address,
      maxSlippage: 100,
      uniswapFee: 3000,
    };

    await expect(debtSwapAdapter.connect(hacker.signer).swapDebt(swapParams)).to.be.revertedWith(
      "U3DSA: caller not borrower"
    );
  });

  it("Hacker call executeOperation (revert expected)", async () => {
    const { users, weth } = testEnv;
    const borrower = users[2];
    const hacker = users[5];

    await expect(
      debtSwapAdapter.connect(hacker.signer).executeOperation([weth.address], [100], [1], borrower.address, [])
    ).to.be.revertedWith("U3DSA: caller must be aave lending pool");
  });

  it("Hacker call aave flashLoan (revert expected)", async () => {
    const { users, weth } = testEnv;
    const borrower = users[2];
    const hacker = users[5];

    await expect(
      mockAavePool
        .connect(hacker.signer)
        .flashLoan(debtSwapAdapter.address, [weth.address], [100], [0], borrower.address, [], 0)
    ).to.be.revertedWith("U3DSA: initiator must be this contract");
  });

  it("Hacker call setPause (revert expected)", async () => {
    const { users, weth } = testEnv;
    const hacker = users[5];

    await expect(debtSwapAdapter.connect(hacker.signer).setPause(true)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
  });

  it("User 2 call swap when paused (revert expected)", async () => {
    const { users, bayc, usdc } = testEnv;
    const borrower = users[2];

    await waitForTx(await debtSwapAdapter.setPause(true));

    const tokenId = testTokenId1;
    let swapParams = {
      nftAssets: [bayc.address],
      nftTokenIds: [tokenId],
      toDebtReserve: usdc.address,
      maxSlippage: 100,
      uniswapFee: 3000,
    };
    await expect(debtSwapAdapter.connect(borrower.signer).swapDebt(swapParams)).to.be.revertedWith("Pausable: paused");

    await waitForTx(await debtSwapAdapter.setPause(false));
  });

  it("User 2 swap WETH debt to USDC", async () => {
    const { users, bayc, usdc } = testEnv;
    const borrower = users[2];

    await waitForTx(await mockUniswapV3SwapRouter.setSmountOutDeltaRatio(101));
    const wethBalanceBeforeSwap = await testEnv.weth.balanceOf(borrower.address);

    const debtSwapOutAmount = await debtSwapAdapter.getNftDebtSwapOutAmount(
      [bayc.address],
      [testTokenId1],
      usdc.address,
      100
    );
    //console.log("debtSwapOutAmount:", debtSwapOutAmount);
    expect(debtSwapOutAmount.toDebtAmounts[0]).to.be.gt(0, "toDebtAmounts should gt 0");
    expect(debtSwapOutAmount.repayAmounts[0]).to.be.eq(0, "repayAmounts should eq 0");

    await waitForTx(await testEnv.bayc.connect(borrower.signer).setApprovalForAll(debtSwapAdapter.address, true));

    await delegateBorrowAllowance(testEnv, borrower, "USDC", "1000000", debtSwapAdapter.address, "success", "");

    const tokenId = testTokenId1;
    let swapParams = {
      nftAssets: [bayc.address],
      nftTokenIds: [tokenId],
      toDebtReserve: usdc.address,
      maxSlippage: 100,
      uniswapFee: 3000,
    };
    await waitForTx(await debtSwapAdapter.connect(borrower.signer).swapDebt(swapParams));

    // balcance should be increased because of the uniswap will give more weth
    const wethBalanceAfterSwap = await testEnv.weth.balanceOf(borrower.address);
    expect(wethBalanceAfterSwap).to.be.gt(wethBalanceBeforeSwap, "weth balance should be increased");

    await waitForTx(await mockUniswapV3SwapRouter.setSmountOutDeltaRatio(0));
  });

  it("user 2 repay all USDC, full of borrow amount", async () => {
    const { users } = testEnv;
    const user2 = users[2];

    await mintERC20(testEnv, user2, "USDC", "100000");

    await approveERC20(testEnv, user2, "USDC");

    const tokenId = testTokenId1;
    await repay(testEnv, user2, "", "BAYC", tokenId, "-1", user2, "success", "");
  });

  it("User 2 uses two NFTs as collateral and borrows USDC", async () => {
    const { users } = testEnv;
    const borrower = users[2];

    await mintERC721(testEnv, borrower, "BAYC", testTokenId2);

    await setApprovalForAll(testEnv, borrower, "BAYC");

    await borrow(testEnv, borrower, "USDC", "1234", "BAYC", testTokenId1, borrower.address, "365", "success", "");
    await borrow(testEnv, borrower, "USDC", "2345", "BAYC", testTokenId2, borrower.address, "365", "success", "");
  });

  it("User 2 swap USDC debt to WETH at first", async () => {
    const { users, weth, bayc } = testEnv;
    const borrower = users[2];

    const debtSwapOutAmount = await debtSwapAdapter.getNftDebtSwapOutAmount(
      [bayc.address, bayc.address],
      [testTokenId1, testTokenId2],
      weth.address,
      100
    );
    //console.log("debtSwapOutAmount:", debtSwapOutAmount);
    expect(debtSwapOutAmount.toDebtAmounts[0]).to.be.gt(0, "toDebtAmounts should gt 0");
    expect(debtSwapOutAmount.repayAmounts[0]).to.be.eq(0, "repayAmounts should eq 0");

    await waitForTx(await bayc.connect(borrower.signer).setApprovalForAll(debtSwapAdapter.address, true));

    await delegateBorrowAllowance(testEnv, borrower, "WETH", "1000000", debtSwapAdapter.address, "success", "");

    let swapParams = {
      nftAssets: [bayc.address, bayc.address],
      nftTokenIds: [testTokenId1, testTokenId2],
      toDebtReserve: weth.address,
      maxSlippage: 100,
      uniswapFee: 3000,
    };
    await waitForTx(await debtSwapAdapter.connect(borrower.signer).swapDebt(swapParams));
  });

  it("User 2 swap WETH debt back to USDC again", async () => {
    const { users, usdc, bayc } = testEnv;
    const borrower = users[2];

    await waitForTx(await bayc.connect(borrower.signer).setApprovalForAll(debtSwapAdapter.address, true));

    await delegateBorrowAllowance(testEnv, borrower, "USDC", "1000000", debtSwapAdapter.address, "success", "");

    let swapParams = {
      nftAssets: [bayc.address, bayc.address],
      nftTokenIds: [testTokenId1, testTokenId2],
      toDebtReserve: usdc.address,
      maxSlippage: 100,
      uniswapFee: 3000,
    };
    await waitForTx(await debtSwapAdapter.connect(borrower.signer).swapDebt(swapParams));
  });
});
