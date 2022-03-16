// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {UserProxy} from "./UserProxy.sol";
import {ICryptoPunk} from "./ICryptoPunk.sol";
import {IWrappedPunks} from "../../interfaces/IWrappedPunks.sol";

contract WrappedPunk is IWrappedPunks, Ownable, ERC721Enumerable, Pausable {
  event ProxyRegistered(address user, address proxy);

  // Instance of cryptopunk smart contract
  ICryptoPunk private _punkContract;

  // Mapping from user address to proxy address
  mapping(address => address) private _proxies;

  /**
   * @dev Initializes the contract settings
   */
  constructor(address punkContract_) ERC721("Wrapped Cryptopunks", "WPUNKS") {
    _punkContract = ICryptoPunk(punkContract_);
  }

  /**
   * @dev Gets address of cryptopunk smart contract
   */
  function punkContract() public view override returns (address) {
    return address(_punkContract);
  }

  /**
   * @dev Registers proxy
   */
  function registerProxy() public override {
    address sender = _msgSender();

    require(_proxies[sender] == address(0), "PunkWrapper: caller has registered the proxy");

    address proxy = address(new UserProxy());

    _proxies[sender] = proxy;

    emit ProxyRegistered(sender, proxy);
  }

  /**
   * @dev Gets proxy address
   */
  function proxyInfo(address user) public view override returns (address) {
    return _proxies[user];
  }

  /**
   * @dev Mints a wrapped punk
   */
  function mint(uint256 punkIndex) public override whenNotPaused {
    address sender = _msgSender();

    UserProxy proxy = UserProxy(_proxies[sender]);

    require(proxy.transfer(address(_punkContract), punkIndex), "PunkWrapper: transfer fail");

    _mint(sender, punkIndex);
  }

  /**
   * @dev Burns a specific wrapped punk
   */
  function burn(uint256 punkIndex) public override whenNotPaused {
    address sender = _msgSender();

    require(_isApprovedOrOwner(sender, punkIndex), "PunkWrapper: caller is not owner nor approved");

    _burn(punkIndex);

    // Transfers ownership of punk on original cryptopunk smart contract to caller
    _punkContract.transferPunk(sender, punkIndex);
  }

  function _baseURI() internal view virtual override returns (string memory) {
    return "https://wrappedpunks.com:3000/api/punks/metadata/";
  }
}
