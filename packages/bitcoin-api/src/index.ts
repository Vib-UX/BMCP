import express, { Request, Response } from 'express';
import * as bitcoin from 'bitcoinjs-lib';
import axios, { AxiosError } from 'axios';

const network = {
  ...bitcoin.networks.testnet,
  bip32: {
    public: 0x045f1cf6, // vpub
    private: 0x045f18bc, // vprv
  },
};

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// BMCP Protocol Magic: "BMCP" in hex = 0x424D4350
const BMCP_PROTOCOL_MAGIC = Buffer.from([0x42, 0x4d, 0x43, 0x50]); // "BMCP"

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const varintSize = (n: number) => {
  if (n < 0xfd) return 1;
  if (n <= 0xffff) return 3;
  if (n <= 0xffffffff) return 5;
  return 9;
};

const estimateTxSize = (
  inputCount: number,
  outputCount: number,
  opReturnBytes: number
) => {
  const overhead = 10.5;
  const inputSize = inputCount * 68;
  const p2wpkhOutputSize = 31;
  // OP_RETURN format: <value:8> <scriptLen:varint> <OP_RETURN:1> <dataLen:varint> <data>
  // For our case: 8 + 1 + 1 + varint(protocolMagic + data) + (4 + data)
  const totalDataSize = 4 + opReturnBytes; // Protocol magic (4 bytes) + payload
  const opReturnOutputSize =
    8 + 1 + 1 + varintSize(totalDataSize) + totalDataSize;
  const totalSize =
    overhead + inputSize + outputCount * p2wpkhOutputSize + opReturnOutputSize;
  return Math.ceil(totalSize);
};

app.post('/psbt', async (req: Request, res: Response) => {
  try {
    const { address, sendBmcpData } = req.body;
    if (!address || typeof address !== 'string') {
      throw new Error('invalid address');
    }
    if (
      !sendBmcpData ||
      typeof sendBmcpData !== 'string' ||
      !sendBmcpData.startsWith('0x')
    ) {
      throw new Error('invalid sendBmcpData');
    }

    // Parse the payload
    const payloadBuffer = Buffer.from(sendBmcpData.slice(2), 'hex');

    const utxos = await axios
      .get(`https://mempool.space/testnet4/api/address/${address}/utxo`)
      .then(
        (response) =>
          response.data as Array<{
            txid: string;
            vout: number;
            value: number;
          }>
      );
    if (!utxos.length) {
      return res.status(404).send({
        success: true,
        message: 'No UTXOs found',
        psbt: null,
      });
    }

    const txSize = estimateTxSize(
      utxos.length,
      1,
      payloadBuffer.length // Already includes protocol magic if using BitcoinCommandEncoder
    );

    const feeRate = await axios
      .get(`https://mempool.space/testnet4/api/v1/fees/recommended`)
      .then((response) =>
        response.data?.fastestFee ? Number(response.data.fastestFee) : 1
      );
    const fee = Math.ceil(txSize * feeRate);
    const totalInput = utxos.reduce((total, current) => {
      return total + Number(current.value);
    }, 0);
    const changeAmount = totalInput - fee;
    const dustLimit = 546;
    if (changeAmount < dustLimit) {
      throw new Error(
        `Change amount ${changeAmount} is below dust limit. Need at least ${dustLimit} sats.`
      );
    }

    const psbt = new bitcoin.Psbt({ network });
    for (const utxo of utxos) {
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          script: bitcoin.address.toOutputScript(address, network),
          value: utxo.value,
        },
      });
    }

    // Build OP_RETURN script with BMCP protocol magic
    // Format: OP_RETURN <protocol_magic> <payload>
    // If payload already has protocol magic (from BitcoinCommandEncoder.encodeBinary), use as-is
    // Otherwise, prepend protocol magic
    let fullData: Buffer;

    // Check if payload already starts with BMCP magic (0x424D4350)
    if (
      payloadBuffer.length >= 4 &&
      payloadBuffer[0] === 0x42 &&
      payloadBuffer[1] === 0x4d &&
      payloadBuffer[2] === 0x43 &&
      payloadBuffer[3] === 0x50
    ) {
      // Already has protocol magic
      fullData = payloadBuffer;
    } else {
      // Prepend protocol magic
      fullData = Buffer.concat([BMCP_PROTOCOL_MAGIC, payloadBuffer]);
    }

    const opReturnScript = bitcoin.script.compile([
      bitcoin.opcodes.OP_RETURN,
      fullData,
    ]);

    psbt.addOutput({
      script: opReturnScript,
      value: 0,
    });

    psbt.addOutput({
      address,
      value: changeAmount,
    });

    return res.status(200).send({
      success: true,
      message: `Found ${utxos.length} UTXOs totalling ${totalInput}, created transaction spending ${totalInput - changeAmount}`,
      address,
      totalInput,
      sendBmcpData,
      protocolMagic: BMCP_PROTOCOL_MAGIC.toString('hex'),
      opReturnSize: fullData.length,
      txSize,
      changeAmount,
      fee,
      psbt: psbt.toHex(),
      link: `https://mempool.space/testnet4/tx/preview#tx=${psbt.toHex()}`,
    });
  } catch (error) {
    const casted = error as Partial<AxiosError>;
    if (casted?.response) {
      const errorText =
        typeof casted.response.data === 'string'
          ? casted.response.data
          : JSON.stringify(casted.response.data);
      return res.status(500).send({
        success: false,
        message: `HTTP ${casted.response.status}: ${errorText}`,
      });
    } else if (casted.request) {
      return res.status(500).send({
        success: false,
        message: `Network error: ${casted.message}`,
      });
    } else {
      return res.status(500).send({
        success: false,
        message: `Error: ${casted.message ?? JSON.stringify(casted)}`,
      });
    }
  }
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.send({
    success: true,
    protocol: 'BMCP',
    protocolMagic: BMCP_PROTOCOL_MAGIC.toString('hex'),
    version: '1.0.0',
  });
});

app.listen(PORT, () => {
  console.log(`🚀 BMCP Bitcoin API running on http://localhost:${PORT}`);
  console.log(
    `📡 Protocol Magic: ${BMCP_PROTOCOL_MAGIC.toString('hex')} ("BMCP")`
  );
});
