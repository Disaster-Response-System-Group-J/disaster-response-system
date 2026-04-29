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
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
AUDIT_CONTRACT_ADDRESS=
AUDIT_PRIVATE_KEY=
```

Notes:
- `BLOCKCHAIN_RPC_URL` points to the blockchain node or local Hardhat node.
- `AUDIT_CONTRACT_ADDRESS` is the deployed `IncidentAuditLog` address.
- `AUDIT_PRIVATE_KEY` is the wallet used by the backend to send audit transactions.

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
