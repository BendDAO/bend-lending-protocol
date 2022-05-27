import { fromRpcSig, ECDSASignature } from "ethereumjs-util";
import { signTypedData, SignTypedDataVersion } from "@metamask/eth-sig-util";
import { encodeBuy, encodeSell } from "opensea-js/lib/utils/schema";
import { ERC721v3Schema } from "wyvern-schemas/dist/schemas/ERC721";
import { ethers, constants, BigNumber } from "ethers";
import { Asset } from "opensea-js/lib/types";
import { WyvernProtocol } from "wyvern-js";
import { OrderJSON } from "opensea-js/lib/types";
import { SignerWithAddress } from "./make-suite";

export interface Order {
  exchange: string;
  maker: string;
  taker: string;
  makerRelayerFee: BigNumber;
  takerRelayerFee: BigNumber;
  makerProtocolFee: BigNumber;
  takerProtocolFee: BigNumber;
  feeRecipient: string;
  feeMethod: number;
  side: number;
  saleKind: number;
  target: string;
  howToCall: number;
  calldata: string;
  replacementPattern: string;
  staticTarget: string;
  staticExtradata: string;
  paymentToken: string;
  basePrice: BigNumber;
  extra: BigNumber;
  listingTime: BigNumber;
  expirationTime: BigNumber;
  salt: BigNumber;

  asset: Asset;
}

export const EIP_712_ORDER_TYPES = {
  EIP712Domain: [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ],
  Order: [
    { name: "exchange", type: "address" },
    { name: "maker", type: "address" },
    { name: "taker", type: "address" },
    { name: "makerRelayerFee", type: "uint256" },
    { name: "takerRelayerFee", type: "uint256" },
    { name: "makerProtocolFee", type: "uint256" },
    { name: "takerProtocolFee", type: "uint256" },
    { name: "feeRecipient", type: "address" },
    { name: "feeMethod", type: "uint8" },
    { name: "side", type: "uint8" },
    { name: "saleKind", type: "uint8" },
    { name: "target", type: "address" },
    { name: "howToCall", type: "uint8" },
    { name: "calldata", type: "bytes" },
    { name: "replacementPattern", type: "bytes" },
    { name: "staticTarget", type: "address" },
    { name: "staticExtradata", type: "bytes" },
    { name: "paymentToken", type: "address" },
    { name: "basePrice", type: "uint256" },
    { name: "extra", type: "uint256" },
    { name: "listingTime", type: "uint256" },
    { name: "expirationTime", type: "uint256" },
    { name: "salt", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ],
};

export const EIP_712_WYVERN_DOMAIN_NAME = "Wyvern Exchange Contract";
export const EIP_712_WYVERN_DOMAIN_VERSION = "2.3";

export const getSignatureFromTypedData = (privateKey: string, typedData: any): ECDSASignature => {
  const signature = signTypedData({
    privateKey: Buffer.from(privateKey.substring(2, 66), "hex"),
    data: typedData,
    version: SignTypedDataVersion.V4,
  });
  return fromRpcSig(signature);
};

export const signOrder = (privateKey: string, order: Order, chainId: number, nonce: number): ECDSASignature => {
  const message = {
    types: EIP_712_ORDER_TYPES,
    domain: {
      name: EIP_712_WYVERN_DOMAIN_NAME,
      version: EIP_712_WYVERN_DOMAIN_VERSION,
      chainId,
      verifyingContract: order.exchange,
    },
    primaryType: "Order",
    message: {
      exchange: order.exchange,
      maker: order.maker,
      taker: order.taker,
      makerRelayerFee: order.makerRelayerFee.toString(),
      takerRelayerFee: order.takerRelayerFee.toString(),
      makerProtocolFee: order.makerProtocolFee.toString(),
      takerProtocolFee: order.takerProtocolFee.toString(),
      feeRecipient: order.feeRecipient,
      feeMethod: order.feeMethod,
      side: order.side,
      saleKind: order.saleKind,
      target: order.target,
      howToCall: order.howToCall,
      calldata: order.calldata,
      replacementPattern: order.replacementPattern,
      staticTarget: order.staticTarget,
      staticExtradata: order.staticExtradata,
      paymentToken: order.paymentToken,
      basePrice: order.basePrice.toString(),
      extra: order.extra.toString(),
      listingTime: order.listingTime.toString(),
      expirationTime: order.expirationTime.toString(),
      salt: order.salt.toString(),
      nonce,
    },
  };
  return getSignatureFromTypedData(privateKey, message);
};

export const encodeSellCalldata = (asset: Asset, seller: string, target: string) => {
  const schema = ERC721v3Schema;
  const wyAsset = schema.assetFromFields({
    ID: asset.tokenId,
    Address: asset.tokenAddress.toLowerCase(),
  });

  // @ts-expect-error
  const { _, calldata, replacementPattern } = encodeSell(schema, wyAsset, seller, target);
  return { calldata, replacementPattern };
};

export const encodeBuyCalldata = (asset: Asset, buyer: string, target: string) => {
  const schema = ERC721v3Schema;
  const wyAsset = schema.assetFromFields({
    ID: asset.tokenId,
    Address: asset.tokenAddress.toLowerCase(),
  });

  // @ts-expect-error
  const { _, calldata, replacementPattern } = encodeBuy(schema, wyAsset, buyer, target);
  return { calldata, replacementPattern };
};

export const makeBuyOrder = (sellOrder: Order, buyer: string, feeRecipient: string, listingTime: BigNumber): Order => {
  const { calldata, replacementPattern } = encodeBuyCalldata(sellOrder.asset, buyer, sellOrder.target);

  feeRecipient = sellOrder.feeRecipient == constants.AddressZero ? feeRecipient : constants.AddressZero;

  return {
    exchange: sellOrder.exchange,
    maker: buyer,
    taker: sellOrder.maker,
    makerRelayerFee: sellOrder.makerRelayerFee,
    takerRelayerFee: sellOrder.takerRelayerFee,
    makerProtocolFee: sellOrder.makerProtocolFee,
    takerProtocolFee: sellOrder.takerProtocolFee,
    feeRecipient,
    feeMethod: sellOrder.feeMethod,
    side: 0,
    saleKind: sellOrder.saleKind,
    target: sellOrder.target,
    howToCall: sellOrder.howToCall,
    calldata,
    replacementPattern,
    staticTarget: constants.AddressZero,
    staticExtradata: "0x",
    paymentToken: sellOrder.paymentToken,
    basePrice: sellOrder.basePrice,
    extra: BigNumber.from(0),
    listingTime: listingTime,
    expirationTime: listingTime.add(86400),
    salt: BigNumber.from(WyvernProtocol.generatePseudoRandomSalt().toString()),
    asset: sellOrder.asset,
  };
};

export const createSellOrder = (
  exchange: string,
  asset: Asset,
  seller: string,
  price: BigNumber,
  listingTime: BigNumber,
  target: string,
  feeRecipient: string
): Order => {
  const { calldata, replacementPattern } = encodeSellCalldata(asset, seller, target);
  return {
    exchange,
    maker: seller,
    taker: constants.AddressZero,
    makerRelayerFee: BigNumber.from(0),
    takerRelayerFee: BigNumber.from(0),
    makerProtocolFee: BigNumber.from(0),
    takerProtocolFee: BigNumber.from(0),
    feeRecipient,
    feeMethod: 1,
    side: 1,
    saleKind: 0,
    target,
    howToCall: 1,
    calldata,
    replacementPattern,
    staticTarget: constants.AddressZero,
    staticExtradata: "0x",
    paymentToken: constants.AddressZero,
    basePrice: price,
    extra: BigNumber.from(0),
    listingTime: listingTime,
    expirationTime: listingTime.add(86400),
    salt: BigNumber.from(WyvernProtocol.generatePseudoRandomSalt().toString()),
    asset,
  };
};

type Grow<T, A extends Array<T>> = ((x: T, ...xs: A) => void) extends (...a: infer X) => void ? X : never;
type GrowToSize<T, A extends Array<T>, N extends number> = {
  0: A;
  1: GrowToSize<T, Grow<T, A>, N>;
}[A["length"] extends N ? 0 : 1];

export type FixedArray<T, N extends number> = GrowToSize<T, [], N>;

export interface AtomicMatchParams {
  addrs: FixedArray<string, 14>;
  uints: FixedArray<BigNumber, 18>;
  feeMethodsSidesKindsHowToCalls: FixedArray<number, 8>;
  calldataBuy: string;
  calldataSell: string;
  replacementPatternBuy: string;
  replacementPatternSell: string;
  staticExtradataBuy: string;
  staticExtradataSell: string;
  vs: FixedArray<number, 2>;
  rssMetadata: FixedArray<string, 5>;
}

export const buildAtomicMatchParams = (
  buy: Order,
  buySig: ECDSASignature,
  sell: Order,
  sellSig: ECDSASignature,
  referrerAddress: string
): AtomicMatchParams => {
  return {
    addrs: [
      buy.exchange,
      buy.maker,
      buy.taker,
      buy.feeRecipient,
      buy.target,
      buy.staticTarget,
      buy.paymentToken,
      sell.exchange,
      sell.maker,
      sell.taker,
      sell.feeRecipient,
      sell.target,
      sell.staticTarget,
      sell.paymentToken,
    ],
    uints: [
      buy.makerRelayerFee,
      buy.takerRelayerFee,
      buy.makerProtocolFee,
      buy.takerProtocolFee,
      buy.basePrice,
      buy.extra,
      buy.listingTime,
      buy.expirationTime,
      buy.salt,
      sell.makerRelayerFee,
      sell.takerRelayerFee,
      sell.makerProtocolFee,
      sell.takerProtocolFee,
      sell.basePrice,
      sell.extra,
      sell.listingTime,
      sell.expirationTime,
      sell.salt,
    ],
    feeMethodsSidesKindsHowToCalls: [
      buy.feeMethod,
      buy.side,
      buy.saleKind,
      buy.howToCall,
      sell.feeMethod,
      sell.side,
      sell.saleKind,
      sell.howToCall,
    ],
    calldataBuy: buy.calldata,
    calldataSell: sell.calldata,
    replacementPatternBuy: buy.replacementPattern,
    replacementPatternSell: sell.replacementPattern,
    staticExtradataBuy: buy.staticExtradata,
    staticExtradataSell: sell.staticExtradata,
    vs: [buySig.v, sellSig.v],
    rssMetadata: [
      "0x" + buySig.r.toString("hex"),
      "0x" + buySig.s.toString("hex"),
      "0x" + sellSig.r.toString("hex"),
      "0x" + sellSig.s.toString("hex"),
      referrerAddress,
    ],
  };
};

export const buildFlashloanParamsFromOpenSeaOrder = (
  nftAsset: string,
  tokenId: number,
  order: OrderJSON,
  buyer: string,
  privateKey: string,
  nonce: number,
  chainId: number
): string => {
  const asset = { tokenId: tokenId.toString(), tokenAddress: nftAsset };
  let sell = {
    exchange: order.exchange,
    maker: order.maker,
    taker: order.taker,
    makerRelayerFee: BigNumber.from(order.makerRelayerFee),
    takerRelayerFee: BigNumber.from(order.takerRelayerFee),
    makerProtocolFee: BigNumber.from(order.makerProtocolFee),
    takerProtocolFee: BigNumber.from(order.takerProtocolFee),
    feeRecipient: order.feeRecipient,
    feeMethod: order.feeMethod,
    side: order.side,
    saleKind: order.saleKind,
    target: order.target,
    howToCall: order.howToCall,
    calldata: order.calldata,
    replacementPattern: order.replacementPattern,
    staticTarget: order.staticTarget,
    staticExtradata: order.staticExtradata,
    paymentToken: order.paymentToken,
    basePrice: BigNumber.from(order.basePrice),
    extra: BigNumber.from(order.extra),
    listingTime: BigNumber.from(order.listingTime),
    expirationTime: BigNumber.from(order.expirationTime),
    salt: BigNumber.from(order.salt),
    asset,
  };
  let buy = makeBuyOrder(sell, buyer, sell.feeRecipient, sell.listingTime);

  let buySig = signOrder(privateKey, buy, chainId, nonce);
  let params = buildFlashloanParams(
    nftAsset,
    tokenId,
    buy,
    buySig,
    sell,
    { v: order.v || 0, r: Buffer.from(order.r || "", "hex"), s: Buffer.from(order.s || "", "hex") },
    "0x0000000000000000000000000000000000000000000000000000000000000000"
  );
  return encodeFlashLoanParams(params);
};

export const encodeFlashLoanParams = (params: any): string => {
  return ethers.utils.defaultAbiCoder.encode(
    ["(address,uint256,address[14],uint256[18],uint8[8],bytes,bytes,bytes,bytes,bytes,bytes,uint8[2],bytes32[5])"],
    [params]
  );
};

export const buildFlashloanParams = (
  nftAsset: string,
  tokenId: number,
  buy: Order,
  buySig: ECDSASignature,
  sell: Order,
  sellSig: ECDSASignature,
  referrerAddress: string
) => {
  return [
    nftAsset,
    tokenId,
    [
      buy.exchange,
      buy.maker,
      buy.taker,
      buy.feeRecipient,
      buy.target,
      buy.staticTarget,
      buy.paymentToken,
      sell.exchange,
      sell.maker,
      sell.taker,
      sell.feeRecipient,
      sell.target,
      sell.staticTarget,
      sell.paymentToken,
    ],
    [
      buy.makerRelayerFee.toString(),
      buy.takerRelayerFee.toString(),
      buy.makerProtocolFee.toString(),
      buy.takerProtocolFee.toString(),
      buy.basePrice.toString(),
      buy.extra.toString(),
      buy.listingTime.toString(),
      buy.expirationTime.toString(),
      buy.salt.toString(),
      sell.makerRelayerFee.toString(),
      sell.takerRelayerFee.toString(),
      sell.makerProtocolFee.toString(),
      sell.takerProtocolFee.toString(),
      sell.basePrice.toString(),
      sell.extra.toString(),
      sell.listingTime.toString(),
      sell.expirationTime.toString(),
      sell.salt.toString(),
    ],
    [buy.feeMethod, buy.side, buy.saleKind, buy.howToCall, sell.feeMethod, sell.side, sell.saleKind, sell.howToCall],
    buy.calldata,
    sell.calldata,
    buy.replacementPattern,
    sell.replacementPattern,
    buy.staticExtradata,
    sell.staticExtradata,
    [buySig.v, sellSig.v],
    [
      "0x" + buySig.r.toString("hex"),
      "0x" + buySig.s.toString("hex"),
      "0x" + sellSig.r.toString("hex"),
      "0x" + sellSig.s.toString("hex"),
      referrerAddress,
    ],
  ];
};

export const strOrder = (order: Order) => {
  return {
    exchange: order.exchange,
    maker: order.maker,
    taker: order.taker,
    makerRelayerFee: order.makerRelayerFee.toString(),
    takerRelayerFee: order.takerRelayerFee.toString(),
    makerProtocolFee: order.makerProtocolFee.toString(),
    takerProtocolFee: order.takerProtocolFee.toString(),
    feeRecipient: order.feeRecipient,
    feeMethod: order.feeMethod.toString(),
    side: order.side.toString(),
    saleKind: order.saleKind.toString(),
    target: order.target,
    howToCall: order.howToCall.toString(),
    calldata: order.calldata,
    replacementPattern: order.replacementPattern,
    staticTarget: order.staticTarget,
    staticExtradata: order.staticExtradata,
    paymentToken: order.paymentToken,
    basePrice: order.basePrice.toString(),
    extra: order.extra.toString(),
    listingTime: order.listingTime.toString(),
    expirationTime: order.expirationTime.toString(),
    salt: order.salt.toString(),
  };
};

export const signFlashLoanParams = (
  privateKey: string,
  chainId: number,
  nonce: string,
  adapter: string,
  nftAsset: string,
  nftTokenId: string,
  buy: Order,
  sell: Order,
  sellSig: ECDSASignature,
  metadata: string
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
      nftAsset,
      nftTokenId,
      buy: strOrder(buy),
      sell: strOrder(sell),
      sellSig: {
        v: sellSig.v.toString(),
        r: "0x" + sellSig.r.toString("hex"),
        s: "0x" + sellSig.s.toString("hex"),
      },
      metadata,
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
  Sig: [
    { name: "v", type: "uint8" },
    { name: "r", type: "bytes32" },
    { name: "s", type: "bytes32" },
  ],
  Order: [
    { name: "exchange", type: "address" },
    { name: "maker", type: "address" },
    { name: "taker", type: "address" },
    { name: "makerRelayerFee", type: "uint256" },
    { name: "takerRelayerFee", type: "uint256" },
    { name: "makerProtocolFee", type: "uint256" },
    { name: "takerProtocolFee", type: "uint256" },
    { name: "feeRecipient", type: "address" },
    { name: "feeMethod", type: "uint8" },
    { name: "side", type: "uint8" },
    { name: "saleKind", type: "uint8" },
    { name: "target", type: "address" },
    { name: "howToCall", type: "uint8" },
    { name: "calldata", type: "bytes" },
    { name: "replacementPattern", type: "bytes" },
    { name: "staticTarget", type: "address" },
    { name: "staticExtradata", type: "bytes" },
    { name: "paymentToken", type: "address" },
    { name: "basePrice", type: "uint256" },
    { name: "extra", type: "uint256" },
    { name: "listingTime", type: "uint256" },
    { name: "expirationTime", type: "uint256" },
    { name: "salt", type: "uint256" },
  ],
  Params: [
    { name: "nftAsset", type: "address" },
    { name: "nftTokenId", type: "uint256" },
    {
      name: "buy",
      type: "Order",
    },
    {
      name: "sell",
      type: "Order",
    },
    {
      name: "sellSig",
      type: "Sig",
    },

    { name: "metadata", type: "bytes32" },
    { name: "nonce", type: "uint256" },
  ],
};

export const EIP_712_ADAPTER_DOMAIN_NAME = "Opensea Downpayment Buy Adapter";
export const EIP_712_ADAPTER_DOMAIN_VERSION = "1.0";
