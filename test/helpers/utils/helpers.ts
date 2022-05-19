import { LendPool } from "../../../types/LendPool";
import { ReserveData, UserReserveData, LoanData, NftData } from "./interfaces";
import {
  getIErc20Detailed,
  getMintableERC20,
  getMintableERC721,
  getBToken,
  getLendPoolLoanProxy,
  getDeploySigner,
  getDebtToken,
  getIErc721Detailed,
} from "../../../helpers/contracts-getters";
import { tEthereumAddress } from "../../../helpers/types";
import BigNumber from "bignumber.js";
import { getDb, DRE } from "../../../helpers/misc-utils";
import { BendProtocolDataProvider } from "../../../types/BendProtocolDataProvider";
import { ERC20Factory } from "../../../types";
import { SignerWithAddress } from "../make-suite";

export const getReserveData = async (
  helper: BendProtocolDataProvider,
  reserve: tEthereumAddress
): Promise<ReserveData> => {
  const [reserveData, tokenAddresses, token] = await Promise.all([
    helper.getReserveData(reserve),
    helper.getReserveTokenData(reserve),
    getIErc20Detailed(reserve),
  ]);

  const debtToken = await getDebtToken(tokenAddresses.debtTokenAddress);

  const scaledVariableDebt = await debtToken.scaledTotalSupply();

  const symbol = await token.symbol();
  const decimals = new BigNumber(await token.decimals());

  const totalLiquidity = new BigNumber(reserveData.availableLiquidity.toString()).plus(
    reserveData.totalVariableDebt.toString()
  );

  const utilizationRate = new BigNumber(
    totalLiquidity.eq(0) ? 0 : new BigNumber(reserveData.totalVariableDebt.toString()).rayDiv(totalLiquidity)
  );

  return {
    totalLiquidity,
    utilizationRate,
    availableLiquidity: new BigNumber(reserveData.availableLiquidity.toString()),
    totalVariableDebt: new BigNumber(reserveData.totalVariableDebt.toString()),
    liquidityRate: new BigNumber(reserveData.liquidityRate.toString()),
    variableBorrowRate: new BigNumber(reserveData.variableBorrowRate.toString()),
    liquidityIndex: new BigNumber(reserveData.liquidityIndex.toString()),
    variableBorrowIndex: new BigNumber(reserveData.variableBorrowIndex.toString()),
    lastUpdateTimestamp: new BigNumber(reserveData.lastUpdateTimestamp),
    scaledVariableDebt: new BigNumber(scaledVariableDebt.toString()),
    address: reserve,
    bTokenAddress: tokenAddresses.bTokenAddress,
    symbol,
    decimals,
  };
};

export const getNftData = async (helper: BendProtocolDataProvider, nftAsset: tEthereumAddress): Promise<NftData> => {
  const [nftData, tokenAddresses, token] = await Promise.all([
    helper.getNftConfigurationData(nftAsset),
    helper.getNftTokenData(nftAsset),
    getIErc721Detailed(nftAsset),
  ]);

  const symbol = await token.symbol();

  return {
    redeemFine: new BigNumber(nftData.redeemFine.toString()),
    address: nftAsset,
    bnftTokenAddress: tokenAddresses.bNftAddress,
    symbol,
  };
};

export const getUserData = async (
  pool: LendPool,
  helper: BendProtocolDataProvider,
  reserve: string,
  user: tEthereumAddress,
  sender?: tEthereumAddress
): Promise<UserReserveData> => {
  const [userData, scaledBTokenBalance] = await Promise.all([
    helper.getUserReserveData(reserve, user),
    getBTokenUserData(reserve, user, helper),
  ]);

  const token = await getMintableERC20(reserve);
  const walletBalance = new BigNumber((await token.balanceOf(sender || user)).toString());

  return {
    scaledBTokenBalance: new BigNumber(scaledBTokenBalance),
    currentBTokenBalance: new BigNumber(userData.currentBTokenBalance.toString()),
    currentVariableDebt: new BigNumber(userData.currentVariableDebt.toString()),
    scaledVariableDebt: new BigNumber(userData.scaledVariableDebt.toString()),
    liquidityRate: new BigNumber(userData.liquidityRate.toString()),
    walletBalance,
  };
};

export const getLoanData = async (
  pool: LendPool,
  helper: BendProtocolDataProvider,
  nftAsset: string,
  nftTokenId: string,
  loanId: string
): Promise<LoanData> => {
  let loanData;
  let auctionData;
  let nftCfgData;

  if (loanId == undefined || loanId == "0") {
    [loanData, auctionData, nftCfgData] = await Promise.all([
      helper.getLoanDataByCollateral(nftAsset, nftTokenId),
      pool.getNftAuctionData(nftAsset, nftTokenId),
      helper.getNftConfigurationData(nftAsset),
    ]);
  } else {
    [loanData, auctionData, nftCfgData] = await Promise.all([
      helper.getLoanDataByLoanId(loanId),
      pool.getNftAuctionData(nftAsset, nftTokenId),
      helper.getNftConfigurationData(nftAsset),
    ]);
  }

  return {
    loanId: new BigNumber(loanData.loanId.toString()),
    state: new BigNumber(loanData.state),
    borrower: loanData.borrower,
    nftAsset: loanData.nftAsset,
    nftTokenId: new BigNumber(loanData.nftTokenId.toString()),
    reserveAsset: loanData.reserveAsset,
    scaledAmount: new BigNumber(loanData.scaledAmount.toString()),
    currentAmount: new BigNumber(loanData.currentAmount.toString()),
    bidderAddress: loanData.bidderAddress,
    bidPrice: new BigNumber(loanData.bidPrice.toString()),
    bidBorrowAmount: new BigNumber(loanData.bidBorrowAmount.toString()),
    bidFine: new BigNumber(auctionData.bidFine.toString()),
    nftCfgRedeemFine: new BigNumber(nftCfgData.redeemFine.toString()),
    nftCfgMinBidFine: new BigNumber(nftCfgData.minBidFine.toString()),
  };
};

export const getReserveAddressFromSymbol = async (symbol: string) => {
  const token = await getMintableERC20((await getDb(DRE.network.name).get(`${symbol}`).value()).address);

  if (!token) {
    throw `Could not find instance for contract ${symbol}`;
  }
  return token.address;
};

export const getNftAddressFromSymbol = async (symbol: string) => {
  const token = await getMintableERC721((await getDb(DRE.network.name).get(`${symbol}`).value()).address);

  if (!token) {
    throw `Could not find instance for contract ${symbol}`;
  }
  return token.address;
};

const getBTokenUserData = async (reserve: string, user: string, dataProvider: BendProtocolDataProvider) => {
  const { bTokenAddress } = await dataProvider.getReserveTokenData(reserve);

  const bToken = await getBToken(bTokenAddress);

  const scaledBalance = await bToken.scaledBalanceOf(user);
  return scaledBalance.toString();
};

export const getERC20TokenBalance = async (reserve: string, user: tEthereumAddress) => {
  const token = await ERC20Factory.connect(reserve, await getDeploySigner()).balanceOf(user);

  return token;
};
