/**
 * CommandBuilder
 * Integrates BitcoinCommandEncoder with bitcoin-api
 */

import {
  BitcoinCommandEncoder,
  BitcoinFunctionEncoder,
  type ChainName,
} from '@bmcp/sdk/bitcoin';

/**
 * Bitcoin transaction output for OP_RETURN
 */
export interface OPReturnOutput {
  value: number; // satoshis (usually 0)
  script: string; // OP_RETURN script
}

/**
 * Bitcoin transaction configuration
 */
export interface BitcoinTxConfig {
  /** Fee rate in sat/vB */
  feeRate?: number;
  /** Change address */
  changeAddress?: string;
  /** Additional outputs */
  outputs?: Array<{ address: string; value: number }>;
}

/**
 * Command Builder for Bitcoin API
 * Bridges @bmcp/sdk with bitcoin-api
 */
export class CommandBuilder {
  /**
   * Build OP_RETURN output for Bitcoin transaction
   */
  static buildOPReturn(
    chain: ChainName | bigint,
    contract: string,
    functionSignature: string,
    args: any[],
    options: {
      nonce?: number;
      deadline?: number;
      btcAddress?: string;
      format?: 'json' | 'binary';
    } = {}
  ): OPReturnOutput {
    const format = options.format ?? 'json';

    // Encode command
    let payload: Buffer;
    if (format === 'json') {
      const json = BitcoinCommandEncoder.encodeJSON(
        chain,
        contract,
        { signature: functionSignature, args },
        options
      );
      payload = Buffer.from(json, 'utf8');
    } else {
      payload = BitcoinCommandEncoder.encodeBinary(
        chain,
        contract,
        { signature: functionSignature, args },
        options
      );
    }

    // Build OP_RETURN script
    // OP_RETURN <data>
    const script = `OP_RETURN ${payload.toString('hex')}`;

    return {
      value: 0,
      script,
    };
  }

  /**
   * Build OP_RETURN for onReport (your Sepolia contract)
   */
  static buildOnReport(
    message: string,
    options: {
      nonce?: number;
      btcAddress?: string;
    } = {}
  ): OPReturnOutput {
    return this.buildOPReturn(
      'SEPOLIA',
      '0x2BaE8224110482eC6dDF12faf359A35362d43573',
      'onReport(string)',
      [message],
      options
    );
  }

  /**
   * Build OP_RETURN for ERC20 transfer
   */
  static buildTransfer(
    chain: ChainName,
    tokenAddress: string,
    to: string,
    amount: bigint | string,
    options: {
      nonce?: number;
      btcAddress?: string;
    } = {}
  ): OPReturnOutput {
    return this.buildOPReturn(
      chain,
      tokenAddress,
      'transfer(address,uint256)',
      [to, amount],
      options
    );
  }

  /**
   * Build complete Bitcoin transaction structure
   * (Ready for bitcoin-cli or bitcoinjs-lib)
   */
  static buildTransaction(
    opReturn: OPReturnOutput,
    config: BitcoinTxConfig = {}
  ): {
    outputs: Array<{ value: number; script?: string; address?: string }>;
    feeRate: number;
  } {
    const outputs: Array<{ value: number; script?: string; address?: string }> =
      [
        // OP_RETURN output (always first)
        opReturn,
        // Additional outputs
        ...(config.outputs ?? []),
      ];

    return {
      outputs,
      feeRate: config.feeRate ?? 1, // 1 sat/vB default
    };
  }

  /**
   * Estimate transaction size
   */
  static estimateTxSize(
    opReturnSize: number,
    numInputs: number = 1,
    numOutputs: number = 1 // not including OP_RETURN
  ): {
    vBytes: number;
    fee: number; // at 1 sat/vB
  } {
    // P2WPKH input: ~68 vBytes
    // P2WPKH output: ~31 vBytes
    // OP_RETURN output: ~11 + data size
    // Base transaction: ~10 vBytes

    const inputSize = numInputs * 68;
    const outputSize = numOutputs * 31;
    const opReturnOutputSize = 11 + opReturnSize;
    const baseSize = 10;

    const vBytes = baseSize + inputSize + outputSize + opReturnOutputSize;

    return {
      vBytes,
      fee: vBytes, // 1 sat/vB
    };
  }

  /**
   * Format for bitcoin-cli sendtoaddress
   */
  static formatForBitcoinCLI(opReturn: OPReturnOutput): {
    command: string;
    example: string;
  } {
    const data = opReturn.script.replace('OP_RETURN ', '');

    return {
      command: 'bitcoin-cli',
      example: `bitcoin-cli sendtoaddress <address> 0.0001 "" "" false false null "unset" null ${data}`,
    };
  }

  /**
   * Format for bitcoinjs-lib PSBT
   */
  static formatForPSBT(opReturn: OPReturnOutput): {
    script: Buffer;
    value: number;
  } {
    const data = Buffer.from(opReturn.script.replace('OP_RETURN ', ''), 'hex');

    // OP_RETURN = 0x6a
    // Push data = length byte(s) + data
    const script = Buffer.concat([Buffer.from([0x6a, data.length]), data]);

    return {
      script,
      value: 0,
    };
  }
}
