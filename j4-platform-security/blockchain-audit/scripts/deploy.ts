import { existsSync, writeFileSync } from "node:fs";

import { network } from "hardhat";

const { ethers } = await network.create();

async function main() {
  const incidentAuditLog = await ethers.deployContract("IncidentAuditLog");

  await incidentAuditLog.waitForDeployment();

  const contractAddress = await incidentAuditLog.getAddress();
  const deploymentFilePath = "/deployment/audit-contract-address.txt";

  console.log(`IncidentAuditLog deployed to: ${contractAddress}`);
  console.log(`AUDIT_CONTRACT_ADDRESS=${contractAddress}`);

  const shouldWriteDeploymentFile =
    existsSync("/deployment") && process.env.BLOCKCHAIN_NETWORK === "local";

  if (shouldWriteDeploymentFile) {
    writeFileSync(deploymentFilePath, `${contractAddress}\n`, "utf8");
    console.log(`Contract address written to ${deploymentFilePath}`);
  }
}

await main();
