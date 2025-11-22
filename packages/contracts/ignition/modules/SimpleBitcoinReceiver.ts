import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

export default buildModule('SimpleBitcoinReceiverModule', (m) => {
  const contract = m.contract('SimpleBitcoinReceiver', []);

  return { contract };
});
