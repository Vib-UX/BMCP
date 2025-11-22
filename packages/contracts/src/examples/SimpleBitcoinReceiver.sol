// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BitcoinCCIPReceiver} from '../BitcoinCCIPReceiver.sol';
import {Client} from '@chainlink/contracts-ccip/contracts/libraries/Client.sol';

/**
 * @title SimpleBitcoinReceiver
 * @notice Example contract that receives messages from Bitcoin
 * @dev Demonstrates how to process cross-chain calls from Bitcoin
 */
contract SimpleBitcoinReceiver is BitcoinCCIPReceiver {
  constructor(
    address router,
    uint64 _bitcoinChainSelector
  ) BitcoinCCIPReceiver(router, _bitcoinChainSelector) {}
}
