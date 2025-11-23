// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract BMCPTarget {
  address public immutable bmcpReceiver;
  mapping(address => uint256) public messages;

  event MessageFromBitcoin(string message);

  error NotBMCPReceiver();

  modifier onlyBMCP() {
    if (msg.sender != bmcpReceiver) {
      revert NotBMCPReceiver();
    }
    _;
  }

  constructor(address _bmcpReceiver) {
    bmcpReceiver = _bmcpReceiver;
  }

  /// @notice Function matching your encoder's onReport example
  function sendMsg(string calldata message) external onlyBMCP {
    // Process the message from Bitcoin
    emit MessageFromBitcoin(message);
  }

  /// @notice ERC20-like transfer from Bitcoin command
  function transfer(address to, uint256 amount) external onlyBMCP {
    // Transfer logic
  }

  /// @notice ERC20-like approve from Bitcoin command
  function approve(address spender, uint256 amount) external onlyBMCP {
    // Approval logic
  }
}
