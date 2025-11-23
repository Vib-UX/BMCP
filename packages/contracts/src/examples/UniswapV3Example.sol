// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {ISwapRouter} from '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import {OwnedByBMCP} from './OwnedByBMCP.sol';

contract UniswapV3Example is OwnedByBMCP {
  using SafeERC20 for IERC20;

  ISwapRouter public immutable swapRouter;

  address public immutable usdt;
  address public immutable wbtc;

  constructor(
    address _bmcpReceiver,
    ISwapRouter _swapRouter,
    address _usdt,
    address _wbtc
  ) OwnedByBMCP(_bmcpReceiver) {
    swapRouter = _swapRouter;
    usdt = _usdt;
    wbtc = _wbtc;
  }

  function swapUSDTforWBTC(
    uint256 amountIn
  ) external onlyBMCP returns (uint256 amountOut) {
    return _swapSingle(usdt, wbtc, 3000, amountIn);
  }

  function swapWBTCforUSDT(
    uint256 amountIn
  ) external onlyBMCP returns (uint256 amountOut) {
    return _swapSingle(wbtc, usdt, 3000, amountIn);
  }

  function _swapSingle(
    address tokenIn,
    address tokenOut,
    uint24 fee,
    uint256 amountIn
  ) internal returns (uint256 amountOut) {
    IERC20(tokenIn).forceApprove(address(swapRouter), amountIn);

    uint256 minOut = /* Calculate min output */ 0;
    uint160 priceLimit = /* Calculate price limit */ 0;

    amountOut = swapRouter.exactInputSingle(
      ISwapRouter.ExactInputSingleParams({
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        fee: fee,
        recipient: msg.sender,
        deadline: block.timestamp,
        amountIn: amountIn,
        amountOutMinimum: minOut,
        sqrtPriceLimitX96: priceLimit
      })
    );
  }

  receive() external payable {}
}
