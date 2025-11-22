import { ethers } from "hardhat";

async function main() {
  console.log("Deploying BMCP contracts...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  // Configuration (update these for your deployment)
  const CCIP_ROUTER = process.env.CCIP_ROUTER_BASE || "0x...";
  const BITCOIN_CHAIN_SELECTOR = BigInt(
    process.env.BITCOIN_CHAIN_SELECTOR || "0x424954434f494e"
  );
  const WBTC_ADDRESS = process.env.WBTC_ADDRESS || "0x...";

  // Deploy SimpleBitcoinReceiver
  console.log("\n📦 Deploying SimpleBitcoinReceiver...");
  const SimpleBitcoinReceiver = await ethers.getContractFactory(
    "SimpleBitcoinReceiver"
  );
  const simpleReceiver = await SimpleBitcoinReceiver.deploy(
    CCIP_ROUTER,
    BITCOIN_CHAIN_SELECTOR
  );
  await simpleReceiver.waitForDeployment();
  const simpleReceiverAddress = await simpleReceiver.getAddress();
  console.log("✅ SimpleBitcoinReceiver deployed to:", simpleReceiverAddress);

  // Deploy BitcoinDeFiGateway
  console.log("\n📦 Deploying BitcoinDeFiGateway...");
  const BitcoinDeFiGateway = await ethers.getContractFactory(
    "BitcoinDeFiGateway"
  );
  const defiGateway = await BitcoinDeFiGateway.deploy(
    CCIP_ROUTER,
    BITCOIN_CHAIN_SELECTOR,
    WBTC_ADDRESS
  );
  await defiGateway.waitForDeployment();
  const defiGatewayAddress = await defiGateway.getAddress();
  console.log("✅ BitcoinDeFiGateway deployed to:", defiGatewayAddress);

  // Print deployment summary
  console.log("\n═══════════════════════════════════════");
  console.log("📋 Deployment Summary");
  console.log("═══════════════════════════════════════");
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("Deployer:", deployer.address);
  console.log("CCIP Router:", CCIP_ROUTER);
  console.log("Bitcoin Chain Selector:", BITCOIN_CHAIN_SELECTOR.toString());
  console.log("\nDeployed Contracts:");
  console.log("  SimpleBitcoinReceiver:", simpleReceiverAddress);
  console.log("  BitcoinDeFiGateway:", defiGatewayAddress);
  console.log("═══════════════════════════════════════\n");

  // Save deployment addresses
  const deployment = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    contracts: {
      SimpleBitcoinReceiver: simpleReceiverAddress,
      BitcoinDeFiGateway: defiGatewayAddress,
    },
    config: {
      ccipRouter: CCIP_ROUTER,
      bitcoinChainSelector: BITCOIN_CHAIN_SELECTOR.toString(),
      wbtc: WBTC_ADDRESS,
    },
    timestamp: new Date().toISOString(),
  };

  console.log("\n💾 Deployment info saved to deployment.json");
  const fs = require("fs");
  fs.writeFileSync("deployment.json", JSON.stringify(deployment, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

