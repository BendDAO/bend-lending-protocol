import { evmRevert, evmSnapshot, DRE } from "../../helpers/misc-utils";
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
  getBendOracle,
  getLendPoolLoanProxy,
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
import { LendPoolAddressesProvider } from "../../types/LendPoolAddressesProvider";
import { getEthersSigners } from "../../helpers/contracts-helpers";
import { getParamPerNetwork } from "../../helpers/contracts-helpers";
import { WETH9Mocked } from "../../types/WETH9Mocked";
import { WETHGateway } from "../../types/WETHGateway";
import { solidity } from "ethereum-waffle";
import { BendConfig } from "../../markets/bend";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { BendOracle, BNFTRegistry, LendPoolLoan } from "../../types";

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
  nftOracle: NFTOracle;
  bendOracle: BendOracle;
  dataProvider: BendProtocolDataProvider;
  weth: WETH9Mocked;
  bWETH: BToken;
  dai: MintableERC20;
  bDai: BToken;
  usdc: MintableERC20;
  bUsdc: BToken;
  //wpunks: WPUNKSMocked;
  bPUNK: BNFT;
  bayc: MintableERC721;
  bBYAC: BNFT;
  addressesProvider: LendPoolAddressesProvider;
  wethGateway: WETHGateway;
  tokenIdTracker: number;
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
  reserveOracle: {} as ReserveOracle,
  nftOracle: {} as NFTOracle,
  bendOracle: {} as BendOracle,
  weth: {} as WETH9Mocked,
  bWETH: {} as BToken,
  dai: {} as MintableERC20,
  bDai: {} as BToken,
  usdc: {} as MintableERC20,
  bUsdc: {} as BToken,
  //wpunks: WPUNKSMocked,
  bPUNK: {} as BNFT,
  bayc: {} as MintableERC721,
  bBYAC: {} as BNFT,
  addressesProvider: {} as LendPoolAddressesProvider,
  wethGateway: {} as WETHGateway,
  //wpunksGateway: {} as WPUNKSGateway,
  tokenIdTracker: {} as number,
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
  testEnv.nftOracle = await getNFTOracle();
  testEnv.bendOracle = await getBendOracle();

  testEnv.dataProvider = await getBendProtocolDataProvider();

  // Reserve Tokens
  const allTokens = await testEnv.dataProvider.getAllBTokens();
  const bDaiAddress = allTokens.find((bToken) => bToken.symbol === "bDAI")?.tokenAddress;
  const bUsdcAddress = allTokens.find((bToken) => bToken.symbol === "bUSDC")?.tokenAddress;
  const bWEthAddress = allTokens.find((bToken) => bToken.symbol === "bWETH")?.tokenAddress;

  const reservesTokens = await testEnv.dataProvider.getAllReservesTokens();

  const daiAddress = reservesTokens.find((token) => token.symbol === "DAI")?.tokenAddress;
  const usdcAddress = reservesTokens.find((token) => token.symbol === "USDC")?.tokenAddress;
  const wethAddress = reservesTokens.find((token) => token.symbol === "WETH")?.tokenAddress;

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
  //testEnv.wethGateway = await getWETHGateway();

  // NFT Tokens
  const allBNftTokens = await testEnv.dataProvider.getAllBNfts();
  //console.log("allBNftTokens", allBNftTokens);
  const bPunkAddress = allBNftTokens.find((bNFT) => bNFT.symbol === "bWPUNKS")?.nftAddress;

  const bByacAddress = allBNftTokens.find((bNFT) => bNFT.symbol === "bBAYC")?.nftAddress;

  const nftsTokens = await testEnv.dataProvider.getAllNftsTokens();
  //console.log("nftsTokens", nftsTokens);
  const wpunksAddress = nftsTokens.find((token) => token.symbol === "WPUNKS")?.nftAddress;
  const baycAddress = nftsTokens.find((token) => token.symbol === "BAYC")?.nftAddress;

  if (!bByacAddress || !bPunkAddress) {
    console.error("Invalid BNFT Tokens", bByacAddress, bPunkAddress);
    process.exit(1);
  }
  if (!baycAddress || !wpunksAddress) {
    console.error("Invalid NFT Tokens", baycAddress, wpunksAddress);
    process.exit(1);
  }

  testEnv.bBYAC = await getBNFT(bByacAddress);
  testEnv.bPUNK = await getBNFT(bPunkAddress);

  testEnv.bayc = await getMintableERC721(baycAddress);
  //testEnv.wpunks = await getWPUNKSMocked(wpunksAddress);
  //testEnv.wpunksGateway = await getWPUNKSGateway();

  testEnv.tokenIdTracker = 100;
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
