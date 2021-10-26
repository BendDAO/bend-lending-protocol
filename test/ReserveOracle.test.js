const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ReserveOralce", () => {
    const EMPTY_ADDRESS = "0x0000000000000000000000000000000000000000"
    let chainLinkMock;
    let reserveOracle;
    let owner;
    let addr1;
    let addr2;
    let addrs

    beforeEach(async () => {
        ro = await ethers.getContractFactory("ReserveOracle");
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
        reserveOracle = await ro.deploy();
        await reserveOracle.deployed();
        await reserveOracle.initialize(stringToBytes32("ETH"));

        cm = await ethers.getContractFactory("ChainlinkMock");
        chainLinkMock = await cm.deploy(8);
        await chainLinkMock.deployed();
    });

    function stringToBytes32(str) {
        return ethers.utils.formatBytes32String(str)
    }

    function fromBytes32(str) {
        return ethers.utils.parseBytes32String(str)
    }

    it("addAggregator", async () => {
        await reserveOracle.addAggregator(stringToBytes32("ETH"), chainLinkMock.address)
        expect(fromBytes32(await reserveOracle.priceFeedKeys(0))).eq("ETH")
        expect(await reserveOracle.getAggregator(stringToBytes32("ETH"))).eq(chainLinkMock.address)
        expect(await reserveOracle.getAggregator(stringToBytes32("BTC"))).eq(EMPTY_ADDRESS)
        await reserveOracle.addAggregator(stringToBytes32("BTC"), addr1.address)
        expect(fromBytes32(await reserveOracle.priceFeedKeys(1))).eq("BTC")
        expect(await reserveOracle.getAggregator(stringToBytes32("BTC"))).eq(addr1.address)
        await expect(reserveOracle.addAggregator(stringToBytes32("LINK"), EMPTY_ADDRESS)).to.be.revertedWith(
            "empty address"
        )
    })

    it("removeAggregator", async () => {
        await reserveOracle.addAggregator(stringToBytes32("ETH"), chainLinkMock.address)
        await reserveOracle.addAggregator(stringToBytes32("BTC"), chainLinkMock.address)
        await reserveOracle.removeAggregator(stringToBytes32("ETH"))
        expect(fromBytes32(await reserveOracle.priceFeedKeys(0))).eq("BTC")
        expect(await reserveOracle.getAggregator(stringToBytes32("ETH"))).eq(EMPTY_ADDRESS)
        expect(await reserveOracle.getAggregator(stringToBytes32("BTC"))).eq(chainLinkMock.address)
    })

    it("get latest price", async () => {
        await reserveOracle.addAggregator(stringToBytes32("ETH"), chainLinkMock.address)
        await chainLinkMock.mockAddAnswer(8, 12345678, 1, 200000000000, 1)
        await expect(reserveOracle.getAssetPrice(stringToBytes32("LINK"))).to.be.revertedWith(
            "key not existed"
        )
        expect(await reserveOracle.getAssetPrice(stringToBytes32("ETH")), "12345678")
        await chainLinkMock.mockAddAnswer(9, 100, 2, 200000000001, 2)
        expect(await reserveOracle.getAssetPrice(stringToBytes32("ETH")), "100")
    })

    it("get latest timestamp", async () => {
        await reserveOracle.addAggregator(stringToBytes32("ETH"), chainLinkMock.address)
        await chainLinkMock.mockAddAnswer(8, 12345678, 1, 200000000000, 1)
        await expect(reserveOracle.getLatestTimestamp(stringToBytes32("LINK"))).to.be.revertedWith(
            "empty address"
        )
        expect(await reserveOracle.getLatestTimestamp(stringToBytes32("ETH")), "200000000000")
        await chainLinkMock.mockAddAnswer(9, 100, 2, 200000000001, 2)
        expect(await reserveOracle.getLatestTimestamp(stringToBytes32("ETH")), "200000000001")
    })
});
