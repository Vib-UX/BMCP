// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC165} from '@openzeppelin/contracts/utils/introspection/IERC165.sol';
import {IReceiverTemplate} from './IReceiverTemplate.sol';

/**
 * @title BitcoinCCIPReceiver
 * @notice Base contract for receiving cross-chain messages from Bitcoin via CRE
 * @dev Extends IReceiverTemplate and adds BMCP validation
 */
contract BitcoinCREReceiver is IReceiverTemplate {
  // Protocol constants matching encoder
  uint32 public constant PROTOCOL_MAGIC = 0x424D4350; // "BMCP"
  uint8 public constant SUPPORTED_VERSION = 1;

  mapping(bytes32 => bool) public executedBtcTxs;
  mapping(address => mapping(uint32 => bool)) public usedNonces;
  mapping(address => bool) public authorizedContracts;

  struct BMCPCommand {
    uint32 protocolMagic;
    uint8 version;
    address targetContract;
    bytes callData;
    uint32 nonce;
    uint32 deadline;
    bytes32 btcTxHash;
    uint256 btcBlockHeight;
  }

  // Events
  event BMCPCommandReceived(
    bytes32 indexed btcTxHash,
    address indexed targetContract,
    bytes4 functionSelector
  );

  event BMCPCommandExecuted(
    bytes32 indexed btcTxHash,
    address indexed targetContract,
    bool success,
    bytes result
  );

  // Errors
  error InvalidProtocolMagic(uint32 received, uint32 expected);
  error UnsupportedVersion(uint8 received);
  error UnauthorizedContract(address contract_);
  error CommandExpired(uint32 deadline, uint256 currentTime);
  error NonceAlreadyUsed(address sender, uint32 nonce);
  error AlreadyExecuted(bytes32 btcTxHash);
  error InvalidDataLength();

  constructor(address _forwarder, bytes32 _workflowId) IReceiverTemplate() {
    // Set CRE forwarder and workflow
    forwarderAddress = _forwarder;
    expectedWorkflowId = _workflowId;
  }

  function authorizeContract(
    address contract_,
    bool authorized
  ) external onlyOwner {
    authorizedContracts[contract_] = authorized;
  }

  function _processReport(bytes calldata report) internal override {
    require(report.length >= 64, 'Invalid report length');

    bytes32 btcTxHash = bytes32(report[0:32]);
    uint256 btcBlockHeight = uint256(bytes32(report[32:64]));

    bytes calldata opReturnData = report[64:];

    // Check not already executed
    if (executedBtcTxs[btcTxHash]) {
      revert AlreadyExecuted(btcTxHash);
    }

    // Decode BMCP command
    BMCPCommand memory cmd = _decodeBMCP(opReturnData);
    cmd.btcTxHash = btcTxHash;
    cmd.btcBlockHeight = btcBlockHeight;

    // Validate command
    _validateCommand(cmd);

    // Mark as executed
    executedBtcTxs[btcTxHash] = true;

    // Mark nonce as used if present
    if (cmd.nonce > 0) {
      usedNonces[cmd.targetContract][cmd.nonce] = true;
    }

    // Emit received event
    bytes4 functionSelector = bytes4(cmd.callData);
    emit BMCPCommandReceived(btcTxHash, cmd.targetContract, functionSelector);

    _executeCommand(cmd);
  }

  function _decodeBMCP(
    bytes calldata data
  ) internal pure returns (BMCPCommand memory cmd) {
    require(data.length >= 35, 'Data too short'); // Minimum: magic(4) + version(1) + chain(8) + contract(20) + length(2)

    uint256 offset = 0;

    // Protocol Magic (4 bytes)
    cmd.protocolMagic = uint32(bytes4(data[offset:offset + 4]));
    offset += 4;

    // Version (1 byte)
    cmd.version = uint8(data[offset]);
    offset += 1;

    // Target Contract (20 bytes)
    cmd.targetContract = address(bytes20(data[offset:offset + 20]));
    offset += 20;

    // Data Length (2 bytes)
    uint16 dataLength = uint16(bytes2(data[offset:offset + 2]));
    offset += 2;

    // Validate remaining data length

    if (dataLength > data.length - offset) {
      revert InvalidDataLength();
    }

    // Call Data
    cmd.callData = data[offset:offset + dataLength];
    offset += dataLength;

    // Optional: Nonce (4 bytes)
    if (data.length >= offset + 4) {
      cmd.nonce = uint32(bytes4(data[offset:offset + 4]));
      offset += 4;
    }

    // Optional: Deadline (4 bytes)
    if (data.length >= offset + 4) {
      cmd.deadline = uint32(bytes4(data[offset:offset + 4]));
      offset += 4;
    }

    return cmd;
  }

  function _validateCommand(BMCPCommand memory cmd) internal view {
    // Verify protocol magic
    if (cmd.protocolMagic != PROTOCOL_MAGIC) {
      revert InvalidProtocolMagic(cmd.protocolMagic, PROTOCOL_MAGIC);
    }

    // Verify version
    if (cmd.version != SUPPORTED_VERSION) {
      revert UnsupportedVersion(cmd.version);
    }

    // Verify authorized contract
    // if (!authorizedContracts[cmd.targetContract]) {
    //   revert UnauthorizedContract(cmd.targetContract);
    // }

    // Check deadline if present
    if (cmd.deadline > 0 && block.timestamp > cmd.deadline) {
      revert CommandExpired(cmd.deadline, block.timestamp);
    }

    // Check nonce if present
    if (cmd.nonce > 0 && usedNonces[cmd.targetContract][cmd.nonce]) {
      revert NonceAlreadyUsed(cmd.targetContract, cmd.nonce);
    }
  }

  function _executeCommand(BMCPCommand memory cmd) internal {
    // Execute the call
    (bool success, bytes memory result) = cmd.targetContract.call(cmd.callData);

    emit BMCPCommandExecuted(
      cmd.btcTxHash,
      cmd.targetContract,
      success,
      result
    );

    // Optional: revert on failure
    if (!success) {
      _handleExecutionFailure(cmd.targetContract, result);
    }
  }

  function _handleExecutionFailure(address, bytes memory result) internal pure {
    // Try to decode revert reason
    if (result.length > 0) {
      // Check if it's a standard Error(string)
      if (result.length >= 68) {
        assembly {
          result := add(result, 0x04)
        }
        revert(abi.decode(result, (string)));
      } else {
        assembly {
          revert(add(32, result), mload(result))
        }
      }
    } else {
      revert('Execution failed without reason');
    }
  }
}
