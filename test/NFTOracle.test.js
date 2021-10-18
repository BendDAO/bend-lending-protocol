const { expect } = require("chai");
const { ethers } = require("hardhat");
const { expectEvent, expectRevert } = require("@openzeppelin/test-helpers");

describe("NFTOralce", () => {
    let nftOracleInstance;
    let owner;
    let addr1;
    let addr2;
    let addrs

    beforeEach(async () => {
        let NFTOracle = await ethers.getContractFactory("NFTOracleFake");
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
        nftOracleInstance = await NFTOracle.deploy();
        await nftOracleInstance.deployed();
        await nftOracleInstance.initialize(owner.address);
    });

    it("add Asset", async () => {
        expect(await nftOracleInstance.owner()).to.equal(owner.address);
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
        await expect(nftOracleInstance.getAssetPrice(addr1.address)).to.be.revertedWith(
            "key not existed"
        );
        await expect(nftOracleInstance.getLatestTimestamp(addr1.address)).to.be.revertedWith(
            "key not existed"
        );
        //await expectRevert(nftOracleInstance.getAssetPrice(addr1.address), "key not existed")
        // await expectRevert(nftOracleInstance.getLatestTimestamp(addr1.address), "key not existed")
    })

    it("round id can be the same", async () => {
        const currentTime = await nftOracleInstance.mock_getCurrentTimestamp()
        await nftOracleInstance.addAsset(addr1.address)
        await nftOracleInstance.setAssetData(addr1.address, 400, currentTime + 15, 100)
        await nftOracleInstance.setAssetData(addr1.address, 400, currentTime + 30, 100)
        //await expectEvent.inTransaction(r.tx, nftOracleInstance, "SetAssetData")
    })

    it("force error, get data with no price feed data", async () => {
        await nftOracleInstance.addAsset(addr1.address)

        expect(await nftOracleInstance.getPriceFeedLength(addr1.address)).to.equal('0')
        expect(await nftOracleInstance.getLatestTimestamp(addr1.address)).to.equal('0')

        await expect(nftOracleInstance.getAssetPrice(addr1.address)).to.be.revertedWith(
            "no price data"
        )
        await expect(nftOracleInstance.getTwapPrice(addr1.address, 1)).to.be.revertedWith(
            "Not enough history"
        )
        await expect(nftOracleInstance.getPreviousPrice(addr1.address, 0)).to.be.revertedWith(
            "Not enough history"
        )
        await expect(nftOracleInstance.getPreviousTimestamp(addr1.address, 0)).to.be.revertedWith(
            "Not enough history"
        )
        // await expectRevert(nftOracleInstance.getAssetPrice(addr1.address), "no price data")
        // await expectRevert(nftOracleInstance.getTwapPrice(addr1.address, 1), "Not enough history")
        // await expectRevert(nftOracleInstance.getPreviousPrice(addr1.address, 0), "Not enough history")
        // await expectRevert(nftOracleInstance.getPreviousTimestamp(addr1.address, 0), "Not enough history")
    })

    it("force error, asset should be set first", async () => {
        // await expectRevert(
        //     nftOracleInstance.setAssetData(addr1.address, 400, 1444004415, 100),
        //     "key not existed",
        // )
        const currentTime = await nftOracleInstance.mock_getCurrentTimestamp()
        await expect(nftOracleInstance.setAssetData(addr1.address, 400, currentTime + 15, 100)).to.be.revertedWith(
            "key not existed"
        )
    })

    it("force error, timestamp should be larger", async () => {
        const currentTime = await nftOracleInstance.mock_getCurrentTimestamp()
        await nftOracleInstance.addAsset(addr1.address)
        await nftOracleInstance.setAssetData(addr1.address, 400, currentTime + 15, 100)
        // await expectRevert(
        //     await nftOracleInstance.setAssetData(addr1.address, 400, 1444004400, 100),
        //     "incorrect timestamp",
        // )
        await expect(nftOracleInstance.setAssetData(addr1.address, 400, currentTime, 100)).to.be.revertedWith(
            "incorrect timestamp"
        )
    })

    it("force error, timestamp can't be the same", async () => {
        const currentTime = await nftOracleInstance.mock_getCurrentTimestamp()
        await nftOracleInstance.addAsset(addr1.address)
        await nftOracleInstance.setAssetData(addr1.address, 400, currentTime + 15, 100)
        // await expectRevert(
        //     await nftOracleInstance.setAssetData(addr1.address, 400, 1444004415, 101),
        //     "incorrect timestamp",
        // )
        await expect(nftOracleInstance.setAssetData(addr1.address, 400, currentTime + 15, 101)).to.be.revertedWith(
            "incorrect timestamp"
        )
    })

    describe("twap", () => {
        beforeEach(async () => {
            await nftOracleInstance.addAsset(addr1.address)
            const currentTime = await nftOracleInstance.mock_getCurrentTimestamp()
            await nftOracleInstance.mock_setBlockTimestamp(currentTime.add(15))
            await nftOracleInstance.setAssetData(addr1.address, 4000000000000000, currentTime.add(15), 100)
            await nftOracleInstance.mock_setBlockTimestamp(currentTime.add(30))
            await nftOracleInstance.setAssetData(addr1.address, 4050000000000000, currentTime.add(30), 101)
            await nftOracleInstance.mock_setBlockTimestamp(currentTime.add(45))
            await nftOracleInstance.setAssetData(addr1.address, 4100000000000000, currentTime.add(45), 102)
            await nftOracleInstance.mock_setBlockTimestamp(currentTime.add(60))
        })

        it("twap price", async () => {
            // (15*4100000000000000+15*4050000000000000+15*4000000000000000)/45 = 405
            const price = await nftOracleInstance.getTwapPrice(addr1.address, 45)
            expect(price).to.equal("4050000000000000")
        })

        it("asking interval more than asset has", async () => {
            // (15*4100000000000000+15*4050000000000000+15*4000000000000000)/45 = 405
            const price = await nftOracleInstance.getTwapPrice(addr1.address, 46)
            expect(price).to.equal("4050000000000000")
        })

        it("asking interval less than asset has", async () => {
            // (15*4100000000000000+15*4050000000000000+14*4000000000000000)/44 = 4051136363636363
            const price = await nftOracleInstance.getTwapPrice(addr1.address, 44)
            expect(price).to.equal("4051136363636363")
        })

        it("given variant price period", async () => {
            const currentTime = await nftOracleInstance.mock_getCurrentTimestamp()
            await nftOracleInstance.mock_setBlockTimestamp(currentTime.add(30))
            await nftOracleInstance.setAssetData(addr1.address, 4200000000000000, currentTime.add(30), 103)
            await nftOracleInstance.mock_setBlockTimestamp(currentTime.add(50))

            // twap price should be (400 * 15) + (405 * 15) + (410 * 45) + (420 * 20) / 95 = 409.74
            const price = await nftOracleInstance.getTwapPrice(addr1.address, 95)
            expect(price).to.equal("4097368421052631")
        })

        it("latest price update time is earlier than the request, return the latest price", async () => {
            const currentTime = await nftOracleInstance.mock_getCurrentTimestamp()
            await nftOracleInstance.mock_setBlockTimestamp(currentTime + 100)

            // latest update time is base + 30, but now is base + 145 and asking for (now - 45)
            // should return the latest price directly
            const price = await nftOracleInstance.getTwapPrice(addr1.address, 45)
            expect(price).to.equal("4100000000000000")
        })

        it("get 0 while interval is zero", async () => {
            await expect(nftOracleInstance.getTwapPrice(addr1.address, 0)).to.be.revertedWith(
                "interval can't be 0"
            )
        })
    })

    describe("getPreviousPrice/getPreviousTimestamp", () => {
        let baseTimestamp
        beforeEach(async () => {
            await nftOracleInstance.addAsset(addr1.address)
            const currentTime = await nftOracleInstance.mock_getCurrentTimestamp()
            baseTimestamp = currentTime
            await nftOracleInstance.setAssetData(addr1.address, 400, currentTime.add(15), 100)
            await nftOracleInstance.setAssetData(addr1.address, 410, currentTime.add(30), 101)
            await nftOracleInstance.setAssetData(addr1.address, 420, currentTime.add(45), 102)
        })

        it("get previous price (latest)", async () => {
            const price = await nftOracleInstance.getPreviousPrice(addr1.address, 0)
            expect(price).to.equal("420")
            const timestamp = await nftOracleInstance.getPreviousTimestamp(addr1.address, 0)
            expect(timestamp).to.equal(baseTimestamp.add(45)).toString()

            const price1 = await nftOracleInstance.getPreviousPrice(addr1.address, 1)
            expect(price1).to.equal("410")
            const timestamp1 = await nftOracleInstance.getPreviousTimestamp(addr1.address, 1)
            expect(timestamp1).to.equal(baseTimestamp.add(30)).toString()
        })

        it("get previous price", async () => {
            const price = await nftOracleInstance.getPreviousPrice(addr1.address, 2)
            expect(price).to.equal("400")
            const timestamp = await nftOracleInstance.getPreviousTimestamp(addr1.address, 2)
            expect(timestamp).to.equal("1444004415")
        })

        it("force error, get previous price", async () => {
            await expect(nftOracleInstance.getPreviousPrice(addr1.address, 3)).to.be.revertedWith(
                "Not enough history"
            )
            await expect(nftOracleInstance.getPreviousTimestamp(addr1.address, 3)).to.be.revertedWith(
                "Not enough history"
            )
        })
    })
});
