import { app } from "./app.js";
import { env } from "./config/env.js";

app.listen(env.port, () => {
  console.log(`Audit API listening on port ${env.port}`);
  console.log(`Blockchain network: ${env.blockchainNetwork}`);
  console.log(`Audit contract address: ${env.auditContractAddress}`);
});
