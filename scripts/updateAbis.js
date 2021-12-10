const fs = require("fs")
const path = require("path");

const protocolContractList = [
  "LendPoolAddressesProviderRegistry",
  "LendPoolAddressesProvider",
  "LendPoolConfigurator",
  "LendPool",
  "LendPoolLoan",
  "InterestRate",
  "ReserveOracle",
  "NFTOracle",
  "BToken",
  "DebtToken",
  "PunkGateway",
  "WETHGateway",
];

const miscContractList = ["UiPoolDataProvider", "BendProtocolDataProvider", "WalletBalanceProvider"];

const interfacesContractList = ["IERC20Detailed", "IERC721Detailed", "IIncentivesController"];

const updateAbis = async (subDir, contractList) => {
  contractList.forEach((contract) => {
    const artifact = require(`../artifacts/contracts/${subDir}/${contract}.sol/${contract}.json`);
    const { abi } = artifact;

    const configStringified = JSON.stringify(abi, null, 2);
    console.log("Getting ABI for contract: ", contract);
    const abiPath = `../abis/${contract}.json`;
    fs.writeFileSync(path.join(__dirname, abiPath), configStringified);
  });
};

function deleteFolderRecursive(directoryPath) {
    if (fs.existsSync(directoryPath)) {
        fs.rmSync(directoryPath, {recursive: true})
    }
}

deleteFolderRecursive("../abis");

updateAbis("protocol", protocolContractList).then().catch();

updateAbis("misc", miscContractList).then().catch();

updateAbis("interfaces", interfacesContractList).then().catch();
