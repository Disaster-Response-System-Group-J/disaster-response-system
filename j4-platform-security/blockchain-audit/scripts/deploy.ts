import { network } from "hardhat";

const { ethers } = await network.create();

async function main() {
  const incidentAuditLog = await ethers.deployContract("IncidentAuditLog");

  await incidentAuditLog.waitForDeployment();

  const contractAddress = await incidentAuditLog.getAddress();

  console.log("IncidentAuditLog deployed successfully");
  console.log(`Contract address: ${contractAddress}`);
  console.log("");
  console.log("Add this to your .env file:");
  console.log(`AUDIT_CONTRACT_ADDRESS=${contractAddress}`);
}

await main();
