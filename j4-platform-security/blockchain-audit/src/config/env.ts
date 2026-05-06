import dotenv from "dotenv";
import { existsSync, readFileSync } from "node:fs";

dotenv.config();

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function getAuditContractAddress(): string {
  const envValue = process.env.AUDIT_CONTRACT_ADDRESS?.trim();

  if (envValue) {
    return envValue;
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

export const env = {
  port: Number(process.env.PORT ?? "8084"),
  blockchainRpcUrl: getRequiredEnv("BLOCKCHAIN_RPC_URL"),
  auditContractAddress: getAuditContractAddress(),
  auditPrivateKey: getRequiredEnv("AUDIT_PRIVATE_KEY"),
};
