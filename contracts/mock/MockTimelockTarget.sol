// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

contract MockTimelockTarget {
  string public sharedAnswer;
  uint256 public sharedValue;

  event MockFunctionCalled();
  event MockFunctionCalledWithArgs(uint256 a, uint256 b);

  uint256[] private _array;

  function mockFunction() public payable returns (string memory) {
    emit MockFunctionCalled();

    return "0x1234";
  }

  function mockFunctionWithArgs(uint256 a, uint256 b) public payable returns (string memory) {
    emit MockFunctionCalledWithArgs(a, b);

    return "0x1234";
  }

  function mockFunctionNonPayable() public returns (string memory) {
    emit MockFunctionCalled();

    return "0x1234";
  }

  function mockStaticFunction() public pure returns (string memory) {
    return "0x1234";
  }

  function mockFunctionRevertsNoReason() public payable {
    revert();
  }

  function mockFunctionRevertsReason() public payable {
    revert("CallReceiverMock: reverting");
  }

  function mockFunctionThrows() public payable {
    assert(false);
  }

  function mockFunctionOutOfGas() public payable {
    for (uint256 i = 0; ; ++i) {
      _array.push(i);
    }
  }

  function mockFunctionWritesStorage() public returns (string memory) {
    sharedAnswer = "42";
    return "0x1234";
  }

  function setValue(uint256 value) public {
    sharedValue = value;
  }

  function getValue() public view returns (uint256) {
    return sharedValue;
  }
}
