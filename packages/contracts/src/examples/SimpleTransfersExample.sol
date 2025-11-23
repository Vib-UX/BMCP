// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract SimpleTransfersExample {
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

  function transferETH(address to, uint256 amount) external onlyBMCP {
    payable(to).transfer(amount);
  }

  function transferERC20(
    address token,
    address to,
    uint256 amount
  ) external onlyBMCP {
    IERC20(token).transfer(to, amount);
  }

  /// @notice ERC20-like approve from Bitcoin command
  function approve(address spender, uint256 amount) external onlyBMCP {
    // Approval logic
  }

  receive() external payable {}
}
