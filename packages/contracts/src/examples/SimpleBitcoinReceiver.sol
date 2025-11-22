// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BitcoinCCIPReceiver} from "../BitcoinCCIPReceiver.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

/**
 * @title SimpleBitcoinReceiver
 * @notice Example contract that receives messages from Bitcoin
 * @dev Demonstrates how to process cross-chain calls from Bitcoin
 */
contract SimpleBitcoinReceiver is BitcoinCCIPReceiver {
    /// @notice Mapping of Bitcoin transaction IDs to received messages
    mapping(bytes32 => ReceivedMessage) public messages;

    /// @notice Counter for total messages received
    uint256 public messageCount;

    struct ReceivedMessage {
        bytes32 messageId;
        bytes32 bitcoinTxId;
        bytes32 bitcoinAddress;
        bytes data;
        uint256 timestamp;
        bool processed;
    }

    event MessageProcessed(
        bytes32 indexed messageId,
        bytes32 indexed bitcoinTxId,
        bytes32 indexed bitcoinAddress,
        uint256 timestamp
    );

    event DepositReceived(
        bytes32 indexed messageId,
        address indexed recipient,
        uint256 amount
    );

    constructor(
        address router,
        uint64 _bitcoinChainSelector
    ) BitcoinCCIPReceiver(router, _bitcoinChainSelector) {}

    /**
     * @notice Process incoming message from Bitcoin
     * @param message The CCIP message
     */
    function processMessage(
        Client.Any2EVMMessage calldata message
    ) external override {
        // Only callable by this contract via _ccipReceive
        require(msg.sender == address(this), "Invalid caller");

        // Decode Bitcoin address
        bytes32 bitcoinAddress = decodeBitcoinAddress(message.sender);

        // Store the message
        messages[message.messageId] = ReceivedMessage({
            messageId: message.messageId,
            bitcoinTxId: message.messageId, // Bitcoin txid is used as messageId
            bitcoinAddress: bitcoinAddress,
            data: message.data,
            timestamp: block.timestamp,
            processed: true
        });

        messageCount++;

        emit MessageProcessed(
            message.messageId,
            message.messageId,
            bitcoinAddress,
            block.timestamp
        );

        // Decode and execute the function call
        if (message.data.length >= 4) {
            bytes4 selector = bytes4(message.data[:4]);

            // Handle deposit(address,uint256)
            if (selector == bytes4(keccak256("deposit(address,uint256)"))) {
                (address recipient, uint256 amount) = abi.decode(
                    message.data[4:],
                    (address, uint256)
                );
                _handleDeposit(message.messageId, recipient, amount);
            }
        }
    }

    /**
     * @notice Handle deposit operation from Bitcoin
     * @param messageId The message ID
     * @param recipient The recipient address
     * @param amount The amount to deposit
     */
    function _handleDeposit(
        bytes32 messageId,
        address recipient,
        uint256 amount
    ) internal {
        // In a real implementation, this would:
        // 1. Verify the deposit with a Bitcoin proof
        // 2. Mint wrapped BTC or credit the recipient
        // 3. Update internal accounting

        emit DepositReceived(messageId, recipient, amount);
    }

    /**
     * @notice Get message details by message ID
     * @param messageId The message ID to query
     * @return The received message details
     */
    function getMessage(
        bytes32 messageId
    ) external view returns (ReceivedMessage memory) {
        return messages[messageId];
    }

    /**
     * @notice Check if a message has been received
     * @param messageId The message ID to check
     * @return True if the message was received and processed
     */
    function isMessageProcessed(bytes32 messageId) external view returns (bool) {
        return messages[messageId].processed;
    }
}

