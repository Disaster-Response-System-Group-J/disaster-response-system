import { readFileSync } from "node:fs";

import {
  Contract,
  type InterfaceAbi,
  JsonRpcProvider,
  NonceManager,
  Wallet,
} from "ethers";

import { env } from "../config/env.js";

type IncidentAuditLogArtifact = {
  abi: InterfaceAbi;
};

const incidentAuditLogArtifact = JSON.parse(
  readFileSync(new URL("./IncidentAuditLog.json", import.meta.url), "utf8"),
) as IncidentAuditLogArtifact;

const provider = new JsonRpcProvider(env.blockchainRpcUrl);
const wallet = new Wallet(env.auditPrivateKey, provider);
const signer = new NonceManager(wallet);

export const incidentAuditLogContract = new Contract(
  env.auditContractAddress,
  incidentAuditLogArtifact.abi,
  signer,
);
