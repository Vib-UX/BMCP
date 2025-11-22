// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CCIPReceiver} from "@chainlink/contracts-ccip/src/v0.8/ccip/applications/CCIPReceiver.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";

/**
 * @title BitcoinCCIPReceiver
 * @notice Base contract for receiving cross-chain messages from Bitcoin via CCIP
 * @dev Extends CCIPReceiver and adds Bitcoin-specific validation
 */
abstract contract BitcoinCCIPReceiver is CCIPReceiver {
    /// @notice Bitcoin chain selector (to be assigned by Chainlink)
    uint64 public immutable bitcoinChainSelector;

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
        bitcoinChainSelector = _bitcoinChainSelector;
    }

    /**
     * @notice Internal function to handle incoming CCIP messages
     * @param message The CCIP message
     */
    function _ccipReceive(
        Client.Any2EVMMessage memory message
    ) internal override {
        // Verify message is from Bitcoin
        if (message.sourceChainSelector != bitcoinChainSelector) {
            revert InvalidSourceChain(message.sourceChainSelector);
        }

        emit MessageReceivedFromBitcoin(
            message.messageId,
            message.sourceChainSelector,
            message.sender,
            message.data
        );

        // Process the message
        try this.processMessage(message) {
            // Success
        } catch (bytes memory reason) {
            emit MessageFailed(message.messageId, reason);
        }
    }

    /**
     * @notice Process the cross-chain message from Bitcoin
     * @dev Override this function to implement custom logic
     * @param message The CCIP message from Bitcoin
     */
    function processMessage(
        Client.Any2EVMMessage calldata message
    ) external virtual;

    /**
     * @notice Decode Bitcoin address from message sender
     * @param sender Encoded Bitcoin address (bytes32 hash)
     * @return Bitcoin address as bytes32
     */
    function decodeBitcoinAddress(
        bytes memory sender
    ) internal pure returns (bytes32) {
        require(sender.length == 32, "Invalid sender length");
        return bytes32(sender);
    }
}

