import BigNumber from "bignumber.js";
import { ethers } from "ethers";
import { BigNumber as BN } from "ethers";
import { makeSuite, SignerWithAddress } from "./helpers/make-suite";

import { advanceTimeAndBlock, increaseTime, sleep, waitForTx } from "../helpers/misc-utils";
import { ONE_DAY, ONE_HOUR, ZERO_ADDRESS, ZERO_BYTES32 } from "../helpers/constants";
import {
  MintableERC1155,
  MintableERC1155Factory,
  MintableERC721,
  MintableERC721Factory,
  MockTimelockTarget,
  MockTimelockTargetFactory,
  PausableTimelockController,
  PausableTimelockControllerFactory,
} from "../types";
import { expectEvent } from "./helpers/expect-event";

const { expect } = require("chai");

const MINDELAY = ONE_DAY;

const salt = "0x025e7b0be353a74631ad648c667493c0e1cd31caa4cc2d3520fdc171ea0cc726"; // a random value

function genOperation(target, value, data, predecessor, salt) {
  const id = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["address", "uint256", "bytes", "uint256", "bytes32"],
      [target, value, data, predecessor, salt]
    )
  );
  return { id, target, value, data, predecessor, salt };
}

function genOperationBatch(targets, values, payloads, predecessor, salt) {
  const id = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["address[]", "uint256[]", "bytes[]", "uint256", "bytes32"],
      [targets, values, payloads, predecessor, salt]
    )
  );
  return { id, targets, values, payloads, predecessor, salt };
}

makeSuite("Pausable Timelock tests", async (testEnv) => {
  const TIMELOCK_ADMIN_ROLE = ethers.utils.solidityKeccak256(["string"], ["TIMELOCK_ADMIN_ROLE"]);
  const PROPOSER_ROLE = ethers.utils.solidityKeccak256(["string"], ["PROPOSER_ROLE"]);
  const EXECUTOR_ROLE = ethers.utils.solidityKeccak256(["string"], ["EXECUTOR_ROLE"]);
  const CANCELLER_ROLE = ethers.utils.solidityKeccak256(["string"], ["CANCELLER_ROLE"]);
  const PAUSER_ADMIN_ROLE = ethers.utils.solidityKeccak256(["string"], ["PAUSER_ADMIN_ROLE"]);
  const PAUSER_ROLE = ethers.utils.solidityKeccak256(["string"], ["PAUSER_ROLE"]);

  let admin: SignerWithAddress;
  let proposer: SignerWithAddress;
  let canceller: SignerWithAddress;
  let executor: SignerWithAddress;
  let pauser: SignerWithAddress;
  let other: SignerWithAddress;
  let mockTimelock: PausableTimelockController;
  let mockTarget: MockTimelockTarget;
  let mockERC721: MintableERC721;
  let mockERC1155: MintableERC1155;

  beforeEach(async function () {
    admin = testEnv.users[1];
    proposer = testEnv.users[2];
    canceller = testEnv.users[3];
    executor = testEnv.users[4];
    pauser = testEnv.users[5];
    other = testEnv.users[6];

    // Deploy new timelock
    mockTimelock = await new PausableTimelockControllerFactory(testEnv.deployer.signer).deploy(
      MINDELAY,
      [proposer.address],
      [executor.address],
      [pauser.address],
      admin.address
    );

    mockTarget = await new MockTimelockTargetFactory(testEnv.deployer.signer).deploy();

    mockERC721 = await new MintableERC721Factory(testEnv.deployer.signer).deploy("TEST", "TEST");
    mockERC1155 = await new MintableERC1155Factory(testEnv.deployer.signer).deploy();

    expect(await mockTimelock.hasRole(CANCELLER_ROLE, proposer.address)).to.be.equal(true);
    await mockTimelock.connect(admin.signer).revokeRole(CANCELLER_ROLE, proposer.address);
    await mockTimelock.connect(admin.signer).grantRole(CANCELLER_ROLE, canceller.address);
  });

  it("initial state", async function () {
    expect(await mockTimelock.getMinDelay()).to.be.equal(MINDELAY);

    expect(await mockTimelock.TIMELOCK_ADMIN_ROLE()).to.be.equal(TIMELOCK_ADMIN_ROLE);
    expect(await mockTimelock.PROPOSER_ROLE()).to.be.equal(PROPOSER_ROLE);
    expect(await mockTimelock.EXECUTOR_ROLE()).to.be.equal(EXECUTOR_ROLE);
    expect(await mockTimelock.CANCELLER_ROLE()).to.be.equal(CANCELLER_ROLE);

    expect(await mockTimelock.PAUSER_ADMIN_ROLE()).to.be.equal(PAUSER_ADMIN_ROLE);
    expect(await mockTimelock.PAUSER_ROLE()).to.be.equal(PAUSER_ROLE);

    expect(
      await Promise.all(
        [PROPOSER_ROLE, CANCELLER_ROLE, EXECUTOR_ROLE, PAUSER_ROLE].map((role) =>
          mockTimelock.hasRole(role, proposer.address)
        )
      )
    ).to.be.deep.equal([true, false, false, false]);

    expect(
      await Promise.all(
        [PROPOSER_ROLE, CANCELLER_ROLE, EXECUTOR_ROLE, PAUSER_ROLE].map((role) =>
          mockTimelock.hasRole(role, canceller.address)
        )
      )
    ).to.be.deep.equal([false, true, false, false]);

    expect(
      await Promise.all(
        [PROPOSER_ROLE, CANCELLER_ROLE, EXECUTOR_ROLE, PAUSER_ROLE].map((role) =>
          mockTimelock.hasRole(role, executor.address)
        )
      )
    ).to.be.deep.equal([false, false, true, false]);

    expect(
      await Promise.all(
        [PROPOSER_ROLE, CANCELLER_ROLE, EXECUTOR_ROLE, PAUSER_ROLE].map((role) =>
          mockTimelock.hasRole(role, pauser.address)
        )
      )
    ).to.be.deep.equal([false, false, false, true]);
  });

  it("optional admin", async function () {
    const mock = await new PausableTimelockControllerFactory(testEnv.deployer.signer).deploy(
      MINDELAY,
      [proposer.address],
      [executor.address],
      [pauser.address],
      ZERO_ADDRESS
    );

    expect(await mock.hasRole(TIMELOCK_ADMIN_ROLE, admin.address)).to.be.equal(false);
    expect(await mock.hasRole(TIMELOCK_ADMIN_ROLE, other.address)).to.be.equal(false);

    expect(await mock.hasRole(PAUSER_ADMIN_ROLE, admin.address)).to.be.equal(false);
    expect(await mock.hasRole(PAUSER_ADMIN_ROLE, other.address)).to.be.equal(false);
  });

  describe("methods", function () {
    describe("operation hashing", function () {
      it("hashOperation", async function () {
        this.operation = genOperation(
          "0x29cebefe301c6ce1bb36b58654fea275e1cacc83",
          "0xf94fdd6e21da21d2",
          "0xa3bc5104",
          "0xba41db3be0a9929145cfe480bd0f1f003689104d275ae912099f925df424ef94",
          "0x60d9109846ab510ed75c15f979ae366a8a2ace11d34ba9788c13ac296db50e6e"
        );
        expect(
          await mockTimelock.hashOperation(
            this.operation.target,
            this.operation.value,
            this.operation.data,
            this.operation.predecessor,
            this.operation.salt
          )
        ).to.be.equal(this.operation.id);
      });

      it("hashOperationBatch", async function () {
        this.operation = genOperationBatch(
          Array(8).fill("0x2d5f21620e56531c1d59c2df9b8e95d129571f71"),
          Array(8).fill("0x2b993cfce932ccee"),
          Array(8).fill("0xcf51966b"),
          "0xce8f45069cc71d25f71ba05062de1a3974f9849b004de64a70998bca9d29c2e7",
          "0x8952d74c110f72bfe5accdf828c74d53a7dfb71235dfa8a1e8c75d8576b372ff"
        );
        expect(
          await mockTimelock.hashOperationBatch(
            this.operation.targets,
            this.operation.values,
            this.operation.payloads,
            this.operation.predecessor,
            this.operation.salt
          )
        ).to.be.equal(this.operation.id);
      });
    });

    describe("simple", function () {
      describe("schedule", function () {
        beforeEach(async function () {
          this.operation = genOperation(
            "0x31754f590B97fD975Eb86938f18Cc304E264D2F2",
            0,
            "0x3bf92ccc",
            ZERO_BYTES32,
            salt
          );
        });

        it("proposer can schedule", async function () {
          const receipt = await waitForTx(
            await mockTimelock
              .connect(proposer.signer)
              .schedule(
                this.operation.target,
                this.operation.value,
                this.operation.data,
                this.operation.predecessor,
                this.operation.salt,
                MINDELAY
              )
          );

          expectEvent(receipt.events, "CallScheduled", {
            id: this.operation.id,
            index: BN.from(0),
            target: this.operation.target,
            value: BN.from(this.operation.value),
            data: this.operation.data,
            predecessor: this.operation.predecessor,
            delay: MINDELAY,
          });

          const blockTimestamp = await testEnv.mockBlockContext.getCurrentBlockTimestamp();
          expect(await mockTimelock.getTimestamp(this.operation.id)).to.be.bignumber.equal(
            BN.from(blockTimestamp.toString()).add(MINDELAY)
          );
        });

        it("prevent overwriting active operation", async function () {
          await mockTimelock
            .connect(proposer.signer)
            .schedule(
              this.operation.target,
              this.operation.value,
              this.operation.data,
              this.operation.predecessor,
              this.operation.salt,
              MINDELAY
            );

          await expect(
            mockTimelock
              .connect(proposer.signer)
              .schedule(
                this.operation.target,
                this.operation.value,
                this.operation.data,
                this.operation.predecessor,
                this.operation.salt,
                MINDELAY
              )
          ).to.be.revertedWith("TimelockController: operation already scheduled");
        });

        it("prevent non-proposer from committing", async function () {
          await expect(
            mockTimelock
              .connect(other.signer)
              .schedule(
                this.operation.target,
                this.operation.value,
                this.operation.data,
                this.operation.predecessor,
                this.operation.salt,
                MINDELAY
              )
          ).to.be.revertedWith(
            `AccessControl: account ${other.address.toLowerCase()} is missing role ${PROPOSER_ROLE}`
          );
        });

        it("enforce minimum delay", async function () {
          await expect(
            mockTimelock
              .connect(proposer.signer)
              .schedule(
                this.operation.target,
                this.operation.value,
                this.operation.data,
                this.operation.predecessor,
                this.operation.salt,
                new BigNumber(MINDELAY).minus(1).toFixed(0)
              )
          ).to.be.revertedWith("TimelockController: insufficient delay");
        });
      });

      describe("execute", function () {
        beforeEach(async function () {
          this.operation = genOperation(
            "0xAe22104DCD970750610E6FE15E623468A98b15f7",
            0,
            "0x13e414de",
            ZERO_BYTES32,
            "0xc1059ed2dc130227aa1d1d539ac94c641306905c020436c636e19e3fab56fc7f"
          );
        });

        it("revert if operation is not scheduled", async function () {
          await expect(
            mockTimelock
              .connect(executor.signer)
              .execute(
                this.operation.target,
                this.operation.value,
                this.operation.data,
                this.operation.predecessor,
                this.operation.salt
              )
          ).to.be.revertedWith("TimelockController: operation is not ready");
        });

        describe("with scheduled operation", function () {
          beforeEach(async function () {
            const receipt = await waitForTx(
              await mockTimelock
                .connect(proposer.signer)
                .schedule(
                  this.operation.target,
                  this.operation.value,
                  this.operation.data,
                  this.operation.predecessor,
                  this.operation.salt,
                  MINDELAY
                )
            );
          });

          it("revert if execution comes too early 1/2", async function () {
            await expect(
              mockTimelock
                .connect(executor.signer)
                .execute(
                  this.operation.target,
                  this.operation.value,
                  this.operation.data,
                  this.operation.predecessor,
                  this.operation.salt
                )
            ).to.be.revertedWith("TimelockController: operation is not ready");
          });

          it("revert if execution comes too early 2/2", async function () {
            const timestamp = await mockTimelock.getTimestamp(this.operation.id);
            const curBlockTimestamp = await testEnv.mockBlockContext.getCurrentBlockTimestamp();
            await increaseTime(timestamp.sub(curBlockTimestamp).sub(5).toNumber()); // -1 is too tight, test sometime fails

            await expect(
              mockTimelock
                .connect(executor.signer)
                .execute(
                  this.operation.target,
                  this.operation.value,
                  this.operation.data,
                  this.operation.predecessor,
                  this.operation.salt
                )
            ).to.be.revertedWith("TimelockController: operation is not ready");
          });

          describe("on time", function () {
            beforeEach(async function () {
              const timestamp = await mockTimelock.getTimestamp(this.operation.id);
              const curBlockTimestamp = await testEnv.mockBlockContext.getCurrentBlockTimestamp();
              await increaseTime(timestamp.sub(curBlockTimestamp).toNumber());
            });

            it("executor can reveal", async function () {
              const receipt = await waitForTx(
                await mockTimelock
                  .connect(executor.signer)
                  .execute(
                    this.operation.target,
                    this.operation.value,
                    this.operation.data,
                    this.operation.predecessor,
                    this.operation.salt
                  )
              );

              expectEvent(receipt.events, "CallExecuted", {
                id: this.operation.id,
                index: BN.from(0),
                target: this.operation.target,
                value: BN.from(this.operation.value),
                data: this.operation.data,
              });
            });

            it("prevent non-executor from revealing", async function () {
              await expect(
                mockTimelock
                  .connect(other.signer)
                  .execute(
                    this.operation.target,
                    this.operation.value,
                    this.operation.data,
                    this.operation.predecessor,
                    this.operation.salt
                  )
              ).to.be.revertedWith(
                `AccessControl: account ${other.address.toLowerCase()} is missing role ${EXECUTOR_ROLE}`
              );
            });
          });
        });
      });
    });

    describe("batch", function () {
      describe("schedule", function () {
        beforeEach(async function () {
          this.operation = genOperationBatch(
            Array(8).fill("0xEd912250835c812D4516BBD80BdaEA1bB63a293C"),
            Array(8).fill(0),
            Array(8).fill("0x2fcb7a88"),
            ZERO_BYTES32,
            "0x6cf9d042ade5de78bed9ffd075eb4b2a4f6b1736932c2dc8af517d6e066f51f5"
          );
        });

        it("proposer can schedule", async function () {
          const receipt = await waitForTx(
            await mockTimelock
              .connect(proposer.signer)
              .scheduleBatch(
                this.operation.targets,
                this.operation.values,
                this.operation.payloads,
                this.operation.predecessor,
                this.operation.salt,
                MINDELAY
              )
          );

          for (const i in this.operation.targets) {
            expectEvent(receipt.events, "CallScheduled", {
              id: this.operation.id,
              index: BN.from(i),
              target: this.operation.targets[i],
              value: BN.from(this.operation.values[i]),
              data: this.operation.payloads[i],
              predecessor: this.operation.predecessor,
              delay: MINDELAY,
            });
          }

          const curBlockTimestamp = await testEnv.mockBlockContext.getCurrentBlockTimestamp();
          expect(await mockTimelock.getTimestamp(this.operation.id)).to.be.bignumber.equal(
            curBlockTimestamp.add(MINDELAY)
          );
        });

        it("prevent overwriting active operation", async function () {
          await mockTimelock
            .connect(proposer.signer)
            .scheduleBatch(
              this.operation.targets,
              this.operation.values,
              this.operation.payloads,
              this.operation.predecessor,
              this.operation.salt,
              MINDELAY
            );

          await expect(
            mockTimelock
              .connect(proposer.signer)
              .scheduleBatch(
                this.operation.targets,
                this.operation.values,
                this.operation.payloads,
                this.operation.predecessor,
                this.operation.salt,
                MINDELAY
              )
          ).to.be.revertedWith("TimelockController: operation already scheduled");
        });

        it("length of batch parameter must match #1", async function () {
          await expect(
            mockTimelock
              .connect(proposer.signer)
              .scheduleBatch(
                this.operation.targets,
                [],
                this.operation.payloads,
                this.operation.predecessor,
                this.operation.salt,
                MINDELAY
              )
          ).to.be.revertedWith("TimelockController: length mismatch");
        });

        it("length of batch parameter must match #1", async function () {
          await expect(
            mockTimelock
              .connect(proposer.signer)
              .scheduleBatch(
                this.operation.targets,
                this.operation.values,
                [],
                this.operation.predecessor,
                this.operation.salt,
                MINDELAY
              )
          ).to.be.revertedWith("TimelockController: length mismatch");
        });

        it("prevent non-proposer from committing", async function () {
          await expect(
            mockTimelock
              .connect(other.signer)
              .scheduleBatch(
                this.operation.targets,
                this.operation.values,
                this.operation.payloads,
                this.operation.predecessor,
                this.operation.salt,
                MINDELAY
              )
          ).to.be.revertedWith(
            `AccessControl: account ${other.address.toLowerCase()} is missing role ${PROPOSER_ROLE}`
          );
        });

        it("enforce minimum delay", async function () {
          await expect(
            mockTimelock
              .connect(proposer.signer)
              .scheduleBatch(
                this.operation.targets,
                this.operation.values,
                this.operation.payloads,
                this.operation.predecessor,
                this.operation.salt,
                BN.from(MINDELAY).sub(1)
              )
          ).to.be.revertedWith("TimelockController: insufficient delay");
        });
      });

      describe("execute", function () {
        beforeEach(async function () {
          this.operation = genOperationBatch(
            Array(8).fill("0x76E53CcEb05131Ef5248553bEBDb8F70536830b1"),
            Array(8).fill(0),
            Array(8).fill("0x58a60f63"),
            ZERO_BYTES32,
            "0x9545eeabc7a7586689191f78a5532443698538e54211b5bd4d7dc0fc0102b5c7"
          );
        });

        it("revert if operation is not scheduled", async function () {
          await expect(
            mockTimelock
              .connect(executor.signer)
              .executeBatch(
                this.operation.targets,
                this.operation.values,
                this.operation.payloads,
                this.operation.predecessor,
                this.operation.salt
              )
          ).to.be.revertedWith("TimelockController: operation is not ready");
        });

        describe("with scheduled operation", function () {
          beforeEach(async function () {
            this.receipt = await waitForTx(
              await mockTimelock
                .connect(proposer.signer)
                .scheduleBatch(
                  this.operation.targets,
                  this.operation.values,
                  this.operation.payloads,
                  this.operation.predecessor,
                  this.operation.salt,
                  MINDELAY
                )
            );
          });

          it("revert if execution comes too early 1/2", async function () {
            await expect(
              mockTimelock
                .connect(executor.signer)
                .executeBatch(
                  this.operation.targets,
                  this.operation.values,
                  this.operation.payloads,
                  this.operation.predecessor,
                  this.operation.salt
                )
            ).to.be.revertedWith("TimelockController: operation is not ready");
          });

          it("revert if execution comes too early 2/2", async function () {
            const timestamp = await mockTimelock.getTimestamp(this.operation.id);
            const curBlockTimestamp = await testEnv.mockBlockContext.getCurrentBlockTimestamp();
            await increaseTime(timestamp.sub(curBlockTimestamp).sub(5).toNumber()); // -1 is to tight, test sometime fails

            await expect(
              mockTimelock
                .connect(executor.signer)
                .executeBatch(
                  this.operation.targets,
                  this.operation.values,
                  this.operation.payloads,
                  this.operation.predecessor,
                  this.operation.salt
                )
            ).to.be.revertedWith("TimelockController: operation is not ready");
          });

          describe("on time", function () {
            beforeEach(async function () {
              const timestamp = await mockTimelock.getTimestamp(this.operation.id);
              const curBlockTimestamp = await testEnv.mockBlockContext.getCurrentBlockTimestamp();
              await increaseTime(timestamp.sub(curBlockTimestamp).toNumber());
            });

            it("executor can reveal", async function () {
              const receipt = await waitForTx(
                await mockTimelock
                  .connect(executor.signer)
                  .executeBatch(
                    this.operation.targets,
                    this.operation.values,
                    this.operation.payloads,
                    this.operation.predecessor,
                    this.operation.salt
                  )
              );
              for (const i in this.operation.targets) {
                expectEvent(receipt.events, "CallExecuted", {
                  id: this.operation.id,
                  index: BN.from(i),
                  target: this.operation.targets[i],
                  value: BN.from(this.operation.values[i]),
                  data: this.operation.payloads[i],
                });
              }
            });

            it("prevent non-executor from revealing", async function () {
              await expect(
                mockTimelock
                  .connect(other.signer)
                  .executeBatch(
                    this.operation.targets,
                    this.operation.values,
                    this.operation.payloads,
                    this.operation.predecessor,
                    this.operation.salt
                  )
              ).to.be.revertedWith(
                `AccessControl: account ${other.address.toLowerCase()} is missing role ${EXECUTOR_ROLE}`
              );
            });

            it("length mismatch #1", async function () {
              await expect(
                mockTimelock
                  .connect(executor.signer)
                  .executeBatch(
                    [],
                    this.operation.values,
                    this.operation.payloads,
                    this.operation.predecessor,
                    this.operation.salt
                  )
              ).to.be.revertedWith("TimelockController: length mismatch");
            });

            it("length mismatch #2", async function () {
              await expect(
                mockTimelock
                  .connect(executor.signer)
                  .executeBatch(
                    this.operation.targets,
                    [],
                    this.operation.payloads,
                    this.operation.predecessor,
                    this.operation.salt
                  )
              ).to.be.revertedWith("TimelockController: length mismatch");
            });

            it("length mismatch #3", async function () {
              await expect(
                mockTimelock
                  .connect(executor.signer)
                  .executeBatch(
                    this.operation.targets,
                    this.operation.values,
                    [],
                    this.operation.predecessor,
                    this.operation.salt
                  )
              ).to.be.revertedWith("TimelockController: length mismatch");
            });
          });
        });

        it("partial execution", async function () {
          const mockFunc1 = mockTarget.interface.encodeFunctionData("mockFunction");
          const mockFunc2 = mockTarget.interface.encodeFunctionData("mockFunctionThrows");
          const mockFunc3 = mockTarget.interface.encodeFunctionData("mockFunction");

          const operation = genOperationBatch(
            [mockTarget.address, mockTarget.address, mockTarget.address],
            [0, 0, 0],
            [mockFunc1, mockFunc2, mockFunc3],
            ZERO_BYTES32,
            "0x8ac04aa0d6d66b8812fb41d39638d37af0a9ab11da507afd65c509f8ed079d3e"
          );

          await mockTimelock
            .connect(proposer.signer)
            .scheduleBatch(
              operation.targets,
              operation.values,
              operation.payloads,
              operation.predecessor,
              operation.salt,
              MINDELAY
            );
          await increaseTime(BN.from(MINDELAY).toNumber());

          await expect(
            mockTimelock
              .connect(executor.signer)
              .executeBatch(
                operation.targets,
                operation.values,
                operation.payloads,
                operation.predecessor,
                operation.salt
              )
          ).to.be.revertedWith("TimelockController: underlying transaction reverted");
        });
      });
    });

    describe("cancel", function () {
      beforeEach(async function () {
        this.operation = genOperation(
          "0xC6837c44AA376dbe1d2709F13879E040CAb653ca",
          0,
          "0x296e58dd",
          ZERO_BYTES32,
          "0xa2485763600634800df9fc9646fb2c112cf98649c55f63dd1d9c7d13a64399d9"
        );
        this.receipt = await mockTimelock
          .connect(proposer.signer)
          .schedule(
            this.operation.target,
            this.operation.value,
            this.operation.data,
            this.operation.predecessor,
            this.operation.salt,
            MINDELAY
          );
      });

      it("canceller can cancel", async function () {
        const receipt = await waitForTx(await mockTimelock.connect(canceller.signer).cancel(this.operation.id));
        expectEvent(receipt.events, "Cancelled", { id: this.operation.id });
      });

      it("cannot cancel invalid operation", async function () {
        await expect(mockTimelock.connect(canceller.signer).cancel(ZERO_BYTES32)).to.be.revertedWith(
          "TimelockController: operation cannot be cancelled"
        );
      });

      it("prevent non-canceller from canceling", async function () {
        await expect(mockTimelock.connect(other.signer).cancel(this.operation.id)).to.be.revertedWith(
          `AccessControl: account ${other.address.toLowerCase()} is missing role ${CANCELLER_ROLE}`
        );
      });
    });
  });

  describe("maintenance", function () {
    it("prevent unauthorized maintenance", async function () {
      await expect(mockTimelock.connect(other.signer).updateDelay(0)).to.be.revertedWith(
        "TimelockController: caller must be timelock"
      );
    });

    it("timelock scheduled maintenance", async function () {
      const newDelay = BN.from(ONE_HOUR).mul(6);
      const funcData = mockTimelock.interface.encodeFunctionData("updateDelay", [newDelay.toString()]);
      const operation = genOperation(
        mockTimelock.address,
        0,
        funcData,
        ZERO_BYTES32,
        "0xf8e775b2c5f4d66fb5c7fa800f35ef518c262b6014b3c0aee6ea21bff157f108"
      );

      await mockTimelock
        .connect(proposer.signer)
        .schedule(operation.target, operation.value, operation.data, operation.predecessor, operation.salt, MINDELAY);
      await increaseTime(BN.from(MINDELAY).toNumber());

      const receipt = await waitForTx(
        await mockTimelock
          .connect(executor.signer)
          .execute(operation.target, operation.value, operation.data, operation.predecessor, operation.salt)
      );
      expectEvent(receipt.events, "MinDelayChange", { newDuration: newDelay.toString(), oldDuration: MINDELAY });

      expect(await mockTimelock.getMinDelay()).to.be.bignumber.equal(newDelay);
    });
  });

  describe("pause", function () {
    beforeEach(async function () {
      this.operation1 = genOperation(
        "0xdE66bD4c97304200A95aE0AadA32d6d01A867E39",
        0,
        "0x01dc731a",
        ZERO_BYTES32,
        "0x64e932133c7677402ead2926f86205e2ca4686aebecf5a8077627092b9bb2feb"
      );
      this.operation2 = genOperation(
        "0x3c7944a3F1ee7fc8c5A5134ba7c79D11c3A1FCa3",
        0,
        "0x8f531849",
        this.operation1.id,
        "0x036e1311cac523f9548e6461e29fb1f8f9196b91910a41711ea22f5de48df07d"
      );

      await mockTimelock
        .connect(proposer.signer)
        .schedule(
          this.operation1.target,
          this.operation1.value,
          this.operation1.data,
          this.operation1.predecessor,
          this.operation1.salt,
          MINDELAY
        );
    });

    it("prevent unauthorized pause", async function () {
      await expect(mockTimelock.connect(other.signer).setPause(true)).to.be.revertedWith(
        `AccessControl: account ${other.address.toLowerCase()} is missing role ${PAUSER_ROLE}`
      );
    });

    it("allow authorized pause", async function () {
      await mockTimelock.connect(pauser.signer).setPause(true);
      expect(await mockTimelock.paused()).to.be.equal(true);

      await mockTimelock.connect(pauser.signer).setPause(false);
      expect(await mockTimelock.paused()).to.be.equal(false);
    });

    it("cannot schedule when paused", async function () {
      await mockTimelock.connect(pauser.signer).setPause(true);

      await expect(
        mockTimelock
          .connect(proposer.signer)
          .schedule(
            this.operation2.target,
            this.operation2.value,
            this.operation2.data,
            this.operation2.predecessor,
            this.operation2.salt,
            MINDELAY
          )
      ).to.be.revertedWith("Pausable: paused");
    });

    it("cannot execute when paused", async function () {
      await mockTimelock.connect(pauser.signer).setPause(true);

      await increaseTime(BN.from(MINDELAY).toNumber());

      await expect(
        mockTimelock
          .connect(executor.signer)
          .execute(
            this.operation1.target,
            this.operation1.value,
            this.operation1.data,
            this.operation1.predecessor,
            this.operation1.salt
          )
      ).to.be.revertedWith("Pausable: paused");
    });

    it("can cancel when paused", async function () {
      await mockTimelock.connect(pauser.signer).setPause(true);

      expect(await mockTimelock.isOperation(this.operation1.id)).to.be.equal(true);

      await mockTimelock.connect(canceller.signer).cancel(this.operation1.id);

      expect(await mockTimelock.isOperation(this.operation1.id)).to.be.equal(false);
    });
  });

  describe("dependency", function () {
    beforeEach(async function () {
      this.operation1 = genOperation(
        "0xdE66bD4c97304200A95aE0AadA32d6d01A867E39",
        0,
        "0x01dc731a",
        ZERO_BYTES32,
        "0x64e932133c7677402ead2926f86205e2ca4686aebecf5a8077627092b9bb2feb"
      );
      this.operation2 = genOperation(
        "0x3c7944a3F1ee7fc8c5A5134ba7c79D11c3A1FCa3",
        0,
        "0x8f531849",
        this.operation1.id,
        "0x036e1311cac523f9548e6461e29fb1f8f9196b91910a41711ea22f5de48df07d"
      );
      await mockTimelock
        .connect(proposer.signer)
        .schedule(
          this.operation1.target,
          this.operation1.value,
          this.operation1.data,
          this.operation1.predecessor,
          this.operation1.salt,
          MINDELAY
        );
      await mockTimelock
        .connect(proposer.signer)
        .schedule(
          this.operation2.target,
          this.operation2.value,
          this.operation2.data,
          this.operation2.predecessor,
          this.operation2.salt,
          MINDELAY
        );
      await increaseTime(BN.from(MINDELAY).toNumber());
    });

    it("cannot execute before dependency", async function () {
      await expect(
        mockTimelock
          .connect(executor.signer)
          .execute(
            this.operation2.target,
            this.operation2.value,
            this.operation2.data,
            this.operation2.predecessor,
            this.operation2.salt
          )
      ).to.be.revertedWith("TimelockController: missing dependency");
    });

    it("can execute after dependency", async function () {
      await mockTimelock
        .connect(executor.signer)
        .execute(
          this.operation1.target,
          this.operation1.value,
          this.operation1.data,
          this.operation1.predecessor,
          this.operation1.salt
        );
      await mockTimelock
        .connect(executor.signer)
        .execute(
          this.operation2.target,
          this.operation2.value,
          this.operation2.data,
          this.operation2.predecessor,
          this.operation2.salt
        );
    });
  });

  describe("usage scenario", function () {
    it("call", async function () {
      const operation = genOperation(
        mockTarget.address,
        0,
        mockTarget.interface.encodeFunctionData("setValue", [42]),
        ZERO_BYTES32,
        "0x8043596363daefc89977b25f9d9b4d06c3910959ef0c4d213557a903e1b555e2"
      );

      await mockTimelock
        .connect(proposer.signer)
        .schedule(operation.target, operation.value, operation.data, operation.predecessor, operation.salt, MINDELAY);
      await increaseTime(BN.from(MINDELAY).toNumber());
      await mockTimelock
        .connect(executor.signer)
        .execute(operation.target, operation.value, operation.data, operation.predecessor, operation.salt);

      expect(await mockTarget.getValue()).to.be.bignumber.equal(BN.from(42));
    });

    it("call reverting", async function () {
      const operation = genOperation(
        mockTarget.address,
        0,
        mockTarget.interface.encodeFunctionData("mockFunctionRevertsNoReason"),
        ZERO_BYTES32,
        "0xb1b1b276fdf1a28d1e00537ea73b04d56639128b08063c1a2f70a52e38cba693"
      );

      await mockTimelock
        .connect(proposer.signer)
        .schedule(operation.target, operation.value, operation.data, operation.predecessor, operation.salt, MINDELAY);
      await increaseTime(BN.from(MINDELAY).toNumber());
      await expect(
        mockTimelock
          .connect(executor.signer)
          .execute(operation.target, operation.value, operation.data, operation.predecessor, operation.salt)
      ).to.be.revertedWith("TimelockController: underlying transaction reverted");
    });

    it("call throw", async function () {
      const operation = genOperation(
        mockTarget.address,
        0,
        mockTarget.interface.encodeFunctionData("mockFunctionThrows"),
        ZERO_BYTES32,
        "0xe5ca79f295fc8327ee8a765fe19afb58f4a0cbc5053642bfdd7e73bc68e0fc67"
      );

      await mockTimelock
        .connect(proposer.signer)
        .schedule(operation.target, operation.value, operation.data, operation.predecessor, operation.salt, MINDELAY);
      await increaseTime(BN.from(MINDELAY).toNumber());
      await expect(
        mockTimelock
          .connect(executor.signer)
          .execute(operation.target, operation.value, operation.data, operation.predecessor, operation.salt)
      ).to.be.revertedWith("TimelockController: underlying transaction reverted");
    });

    it("call out of gas", async function () {
      const operation = genOperation(
        mockTarget.address,
        0,
        mockTarget.interface.encodeFunctionData("mockFunctionOutOfGas"),
        ZERO_BYTES32,
        "0xf3274ce7c394c5b629d5215723563a744b817e1730cca5587c567099a14578fd"
      );

      await mockTimelock
        .connect(proposer.signer)
        .schedule(operation.target, operation.value, operation.data, operation.predecessor, operation.salt, MINDELAY);
      await increaseTime(BN.from(MINDELAY).toNumber());
      await expect(
        mockTimelock
          .connect(executor.signer)
          .execute(operation.target, operation.value, operation.data, operation.predecessor, operation.salt, {
            gasLimit: "70000",
          })
      ).to.be.revertedWith("TimelockController: underlying transaction reverted");
    });

    it("call payable with eth", async function () {
      const operation = genOperation(
        mockTarget.address,
        1,
        mockTarget.interface.encodeFunctionData("mockFunction"),
        ZERO_BYTES32,
        "0x5ab73cd33477dcd36c1e05e28362719d0ed59a7b9ff14939de63a43073dc1f44"
      );

      await mockTimelock
        .connect(proposer.signer)
        .schedule(operation.target, operation.value, operation.data, operation.predecessor, operation.salt, MINDELAY);
      await increaseTime(BN.from(MINDELAY).toNumber());

      expect(await testEnv.mockBlockContext.getEthBalance(mockTimelock.address)).to.be.bignumber.equal(BN.from(0));
      expect(await testEnv.mockBlockContext.getEthBalance(mockTarget.address)).to.be.bignumber.equal(BN.from(0));

      await mockTimelock
        .connect(executor.signer)
        .execute(operation.target, operation.value, operation.data, operation.predecessor, operation.salt, {
          value: 1,
        });

      expect(await testEnv.mockBlockContext.getEthBalance(mockTimelock.address)).to.be.bignumber.equal(BN.from(0));
      expect(await testEnv.mockBlockContext.getEthBalance(mockTarget.address)).to.be.bignumber.equal(BN.from(1));
    });

    it("call nonpayable with eth", async function () {
      const operation = genOperation(
        mockTarget.address,
        1,
        mockTarget.interface.encodeFunctionData("mockFunctionNonPayable"),
        ZERO_BYTES32,
        "0xb78edbd920c7867f187e5aa6294ae5a656cfbf0dea1ccdca3751b740d0f2bdf8"
      );

      await mockTimelock
        .connect(proposer.signer)
        .schedule(operation.target, operation.value, operation.data, operation.predecessor, operation.salt, MINDELAY);
      await increaseTime(BN.from(MINDELAY).toNumber());

      expect(await testEnv.mockBlockContext.getEthBalance(mockTimelock.address)).to.be.bignumber.equal(BN.from(0));
      expect(await testEnv.mockBlockContext.getEthBalance(mockTarget.address)).to.be.bignumber.equal(BN.from(0));

      await expect(
        mockTimelock
          .connect(executor.signer)
          .execute(operation.target, operation.value, operation.data, operation.predecessor, operation.salt)
      ).to.be.revertedWith("TimelockController: underlying transaction reverted");

      expect(await testEnv.mockBlockContext.getEthBalance(mockTimelock.address)).to.be.bignumber.equal(BN.from(0));
      expect(await testEnv.mockBlockContext.getEthBalance(mockTarget.address)).to.be.bignumber.equal(BN.from(0));
    });

    it("call reverting with eth", async function () {
      const operation = genOperation(
        mockTarget.address,
        1,
        mockTarget.interface.encodeFunctionData("mockFunctionRevertsNoReason"),
        ZERO_BYTES32,
        "0xdedb4563ef0095db01d81d3f2decf57cf83e4a72aa792af14c43a792b56f4de6"
      );

      await mockTimelock
        .connect(proposer.signer)
        .schedule(operation.target, operation.value, operation.data, operation.predecessor, operation.salt, MINDELAY);
      await increaseTime(BN.from(MINDELAY).toNumber());

      expect(await testEnv.mockBlockContext.getEthBalance(mockTimelock.address)).to.be.bignumber.equal(BN.from(0));
      expect(await testEnv.mockBlockContext.getEthBalance(mockTarget.address)).to.be.bignumber.equal(BN.from(0));

      await expect(
        mockTimelock
          .connect(executor.signer)
          .execute(operation.target, operation.value, operation.data, operation.predecessor, operation.salt)
      ).to.be.revertedWith("TimelockController: underlying transaction reverted");

      expect(await testEnv.mockBlockContext.getEthBalance(mockTimelock.address)).to.be.bignumber.equal(BN.from(0));
      expect(await testEnv.mockBlockContext.getEthBalance(mockTarget.address)).to.be.bignumber.equal(BN.from(0));
    });
  });

  describe("safe receive", function () {
    describe("ERC721", function () {
      const name = "Non Fungible Token";
      const symbol = "NFT";
      const tokenId = BN.from(1);

      beforeEach(async function () {
        await mockERC721.connect(other.signer).mint(tokenId);
      });

      it("can receive an ERC721 safeTransfer", async function () {
        await mockERC721
          .connect(other.signer)
          ["safeTransferFrom(address,address,uint256)"](other.address, mockTimelock.address, tokenId);
      });
    });

    describe("ERC1155", function () {
      beforeEach(async function () {
        await mockERC1155.connect(other.signer).mint(1, 5);
        await mockERC1155.connect(other.signer).mint(2, 6);
        await mockERC1155.connect(other.signer).mint(3, 7);
      });

      it("can receive ERC1155 safeTransfer", async function () {
        await mockERC1155.connect(other.signer).safeTransferFrom(other.address, mockTimelock.address, 1, 5, "0x");
      });

      it("can receive ERC1155 safeBatchTransfer", async function () {
        await mockERC1155
          .connect(other.signer)
          .safeBatchTransferFrom(other.address, mockTimelock.address, [1, 2, 3], [5, 6, 7], "0x");
      });
    });
  });
});
