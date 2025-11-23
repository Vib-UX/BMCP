import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

export default buildModule('BMCPCREReceiverModule', (m) => {
  const contract = m.contract('BMCPCREReceiver', [
    '0x15fC6ae953E024d975e77382eEeC56A9101f9F88',
    '0x1111111111111111111111111111111111111111111111111111111111111111',
  ]);

  return { contract };
});
