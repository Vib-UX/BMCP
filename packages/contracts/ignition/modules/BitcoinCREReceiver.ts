import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

export default buildModule('BitcoinCREReceiverModule', (m) => {
  const contract = m.contract('BitcoinCREReceiver', [
    '0x15fC6ae953E024d975e77382eEeC56A9101f9F88',
    '0x0000000000000000000000000000000000000000000000000000000000000000',
  ]);

  return { contract };
});
