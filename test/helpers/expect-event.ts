import BigNumber from "bignumber.js";
import { BigNumber as BN } from "ethers";

import { expect } from "chai";

export function expectEvent(logs, eventName, eventArgs = {}) {
  const events = logs.filter((e) => e.event === eventName);
  expect(events.length > 0).to.equal(true, `No '${eventName}' events found`);

  const exception: any[] = [];
  const event = events.find(function (e) {
    for (const [k, v] of Object.entries(eventArgs)) {
      try {
        contains(e.args, k, v);
      } catch (error) {
        exception.push(error);
        return false;
      }
    }
    return true;
  });

  if (event === undefined) {
    throw exception[0];
  }

  return event;
}

export function notExpectEvent(logs, eventName) {
  // eslint-disable-next-line no-unused-expressions
  expect(
    logs.find((e) => e.event === eventName),
    `Event ${eventName} was found`
  ).to.be.undefined;
}

function isBN(object) {
  return BN.isBigNumber(object) || object instanceof BN;
}

function contains(args, key, value) {
  expect(key in args).to.equal(true, `Event argument '${key}' not found`);

  if (value === null) {
    expect(args[key]).to.equal(null, `expected event argument '${key}' to be null but got ${args[key]}`);
  } else if (isBN(args[key]) || isBN(value)) {
    const actual = isBN(args[key]) ? args[key].toString() : args[key];
    const expected = isBN(value) ? value.toString() : value;
    expect(args[key]).to.be.equal(
      value,
      `expected event argument '${key}' to have value ${expected} but got ${actual}`
    );
  } else {
    expect(args[key]).to.be.deep.equal(
      value,
      `expected event argument '${key}' to have value ${value} but got ${args[key]}`
    );
  }
}
