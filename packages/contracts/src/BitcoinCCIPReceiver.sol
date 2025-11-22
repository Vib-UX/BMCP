// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC165} from '@openzeppelin/contracts/utils/introspection/IERC165.sol';
import {IReceiver} from './interfaces/IReceiver.sol';

/**
 * @title BitcoinCCIPReceiver
 * @notice Base contract for receiving cross-chain messages from Bitcoin via CCIP
 * @dev Extends CCIPReceiver and adds Bitcoin-specific validation
 */
abstract contract BitcoinCCIPReceiver is IReceiver {
  /// @notice Bitcoin chain selector (to be assigned by Chainlink)
  //   uint64 public immutable BITCOIN_SELECTOR;

  /// @notice Emitted when a message is received from Bitcoin
  event MessageReceivedFromBitcoin(string message);

  /// @notice Emitted when message processing fails
  //   event MessageFailed(bytes32 indexed messageId, bytes reason);

  //   error InvalidSourceChain(uint64 sourceChainSelector);

  constructor() {}

  function onReport(bytes calldata metadata, bytes calldata report) external {
    _processReport(report);
  }

  function _processReport(bytes calldata report) internal {
    string memory message = abi.decode(report, (string));
    emit MessageReceivedFromBitcoin(message);
  }

  //   / @inheritdoc IERC165
  function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
    return
      interfaceId == type(IReceiver).interfaceId ||
      interfaceId == type(IERC165).interfaceId;
  }
}
