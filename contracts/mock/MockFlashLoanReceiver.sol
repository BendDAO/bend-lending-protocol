// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {IFlashLoanReceiver} from "../interfaces/IFlashLoanReceiver.sol";
import {IBNFT} from "../interfaces/IBNFT.sol";
import {IBNFTRegistry} from "../interfaces/IBNFTRegistry.sol";

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import {MockFlashLoanReceiverDummy} from "./MockFlashLoanReceiverDummy.sol";

contract MockFlashLoanReceiver is IFlashLoanReceiver, IERC721Receiver {
  event ExecutedWithFail(address _asset, uint256[] _tokenIds);
  event ExecutedWithSuccess(address _asset, uint256[] _tokenIds);

  address _bnftRegistry;

  bool _failExecution;
  uint8 _simulateBNFTCall;
  uint256 _simulateBNFTCallTokenId;
  mapping(uint256 => bool) _tokenIdNotToApproves;
  uint256[] _tokenIdList;

  constructor(address bnftRegistry_) {
    _bnftRegistry = bnftRegistry_;
  }

  function setFailExecution(bool fail) public {
    _failExecution = fail;
  }

  function setTokenIdNotToApprove(uint256 tokenId) public {
    _tokenIdNotToApproves[tokenId] = true;
    _tokenIdList.push(tokenId);
  }

  //1:mint, 2:burn
  function setSimulateCallBNFT(uint8 val, uint256 tokenId) public {
    _simulateBNFTCall = val;
    _simulateBNFTCallTokenId = tokenId;
  }

  function clearAllSimulate() public {
    _failExecution = false;
    _simulateBNFTCall = 0;
    _simulateBNFTCallTokenId = 0;
    uint256 i;
    for (i = 0; i < _tokenIdList.length; i++) {
      delete _tokenIdNotToApproves[i];
      delete _tokenIdList[i];
    }
  }

  function executeOperation(
    address asset,
    uint256[] memory tokenIds,
    address initiator,
    address operator,
    bytes memory params
  ) public override returns (bool) {
    params;
    initiator;

    (address bNftProxy, ) = IBNFTRegistry(_bnftRegistry).getBNFTAddresses(asset);
    address _bNftAddress = bNftProxy;

    if (_failExecution) {
      emit ExecutedWithFail(asset, tokenIds);
      return false;
    }

    //IERC721(asset).setApprovalForAll(operator, true);

    for (uint256 i = 0; i < tokenIds.length; i++) {
      //check the contract has the specified token
      require(IERC721(asset).ownerOf(tokenIds[i]) == address(this), "Invalid token for the contract");

      //simulate reentry into BNFT, revert expected
      if (_simulateBNFTCall == 1) {
        IERC721(asset).setApprovalForAll(_bNftAddress, true);
        IBNFT(_bNftAddress).mint(initiator, tokenIds[i]);
      }

      //simulate reentry into BNFT, revert expected
      if (_simulateBNFTCall == 2) {
        IERC721(asset).setApprovalForAll(_bNftAddress, true);
        IBNFT(_bNftAddress).burn(tokenIds[i]);
      }

      //simulate reentry into BNFT, revert expected
      if (_simulateBNFTCall == 3) {
        address simReceiver = address(this);
        uint256[] memory simTokenIds = new uint256[](1);
        simTokenIds[0] = _simulateBNFTCallTokenId;
        IBNFT(_bNftAddress).flashLoan(simReceiver, simTokenIds, new bytes(0));
      }

      //simulate reentry into BNFT, revert expected
      if (_simulateBNFTCall == 4) {
        address simReceiver = address(new MockFlashLoanReceiverDummy(_bnftRegistry));
        uint256[] memory simTokenIds = new uint256[](1);
        simTokenIds[0] = _simulateBNFTCallTokenId;
        IBNFT(_bNftAddress).flashLoan(simReceiver, simTokenIds, new bytes(0));
      }

      if (!_tokenIdNotToApproves[tokenIds[i]]) {
        IERC721(asset).approve(operator, tokenIds[i]);
      }
    }

    emit ExecutedWithSuccess(asset, tokenIds);

    return true;
  }

  function onERC721Received(
    address operator,
    address from,
    uint256 tokenId,
    bytes calldata data
  ) external pure override returns (bytes4) {
    operator;
    from;
    tokenId;
    data;
    return IERC721Receiver.onERC721Received.selector;
  }
}
