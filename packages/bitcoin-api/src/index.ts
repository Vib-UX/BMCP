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

const TATUM_API_KEY = ''

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
  return {
    txSize: Math.ceil(totalSize),
    opReturnOutputSize
  }
};

app.post('/psbt', async (req: Request, res: Response) => {
  try {
    const { address, sendBmcpData, feeRateOverride } = req.body;
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
    const { txSize, opReturnOutputSize } = estimateTxSize(
      utxos.length,
      1,
      payloadBuffer.length // Already includes protocol magic if using BitcoinCommandEncoder
    );
    const feeRate = feeRateOverride && typeof feeRateOverride === 'number' ? Number(feeRateOverride) : await axios.get(`https://mempool.space/testnet4/api/v1/fees/recommended`).then(response => response.data?.fastestFee ? Number(response.data.fastestFee) : 1);
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
      opReturnOutputSize,
      changeAmount,
      fee,
      feeRate,
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
})

app.get('/mempool', async (req: Request, res: Response) => {
  try {
    const mempoolTxHashSet = await axios.get(`https://mempool.space/testnet4/api/mempool/txids`).then(response => response.data as Array<string>).then(excludeTxs => new Set(excludeTxs));
    if (!mempoolTxHashSet.size) {
      return res.status(404).send({
        success: true,
        message: 'No mempool transactions found on mempool.space',
        psbt: null
      })
    }
    const tatumTxHashes = await axios.post(`https://bitcoin-testnet4.gateway.tatum.io/`, {
      "jsonrpc": "2.0",
      "method": "getrawmempool",
      "params": [
      ],
      "id": 1
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-api-key': TATUM_API_KEY
      }
    }).then(response => response.data.result as Array<string>);
    const missingTxHashes = tatumTxHashes.filter(txHash => !mempoolTxHashSet.has(txHash))
    await delay(1100); // wait 1.1s to avoid ratelimit
    const opReturns = new Set<{
      txHash: string,
      txHex: string,
      voutIndex: number,
      voutValue: number,
      scriptPubKeyAsm: string,
      opReturnHex: string
    }>();
    for (let i = 0; i < missingTxHashes.length; i += 3) {
      const batch = missingTxHashes.slice(i, i + 3);
      const txs = await Promise.all(batch.map(async (hash) => axios.post(`https://bitcoin-testnet4.gateway.tatum.io/`, {
        "jsonrpc": "2.0",
        "method": "getrawtransaction",
        "params": [
          hash,
          true
        ],
        "id": 1
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-api-key': TATUM_API_KEY
        }
      }).then(response => response.data.result as {
        txid: string,
        vout: Array<{
          value: number,
          n: number,
          scriptPubKey: {
            asm: string,
            type: string
          }
        }>,
        hex: string,
      }).catch(error => {
        console.error(error)
        return null
      })));
      for (const tx of txs) {
        if (!tx) {
          continue
        }
        const opReturnVouts = tx.vout.filter(vout =>
          vout.scriptPubKey.type === 'nulldata'
          && vout.scriptPubKey.asm.split(" ")?.[1]?.startsWith('424d4350')
        );
        if (!opReturnVouts.length) {
          continue
        }
        for (const vout of opReturnVouts) {
          opReturns.add({
            txHash: tx.txid,
            txHex: tx.hex,
            voutIndex: vout.n,
            voutValue: vout.value * 100_000_000,
            scriptPubKeyAsm: vout.scriptPubKey.asm,
            opReturnHex: vout.scriptPubKey.asm.split(' ')?.[1]
          })
        }
      }
      if (i + 3 < missingTxHashes.length) {
        await delay(1100); // process max 3 requests per second
      }
    }
    return res.status(200).send({
      success: true,
      mempoolCount: mempoolTxHashSet.size,
      tatumCount: tatumTxHashes.length,
      missingCount: missingTxHashes.length,
      opReturns: Array.from(opReturns.values())
    })
  } catch (error) {
    const casted = error as Partial<AxiosError>;
    if (casted?.response) {
      const errorText = typeof casted.response.data === 'string'
        ? casted.response.data
        : JSON.stringify(casted.response.data);
      return res.status(500).send({
        success: false,
        message: `HTTP ${casted.response.status}: ${errorText}`
      })
    } else if (casted.request) {
      return res.status(500).send({
        success: false,
        message: `Network error: ${casted.message}`
      })
    } else {
      return res.status(500).send({
        success: false,
        message: `Error: ${casted.message ?? JSON.stringify(casted)}`
      })
    }
  }
});

app.listen(PORT, () => {
  console.log(`🚀 BMCP Bitcoin API running on http://localhost:${PORT}`);
  console.log(
    `📡 Protocol Magic: ${BMCP_PROTOCOL_MAGIC.toString('hex')} ("BMCP")`
  );
});
