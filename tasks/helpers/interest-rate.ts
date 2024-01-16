import { task } from "hardhat/config";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import { getLendPoolAddressesProvider } from "../../helpers/contracts-getters";
import { eContractid, eNetwork, IReserveParams } from "../../helpers/types";
import { deployInterestRate, deployInterestRateWithID } from "../../helpers/contracts-deployments";
import { notFalsyOrZeroAddress, waitForTx } from "../../helpers/misc-utils";
import { getEthersSignerByAddress, insertContractAddressInDb } from "../../helpers/contracts-helpers";
import BigNumber from "bignumber.js";
import { oneRay } from "../../helpers/constants";
import { strategyReserveParams } from "../../markets/bend/reservesConfigs";

task("helpers:deploy-new-interest-rate-for-symbol", "Add and config new reserve asset to lend pool")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("symbol", "Address of underlying reserve asset contract")
  .addOptionalParam("strategy", "Name of reserve strategy, supported: ClassA, ClassB, ClassC, ClassD, ClassE")
  .setAction(async ({ verify, pool, symbol, strategy }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);

    const addressesProviderRaw = await getLendPoolAddressesProvider();
    const providerOwnerSigner = await getEthersSignerByAddress(await addressesProviderRaw.owner());
    const addressesProvider = addressesProviderRaw.connect(providerOwnerSigner);

    let reserveParam: IReserveParams;
    if (strategy != undefined && strategy != "") {
      reserveParam = strategyReserveParams[strategy];
    } else {
      reserveParam = poolConfig.ReservesConfig[symbol];
    }
    if (reserveParam == undefined) {
      throw new Error("The strategy of symbol is not exist");
    }

    let rateParams = reserveParam.strategy;

    console.log("Interest rate params:", rateParams);

    const rateInstance = await deployInterestRateWithID(
      rateParams.name,
      [
        addressesProvider.address,
        rateParams.optimalUtilizationRate,
        rateParams.baseVariableBorrowRate,
        rateParams.variableRateSlope1,
        rateParams.variableRateSlope2,
      ],
      verify
    );
    console.log("InterestRate implementation address:", rateParams.name, rateInstance.address);
  });

task("helpers:deploy-new-interest-rate", "Deploy new interest rate implementation")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("id", "ID of interest rate contract")
  .addParam("optUtilRate", "Optimal Utilization Rate, 0-1, 0.65")
  .addParam("baseRate", "Base Interest Rate, 0-1, 0.1")
  .addParam("rateSlope1", "Variable Rate Slope1, 0-1, 0.08")
  .addParam("rateSlope2", "Variable Rate Slope2, 0-1, 1.0")
  .setAction(async ({ verify, pool, id, optUtilRate, baseRate, rateSlope1, rateSlope2 }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const addressesProviderRaw = await getLendPoolAddressesProvider();
    const providerOwnerSigner = await getEthersSignerByAddress(await addressesProviderRaw.owner());
    const addressesProvider = addressesProviderRaw.connect(providerOwnerSigner);

    const optUtilRateInRay = new BigNumber(optUtilRate).multipliedBy(oneRay).toFixed();
    const baseRateInRay = new BigNumber(baseRate).multipliedBy(oneRay).toFixed();
    const rateSlope1InRay = new BigNumber(rateSlope1).multipliedBy(oneRay).toFixed();
    const rateSlope2InRay = new BigNumber(rateSlope2).multipliedBy(oneRay).toFixed();

    const rateInstance = await deployInterestRateWithID(
      id,
      [addressesProvider.address, optUtilRateInRay, baseRateInRay, rateSlope1InRay, rateSlope2InRay],
      verify
    );
    console.log("InterestRate implementation address:", id, rateInstance.address);
  });
