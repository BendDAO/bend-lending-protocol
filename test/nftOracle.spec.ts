import { TestEnv, makeSuite } from "./helpers/make-suite";

const { expect } = require("chai");

makeSuite("NFTOracle", (testEnv: TestEnv) => {
  before(async () => {});

  it("NFTOracle: Set Admin", async () => {
    const { mockNftOracle, users } = testEnv;
    const admin = await mockNftOracle.priceFeedAdmin();
    await mockNftOracle.setPriceFeedAdmin(users[0].address);
    expect(await mockNftOracle.priceFeedAdmin()).eq(users[0].address);
    await mockNftOracle.setPriceFeedAdmin(admin);
    expect(await mockNftOracle.priceFeedAdmin()).eq(admin);
  });

  it("NFTOracle: Add Asset", async () => {
    const { mockNftOracle, users } = testEnv;
    await mockNftOracle.addAsset(users[0].address);
    expect(await mockNftOracle.nftPriceFeedKeys(0)).eq(users[0].address);
    await expect(mockNftOracle.connect(users[1].signer).addAsset(users[1].address)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
    await mockNftOracle.removeAsset(users[0].address);
  });

  it("NFTOracle: Add Multi Assets", async () => {
    const { mockNftOracle, users } = testEnv;
    await mockNftOracle.addAsset(users[0].address);
    await mockNftOracle.addAsset(users[1].address);
    expect(await mockNftOracle.nftPriceFeedKeys(0)).eq(users[0].address);
    expect(await mockNftOracle.nftPriceFeedKeys(1)).eq(users[1].address);
    await mockNftOracle.removeAsset(users[0].address);
    await mockNftOracle.removeAsset(users[1].address);
  });

  it("NFTOracle: Remove 1 Asset When There's Only 1", async () => {
    const { mockNftOracle, users } = testEnv;

    let error;
    try {
      await mockNftOracle.nftPriceFeedKeys(0);
    } catch (e) {
      error = e;
    }
    expect(error).not.eq(undefined);
  });

  it("NFTOracle: Remove 1 Asset When There're 2", async () => {
    const { mockNftOracle, users } = testEnv;
    await mockNftOracle.addAsset(users[0].address);
    await mockNftOracle.addAsset(users[1].address);
    await mockNftOracle.removeAsset(users[0].address);
    expect(await mockNftOracle.nftPriceFeedKeys(0)).eq(users[1].address);
    expect(await mockNftOracle.getPriceFeedLength(users[1].address)).to.equal("0");
    await mockNftOracle.removeAsset(users[1].address);
  });

  it("NFTOracle: Set Asset Data", async () => {
    const { mockNftOracle, users } = testEnv;
    await mockNftOracle.addAsset(users[0].address);
    const currentTime = await mockNftOracle.mock_getCurrentTimestamp();
    await mockNftOracle.mock_setBlockTimestamp(currentTime.add(15));
    const r = await mockNftOracle.setAssetData(users[0].address, 400);
    // await expectEvent.inTransaction(r.tx, nftOracleInstance, "NFTPriceFeedDataSet", {
    //     key: addr1.address,
    //     price: 400,
    //     timestamp: 1444004400,
    //     roundId: "1",
    // })
    expect(await mockNftOracle.getPriceFeedLength(users[0].address)).to.equal("1");
    const price = await mockNftOracle.getAssetPrice(users[0].address);
    expect(price).to.equal("400");
    const timestamp = await mockNftOracle.getLatestTimestamp(users[0].address);
    expect(timestamp).to.equal(currentTime.add(15));
    await mockNftOracle.mock_setBlockTimestamp(currentTime);
    await mockNftOracle.removeAsset(users[0].address);
  });

  it("NFTOracle: Set Multiple Data", async () => {
    const { mockNftOracle, users } = testEnv;
    await mockNftOracle.addAsset(users[0].address);
    const currentTime = await mockNftOracle.mock_getCurrentTimestamp();
    await mockNftOracle.mock_setBlockTimestamp(currentTime.add(15));
    await mockNftOracle.setAssetData(users[0].address, 400);
    await mockNftOracle.mock_setBlockTimestamp(currentTime.add(30));
    await mockNftOracle.setAssetData(users[0].address, 410);
    await mockNftOracle.mock_setBlockTimestamp(currentTime.add(45));
    const r = await mockNftOracle.setAssetData(users[0].address, 420);

    expect(await mockNftOracle.getPriceFeedLength(users[0].address)).to.equal("3");
    const price = await mockNftOracle.getAssetPrice(users[0].address);
    expect(price).to.equal("405");
    const timestamp = await mockNftOracle.getLatestTimestamp(users[0].address);
    expect(timestamp).to.equal(currentTime.add(45));
    await mockNftOracle.mock_setBlockTimestamp(currentTime);
    await mockNftOracle.removeAsset(users[0].address);
  });

  it("NFTOracle: Set Multiple Data use Multiple interface", async () => {
    const { mockNftOracle, users } = testEnv;
    await mockNftOracle.addAsset(users[0].address);
    await mockNftOracle.addAsset(users[1].address);
    const currentTime = await mockNftOracle.mock_getCurrentTimestamp();
    await mockNftOracle.mock_setBlockTimestamp(currentTime.add(15));
    let assets: string[] = [users[0].address, users[1].address];
    let prices: string[] = ["400", "600", "800"];
    let prices1: string[] = ["410", "610"];
    let prices2: string[] = ["420", "620"];

    await expect(mockNftOracle.setMultipleAssetsData(assets, prices)).to.be.revertedWith(
      "NFTOracle: data length not match"
    );
    prices = ["400", "600"];
    await mockNftOracle.setMultipleAssetsData(assets, prices);
    await mockNftOracle.mock_setBlockTimestamp(currentTime.add(30));
    await mockNftOracle.setMultipleAssetsData(assets, prices1);
    await mockNftOracle.mock_setBlockTimestamp(currentTime.add(45));
    await mockNftOracle.setPause(users[1].address, true);
    let r = await mockNftOracle.setMultipleAssetsData(assets, prices2);
    expect(await mockNftOracle.getPriceFeedLength(users[0].address)).to.equal("3");
    expect(await mockNftOracle.getPriceFeedLength(users[1].address)).to.equal("2");
    await mockNftOracle.setPause(users[0].address, true);
    await mockNftOracle.setPause(users[1].address, false);
    r = await mockNftOracle.setMultipleAssetsData(assets, prices2);
    expect(await mockNftOracle.getPriceFeedLength(users[0].address)).to.equal("3");
    expect(await mockNftOracle.getPriceFeedLength(users[1].address)).to.equal("3");
    const price = await mockNftOracle.getAssetPrice(users[0].address);
    expect(price).to.equal("405");
    const price1 = await mockNftOracle.getAssetPrice(users[1].address);
    expect(price1).to.equal("605");
    const timestamp = await mockNftOracle.getLatestTimestamp(users[0].address);
    expect(timestamp).to.equal(currentTime.add(45));
    const timestamp1 = await mockNftOracle.getLatestTimestamp(users[1].address);
    expect(timestamp1).to.equal(currentTime.add(45));
    await mockNftOracle.mock_setBlockTimestamp(currentTime);
    await mockNftOracle.setPause(users[0].address, false);
    await mockNftOracle.removeAsset(users[0].address);
    await mockNftOracle.removeAsset(users[1].address);
  });

  it("NFTOracle: GetAssetPrice After Remove The Asset", async () => {
    const { mockNftOracle, users } = testEnv;
    await mockNftOracle.addAsset(users[0].address);
    const currentTime = await mockNftOracle.mock_getCurrentTimestamp();
    await mockNftOracle.mock_setBlockTimestamp(currentTime.add(15));
    await mockNftOracle.setAssetData(users[0].address, 400);
    await mockNftOracle.mock_setBlockTimestamp(currentTime.add(30));
    await mockNftOracle.setAssetData(users[0].address, 410);
    await mockNftOracle.mock_setBlockTimestamp(currentTime.add(45));
    await mockNftOracle.setAssetData(users[0].address, 420);

    await mockNftOracle.removeAsset(users[0].address);
    await expect(mockNftOracle.getAssetPrice(users[0].address)).to.be.revertedWith("key not existed");
    await expect(mockNftOracle.getLatestTimestamp(users[0].address)).to.be.revertedWith("key not existed");
  });

  it("NFTOracle: Round Id Can Be The Same", async () => {
    const { mockNftOracle, users } = testEnv;
    const currentTime = await mockNftOracle.mock_getCurrentTimestamp();
    await mockNftOracle.mock_setBlockTimestamp(currentTime.add(15));
    await mockNftOracle.addAsset(users[0].address);
    await mockNftOracle.setAssetData(users[0].address, 400);
    await mockNftOracle.mock_setBlockTimestamp(currentTime.add(30));
    await mockNftOracle.setAssetData(users[0].address, 400);
    //await expectEvent.inTransaction(r.tx, nftOracleInstance, "SetAssetData")
    await mockNftOracle.removeAsset(users[0].address);
  });

  it("NFTOracle: force error, get data with no price feed data", async () => {
    const { mockNftOracle, users } = testEnv;
    await mockNftOracle.addAsset(users[0].address);

    expect(await mockNftOracle.getPriceFeedLength(users[0].address)).to.equal("0");
    expect(await mockNftOracle.getLatestTimestamp(users[0].address)).to.equal("0");
    await expect(mockNftOracle.getAssetPrice(users[0].address)).to.be.revertedWith("no price data");
    await expect(mockNftOracle.getPreviousPrice(users[0].address, 0)).to.be.revertedWith("Not enough history");
    await expect(mockNftOracle.getPreviousTimestamp(users[0].address, 0)).to.be.revertedWith("Not enough history");
    await mockNftOracle.removeAsset(users[0].address);
  });

  it("NFTOracle: force error, asset should be set first", async () => {
    // await expectRevert(
    //     nftOracleInstance.setAssetData(addr1.address, 400, 1444004415, 100),
    //     "key not existed",
    // )
    const { mockNftOracle, users } = testEnv;
    const currentTime = await mockNftOracle.mock_getCurrentTimestamp();
    await mockNftOracle.mock_setBlockTimestamp(currentTime.add(15));
    await expect(mockNftOracle.setAssetData(users[0].address, 400)).to.be.revertedWith("key not existed");
    await mockNftOracle.mock_setBlockTimestamp(currentTime);
  });

  it("NFTOracle: force error, timestamp should be larger", async () => {
    const { mockNftOracle, users } = testEnv;
    const currentTime = await mockNftOracle.mock_getCurrentTimestamp();
    await mockNftOracle.mock_setBlockTimestamp(currentTime.add(15));
    await mockNftOracle.addAsset(users[0].address);
    await mockNftOracle.setAssetData(users[0].address, 400);
    // await expectRevert(
    //     await nftOracleInstance.setAssetData(addr1.address, 400, 1444004400, 100),
    //     "incorrect timestamp",
    // )
    await expect(mockNftOracle.setAssetData(users[0].address, 400)).to.be.revertedWith("incorrect timestamp");
    await mockNftOracle.removeAsset(users[0].address);
    await mockNftOracle.mock_setBlockTimestamp(currentTime);
  });

  it("NFTOracle: force error, timestamp can't be the same", async () => {
    const { mockNftOracle, users } = testEnv;
    await mockNftOracle.addAsset(users[0].address);
    const currentTime = await mockNftOracle.mock_getCurrentTimestamp();
    await mockNftOracle.mock_setBlockTimestamp(currentTime.add(15));
    await mockNftOracle.setAssetData(users[0].address, 400);
    // await expectRevert(
    //     await nftOracleInstance.setAssetData(addr1.address, 400, 1444004415, 101),
    //     "incorrect timestamp",
    // )
    await expect(mockNftOracle.setAssetData(users[0].address, 400)).to.be.revertedWith("incorrect timestamp");
    await mockNftOracle.removeAsset(users[0].address);
    await mockNftOracle.mock_setBlockTimestamp(currentTime);
  });

  makeSuite("NFTOracle-TWAP", () => {
    let basestamp;
    before(async () => {
      const { mockNftOracle, users } = testEnv;
      await mockNftOracle.addAsset(users[0].address);
      const currentTime = await mockNftOracle.mock_getCurrentTimestamp();
      basestamp = currentTime;
      await mockNftOracle.setTwapInterval(45);
      await mockNftOracle.mock_setBlockTimestamp(currentTime.add(15));
      await mockNftOracle.setAssetData(users[0].address, 4000000000000000);
      await mockNftOracle.mock_setBlockTimestamp(currentTime.add(30));
      await mockNftOracle.setAssetData(users[0].address, 4050000000000000);
      await mockNftOracle.mock_setBlockTimestamp(currentTime.add(45));
      await mockNftOracle.setAssetData(users[0].address, 4100000000000000);
      await mockNftOracle.mock_setBlockTimestamp(currentTime.add(60));
    });
    after(async () => {
      const { mockNftOracle, users } = testEnv;
      await mockNftOracle.removeAsset(users[0].address);
      await mockNftOracle.mock_setBlockTimestamp(basestamp);
    });
    it("twap price", async () => {
      const { mockNftOracle, users } = testEnv;
      // (15*4050000000000000+15*4000000000000000)/45 = 4025000000000000
      const price = await mockNftOracle.getAssetPrice(users[0].address);
      expect(price).to.equal("4025000000000000");
      await mockNftOracle.setAssetData(users[0].address, 4100000000000000);
      const price1 = await mockNftOracle.getAssetPrice(users[0].address);
      // (15*4100000000000000+15*4050000000000000+15*4000000000000000)/45 = 4025000000000000
      expect(price1).to.equal("4050000000000000");
    });

    it("asking interval more than asset has", async () => {
      const { mockNftOracle, users } = testEnv;
      await mockNftOracle.setTwapInterval(46);
      // (15*4100000000000000+15*4050000000000000+15*4000000000000000)/45 = 405
      const price = await mockNftOracle.getAssetPrice(users[0].address);
      expect(price).to.equal("4050000000000000");
    });

    it("asking interval less than asset has", async () => {
      const { mockNftOracle, users } = testEnv;
      await mockNftOracle.removeAsset(users[0].address);
      await mockNftOracle.setTwapInterval(44);
      await mockNftOracle.addAsset(users[0].address);
      const currentTime = await mockNftOracle.mock_getCurrentTimestamp();
      basestamp = currentTime;
      await mockNftOracle.mock_setBlockTimestamp(currentTime.add(15));
      await mockNftOracle.setAssetData(users[0].address, 4000000000000000);
      await mockNftOracle.mock_setBlockTimestamp(currentTime.add(30));
      await mockNftOracle.setAssetData(users[0].address, 4050000000000000);
      await mockNftOracle.mock_setBlockTimestamp(currentTime.add(45));
      await mockNftOracle.setAssetData(users[0].address, 4100000000000000);
      await mockNftOracle.mock_setBlockTimestamp(currentTime.add(60));
      await mockNftOracle.setAssetData(users[0].address, 4100000000000000);
      // (15*4100000000000000+15*4050000000000000+14*4000000000000000)/44 = 4051136363636363
      const price = await mockNftOracle.getAssetPrice(users[0].address);
      expect(price).to.equal("4051136363636363");
      await mockNftOracle.removeAsset(users[0].address);
    });

    it("given variant price period", async () => {
      const { mockNftOracle, users } = testEnv;
      await mockNftOracle.addAsset(users[0].address);
      await mockNftOracle.setTwapInterval(95);
      let currentTime = await mockNftOracle.mock_getCurrentTimestamp();
      basestamp = currentTime;
      await mockNftOracle.mock_setBlockTimestamp(currentTime.add(15));
      await mockNftOracle.setAssetData(users[0].address, 4000000000000000);
      await mockNftOracle.mock_setBlockTimestamp(currentTime.add(30));
      await mockNftOracle.setAssetData(users[0].address, 4050000000000000);
      await mockNftOracle.mock_setBlockTimestamp(currentTime.add(45));
      await mockNftOracle.setAssetData(users[0].address, 4100000000000000);
      await mockNftOracle.mock_setBlockTimestamp(currentTime.add(60));
      currentTime = await mockNftOracle.mock_getCurrentTimestamp();
      await mockNftOracle.mock_setBlockTimestamp(currentTime.add(30));
      await mockNftOracle.setAssetData(users[0].address, 4200000000000000);
      await mockNftOracle.mock_setBlockTimestamp(currentTime.add(50));
      await mockNftOracle.setAssetData(users[0].address, 4200000000000000);

      // twap price should be (400 * 15) + (405 * 15) + (410 * 45) + (420 * 20) / 95 = 409.74

      const price = await mockNftOracle.getAssetPrice(users[0].address);
      expect(price).to.equal("4097368421052631");
    });

    it("latest price update time is earlier than the request, return the latest price", async () => {
      const { mockNftOracle, users } = testEnv;
      const currentTime = await mockNftOracle.mock_getCurrentTimestamp();
      await mockNftOracle.mock_setBlockTimestamp(currentTime.add(100));

      // latest update time is base + 30, but now is base + 145 and asking for (now - 45)
      // should return the latest price directly
      await mockNftOracle.setTwapInterval(45);
      await mockNftOracle.setAssetData(users[0].address, 4200000000000000);
      const price = await mockNftOracle.getAssetPrice(users[0].address);
      expect(price).to.equal("4200000000000000");
    });

    it("get 0 while interval is zero", async () => {
      const { mockNftOracle, users } = testEnv;
      await mockNftOracle.setTwapInterval(0);
      const currentTime = await mockNftOracle.mock_getCurrentTimestamp();
      await mockNftOracle.mock_setBlockTimestamp(currentTime.add(100));
      await expect(mockNftOracle.setAssetData(users[0].address, 4200000000000000)).to.be.revertedWith(
        "interval can't be 0"
      );
    });
  });

  makeSuite("NFTOracle: getPreviousPrice/getPreviousTimestamp", () => {
    let baseTimestamp;
    before(async () => {
      const { mockNftOracle, users } = testEnv;
      await mockNftOracle.addAsset(users[0].address);
      const currentTime = await mockNftOracle.mock_getCurrentTimestamp();
      baseTimestamp = currentTime;
      await mockNftOracle.setAssetData(users[0].address, 400);
      await mockNftOracle.mock_setBlockTimestamp(currentTime.add(15));
      await mockNftOracle.setAssetData(users[0].address, 410);
      await mockNftOracle.mock_setBlockTimestamp(currentTime.add(30));
      await mockNftOracle.setAssetData(users[0].address, 420);
    });
    after(async () => {
      const { mockNftOracle, users } = testEnv;
      await mockNftOracle.removeAsset(users[0].address);
    });

    it("get previous price (latest)", async () => {
      const { mockNftOracle, users } = testEnv;
      const price = await mockNftOracle.getPreviousPrice(users[0].address, 0);
      expect(price).to.equal("420");
      const timestamp = await mockNftOracle.getPreviousTimestamp(users[0].address, 0);
      expect(timestamp).to.equal(baseTimestamp.add(30)).toString();

      const price1 = await mockNftOracle.getPreviousPrice(users[0].address, 1);
      expect(price1).to.equal("410");
      const timestamp1 = await mockNftOracle.getPreviousTimestamp(users[0].address, 1);
      expect(timestamp1).to.equal(baseTimestamp.add(15)).toString();
    });

    it("get previous price", async () => {
      const { mockNftOracle, users } = testEnv;
      const price = await mockNftOracle.getPreviousPrice(users[0].address, 2);
      expect(price).to.equal("400");
      const timestamp = await mockNftOracle.getPreviousTimestamp(users[0].address, 2);
      expect(timestamp).to.equal(baseTimestamp).toString();
    });

    it("get latest round id", async () => {
      const { mockNftOracle, users } = testEnv;
      await mockNftOracle.addAsset(users[3].address);
      const id = await mockNftOracle.getLatestRoundId(users[0].address);
      expect(id).to.equal("2");
      const id1 = await mockNftOracle.getLatestRoundId(users[3].address);
      expect(id1).to.equal("0");
      const id2 = await mockNftOracle.getLatestRoundId(users[2].address);
      expect(id2).to.equal("0");
      const currentTime = await mockNftOracle.mock_getCurrentTimestamp();
      baseTimestamp = currentTime;
      await mockNftOracle.mock_setBlockTimestamp(currentTime.add(5));
      await mockNftOracle.setAssetData(users[3].address, 400);
      const id3 = await mockNftOracle.getLatestRoundId(users[3].address);
      expect(id3).to.equal("0");
      await mockNftOracle.mock_setBlockTimestamp(currentTime.add(10));
      await mockNftOracle.setAssetData(users[3].address, 400);
      const id4 = await mockNftOracle.getLatestRoundId(users[3].address);
      expect(id4).to.equal("1");
    });

    it("force error, get previous price", async () => {
      const { mockNftOracle, users } = testEnv;
      await expect(mockNftOracle.getPreviousPrice(users[0].address, 3)).to.be.revertedWith("Not enough history");
      await expect(mockNftOracle.getPreviousTimestamp(users[0].address, 3)).to.be.revertedWith("Not enough history");
    });
  });

  makeSuite("NFTOracle: Data validity check", () => {
    before(async () => {
      const { mockNftOracle, users } = testEnv;
      await mockNftOracle.setDataValidityParameters("200000000000000000", "100000000000000000", 10, 5);
    });
    after(async () => {
      const { mockNftOracle, users } = testEnv;
      await mockNftOracle.setDataValidityParameters("20000000000000000000", "10000000000000000000", 1, 1);
    });
    it("price > maxPriceDeviation", async () => {
      const { mockNftOracle, users } = testEnv;
      await mockNftOracle.addAsset(users[0].address);
      const currentTime = await mockNftOracle.mock_getCurrentTimestamp();
      await mockNftOracle.mock_setBlockTimestamp(currentTime.add(15));
      await mockNftOracle.setAssetData(users[0].address, 400);
      await mockNftOracle.mock_setBlockTimestamp(currentTime.add(30));
      await expect(mockNftOracle.setAssetData(users[0].address, 481)).to.be.revertedWith(
        "NFTOracle: invalid price data"
      );
      await mockNftOracle.setAssetData(users[0].address, 480);
      await mockNftOracle.mock_setBlockTimestamp(currentTime.add(39));
      await expect(mockNftOracle.setAssetData(users[0].address, 530)).to.be.revertedWith(
        "NFTOracle: invalid price data"
      );
      await mockNftOracle.mock_setBlockTimestamp(currentTime.add(45));
      await mockNftOracle.setAssetData(users[0].address, 530);
      await mockNftOracle.mock_setBlockTimestamp(currentTime.add(49));
      await expect(mockNftOracle.setAssetData(users[0].address, 531)).to.be.revertedWith(
        "NFTOracle: invalid price data"
      );
      await mockNftOracle.mock_setBlockTimestamp(currentTime.add(60));
      await mockNftOracle.setAssetData(users[0].address, 531);
      await mockNftOracle.removeAsset(users[0].address);
    });

    it("set data validity parameters", async () => {
      const { mockNftOracle, users } = testEnv;
      const maxPriceDeviation = await mockNftOracle.maxPriceDeviation();
      const maxPriceDeviationWithTime = await mockNftOracle.maxPriceDeviationWithTime();
      const timeIntervalWithPrice = await mockNftOracle.timeIntervalWithPrice();
      const minimumUpdateTime = await mockNftOracle.minUpdateTime();
      expect(maxPriceDeviation).to.equal("200000000000000000");
      expect(maxPriceDeviationWithTime).to.equal("100000000000000000");
      expect(timeIntervalWithPrice).to.equal("10");
      expect(minimumUpdateTime).to.equal("5");

      await mockNftOracle.setDataValidityParameters("150000000000000000", "60000000000000000", 3600, 600);
      const maxPriceDeviation2 = await mockNftOracle.maxPriceDeviation();
      const maxPriceDeviationWithTime2 = await mockNftOracle.maxPriceDeviationWithTime();
      const timeIntervalWithPrice2 = await mockNftOracle.timeIntervalWithPrice();
      const minimumUpdateTime2 = await mockNftOracle.minUpdateTime();
      expect(maxPriceDeviation2).to.equal("150000000000000000");
      expect(maxPriceDeviationWithTime2).to.equal("60000000000000000");
      expect(timeIntervalWithPrice2).to.equal("3600");
      expect(minimumUpdateTime2).to.equal("600");
      await mockNftOracle.setDataValidityParameters("200000000000000000", "100000000000000000", 10, 5);
    });
  });

  makeSuite("NFTOracle: test pause", () => {
    before(async () => {});
    it("test pause", async () => {
      const { mockNftOracle, users } = testEnv;
      await mockNftOracle.addAsset(users[0].address);
      await mockNftOracle.addAsset(users[1].address);
      await mockNftOracle.addAsset(users[2].address);
      const currentTime = await mockNftOracle.mock_getCurrentTimestamp();
      await mockNftOracle.setAssetData(users[0].address, 400);
      await mockNftOracle.setPause(users[0].address, true);
      //await mockNftOracle.setAssetData(users[0].address, 410, currentTime.add(20), 101);
      await expect(mockNftOracle.setAssetData(users[0].address, 410)).to.be.revertedWith(
        "NFTOracle: nft price feed paused"
      );
      await mockNftOracle.setAssetData(users[2].address, 400);
      await mockNftOracle.setPause(users[0].address, false);
      await mockNftOracle.setAssetData(users[1].address, 410);
    });
  });
});
