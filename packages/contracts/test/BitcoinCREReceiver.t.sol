// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from 'forge-std/Test.sol';
import {BMCPTestHelpers} from './helpers/BMCPTestHelpers.sol';

/**
 * @title BitcoinCREReceiverTest
 * @notice Test suite for BitcoinCREReceiver contract and BMCP encoding helpers
 */
contract BitcoinCREReceiverTest is Test {
  using BMCPTestHelpers for *;

  // Test constants
  address constant TEST_TARGET = 0x1234567890123456789012345678901234567890;
  bytes4 constant TEST_FUNCTION_SELECTOR = 0x12345678;

  function test_encodeBMCPCommand_BasicPayload() public pure {
    bytes memory callData = abi.encodePacked(TEST_FUNCTION_SELECTOR);
    bytes memory encoded = BMCPTestHelpers.encodeBMCPCommand(
      TEST_TARGET,
      callData
    );

    // Verify total length: 4 (magic) + 1 (version) + 20 (contract) + 2 (length) + 4 (callData) = 31 bytes
    assertEq(encoded.length, 31);

    // Verify protocol magic (first 4 bytes)
    bytes4 magic = bytes4(
      bytes.concat(encoded[0], encoded[1], encoded[2], encoded[3])
    );
    assertEq(uint32(magic), BMCPTestHelpers.PROTOCOL_MAGIC);

    // Verify version (byte 4)
    assertEq(uint8(encoded[4]), BMCPTestHelpers.SUPPORTED_VERSION);

    // Verify target contract (bytes 5-24)
    address decodedTarget;
    assembly {
      decodedTarget := mload(add(encoded, 25)) // 32 byte offset - 12 bytes + 5 bytes into data
    }
    assertEq(decodedTarget, TEST_TARGET);

    // Verify data length (bytes 25-26)
    uint16 dataLength = (uint16(uint8(encoded[25])) << 8) |
      uint16(uint8(encoded[26]));
    assertEq(dataLength, 4);
  }

  function test_encodeBMCPCommand_WithNonce() public pure {
    bytes memory callData = abi.encodePacked(TEST_FUNCTION_SELECTOR);
    uint32 nonce = 12345;

    bytes memory encoded = BMCPTestHelpers.encodeBMCPCommand(
      TEST_TARGET,
      callData,
      nonce,
      0
    );

    // Verify total length includes nonce: 31 + 4 = 35 bytes
    assertEq(encoded.length, 35);

    // Verify nonce is at the end (last 4 bytes)
    uint32 decodedNonce = (uint32(uint8(encoded[31])) << 24) |
      (uint32(uint8(encoded[32])) << 16) |
      (uint32(uint8(encoded[33])) << 8) |
      uint32(uint8(encoded[34]));
    assertEq(decodedNonce, nonce);
  }

  function test_encodeBMCPCommand_WithDeadline() public pure {
    bytes memory callData = abi.encodePacked(TEST_FUNCTION_SELECTOR);
    uint32 deadline = 1700000000;

    bytes memory encoded = BMCPTestHelpers.encodeBMCPCommand(
      TEST_TARGET,
      callData,
      0,
      deadline
    );

    // Verify total length includes deadline: 31 + 4 = 35 bytes
    assertEq(encoded.length, 35);

    // Verify deadline is at the end (last 4 bytes)
    uint32 decodedDeadline = (uint32(uint8(encoded[31])) << 24) |
      (uint32(uint8(encoded[32])) << 16) |
      (uint32(uint8(encoded[33])) << 8) |
      uint32(uint8(encoded[34]));
    assertEq(decodedDeadline, deadline);
  }

  function test_encodeBMCPCommand_WithNonceAndDeadline() public pure {
    bytes memory callData = abi.encodePacked(TEST_FUNCTION_SELECTOR);
    uint32 nonce = 12345;
    uint32 deadline = 1700000000;

    bytes memory encoded = BMCPTestHelpers.encodeBMCPCommand(
      TEST_TARGET,
      callData,
      nonce,
      deadline
    );

    // Verify total length includes both: 31 + 4 + 4 = 39 bytes
    assertEq(encoded.length, 39);

    // Verify nonce (bytes 31-34)
    uint32 decodedNonce = (uint32(uint8(encoded[31])) << 24) |
      (uint32(uint8(encoded[32])) << 16) |
      (uint32(uint8(encoded[33])) << 8) |
      uint32(uint8(encoded[34]));
    assertEq(decodedNonce, nonce);

    // Verify deadline (bytes 35-38)
    uint32 decodedDeadline = (uint32(uint8(encoded[35])) << 24) |
      (uint32(uint8(encoded[36])) << 16) |
      (uint32(uint8(encoded[37])) << 8) |
      uint32(uint8(encoded[38]));
    assertEq(decodedDeadline, deadline);
  }

  function test_encodeReportData_CorrectFormat() public pure {
    bytes32 txHash = keccak256('testTx');
    uint256 blockHeight = 800000;
    bytes memory opReturnData = abi.encodePacked(TEST_FUNCTION_SELECTOR);

    bytes memory reportData = BMCPTestHelpers.encodeReportData(
      txHash,
      blockHeight,
      opReturnData
    );

    // Verify total length: 32 (txHash) + 32 (blockHeight) + opReturnData.length
    assertEq(reportData.length, 64 + opReturnData.length);

    // Verify btcTxHash (first 32 bytes)
    bytes32 decodedTxHash;
    assembly {
      decodedTxHash := mload(add(reportData, 32))
    }
    assertEq(decodedTxHash, txHash);

    // Verify btcBlockHeight (next 32 bytes)
    bytes32 decodedBlockHeight;
    assembly {
      decodedBlockHeight := mload(add(reportData, 64))
    }
    assertEq(uint256(decodedBlockHeight), blockHeight);
  }

  function test_generateUniqueTxHash_ProducesDifferentHashes() public pure {
    bytes32 hash1 = BMCPTestHelpers.generateUniqueTxHash(1);
    bytes32 hash2 = BMCPTestHelpers.generateUniqueTxHash(2);

    // Verify hashes are different
    assert(hash1 != hash2);
  }
}
