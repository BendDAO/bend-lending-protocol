import { BigNumberish } from "@ethersproject/bignumber";
import { task } from "hardhat/config";
import { ConfigNames, getProviderRegistryAddress, loadPoolConfig } from "../../helpers/configuration";
import { ADDRESS_ID_PUNK_GATEWAY, oneRay } from "../../helpers/constants";
import { deployInterestRate } from "../../helpers/contracts-deployments";
import {
  getBToken,
  getDebtToken,
  getIErc20Detailed,
  getInterestRate,
  getLendPoolAddressesProvider,
  getLendPoolConfiguratorProxy,
  getPunkGateway,
} from "../../helpers/contracts-getters";
import { getEthersSignerByAddress, getParamPerNetwork } from "../../helpers/contracts-helpers";
import { getNowTimeInSeconds, notFalsyOrZeroAddress, waitForTx } from "../../helpers/misc-utils";
import { eContractid, eNetwork, IReserveParams } from "../../helpers/types";
import { strategyReserveParams } from "../../markets/bend/reservesConfigs";

task("helpers:add-reserve-to-pool", "Add and config new reserve asset to lend pool")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("asset", "Address of underlying reserve asset contract")
  .addParam("interest", "Address of interest rate contract")
  .addOptionalParam("strategy", "Name of reserve strategy, supported: ClassA, ClassB, ClassC, ClassD, ClassE")
  .setAction(async ({ pool, asset, interest, strategy }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);

    const addressesProvider = await getLendPoolAddressesProvider();

    const poolAdminSigner = await getEthersSignerByAddress(await addressesProvider.getPoolAdmin());

    const lendPoolConfiguratorProxy = await getLendPoolConfiguratorProxy(
      await addressesProvider.getLendPoolConfigurator()
    );

    const treasuryAddress = getParamPerNetwork(poolConfig.ReserveFactorCollectorAddress, network);
    console.log(`Treasury Address: ${treasuryAddress}`);

    const punkGateway = await getPunkGateway(await addressesProvider.getAddress(ADDRESS_ID_PUNK_GATEWAY));
    const genericBTokenImpl = await getBToken();
    const genericDebtTokenImpl = await getDebtToken();
    console.log(
      `Generic implementation: BToken: ${genericBTokenImpl.address}, DebtToken: ${genericDebtTokenImpl.address}`
    );

    const reserveContract = await getIErc20Detailed(asset);
    const reserveName = await reserveContract.name();
    const reserveSymbol = await reserveContract.symbol();
    const reserveDecimals = await reserveContract.decimals();
    console.log("Reserve:", reserveSymbol, reserveDecimals);

    let reserveParam: IReserveParams;
    if (strategy != undefined && strategy != "") {
      reserveParam = strategyReserveParams[strategy];
    } else {
      reserveParam = poolConfig.ReservesConfig[reserveSymbol];
    }
    if (reserveParam == undefined) {
      throw new Error("The strategy of asset is not exist");
    }

    if (reserveParam.reserveDecimals != reserveDecimals.toString()) {
      throw new Error("The decimals of asset is not match");
    }

    console.log("Reserve Strategy:", reserveParam);

    let rateStrategy = reserveParam.strategy;
    const rateInstance = await getInterestRate(interest);
    console.log("InterestRate implementation address:", rateInstance.address);

    console.log("Initialize reserve to lend pool");
    const initInputParams: {
      bTokenImpl: string;
      debtTokenImpl: string;
      underlyingAssetDecimals: BigNumberish;
      interestRateAddress: string;
      underlyingAsset: string;
      treasury: string;
      underlyingAssetName: string;
      bTokenName: string;
      bTokenSymbol: string;
      debtTokenName: string;
      debtTokenSymbol: string;
    }[] = [
      {
        bTokenImpl: genericBTokenImpl.address,
        debtTokenImpl: genericDebtTokenImpl.address,
        underlyingAssetDecimals: reserveParam.reserveDecimals,
        interestRateAddress: rateInstance.address,
        underlyingAsset: asset,
        treasury: treasuryAddress,
        underlyingAssetName: reserveName,
        bTokenName: `${poolConfig.BTokenNamePrefix} ${reserveSymbol}`,
        bTokenSymbol: `${poolConfig.BTokenSymbolPrefix}${reserveSymbol}`,
        debtTokenName: `${poolConfig.DebtTokenNamePrefix} ${reserveSymbol}`,
        debtTokenSymbol: `${poolConfig.DebtTokenSymbolPrefix}${reserveSymbol}`,
      },
    ];
    console.log("Reserve initInputParams:", initInputParams);
    //await waitForTx(await lendPoolConfiguratorProxy.connect(poolAdminSigner).batchInitReserve(initInputParams));

    console.log("Configure reserve parameters to lend pool");
    let cfgInputParams: {
      asset: string;
      reserveFactor: BigNumberish;
      maxUtilizationRate: BigNumberish;
    }[] = [
      {
        asset: asset,
        reserveFactor: reserveParam.reserveFactor,
        maxUtilizationRate: oneRay,
      },
    ];
    console.log("Reserve cfgInputParams:", cfgInputParams);
    //await waitForTx(await lendPoolConfiguratorProxy.connect(poolAdminSigner).batchConfigReserve(cfgInputParams));

    console.log("PunkGateway authorizeLendPoolERC20");
    //await waitForTx(await punkGateway.authorizeLendPoolERC20([asset]));

    console.log("OK");
  });
