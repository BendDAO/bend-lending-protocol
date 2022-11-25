// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {IBNFT} from "../../interfaces/IBNFT.sol";
import {IFlashLoanReceiver} from "../../interfaces/IFlashLoanReceiver.sol";
import {IENSReverseRegistrar} from "../../interfaces/IENSReverseRegistrar.sol";

import {StringsUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import {AddressUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import {EnumerableSetUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {ERC721EnumerableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import {IERC1155Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import {IERC721MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/IERC721MetadataUpgradeable.sol";
import {IERC721ReceiverUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import {IERC1155ReceiverUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155ReceiverUpgradeable.sol";

/**
 * @title BNFT contract
 * @dev Implements the methods for the bNFT protocol
 **/
contract BNFT is IBNFT, ERC721EnumerableUpgradeable, IERC721ReceiverUpgradeable, IERC1155ReceiverUpgradeable {
  using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

  address private _underlyingAsset;
  // Mapping from token ID to minter address
  mapping(uint256 => address) private _minters;
  address private _owner;
  uint256 private constant _NOT_ENTERED = 0;
  uint256 private constant _ENTERED = 1;
  uint256 private _status;
  address private _claimAdmin;
  // Mapping from minter to flash loan operator approval address
  mapping(address => mapping(address => bool)) private _flashLoanOperatorApprovals;
  // Mapping from minter & token ID to flash loan operator locking address
  mapping(address => mapping(uint256 => EnumerableSetUpgradeable.AddressSet)) private _flashLoanOperatorLockings;

  /**
   * @dev Prevents a contract from calling itself, directly or indirectly.
   * Calling a `nonReentrant` function from another `nonReentrant`
   * function is not supported. It is possible to prevent this from happening
   * by making the `nonReentrant` function external, and making it call a
   * `private` function that does the actual work.
   */
  modifier nonReentrant() {
    // On the first call to nonReentrant, _notEntered will be true
    require(_status != _ENTERED, "ReentrancyGuard: reentrant call");

    // Any calls to nonReentrant after this point will fail
    _status = _ENTERED;

    _;

    // By storing the original value once again, a refund is triggered (see
    // https://eips.ethereum.org/EIPS/eip-2200)
    _status = _NOT_ENTERED;
  }

  /**
   * @dev Initializes the bNFT
   * @param underlyingAsset_ The address of the underlying asset of this bNFT (E.g. PUNK for bPUNK)
   */
  function initialize(
    address underlyingAsset_,
    string calldata bNftName,
    string calldata bNftSymbol,
    address owner_,
    address claimAdmin_
  ) external override initializer {
    __ERC721_init(bNftName, bNftSymbol);

    _underlyingAsset = underlyingAsset_;

    _transferOwnership(owner_);

    _setClaimAdmin(claimAdmin_);

    emit Initialized(underlyingAsset_);
  }

  /**
   * @dev Returns the address of the current owner.
   */
  function owner() public view virtual returns (address) {
    return _owner;
  }

  /**
   * @dev Throws if called by any account other than the owner.
   */
  modifier onlyOwner() {
    require(owner() == _msgSender(), "BNFT: caller is not the owner");
    _;
  }

  /**
   * @dev Leaves the contract without owner. It will not be possible to call
   * `onlyOwner` functions anymore. Can only be called by the current owner.
   *
   * NOTE: Renouncing ownership will leave the contract without an owner,
   * thereby removing any functionality that is only available to the owner.
   */
  function renounceOwnership() public virtual onlyOwner {
    _transferOwnership(address(0));
  }

  /**
   * @dev Transfers ownership of the contract to a new account (`newOwner`).
   * Can only be called by the current owner.
   */
  function transferOwnership(address newOwner) public virtual onlyOwner {
    require(newOwner != address(0), "BNFT: new owner is the zero address");
    _transferOwnership(newOwner);
  }

  /**
   * @dev Transfers ownership of the contract to a new account (`newOwner`).
   * Internal function without access restriction.
   */
  function _transferOwnership(address newOwner) internal virtual {
    address oldOwner = _owner;
    _owner = newOwner;
    emit OwnershipTransferred(oldOwner, newOwner);
  }

  /**
   * @dev Returns the address of the current claim admin.
   */
  function claimAdmin() public view virtual returns (address) {
    return _claimAdmin;
  }

  /**
   * @dev Throws if called by any account other than the claim admin.
   */
  modifier onlyClaimAdmin() {
    require(claimAdmin() == _msgSender(), "BNFT: caller is not the claim admin");
    _;
  }

  /**
   * @dev Set claim admin of the contract to a new account (`newAdmin`).
   * Can only be called by the current owner.
   */
  function setClaimAdmin(address newAdmin) public virtual onlyOwner {
    require(newAdmin != address(0), "BNFT: new admin is the zero address");
    _setClaimAdmin(newAdmin);
  }

  function _setClaimAdmin(address newAdmin) internal virtual {
    address oldAdmin = _claimAdmin;
    _claimAdmin = newAdmin;
    emit ClaimAdminUpdated(oldAdmin, newAdmin);
  }

  /**
   * @dev Mints bNFT token to the user address
   *
   * Requirements:
   *  - The caller can be contract address and EOA
   *
   * @param to The owner address receive the bNFT token
   * @param tokenId token id of the underlying asset of NFT
   **/
  function mint(address to, uint256 tokenId) external override nonReentrant {
    bool isCA = AddressUpgradeable.isContract(_msgSender());
    if (!isCA) {
      require(to == _msgSender(), "BNFT: caller is not to");
    }
    require(!_exists(tokenId), "BNFT: exist token");
    require(IERC721Upgradeable(_underlyingAsset).ownerOf(tokenId) == _msgSender(), "BNFT: caller is not owner");

    // mint bNFT to user
    _mint(to, tokenId);

    _minters[tokenId] = _msgSender();

    // Receive NFT Tokens
    IERC721Upgradeable(_underlyingAsset).safeTransferFrom(_msgSender(), address(this), tokenId);

    emit Mint(_msgSender(), _underlyingAsset, tokenId, to);
  }

  /**
   * @dev Burns user bNFT token
   *
   * Requirements:
   *  - The caller can be contract address and EOA
   *
   * @param tokenId token id of the underlying asset of NFT
   **/
  function burn(uint256 tokenId) external override nonReentrant {
    require(_exists(tokenId), "BNFT: nonexist token");
    require(_minters[tokenId] == _msgSender(), "BNFT: caller is not minter");

    address tokenOwner = ERC721Upgradeable.ownerOf(tokenId);

    _burn(tokenId);

    delete _minters[tokenId];

    IERC721Upgradeable(_underlyingAsset).safeTransferFrom(address(this), _msgSender(), tokenId);

    emit Burn(_msgSender(), _underlyingAsset, tokenId, tokenOwner);
  }

  /**
   * @dev See {IBNFT-flashLoan}.
   */
  function flashLoan(
    address receiverAddress,
    uint256[] calldata nftTokenIds,
    bytes calldata params
  ) external override nonReentrant {
    uint256 i;
    IFlashLoanReceiver receiver = IFlashLoanReceiver(receiverAddress);

    // !!!CAUTION: receiver contract may reentry mint, burn, flashloan again

    require(receiverAddress != address(0), "BNFT: zero address");
    require(nftTokenIds.length > 0, "BNFT: empty token list");

    // only token owner can do flashloan
    for (i = 0; i < nftTokenIds.length; i++) {
      address minter = minterOf(nftTokenIds[i]);
      if (_flashLoanOperatorLockings[minter][nftTokenIds[i]].length() > 0) {
        require(isFlashLoanLocked(nftTokenIds[i], minter, _msgSender()), "BNFT: caller without permission");
      } else {
        require(_isFlashLoanApprovedOrOwner(nftTokenIds[i], _msgSender()), "BNFT: caller without permission");
      }
    }

    // step 1: moving underlying asset forward to receiver contract
    for (i = 0; i < nftTokenIds.length; i++) {
      IERC721Upgradeable(_underlyingAsset).safeTransferFrom(address(this), receiverAddress, nftTokenIds[i]);
    }

    // setup 2: execute receiver contract, doing something like aidrop
    require(
      receiver.executeOperation(_underlyingAsset, nftTokenIds, _msgSender(), address(this), params),
      "BNFT: invalid flashloan executor return"
    );

    // setup 3: moving underlying asset backword from receiver contract
    for (i = 0; i < nftTokenIds.length; i++) {
      IERC721Upgradeable(_underlyingAsset).safeTransferFrom(receiverAddress, address(this), nftTokenIds[i]);

      emit FlashLoan(receiverAddress, _msgSender(), _underlyingAsset, nftTokenIds[i]);
    }
  }

  /**
   * @dev See {IBNFT-setFlashLoanApproval}.
   */
  function setFlashLoanApproval(address operator, bool approved) public override nonReentrant {
    address minter = _msgSender();
    _flashLoanOperatorApprovals[minter][operator] = approved;
    emit FlashLoanApproval(minter, operator, approved);
  }

  /**
   * @dev See {IBNFT-isFlashLoanApproved}.
   */
  function isFlashLoanApproved(address minter, address operator) public view override returns (bool) {
    return _flashLoanOperatorApprovals[minter][operator];
  }

  function setFlashLoanLocking(
    uint256 tokenId,
    address operator,
    bool locked
  ) public override {
    if (locked) {
      _flashLoanOperatorLockings[_msgSender()][tokenId].add(operator);

      emit FlashLoanLocking(tokenId, _msgSender(), operator, true);
    } else {
      _flashLoanOperatorLockings[_msgSender()][tokenId].remove(operator);

      emit FlashLoanLocking(tokenId, _msgSender(), operator, false);
    }
  }

  function isFlashLoanLocked(
    uint256 tokenId,
    address minter,
    address operator
  ) public view override returns (bool) {
    return _flashLoanOperatorLockings[minter][tokenId].contains(operator);
  }

  function getFlashLoanLocked(uint256 tokenId, address minter) public view override returns (address[] memory) {
    return _flashLoanOperatorLockings[minter][tokenId].values();
  }

  /**
   * @dev See {IERC721Metadata-tokenURI}.
   */
  function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
    return IERC721MetadataUpgradeable(_underlyingAsset).tokenURI(tokenId);
  }

  /**
   * @dev See {IBNFT-contractURI}.
   */
  function contractURI() external view override returns (string memory) {
    string memory hexAddress = StringsUpgradeable.toHexString(uint256(uint160(address(this))), 20);
    return string(abi.encodePacked("https://metadata.benddao.xyz/", hexAddress));
  }

  function claimERC20Airdrop(
    address token,
    address to,
    uint256 amount
  ) external override nonReentrant onlyClaimAdmin {
    require(token != _underlyingAsset, "BNFT: token can not be underlying asset");
    require(token != address(this), "BNFT: token can not be self address");
    IERC20Upgradeable(token).transfer(to, amount);
    emit ClaimERC20Airdrop(token, to, amount);
  }

  function claimERC721Airdrop(
    address token,
    address to,
    uint256[] calldata ids
  ) external override nonReentrant onlyClaimAdmin {
    require(token != _underlyingAsset, "BNFT: token can not be underlying asset");
    require(token != address(this), "BNFT: token can not be self address");
    for (uint256 i = 0; i < ids.length; i++) {
      IERC721Upgradeable(token).safeTransferFrom(address(this), to, ids[i]);
    }
    emit ClaimERC721Airdrop(token, to, ids);
  }

  function claimERC1155Airdrop(
    address token,
    address to,
    uint256[] calldata ids,
    uint256[] calldata amounts,
    bytes calldata data
  ) external override nonReentrant onlyClaimAdmin {
    require(token != _underlyingAsset, "BNFT: token can not be underlying asset");
    require(token != address(this), "BNFT: token can not be self address");
    IERC1155Upgradeable(token).safeBatchTransferFrom(address(this), to, ids, amounts, data);
    emit ClaimERC1155Airdrop(token, to, ids, amounts, data);
  }

  function executeAirdrop(address airdropContract, bytes calldata airdropParams)
    external
    override
    nonReentrant
    onlyClaimAdmin
  {
    require(airdropContract != address(0), "invalid airdrop contract address");
    require(airdropParams.length >= 4, "invalid airdrop parameters");

    // call project aidrop contract
    AddressUpgradeable.functionCall(airdropContract, airdropParams, "call airdrop method failed");

    emit ExecuteAirdrop(airdropContract);
  }

  function setENSName(address registrar, string memory name) external nonReentrant onlyOwner returns (bytes32) {
    return IENSReverseRegistrar(registrar).setName(name);
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
    return IERC721ReceiverUpgradeable.onERC721Received.selector;
  }

  function onERC1155Received(
    address operator,
    address from,
    uint256 id,
    uint256 value,
    bytes calldata data
  ) external pure override returns (bytes4) {
    operator;
    from;
    id;
    value;
    data;
    return IERC1155ReceiverUpgradeable.onERC1155Received.selector;
  }

  function onERC1155BatchReceived(
    address operator,
    address from,
    uint256[] calldata ids,
    uint256[] calldata values,
    bytes calldata data
  ) external pure override returns (bytes4) {
    operator;
    from;
    ids;
    values;
    data;
    return IERC1155ReceiverUpgradeable.onERC1155BatchReceived.selector;
  }

  /**
   * @dev See {IBNFT-minterOf}.
   */
  function minterOf(uint256 tokenId) public view override returns (address) {
    address minter = _minters[tokenId];
    require(minter != address(0), "BNFT: minter query for nonexistent token");
    return minter;
  }

  /**
   * @dev See {IBNFT-underlyingAsset}.
   */
  function underlyingAsset() public view override returns (address) {
    return _underlyingAsset;
  }

  /**
   * @dev Being non transferrable, the bNFT token does not implement any of the
   * standard ERC721 functions for transfer and allowance.
   **/
  function approve(address to, uint256 tokenId) public virtual override {
    to;
    tokenId;
    revert("APPROVAL_NOT_SUPPORTED");
  }

  function setApprovalForAll(address operator, bool approved) public virtual override {
    operator;
    approved;
    revert("APPROVAL_NOT_SUPPORTED");
  }

  function transferFrom(
    address from,
    address to,
    uint256 tokenId
  ) public virtual override {
    from;
    to;
    tokenId;
    revert("TRANSFER_NOT_SUPPORTED");
  }

  function safeTransferFrom(
    address from,
    address to,
    uint256 tokenId
  ) public virtual override {
    from;
    to;
    tokenId;
    revert("TRANSFER_NOT_SUPPORTED");
  }

  function safeTransferFrom(
    address from,
    address to,
    uint256 tokenId,
    bytes memory _data
  ) public virtual override {
    from;
    to;
    tokenId;
    _data;
    revert("TRANSFER_NOT_SUPPORTED");
  }

  function _transfer(
    address from,
    address to,
    uint256 tokenId
  ) internal virtual override(ERC721Upgradeable) {
    from;
    to;
    tokenId;
    revert("TRANSFER_NOT_SUPPORTED");
  }

  /**
   * @dev Returns whether `operator` is allowed to flash loan `tokenId`.
   */
  function _isFlashLoanApprovedOrOwner(uint256 tokenId, address operator) internal view returns (bool) {
    address tokenOwner = ownerOf(tokenId);
    address tokenMinter = minterOf(tokenId);
    return (operator == tokenOwner || isFlashLoanApproved(tokenMinter, operator));
  }
}
