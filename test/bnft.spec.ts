import { TestEnv, makeSuite } from "./helpers/make-suite";
import { ZERO_ADDRESS, RAY } from "../helpers/constants";
import { APPROVAL_AMOUNT_LENDING_POOL, oneEther } from "../helpers/constants";
import { deployMintableERC721, deployMockBNFTMinter } from "../helpers/contracts-deployments";
import { getIErc721Detailed, getMockBNFTMinter } from "../helpers/contracts-getters";
import { convertToCurrencyDecimals } from "../helpers/contracts-helpers";
import { waitForTx } from "../helpers/misc-utils";
import { CommonsConfig } from "../markets/bend/commons";

const { expect } = require("chai");

makeSuite("BNFT", (testEnv: TestEnv) => {
  let mockMinterInstance1;
  let mockMinterInstance2;
  let cachedTokenId;

  before(async () => {
    mockMinterInstance1 = await deployMockBNFTMinter([testEnv.bayc.address, testEnv.bBYAC.address]);
    mockMinterInstance2 = await deployMockBNFTMinter([testEnv.bayc.address, testEnv.bBYAC.address]);
  });

  it("Check BAYC basic parameters", async () => {
    const { bayc, bBYAC, users } = testEnv;

    const baycName = await bayc.name();
    const bBAYCName = await bBYAC.name();
    expect(bBAYCName).to.be.equal(CommonsConfig.BNftNamePrefix + " " + baycName);

    const baycSymbol = await bayc.symbol();
    const bBAYCSymbol = await bBYAC.symbol();
    expect(bBAYCSymbol).to.be.equal(CommonsConfig.BNftSymbolPrefix + baycSymbol);

    testEnv.tokenIdTracker++;
    const tokenId = testEnv.tokenIdTracker.toString();
    await bayc.connect(users[0].signer).mint(tokenId);
    await bayc.connect(users[0].signer).transferFrom(users[0].address, mockMinterInstance1.address, tokenId);
    await bayc.connect(users[0].signer).setApprovalForAll(bBYAC.address, true);

    cachedTokenId = tokenId;
  });

  it("Check BAYC caller must be contract", async () => {
    const { bayc, bBYAC, users, pool } = testEnv;

    expect(cachedTokenId, "previous test case is faild").to.not.be.undefined;
    const tokenId = cachedTokenId;

    await expect(bBYAC.connect(users[0].signer).mint(users[1].address, tokenId)).to.be.revertedWith(
      "BNFT: caller is not contract"
    );

    await expect(bBYAC.connect(users[0].signer).burn(tokenId)).to.be.revertedWith("BNFT: caller is not contract");
  });

  it("Check BAYC mint other owner's token", async () => {
    const { bayc, bBYAC, users, pool } = testEnv;

    expect(cachedTokenId, "previous test case is faild").to.not.be.undefined;
    const tokenId = cachedTokenId;

    await expect(mockMinterInstance2.mint(users[0].address, tokenId)).to.be.revertedWith("BNFT: caller is not owner");
  });

  it("Check BAYC burn non-exist token", async () => {
    const { bayc, bBYAC, users, pool } = testEnv;

    const tokenId = testEnv.tokenIdTracker++;

    await expect(mockMinterInstance1.burn(tokenId)).to.be.revertedWith("BNFT: nonexist token");
  });

  it("Check BAYC burn caller must be minter", async () => {
    const { bayc, bBYAC, users, pool } = testEnv;

    expect(cachedTokenId, "previous test case is faild").to.not.be.undefined;
    const tokenId = cachedTokenId;

    await mockMinterInstance1.mint(users[0].address, tokenId);

    await expect(mockMinterInstance2.burn(tokenId)).to.be.revertedWith("BNFT: caller is not minter");
  });

  it("Check BAYC is non-transfer", async () => {
    const { weth, bayc, bBYAC, users, pool } = testEnv;

    expect(cachedTokenId, "previous test case is faild").to.not.be.undefined;
    const tokenId = cachedTokenId;

    // check non-approve
    await expect(bBYAC.connect(users[0].signer).approve(pool.address, tokenId)).to.be.revertedWith(
      "APPROVAL_NOT_SUPPORTED"
    );
    await expect(bBYAC.connect(users[0].signer).setApprovalForAll(pool.address, true)).to.be.revertedWith(
      "APPROVAL_NOT_SUPPORTED"
    );

    // check non-transfer
    await expect(
      bBYAC.connect(users[0].signer).transferFrom(users[0].address, users[1].address, tokenId)
    ).to.be.revertedWith("TRANSFER_NOT_SUPPORTED");

    //safeTransferFrom is a overloaded function.
    //In ethers, the syntax to call an overloaded contract function is different from the non-overloaded function.
    await expect(
      bBYAC
        .connect(users[0].signer)
        ["safeTransferFrom(address,address,uint256)"](users[0].address, users[1].address, tokenId)
    ).to.be.revertedWith("TRANSFER_NOT_SUPPORTED");

    await expect(
      bBYAC
        .connect(users[0].signer)
        ["safeTransferFrom(address,address,uint256,bytes)"](users[0].address, users[1].address, tokenId, "0x1234")
    ).to.be.revertedWith("TRANSFER_NOT_SUPPORTED");
  });
});
