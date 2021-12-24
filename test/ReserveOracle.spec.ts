import { TestEnv, makeSuite } from "./helpers/make-suite";
import { ZERO_ADDRESS } from "../helpers/constants";
import { getDeploySigner, getMockChainlinkOracle } from "../helpers/contracts-getters";
import { MockChainlinkOracle, MockChainlinkOracleFactory, MockReserveOracle } from "../types";

const { expect } = require("chai");

makeSuite("ReserveOracle", (testEnv: TestEnv) => {
  let mockChainlinkOracle: MockChainlinkOracle;
  let mockReserveOracle: MockReserveOracle;
  let addresses;

  before(async () => {
    mockReserveOracle = testEnv.mockReserveOracle;
    mockChainlinkOracle = await new MockChainlinkOracleFactory(await getDeploySigner()).deploy("18");
    addresses = testEnv.users;
  });

  it("ReserveOracle: Add Aggregator", async () => {
    expect(await mockReserveOracle.getPriceFeedLength()).eq("0");
    await mockReserveOracle.addAggregator(addresses[0].address, mockChainlinkOracle.address);
    await expect(mockReserveOracle.addAggregator(ZERO_ADDRESS, mockChainlinkOracle.address)).to.be.revertedWith(
      "ReserveOracle: empty address"
    );
    expect(await mockReserveOracle.priceFeedKeys(0)).eq(addresses[0].address);
    expect(await mockReserveOracle.getAggregator(addresses[0].address)).eq(mockChainlinkOracle.address);
    expect(await mockReserveOracle.getAggregator(addresses[1].address)).eq(ZERO_ADDRESS);
    await mockReserveOracle.addAggregator(addresses[1].address, mockChainlinkOracle.address);
    expect(await mockReserveOracle.priceFeedKeys(1)).eq(addresses[1].address);
    expect(await mockReserveOracle.getAggregator(addresses[1].address)).eq(mockChainlinkOracle.address);
    await expect(mockReserveOracle.addAggregator(addresses[2].address, ZERO_ADDRESS)).to.be.revertedWith(
      "ReserveOracle: empty address"
    );
  });

  it("ReserveOracle: Remove Aggregator", async () => {
    await mockReserveOracle.removeAggregator(addresses[0].address);
    expect(await mockReserveOracle.priceFeedKeys(0)).eq(addresses[1].address);
    expect(await mockReserveOracle.getAggregator(addresses[0].address)).eq(ZERO_ADDRESS);
    expect(await mockReserveOracle.getAggregator(addresses[1].address)).eq(mockChainlinkOracle.address);
    await mockReserveOracle.removeAggregator(addresses[1].address);
  });

  it("ReserveOracle: get latest price", async () => {
    await mockReserveOracle.addAggregator(addresses[0].address, mockChainlinkOracle.address);
    await mockChainlinkOracle.mockAddAnswer(8, 12345678, 1, 200000000000, 1);
    await expect(mockReserveOracle.getAssetPrice(addresses[1].address)).to.be.revertedWith("key not existed");
    expect(await mockReserveOracle.getAssetPrice(addresses[0].address), "12345678");
    await mockChainlinkOracle.mockAddAnswer(9, 100, 2, 200000000001, 2);
    expect(await mockReserveOracle.getAssetPrice(addresses[0].address), "100");
    await mockReserveOracle.removeAggregator(addresses[0].address);
  });

  it("ReserveOracle: get eth price", async () => {
    expect(await mockReserveOracle.getAssetPrice(testEnv.weth.address), "1000000000000000000");
  });

  it("ReserveOracle: get latest timestamp", async () => {
    await mockReserveOracle.addAggregator(addresses[0].address, mockChainlinkOracle.address);
    await mockChainlinkOracle.mockAddAnswer(8, 12345678, 1, 200000000000, 1);
    await expect(mockReserveOracle.getLatestTimestamp(addresses[1].address)).to.be.revertedWith(
      "ReserveOracle: empty address"
    );
    expect(await mockReserveOracle.getLatestTimestamp(addresses[0].address), "200000000000");
    await mockChainlinkOracle.mockAddAnswer(9, 100, 2, 200000000001, 2);
    expect(await mockReserveOracle.getLatestTimestamp(addresses[0].address), "200000000001");
    await mockReserveOracle.removeAggregator(addresses[0].address);
  });

  makeSuite("ReserveOracle-TWAP", () => {
    before(async () => {
      // function mockAddAnswer(
      //     uint80 _roundId,
      //     int256 _answer,
      //     uint256 _startedAt,
      //     uint256 _updatedAt,
      //     uint80 _answeredInRound
      //   )
      await mockReserveOracle.addAggregator(addresses[0].address, mockChainlinkOracle.address);
      const currentTime = await mockReserveOracle.mock_getCurrentTimestamp();
      await mockReserveOracle.mock_setBlockTimestamp(currentTime.add(15));
      await mockChainlinkOracle.mockAddAnswer(100, 4000000000000000, 2, currentTime.add(15), 2);
      await mockReserveOracle.mock_setBlockTimestamp(currentTime.add(30));
      await mockChainlinkOracle.mockAddAnswer(101, 4050000000000000, 3, currentTime.add(30), 3);
      await mockReserveOracle.mock_setBlockTimestamp(currentTime.add(45));
      await mockChainlinkOracle.mockAddAnswer(102, 4100000000000000, 4, currentTime.add(45), 4);
      await mockReserveOracle.mock_setBlockTimestamp(currentTime.add(60));
    });
    after(async () => {
      await mockReserveOracle.removeAggregator(addresses[0].address);
    });
    it("twap price", async () => {
      const time = await mockReserveOracle.getLatestTimestamp(addresses[0].address);
      // (15*4100000000000000+15*4050000000000000+15*4000000000000000)/45 = 405
      const price = await mockReserveOracle.getTwapPrice(addresses[0].address, 30);
      expect(price).to.equal("4075000000000000");
    });

    it("asking interval more than asset has", async () => {
      // (15*4100000000000000+15*4050000000000000+15*4000000000000000)/45 = 405
      const price = await mockReserveOracle.getTwapPrice(addresses[0].address, 45);
      expect(price).to.equal("4050000000000000");
    });

    it("asking interval less than asset has", async () => {
      // (15*4100000000000000+15*4050000000000000+14*4000000000000000)/44 = 4051136363636363
      const price = await mockReserveOracle.getTwapPrice(addresses[0].address, 44);
      expect(price).to.equal("4051136363636363");
    });

    it("given variant price period", async () => {
      const currentTime = await mockReserveOracle.mock_getCurrentTimestamp();
      await mockReserveOracle.mock_setBlockTimestamp(currentTime.add(30));
      await mockChainlinkOracle.mockAddAnswer(103, 4200000000000000, 5, currentTime.add(30), 5);
      await mockReserveOracle.mock_setBlockTimestamp(currentTime.add(50));

      // twap price should be (400 * 15) + (405 * 15) + (410 * 45) + (420 * 20) / 95 = 409.74
      const price = await mockReserveOracle.getTwapPrice(addresses[0].address, 95);
      expect(price).to.equal("4097368421052631");
    });

    it("latest price update time is earlier than the request, return the latest price", async () => {
      const currentTime = await mockReserveOracle.mock_getCurrentTimestamp();
      await mockReserveOracle.mock_setBlockTimestamp(currentTime.add(100));

      // latest update time is base + 30, but now is base + 145 and asking for (now - 45)
      // should return the latest price directly
      const price = await mockReserveOracle.getTwapPrice(addresses[0].address, 45);
      expect(price).to.equal("4200000000000000");
    });

    it("get 0 while interval is zero", async () => {
      await expect(mockReserveOracle.getTwapPrice(addresses[0].address, 0)).to.be.revertedWith("interval can't be 0");
    });
  });
});
