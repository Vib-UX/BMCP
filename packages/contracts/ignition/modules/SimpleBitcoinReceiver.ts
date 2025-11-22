import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

export default buildModule('SimpleBitcoinReceiverModule', (m) => {
  const router = m.getParameter(
    'router',
    '0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59'
  );
  const bitcoinChainSelector = m.getParameter('bitcoinChainSelector', '12345678');

  const contract = m.contract('SimpleBitcoinReceiver', [
    router,
    bitcoinChainSelector,
  ]);

  return { contract };
});
