import dotenv from "dotenv";

dotenv.config();

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

export const env = {
  port: Number(process.env.PORT ?? "8084"),
  blockchainRpcUrl: getRequiredEnv("BLOCKCHAIN_RPC_URL"),
  auditContractAddress: getRequiredEnv("AUDIT_CONTRACT_ADDRESS"),
  auditPrivateKey: getRequiredEnv("AUDIT_PRIVATE_KEY"),
};
