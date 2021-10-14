const { expect } = require("chai");
const { ethers } = require("hardhat");
const { expectEvent, expectRevert } = require("@openzeppelin/test-helpers");

describe("NFTOralce", () => {
    let NFTOracle;
    let nftOracleInstance;
    let owner;
    let addr1;
    let addr2;
    let addrs

    beforeEach(async () => {
        NFTOracle = await ethers.getContractFactory("NFTOracleFake");
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
        nftOracleInstance = await NFTOracle.deploy();
        await nftOracleInstance.deployed();
        await nftOracleInstance.initialize(owner.address);
    });

    it("add Asset", async () => {
        await nftOracleInstance.addAsset(addr1.address)
        expect(await nftOracleInstance.nftPriceFeedKeys(0)).eq(addr1.address)
    });

    it("add multi Assets", async () => {
        await nftOracleInstance.addAsset(addr1.address)
        await nftOracleInstance.addAsset(addr2.address)
        expect(await nftOracleInstance.nftPriceFeedKeys(0)).eq(addr1.address)
        expect(await nftOracleInstance.nftPriceFeedKeys(1)).eq(addr2.address)
    })

    it("remove 1 asset when there's only 1", async () => {
        await nftOracleInstance.addAsset(addr1.address)
        await nftOracleInstance.removeAsset(addr1.address)

        let error
        try {
            await nftOracleInstance.nftPriceFeedKeys(0)
        } catch (e) {
            error = e
        }
        expect(error).not.eq(undefined)
    })

    it("remove 1 asset when there're 2", async () => {
        await nftOracleInstance.addAsset(addr1.address)
        await nftOracleInstance.addAsset(addr2.address)
        await nftOracleInstance.removeAsset(addr1.address)
        expect(await nftOracleInstance.nftPriceFeedKeys(0)).eq(addr2.address)
        expect(await nftOracleInstance.getPriceFeedLength(addr1.address)).to.equal('0');
    })

    it("set Asset Data", async () => {
        await nftOracleInstance.addAsset(addr1.address)
        const currentTime = await nftOracleInstance.mock_getCurrentTimestamp()
        const dataTimestamp = currentTime + 15

        const r = await nftOracleInstance.setAssetData(addr1.address, 400, dataTimestamp, 1)
        // await expectEvent.inTransaction(r.tx, nftOracleInstance, "NFTPriceFeedDataSet", {
        //     key: addr1.address,
        //     price: 400,
        //     timestamp: 1444004400,
        //     roundId: "1",
        // })
        expect(await nftOracleInstance.getPriceFeedLength(addr1.address)).to.equal('1')
        const price = await nftOracleInstance.getAssetPrice(addr1.address)
        expect(price).to.equal("400")
        const timestamp = await nftOracleInstance.getLatestTimestamp(addr1.address)
        expect(timestamp).to.equal(dataTimestamp)
    })

    it("set multiple data", async () => {
        await nftOracleInstance.addAsset(addr1.address)
        const currentTime = await nftOracleInstance.mock_getCurrentTimestamp()
        await nftOracleInstance.setAssetData(addr1.address, 400, currentTime + 15, 100)
        await nftOracleInstance.setAssetData(addr1.address, 410, currentTime + 30, 101)
        const r = await nftOracleInstance.setAssetData(addr1.address, 420, currentTime + 45, 102)
        //await expectEvent.inTransaction(r.tx, this.l2PriceFeed, "PriceFeedDataSet")
        expect(await nftOracleInstance.getPriceFeedLength(addr1.address)).to.equal('3')
        const price = await nftOracleInstance.getAssetPrice(addr1.address)
        expect(price).to.equal("420")
        const timestamp = await nftOracleInstance.getLatestTimestamp(addr1.address)
        expect(timestamp).to.equal(currentTime + 45)
    })

    it("getAssetPrice after remove the asset", async () => {
        await nftOracleInstance.addAsset(addr1.address)
        await nftOracleInstance.addAsset(addr2.address)
        const currentTime = await nftOracleInstance.mock_getCurrentTimestamp()
        await nftOracleInstance.setAssetData(addr1.address, 400, currentTime + 15, 100)
        await nftOracleInstance.setAssetData(addr1.address, 410, currentTime + 30, 101)
        await nftOracleInstance.setAssetData(addr1.address, 420, currentTime + 45, 102)

        await nftOracleInstance.removeAsset(addr1.address)

        await expectRevert(nftOracleInstance.getAssetPrice(addr1.address), "key not existed",)
        // await expectRevert(nftOracleInstance.getLatestTimestamp(addr1.address), "key not existed")
    })

    it("round id can be the same", async () => {
        await nftOracleInstance.addAsset(addr1.address)
        await nftOracleInstance.setAssetData(addr1.address, 400, 1444004415, 100)
        await nftOracleInstance.setAssetData(addr1.address, 400, 1444004430, 100)
        await expectEvent.inTransaction(r.tx, nftOracleInstance, "SetAssetData")
    })

    it("force error, get data with no price feed data", async () => {
        await nftOracleInstance.addAsset(addr1.address)

        expect(await nftOracleInstance.getPriceFeedLength(addr1.address)).to.equal('0')
        expect(await nftOracleInstance.getLatestTimestamp(addr1.address)).to.equal('0')

        await expectRevert(nftOracleInstance.getAssetPrice(addr1.address), "no price data")
        await expectRevert(nftOracleInstance.getTwapPrice(addr1.address, 1), "Not enough history")
        await expectRevert(nftOracleInstance.getPreviousPrice(addr1.address, 0), "Not enough history")
        await expectRevert(nftOracleInstance.getPreviousTimestamp(addr1.address, 0), "Not enough history")
    })

    it("force error, asset should be set first", async () => {
        await expectRevert(
            nftOracleInstance.setAssetData(addr1.address, 400, 1444004415, 100),
            "key not existed",
        )
    })

    it("force error, timestamp should be larger", async () => {
        await nftOracleInstance.addAsset(addr1.address)
        await nftOracleInstance.setAssetData(addr1.address, 400, 1444004415, 100)
        await expectRevert(
            await nftOracleInstance.setAssetData(addr1.address, 400, 1444004400, 100),
            "incorrect timestamp",
        )
    })

    it("force error, timestamp can't be the same", async () => {
        await nftOracleInstance.addAsset(addr1.address)
        await nftOracleInstance.setAssetData(addr1.address, 400, 1444004415, 100)
        await expectRevert(
            await nftOracleInstance.setAssetData(addr1.address, 400, 1444004415, 101),
            "incorrect timestamp",
        )
    })

    describe("twap", () => {
        beforeEach(async () => {
            await nftOracleInstance.addAsset(addr1.address)

            await nftOracleInstance.setAssetData(addr1.address, 400, 1444004415, 100)
            await nftOracleInstance.setAssetData(addr1.address, 405, 1444004430, 101)
            await nftOracleInstance.setAssetData(addr1.address, 410, 1444004445, 102)
        })

        it("twap price", async () => {
            const price = await nftOracleInstance.getTwapPrice(addr1.address, 45)
            expect(price).to.equal("405")
        })

        it("asking interval more than asset has", async () => {
            const price = await nftOracleInstance.getTwapPrice(addr1.address, 46)
            expect(price).to.equal("405")
        })

        it("asking interval less than asset has", async () => {
            const price = await nftOracleInstance.getTwapPrice(toBytes32("ETH"), 44)
            expect(price).to.equal("405113636363636363636")
        })

        it("given variant price period", async () => {
            const currentTime = await this.l2PriceFeed.mock_getCurrentTimestamp()
            await this.l2PriceFeed.mock_setBlockTimestamp(currentTime.addn(30))
            await this.l2PriceFeed.setLatestData(toBytes32("ETH"), toFullDigit(420), currentTime.addn(30), 4)
            await this.l2PriceFeed.mock_setBlockTimestamp(currentTime.addn(50))

            await nftOracleInstance.setAssetData(addr1.address, 420, 1444004490, 103)

            // twap price should be (400 * 15) + (405 * 15) + (410 * 45) + (420 * 20) / 95 = 409.74
            const price = await nftOracleInstance.getTwapPrice(addr1.address, 95)
            expect(price).to.equal("409736842105263157894")
        })

        it("latest price update time is earlier than the request, return the latest price", async () => {
            const currentTime = await this.l2PriceFeed.mock_getCurrentTimestamp()
            await this.l2PriceFeed.mock_setBlockTimestamp(currentTime.addn(100))

            // latest update time is base + 30, but now is base + 145 and asking for (now - 45)
            // should return the latest price directly
            const price = await this.l2PriceFeed.getTwapPrice(toBytes32("ETH"), 45)
            assert.equal(price.valueOf(), toFullDigitStr(410))
        })

        it("get 0 while interval is zero", async () => {
            await expectRevert(nftOracleInstance.getTwapPrice(addr1.address, 0), "interval can't be 0")
        })
    })

    describe("getPreviousPrice/getPreviousTimestamp", () => {
        let baseTimestamp
        beforeEach(async () => {
            await nftOracleInstance.addAsset(addr1.address)

            await nftOracleInstance.setAssetData(addr1.address, 400, 1444004415, 100)
            await nftOracleInstance.setAssetData(addr1.address, 410, 1444004430, 101)
            await nftOracleInstance.setAssetData(addr1.address, 420, 1444004445, 102)
        })

        it("get previous price (latest)", async () => {
            const price = await nftOracleInstance.getPreviousPrice(addr1.address, 0)
            expect(price).to.equal("420")
            const timestamp = await nftOracleInstance.getPreviousTimestamp(addr1.address, 0)
            expect(timestamp).to.equal("1444004445")

            const price = await nftOracleInstance.getPreviousPrice(addr1.address, 0)
            assert.equal(price.valueOf(), toFullDigitStr(410))
            const timestamp = await this.l2PriceFeed.getPreviousTimestamp(toBytes32("ETH"), 0)
            assert.equal(timestamp.valueOf(), (baseTimestamp.addn(45)).toString())
        })

        it("get previous price", async () => {
            const price = await nftOracleInstance.getPreviousPrice(addr1.address, 2)
            expect(price).to.equal("400")
            const timestamp = await nftOracleInstance.getPreviousTimestamp(addr1.address, 2)
            expect(timestamp).to.equal("1444004415")
        })

        it("force error, get previous price", async () => {
            await expectRevert(nftOracleInstance.getPreviousPrice(addr1.address, 3), "Not enough history")
            await expectRevert(nftOracleInstance.getPreviousTimestamp(addr1.address, 3), "Not enough history")
        })
    })
});
