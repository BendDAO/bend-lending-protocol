import BigNumber from "bignumber.js";

// ----------------
// MATH
// ----------------

export const PERCENTAGE_FACTOR = "10000";
export const HALF_PERCENTAGE = "5000";
export const WAD = Math.pow(10, 18).toString();
export const HALF_WAD = new BigNumber(WAD).multipliedBy(0.5).toString();
export const RAY = new BigNumber(10).exponentiatedBy(27).toFixed();
export const HALF_RAY = new BigNumber(RAY).multipliedBy(0.5).toFixed();
export const WAD_RAY_RATIO = Math.pow(10, 9).toString();
export const oneEther = new BigNumber(Math.pow(10, 18));
export const oneRay = new BigNumber(Math.pow(10, 27));
export const MAX_UINT_AMOUNT = "115792089237316195423570985008687907853269984665640564039457584007913129639935";
export const ONE_YEAR = "31536000";
export const ONE_DAY = "86400";
export const ONE_HOUR = "3600";
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const ONE_ADDRESS = "0x0000000000000000000000000000000000000001";
// ----------------
// PROTOCOL GLOBAL PARAMS
// ----------------
export const OPTIMAL_UTILIZATION_RATE = new BigNumber(0.8).times(RAY);
export const EXCESS_UTILIZATION_RATE = new BigNumber(0.2).times(RAY);
export const APPROVAL_AMOUNT_LENDING_POOL = "1000000000000000000000000000";
export const TOKEN_DISTRIBUTOR_PERCENTAGE_BASE = "10000";
export const MOCK_USD_PRICE = "425107839690";
export const USD_ADDRESS = "0x9ceb4d4c184d1786614a593a03621b7f37f8685f"; //index 19, lowercase
export const BEND_REFERRAL = "0";

// ----------------
// ADDRESS IDS IN PROVIDER
// ----------------
export const ADDRESS_ID_WETH_GATEWAY = "0xADDE000000000000000000000000000000000000000000000000000000000001";
export const ADDRESS_ID_PUNK_GATEWAY = "0xADDE000000000000000000000000000000000000000000000000000000000002";

//Price source: https://data.chain.link/ethereum/mainnet/stablecoins
export const MOCK_RESERVE_AGGREGATORS_PRICES = {
  WETH: oneEther.toFixed(),
  DAI: oneEther.multipliedBy("0.000233211").toFixed(),
  //BUSD: oneEther.multipliedBy('0.0002343946').toFixed(),
  USDC: oneEther.multipliedBy("0.0002349162").toFixed(),
  //USDT: oneEther.multipliedBy('0.0002359253').toFixed(),
};

//Price source: https://nftpricefloor.com/
//Price source: https://opensea.io/
export const MOCK_NFT_AGGREGATORS_PRICES = {
  WPUNKS: oneEther.multipliedBy("66.99").toFixed(),
  BAYC: oneEther.multipliedBy("52.77").toFixed(),
  DOODLE: oneEther.multipliedBy("2.69").toFixed(),
  SDOODLE: oneEther.multipliedBy("2.69").toFixed(),
  MAYC: oneEther.multipliedBy("6.23").toFixed(),
  CLONEX: oneEther.multipliedBy("11.95").toFixed(),
  AZUKI: oneEther.multipliedBy("10.50").toFixed(),
};

export const MOCK_NFT_BASE_URIS = {
  WPUNKS: "https://wrappedpunks.com:3000/api/punks/metadata/",
  BAYC: "ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/",
  DOODLE: "ipfs://QmPMc4tcBsMqLRuCQtPmPe84bpSjrC3Ky7t3JWuHXYB4aS/",
  COOL: "https://api.coolcatsnft.com/cat/",
  MEEBITS: "https://meebits.larvalabs.com/meebit/1",
  MAYC: "https://boredapeyachtclub.com/api/mutants/",
  WOW: "https://wow-prod-nftribe.s3.eu-west-2.amazonaws.com/t/",
  CLONEX: "https://clonex-assets.rtfkt.com/",
  AZUKI: "https://ikzttp.mypinata.cloud/ipfs/QmQFkLSQysj94s5GvTHPyzTxrawwtjgiiYS2TBLgrvw8CW/",
  KONGZ: "https://kongz.herokuapp.com/api/metadata/",
};
