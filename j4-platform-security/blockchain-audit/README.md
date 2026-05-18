# Blockchain Audit Service

This folder contains the J4 blockchain audit component for the disaster response system.

Its job is small and specific:
- store immutable audit records on blockchain
- expose a simple backend API that other services can call
- return the blockchain `caseId` so the main incident system can store and reuse it later

This is not the main incident management service. The full incident data stays in the normal application/database layer. This module only handles the blockchain audit trail.

## What is inside

This folder has two main parts:

1. A Hardhat 3 smart contract project
   - Contract: [IncidentAuditLog.sol](</c:/Users/LOQ/Documents/GitHub/disaster-response-system/j4-platform-security/blockchain-audit/contracts/IncidentAuditLog.sol>)
   - Tests: [IncidentAuditLog.ts](</c:/Users/LOQ/Documents/GitHub/disaster-response-system/j4-platform-security/blockchain-audit/test/IncidentAuditLog.ts>)
   - Deployment script: [deploy.ts](</c:/Users/LOQ/Documents/GitHub/disaster-response-system/j4-platform-security/blockchain-audit/scripts/deploy.ts>)

2. A small Node.js + TypeScript backend API
   - App entry: [server.ts](</c:/Users/LOQ/Documents/GitHub/disaster-response-system/j4-platform-security/blockchain-audit/src/server.ts>)
   - Express setup: [app.ts](</c:/Users/LOQ/Documents/GitHub/disaster-response-system/j4-platform-security/blockchain-audit/src/app.ts>)
   - Route/controller/service flow under [src](</c:/Users/LOQ/Documents/GitHub/disaster-response-system/j4-platform-security/blockchain-audit/src>)

## Current flow

Today this module supports one blockchain-backed workflow:

1. Another service creates a manual incident in its own system.
2. That service calls `POST /api/v1/audit/cases`.
3. This backend calls `createManualIncident(...)` on `IncidentAuditLog`.
4. The smart contract creates a new blockchain `caseId` and stores the first immutable audit event.
5. This backend returns `caseId`, `auditEventId`, and `transactionHash`.
6. The caller stores the returned `caseId` for future audit actions.

## API endpoints

### `GET /health`

Simple health check:

```json
{
  "status": "ok"
}
```

### `POST /api/v1/audit/cases`

Creates a blockchain audit case for a manual incident.

Example request:

```json
{
  "eventId": "evt-001",
  "eventType": "MANUAL_INCIDENT_CREATED",
  "incidentId": "inc-001",
  "resourceId": null,
  "alertId": null,
  "performedBy": "user-001",
  "performedRole": "operator",
  "previousStatus": null,
  "newStatus": null,
  "district": "Colombo",
  "notes": "Manual incident created from phone call",
  "correlationId": "corr-001"
}
```

Example success response:

```json
{
  "success": true,
  "data": {
    "caseId": "1",
    "auditEventId": "0",
    "eventType": "MANUAL_INCIDENT_CREATED",
    "incidentId": "inc-001",
    "transactionHash": "0x..."
  },
  "error": null
}
```

Example error response:

```json
{
  "success": false,
  "data": null,
  "error": "eventId is required"
}
```

## Project structure

```text
contracts/
  IncidentAuditLog.sol

scripts/
  deploy.ts

src/
  app.ts
  server.ts
  blockchain/
    contract.ts
    IncidentAuditLog.json
  config/
    env.ts
  controllers/
    audit.controller.ts
  middleware/
    errorHandler.ts
  routes/
    audit.routes.ts
  services/
    audit.service.ts
  utils/
    response.ts

test/
  IncidentAuditLog.ts
```

## Environment variables

Create a `.env` file based on [.env.example](</c:/Users/LOQ/Documents/GitHub/disaster-response-system/j4-platform-security/blockchain-audit/.env.example>):

```env
PORT=8084
BLOCKCHAIN_NETWORK=sepolia
BLOCKCHAIN_RPC_URL=
AUDIT_CONTRACT_ADDRESS=
AUDIT_PRIVATE_KEY=
SEPOLIA_RPC_URL=
SEPOLIA_PRIVATE_KEY=
```

Notes:
- `BLOCKCHAIN_NETWORK` should be `sepolia` for testnet mode or `local` for Hardhat mode.
- `BLOCKCHAIN_RPC_URL` should be a Sepolia RPC URL from Alchemy, Infura, QuickNode, etc. In local mode it can be `http://127.0.0.1:8545` or `http://hardhat-node:8545` inside Docker.
- `AUDIT_CONTRACT_ADDRESS` is the deployed `IncidentAuditLog` address on the active network.
- `AUDIT_PRIVATE_KEY` is the backend wallet private key. It sends audit transactions and needs Sepolia ETH in Sepolia mode.
- `SEPOLIA_RPC_URL` and `SEPOLIA_PRIVATE_KEY` are optional aliases used by Hardhat deployment. If they are empty, Hardhat uses `BLOCKCHAIN_RPC_URL` and `AUDIT_PRIVATE_KEY`.
- Never commit real RPC keys, private keys, or deployed contract addresses.

### Sepolia mode

Sepolia is the default mode for the backend.

1. Fill `.env`:

```env
PORT=8084
BLOCKCHAIN_NETWORK=sepolia
BLOCKCHAIN_RPC_URL=<your-sepolia-rpc-url>
AUDIT_PRIVATE_KEY=<backend-wallet-private-key>
AUDIT_CONTRACT_ADDRESS=
SEPOLIA_RPC_URL=<your-sepolia-rpc-url>
SEPOLIA_PRIVATE_KEY=<deployer-wallet-private-key>
```

2. Deploy the contract to Sepolia:

```bash
npm run deploy:sepolia
```

The script prints:

```text
AUDIT_CONTRACT_ADDRESS=0x...
```

3. Paste that address into `.env`:

```env
AUDIT_CONTRACT_ADDRESS=0x...
```

4. Start the API:

```bash
npm run dev
```

For Docker Sepolia mode from the repository root, fill the root `.env` with the Sepolia values and run:

```bash
docker compose up -d --build j4-audit-api
```

In Sepolia mode, the API does not need `hardhat-node` or `deploy-audit-contract`.

### Local Hardhat mode

Local mode is still available for development.

```env
PORT=8084
BLOCKCHAIN_NETWORK=local
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
AUDIT_CONTRACT_ADDRESS=
AUDIT_PRIVATE_KEY=<local-hardhat-private-key>
```

Run a local node, deploy the contract, and start the API:

```bash
npx hardhat node
npm run deploy:local
npm run dev
```

For non-Docker local mode, copy the printed `AUDIT_CONTRACT_ADDRESS=0x...` value into `.env` before starting the API.

For Docker local mode from the repository root:

```bash
docker compose up -d --build hardhat-node deploy-audit-contract j4-audit-api
```

The local deployer writes the contract address to the shared Docker volume at `/deployment/audit-contract-address.txt`, and the API can read it only when `BLOCKCHAIN_NETWORK=local`.

## Common commands

Install dependencies:

```bash
npm install
```

Compile the backend:

```bash
npm run build
```

Run the backend in development mode:

```bash
npm run dev
```

Run the backend build:

```bash
npm start
```

Run contract tests:

```bash
npm test
```

Deploy the contract to the configured Hardhat network:

```bash
npx hardhat run scripts/deploy.ts --network hardhatMainnet
```

Deploy to Sepolia:

```bash
npm run deploy:sepolia
```

Test the running API:

```bash
curl http://localhost:8084/health
```

Create a test audit case:

```bash
curl -X POST http://localhost:8084/api/v1/audit/cases \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "evt-001",
    "incidentId": "inc-001",
    "performedBy": "user-001",
    "performedRole": "operator",
    "district": "Colombo",
    "notes": "Manual incident created from phone call",
    "correlationId": "corr-001"
  }'
```

## Notes for new contributors

- This folder mixes blockchain contract work and a small API because the API is only a thin wrapper around the contract.
- The smart contract should stay focused on immutable audit storage.
- The backend should stay focused on validation, transaction sending, and formatting API responses.
- The main incident service should keep owning the full incident record and database state.

<!-- This project showcases a Hardhat 3 Beta project using `mocha` for tests and the `ethers` library for Ethereum interactions.

To learn more about the Hardhat 3 Beta, please visit the [Getting Started guide](https://hardhat.org/docs/getting-started#getting-started-with-hardhat-3). To share your feedback, join our [Hardhat 3 Beta](https://hardhat.org/hardhat3-beta-telegram-group) Telegram group or [open an issue](https://github.com/NomicFoundation/hardhat/issues/new) in our GitHub issue tracker.

## Project Overview

This example project includes:

- A simple Hardhat configuration file.
- Foundry-compatible Solidity unit tests.
- TypeScript integration tests using `mocha` and ethers.js
- Examples demonstrating how to connect to different types of networks, including locally simulating OP mainnet.

## Usage

### Running Tests

To run all the tests in the project, execute the following command:

```shell
npx hardhat test
```

You can also selectively run the Solidity or `mocha` tests:

```shell
npx hardhat test solidity
npx hardhat test mocha
```

### Make a deployment to Sepolia

This project includes an example Ignition module to deploy the contract. You can deploy this module to a locally simulated chain or to Sepolia.

To run the deployment to a local chain:

```shell
npx hardhat ignition deploy ignition/modules/Counter.ts
```

To run the deployment to Sepolia, you need an account with funds to send the transaction. The provided Hardhat configuration includes a Configuration Variable called `SEPOLIA_PRIVATE_KEY`, which you can use to set the private key of the account you want to use.

You can set the `SEPOLIA_PRIVATE_KEY` variable using the `hardhat-keystore` plugin or by setting it as an environment variable.

To set the `SEPOLIA_PRIVATE_KEY` config variable using `hardhat-keystore`:

```shell
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
```

After setting the variable, you can run the deployment with the Sepolia network:

```shell
npx hardhat ignition deploy --network sepolia ignition/modules/Counter.ts
``` -->
