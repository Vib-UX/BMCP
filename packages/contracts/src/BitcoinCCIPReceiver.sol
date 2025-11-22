// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CCIPReceiver} from '@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol';
import {Client} from '@chainlink/contracts-ccip/contracts/libraries/Client.sol';

/**
 * @title BitcoinCCIPReceiver
 * @notice Base contract for receiving cross-chain messages from Bitcoin via CCIP
 * @dev Extends CCIPReceiver and adds Bitcoin-specific validation
 */
abstract contract BitcoinCCIPReceiver is CCIPReceiver {
  /// @notice Bitcoin chain selector (to be assigned by Chainlink)
  uint64 public immutable BITCOIN_SELECTOR;

  /// @notice Emitted when a message is received from Bitcoin
  event MessageReceivedFromBitcoin(
    bytes32 indexed messageId,
    uint64 indexed sourceChainSelector,
    bytes sender,
    bytes data
  );

  /// @notice Emitted when message processing fails
  event MessageFailed(bytes32 indexed messageId, bytes reason);

  error InvalidSourceChain(uint64 sourceChainSelector);
  error InvalidSender(bytes sender);

  /**
   * @param router The CCIP router address
   * @param _bitcoinChainSelector The Bitcoin chain selector
   */
  constructor(
    address router,
    uint64 _bitcoinChainSelector
  ) CCIPReceiver(router) {
    BITCOIN_SELECTOR = _bitcoinChainSelector;
  }

  /**
   * @notice Simple CCIP receive function
   * @param message The CCIP message
   */
  function _ccipReceive(
    Client.Any2EVMMessage memory message
  ) internal override {
    // Verify message is from Bitcoin
    if (message.sourceChainSelector != BITCOIN_SELECTOR) {
      revert InvalidSourceChain(message.sourceChainSelector);
    }

    emit MessageReceivedFromBitcoin(
      message.messageId,
      message.sourceChainSelector,
      message.sender,
      message.data
    );

    (bool success, ) = address(this).call(message.data);
    if (!success) {
      emit MessageFailed(message.messageId, 'Call failed');
    }
  }
}
