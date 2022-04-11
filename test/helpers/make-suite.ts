import { evmRevert, evmSnapshot, DRE, getNowTimeInSeconds } from "../../helpers/misc-utils";
import { Signer } from "ethers";
import {
  getLendPool,
  getLendPoolAddressesProvider,
  getBendProtocolDataProvider,
  getBToken,
  getBNFT,
  getMintableERC20,
  getMintableERC721,
  getLendPoolConfiguratorProxy,
  getReserveOracle,
  getNFTOracle,
  getWETHMocked,
  getWETHGateway,
  getBNFTRegistryProxy,
  getLendPoolLoanProxy,
  getCryptoPunksMarket,
  getWrappedPunk,
  getPunkGateway,
  getMockChainlinkOracle,
  getMockNFTOracle,
  getMockReserveOracle,
  getMockIncentivesController,
  getDebtToken,
  getWalletProvider,
  getUIPoolDataProvider,
} from "../../helpers/contracts-getters";
import { eEthereumNetwork, eNetwork, tEthereumAddress } from "../../helpers/types";
import { LendPool } from "../../types/LendPool";
import { BendProtocolDataProvider } from "../../types/BendProtocolDataProvider";
import { MintableERC20 } from "../../types/MintableERC20";
import { BToken } from "../../types/BToken";
import { MintableERC721 } from "../../types/MintableERC721";
import { BNFT } from "../../types/BNFT";
import { LendPoolConfigurator } from "../../types/LendPoolConfigurator";

import chai from "chai";
// @ts-ignore
import bignumberChai from "chai-bignumber";
import { almostEqual } from "./almost-equal";
import { ReserveOracle } from "../../types/ReserveOracle";
import { NFTOracle } from "../../types/NFTOracle";
import { MockNFTOracle } from "../../types/MockNFTOracle";
import { MockReserveOracle } from "../../types/MockReserveOracle";
import { LendPoolAddressesProvider } from "../../types/LendPoolAddressesProvider";
import { getEthersSigners } from "../../helpers/contracts-helpers";
import { getParamPerNetwork } from "../../helpers/contracts-helpers";
import { WETH9Mocked } from "../../types/WETH9Mocked";
import { WETHGateway } from "../../types/WETHGateway";
import { solidity } from "ethereum-waffle";
import { BendConfig } from "../../markets/bend";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  BNFTRegistry,
  LendPoolLoan,
  CryptoPunksMarket,
  WrappedPunk,
  PunkGateway,
  MockIncentivesController,
  UiPoolDataProvider,
  WalletBalanceProvider,
} from "../../types";
import { MockChainlinkOracle } from "../../types/MockChainlinkOracle";
import { USD_ADDRESS } from "../../helpers/constants";

chai.use(bignumberChai());
chai.use(almostEqual());
chai.use(solidity);

export interface SignerWithAddress {
  signer: Signer;
  address: tEthereumAddress;
}
export interface TestEnv {
  deployer: SignerWithAddress;
  users: SignerWithAddress[];
  bnftRegistry: BNFTRegistry;
  pool: LendPool;
  loan: LendPoolLoan;
  configurator: LendPoolConfigurator;
  reserveOracle: ReserveOracle;
  mockChainlinkOracle: MockChainlinkOracle;
  mockReserveOracle: MockReserveOracle;
  nftOracle: NFTOracle;
  mockNftOracle: MockNFTOracle;
  dataProvider: BendProtocolDataProvider;
  uiProvider: UiPoolDataProvider;
  walletProvider: WalletBalanceProvider;
  mockIncentivesController: MockIncentivesController;
  weth: WETH9Mocked;
  bWETH: BToken;
  dai: MintableERC20;
  bDai: BToken;
  usdc: MintableERC20;
  bUsdc: BToken;
  //wpunks: WPUNKSMocked;
  bPUNK: BNFT;
  bayc: MintableERC721;
  bBAYC: BNFT;
  addressesProvider: LendPoolAddressesProvider;
  wethGateway: WETHGateway;
  tokenIdTracker: number;

  cryptoPunksMarket: CryptoPunksMarket;
  punkIndexTracker: number;
  wrappedPunk: WrappedPunk;
  punkGateway: PunkGateway;

  roundIdTracker: number;
  nowTimeTracker: number;
}

let buidlerevmSnapshotId: string = "0x1";
const setBuidlerevmSnapshotId = (id: string) => {
  buidlerevmSnapshotId = id;
};

const testEnv: TestEnv = {
  deployer: {} as SignerWithAddress,
  users: [] as SignerWithAddress[],
  bnftRegistry: {} as BNFTRegistry,
  pool: {} as LendPool,
  loan: {} as LendPoolLoan,
  configurator: {} as LendPoolConfigurator,
  dataProvider: {} as BendProtocolDataProvider,
  uiProvider: {} as UiPoolDataProvider,
  walletProvider: {} as WalletBalanceProvider,
  mockIncentivesController: {} as MockIncentivesController,
  reserveOracle: {} as ReserveOracle,
  mockReserveOracle: {} as MockReserveOracle,
  mockNftOracle: {} as MockNFTOracle,
  nftOracle: {} as NFTOracle,
  mockChainlinkOracle: {} as MockChainlinkOracle,
  weth: {} as WETH9Mocked,
  bWETH: {} as BToken,
  dai: {} as MintableERC20,
  bDai: {} as BToken,
  usdc: {} as MintableERC20,
  bUsdc: {} as BToken,
  //wpunks: WPUNKSMocked,
  bPUNK: {} as BNFT,
  bayc: {} as MintableERC721,
  bBAYC: {} as BNFT,
  addressesProvider: {} as LendPoolAddressesProvider,
  wethGateway: {} as WETHGateway,
  //wpunksGateway: {} as WPUNKSGateway,
  tokenIdTracker: {} as number,
  roundIdTracker: {} as number,
  nowTimeTracker: {} as number,
} as TestEnv;

export async function initializeMakeSuite() {
  const [_deployer, ...restSigners] = await getEthersSigners();
  const deployer: SignerWithAddress = {
    address: await _deployer.getAddress(),
    signer: _deployer,
  };

  for (const signer of restSigners) {
    testEnv.users.push({
      signer,
      address: await signer.getAddress(),
    });
  }
  testEnv.deployer = deployer;

  testEnv.bnftRegistry = await getBNFTRegistryProxy();

  testEnv.pool = await getLendPool();

  testEnv.loan = await getLendPoolLoanProxy();

  testEnv.configurator = await getLendPoolConfiguratorProxy();

  testEnv.addressesProvider = await getLendPoolAddressesProvider();

  testEnv.reserveOracle = await getReserveOracle();
  testEnv.mockChainlinkOracle = await getMockChainlinkOracle();
  testEnv.mockReserveOracle = await getMockReserveOracle();
  testEnv.nftOracle = await getNFTOracle();
  testEnv.mockNftOracle = await getMockNFTOracle();

  testEnv.dataProvider = await getBendProtocolDataProvider();
  testEnv.walletProvider = await getWalletProvider();
  testEnv.uiProvider = await getUIPoolDataProvider();

  testEnv.mockIncentivesController = await getMockIncentivesController();

  // Reserve Tokens
  const allReserveTokens = await testEnv.dataProvider.getAllReservesTokenDatas();
  const bDaiAddress = allReserveTokens.find((tokenData) => tokenData.tokenSymbol === "DAI")?.bTokenAddress;
  const bUsdcAddress = allReserveTokens.find((tokenData) => tokenData.tokenSymbol === "USDC")?.bTokenAddress;
  const bWEthAddress = allReserveTokens.find((tokenData) => tokenData.tokenSymbol === "WETH")?.bTokenAddress;

  const daiAddress = allReserveTokens.find((tokenData) => tokenData.tokenSymbol === "DAI")?.tokenAddress;
  const usdcAddress = allReserveTokens.find((tokenData) => tokenData.tokenSymbol === "USDC")?.tokenAddress;
  const wethAddress = allReserveTokens.find((tokenData) => tokenData.tokenSymbol === "WETH")?.tokenAddress;

  if (!bDaiAddress || !bUsdcAddress || !bWEthAddress) {
    console.error("Invalid BTokens", bDaiAddress, bUsdcAddress, bWEthAddress);
    process.exit(1);
  }
  if (!daiAddress || !usdcAddress || !wethAddress) {
    console.error("Invalid Reserve Tokens", daiAddress, usdcAddress, wethAddress);
    process.exit(1);
  }

  testEnv.bDai = await getBToken(bDaiAddress);
  testEnv.bUsdc = await getBToken(bUsdcAddress);
  testEnv.bWETH = await getBToken(bWEthAddress);

  testEnv.dai = await getMintableERC20(daiAddress);
  testEnv.usdc = await getMintableERC20(usdcAddress);
  testEnv.weth = await getWETHMocked(wethAddress);
  testEnv.wethGateway = await getWETHGateway();

  // NFT Tokens
  const allBNftTokens = await testEnv.dataProvider.getAllNftsTokenDatas();
  //console.log("allBNftTokens", allBNftTokens);
  const bPunkAddress = allBNftTokens.find((tokenData) => tokenData.nftSymbol === "WPUNKS")?.bNftAddress;
  const bByacAddress = allBNftTokens.find((tokenData) => tokenData.nftSymbol === "BAYC")?.bNftAddress;

  const wpunksAddress = allBNftTokens.find((tokenData) => tokenData.nftSymbol === "WPUNKS")?.nftAddress;
  const baycAddress = allBNftTokens.find((tokenData) => tokenData.nftSymbol === "BAYC")?.nftAddress;

  if (!bByacAddress || !bPunkAddress) {
    console.error("Invalid BNFT Tokens", bByacAddress, bPunkAddress);
    process.exit(1);
  }
  if (!baycAddress || !wpunksAddress) {
    console.error("Invalid NFT Tokens", baycAddress, wpunksAddress);
    process.exit(1);
  }

  testEnv.bBAYC = await getBNFT(bByacAddress);
  testEnv.bPUNK = await getBNFT(bPunkAddress);

  testEnv.bayc = await getMintableERC721(baycAddress);

  testEnv.cryptoPunksMarket = await getCryptoPunksMarket();
  testEnv.wrappedPunk = await getWrappedPunk();
  testEnv.punkGateway = await getPunkGateway();

  testEnv.tokenIdTracker = 100;
  testEnv.punkIndexTracker = 0;

  testEnv.roundIdTracker = 1;
  testEnv.nowTimeTracker = Number(await getNowTimeInSeconds());
}

const setSnapshot = async () => {
  const hre = DRE as HardhatRuntimeEnvironment;
  setBuidlerevmSnapshotId(await evmSnapshot());
};

const revertHead = async () => {
  const hre = DRE as HardhatRuntimeEnvironment;
  await evmRevert(buidlerevmSnapshotId);
};

export function makeSuite(name: string, tests: (testEnv: TestEnv) => void) {
  describe(name, () => {
    before(async () => {
      await setSnapshot();
    });
    tests(testEnv);
    after(async () => {
      await revertHead();
    });
  });
}
