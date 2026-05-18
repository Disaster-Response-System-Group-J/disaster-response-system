import dotenv from "dotenv";
import { existsSync, readFileSync } from "node:fs";

dotenv.config();

type BlockchainNetwork = "local" | "sepolia";

function getBlockchainNetwork(): BlockchainNetwork {
  const value = (process.env.BLOCKCHAIN_NETWORK ?? "sepolia").trim().toLowerCase();

  if (value === "local" || value === "sepolia") {
    return value;
  }

  throw new Error("BLOCKCHAIN_NETWORK must be either local or sepolia");
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function getAuditContractAddress(blockchainNetwork: BlockchainNetwork): string {
  const envValue = process.env.AUDIT_CONTRACT_ADDRESS?.trim();

  if (envValue) {
    return envValue;
  }

  if (blockchainNetwork === "sepolia") {
    throw new Error("AUDIT_CONTRACT_ADDRESS is required when BLOCKCHAIN_NETWORK=sepolia");
  }

  const deploymentFilePath = "/deployment/audit-contract-address.txt";

  if (existsSync(deploymentFilePath)) {
    const fileValue = readFileSync(deploymentFilePath, "utf8").trim();

    if (fileValue) {
      return fileValue;
    }
  }

  throw new Error(
    "AUDIT_CONTRACT_ADDRESS is required or /deployment/audit-contract-address.txt must exist",
  );
}

function getAuditPrivateKey(): string {
  const privateKey = getRequiredEnv("AUDIT_PRIVATE_KEY");

  if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    throw new Error("AUDIT_PRIVATE_KEY must be a valid private key with 0x prefix");
  }

  return privateKey;
}

const blockchainNetwork = getBlockchainNetwork();

export const env = {
  port: Number(process.env.PORT ?? "8084"),
  blockchainNetwork,
  blockchainRpcUrl: getRequiredEnv("BLOCKCHAIN_RPC_URL"),
  auditContractAddress: getAuditContractAddress(blockchainNetwork),
  auditPrivateKey: getAuditPrivateKey(),
};
