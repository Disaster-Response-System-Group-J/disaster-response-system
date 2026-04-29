import { type Log, type TransactionReceipt } from "ethers";

import { incidentAuditLogContract } from "../blockchain/contract.js";

export type CreateAuditCaseInput = {
  eventId: string;
  incidentId: string;
  performedBy: string;
  performedRole: string;
  district: string;
  notes?: string | null;
  correlationId?: string | null;
};

export type CreateAuditCaseResult = {
  caseId: string;
  auditEventId: string;
  eventType: "MANUAL_INCIDENT_CREATED";
  incidentId: string;
  transactionHash: string;
};

type ManualIncidentCreatedEvent = {
  caseId: bigint;
  auditEventId: bigint;
};

function readManualIncidentCreatedEvent(
  receipt: TransactionReceipt,
): ManualIncidentCreatedEvent | null {
  for (const log of receipt.logs) {
    try {
      const parsedLog = incidentAuditLogContract.interface.parseLog(log as Log);

      if (parsedLog?.name === "ManualIncidentCreated") {
        return {
          caseId: parsedLog.args.caseId,
          auditEventId: parsedLog.args.auditEventId,
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}

export async function createManualIncidentAuditCase(
  input: CreateAuditCaseInput,
): Promise<CreateAuditCaseResult> {
  const predictedResult =
    await incidentAuditLogContract.createManualIncident.staticCall(
      input.eventId,
      input.incidentId,
      input.performedBy,
      input.performedRole,
      input.district,
      input.notes || "",
      input.correlationId || "",
    );

  const transaction = await incidentAuditLogContract.createManualIncident(
    input.eventId,
    input.incidentId,
    input.performedBy,
    input.performedRole,
    input.district,
    input.notes || "",
    input.correlationId || "",
  );

  const receipt = await transaction.wait();

  if (!receipt) {
    throw new Error("Transaction receipt not found");
  }

  const eventData = readManualIncidentCreatedEvent(receipt) ?? {
    caseId: predictedResult.caseId,
    auditEventId: predictedResult.auditEventId,
  };

  return {
    caseId: eventData.caseId.toString(),
    auditEventId: eventData.auditEventId.toString(),
    eventType: "MANUAL_INCIDENT_CREATED",
    incidentId: input.incidentId,
    transactionHash: receipt.hash,
  };
}
