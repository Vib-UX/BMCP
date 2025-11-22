import express, { Request, Response } from 'express';
import * as bitcoin from 'bitcoinjs-lib';
import * as bip32 from 'bip32';
import * as ecc from 'tiny-secp256k1';

const network = {
  ...bitcoin.networks.testnet,
  bip32: {
    public: 0x045f1cf6,  // vpub
    private: 0x045f18bc, // vprv
  },
};

const app = express();
const PORT = process.env.PORT || 3000;

const bip32Instance = bip32.BIP32Factory(ecc);
const accountPath = `m/84'/1'/0'`

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/:vpub', (req: Request, res: Response) => {
  const vpub = req.params.vpub;

  try {
    const accountNode = bip32Instance.fromBase58(vpub, network);
    const depositNode = accountNode.derive(0);
    const changeNode = accountNode.derive(1)

    const addresses = new Set<{
      index: number,
      address: string,
      isChange: boolean,
      path: string,
    }>();

    for (let index = 0; index < 10; index++) {
      const depositAddressNode = depositNode.derive(index);
      const { address: depositAddress } = bitcoin.payments.p2wpkh({
        pubkey: Buffer.from(depositAddressNode.publicKey),
        network,
      });
      if (!depositAddress) {
        throw new Error(`Could not derive deposit address at index ${index}`)
      }
      addresses.add({
        index,
        address: depositAddress,
        isChange: false,
        path: `${accountPath}/0/${index}`,
      });
      const changeAddressNode = changeNode.derive(index);
      const { address: changeAddress } = bitcoin.payments.p2wpkh({
        pubkey: Buffer.from(changeAddressNode.publicKey),
        network,
      });
      if (!changeAddress) {
        throw new Error(`Could not derive change address at index ${index}`)
      }
      addresses.add({
        index,
        address: changeAddress,
        isChange: true,
        path: `${accountPath}/1/${index}`,
      });
    }

    res.send(`<pre>${JSON.stringify({
      vpub,
      addresses: Array.from(addresses.values()),
    }, null, 2)}</pre>`);

  } catch (error) {
    res.status(400).send(`<pre>Error: ${error}</pre>`);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});