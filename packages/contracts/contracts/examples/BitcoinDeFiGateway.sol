// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BitcoinCCIPReceiver} from "../BitcoinCCIPReceiver.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BitcoinDeFiGateway
 * @notice Advanced DeFi gateway for Bitcoin cross-chain operations
 * @dev Supports complex multi-step DeFi operations initiated from Bitcoin
 */
contract BitcoinDeFiGateway is BitcoinCCIPReceiver, ReentrancyGuard {
    /// @notice Wrapped Bitcoin token
    IERC20 public immutable wbtc;

    /// @notice Mapping of Bitcoin addresses to wrapped BTC balances
    mapping(bytes32 => uint256) public bitcoinBalances;

    /// @notice Mapping of Bitcoin transaction IDs to prevent replay
    mapping(bytes32 => bool) public processedTxs;

    event BitcoinDepositProcessed(
        bytes32 indexed btcTxId,
        bytes32 indexed btcAddress,
        address indexed recipient,
        uint256 amount
    );

    event BitcoinSwapExecuted(
        bytes32 indexed btcTxId,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    event BatchOperationExecuted(
        bytes32 indexed btcTxId,
        uint256 operationCount,
        bool success
    );

    error TransactionAlreadyProcessed(bytes32 txId);
    error InsufficientBalance(bytes32 btcAddress, uint256 required, uint256 available);
    error OperationFailed(uint256 operationIndex, bytes reason);

    constructor(
        address router,
        uint64 _bitcoinChainSelector,
        address _wbtc
    ) BitcoinCCIPReceiver(router, _bitcoinChainSelector) {
        wbtc = IERC20(_wbtc);
    }

    /**
     * @notice Process incoming message from Bitcoin
     * @param message The CCIP message
     */
    function processMessage(
        Client.Any2EVMMessage calldata message
    ) external override nonReentrant {
        require(msg.sender == address(this), "Invalid caller");

        // Prevent replay attacks
        if (processedTxs[message.messageId]) {
            revert TransactionAlreadyProcessed(message.messageId);
        }
        processedTxs[message.messageId] = true;

        bytes32 btcAddress = decodeBitcoinAddress(message.sender);

        // Decode and route the operation
        if (message.data.length >= 4) {
            bytes4 selector = bytes4(message.data[:4]);

            if (selector == bytes4(keccak256("deposit(address,uint256)"))) {
                _processDeposit(message.messageId, btcAddress, message.data[4:]);
            } else if (
                selector == bytes4(keccak256("swap(address,address,uint256,uint256)"))
            ) {
                _processSwap(message.messageId, btcAddress, message.data[4:]);
            } else if (selector == bytes4(keccak256("batchExecute(address[],bytes[])"))) {
                _processBatchOperation(message.messageId, btcAddress, message.data[4:]);
            }
        }
    }

    /**
     * @notice Process a deposit from Bitcoin
     */
    function _processDeposit(
        bytes32 txId,
        bytes32 btcAddress,
        bytes memory data
    ) internal {
        (address recipient, uint256 amount) = abi.decode(data, (address, uint256));

        // Credit the Bitcoin address
        bitcoinBalances[btcAddress] += amount;

        // Transfer wrapped BTC to recipient
        // In production, this would mint or unlock from a reserve
        require(wbtc.transfer(recipient, amount), "Transfer failed");

        emit BitcoinDepositProcessed(txId, btcAddress, recipient, amount);
    }

    /**
     * @notice Process a token swap initiated from Bitcoin
     */
    function _processSwap(
        bytes32 txId,
        bytes32 btcAddress,
        bytes memory data
    ) internal {
        (
            address tokenIn,
            address tokenOut,
            uint256 amountIn,
            uint256 minAmountOut
        ) = abi.decode(data, (address, address, uint256, uint256));

        // Verify balance
        if (bitcoinBalances[btcAddress] < amountIn) {
            revert InsufficientBalance(
                btcAddress,
                amountIn,
                bitcoinBalances[btcAddress]
            );
        }

        // Deduct balance
        bitcoinBalances[btcAddress] -= amountIn;

        // Execute swap (simplified - in production, integrate with DEX)
        uint256 amountOut = _executeSwap(tokenIn, tokenOut, amountIn, minAmountOut);

        emit BitcoinSwapExecuted(txId, tokenOut, amountIn, amountOut);
    }

    /**
     * @notice Process batch operations (swap + deposit + borrow)
     */
    function _processBatchOperation(
        bytes32 txId,
        bytes32 btcAddress,
        bytes memory data
    ) internal {
        (address[] memory targets, bytes[] memory calls) = abi.decode(
            data,
            (address[], bytes[])
        );

        require(targets.length == calls.length, "Length mismatch");

        for (uint256 i = 0; i < targets.length; i++) {
            (bool success, bytes memory result) = targets[i].call(calls[i]);
            if (!success) {
                revert OperationFailed(i, result);
            }
        }

        emit BatchOperationExecuted(txId, targets.length, true);
    }

    /**
     * @notice Execute token swap (simplified)
     * @dev In production, integrate with Uniswap/other DEX
     */
    function _executeSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) internal returns (uint256) {
        // Simplified swap logic
        // In production: call Uniswap router, Curve, etc.
        return minAmountOut;
    }

    /**
     * @notice Get Bitcoin balance
     * @param btcAddress The Bitcoin address (hashed)
     * @return The wrapped BTC balance
     */
    function getBitcoinBalance(bytes32 btcAddress) external view returns (uint256) {
        return bitcoinBalances[btcAddress];
    }
}

