import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

export default buildModule('UniswapV3ExampleModule', (m) => {
  const contract = m.contract('UniswapV3Example', [
    '0xefF083B4d0d0435ac40C43b95661Ad45EfCAcAf2',
    '0x65669fE35312947050C450Bd5d36e6361F85eC12',
    '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
  ]);

  return { contract };
});
