import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

export default buildModule('SimpleTransfersExampleModule', (m) => {
  const contract = m.contract('SimpleTransfersExample', [
    '0xefF083B4d0d0435ac40C43b95661Ad45EfCAcAf2',
  ]);

  return { contract };
});
