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

export type LogAuditEventInput = {
  caseId: string;
  eventId: string;
  eventType: string;
  incidentId: string;
  resourceId?: string | null;
  alertId?: string | null;
  performedBy: string;
  performedRole: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  district?: string | null;
  notes?: string | null;
  correlationId?: string | null;
};

export type LogAuditEventResult = {
  caseId: string;
  auditEventId: string;
  eventType: string;
  incidentId: string;
  transactionHash: string;
};

export type ManualIncidentCase = {
  caseId: string;
  auditEventId: string;
  eventId: string;
  eventType: string;
  incidentId: string;
  performedBy: string;
  performedRole: string;
  district: string;
  newStatus: string;
  notes: string;
  correlationId: string;
  timestamp: string;
};

export type ManualIncidentCasesResult = {
  eventType: "MANUAL_INCIDENT_CREATED";
  count: number;
  cases: ManualIncidentCase[];
};

export type ResourceEvent = {
  auditEventId: string;
  caseId: string;
  eventId: string;
  eventType: string;
  incidentId: string;
  resourceId: string;
  alertId: string;
  performedBy: string;
  performedRole: string;
  previousStatus: string;
  newStatus: string;
  district: string;
  notes: string;
  correlationId: string;
  timestamp: string;
};

export type ResourceEventsByCaseIdResult = {
  caseId: string;
  includedEventTypes: ["RESOURCE_ASSIGNED", "RESCUE_DISPATCHED"];
  count: number;
  events: ResourceEvent[];
};

export type CaseEvent = {
  auditEventId: string;
  caseId: string;
  eventId: string;
  eventType: string;
  incidentId: string;
  resourceId: string;
  alertId: string;
  performedBy: string;
  performedRole: string;
  previousStatus: string;
  newStatus: string;
  district: string;
  notes: string;
  correlationId: string;
  timestamp: string;
};

export type CaseEventsResult = {
  caseId: string;
  appliedFilter: string[];
  count: number;
  events: CaseEvent[];
};

type ManualIncidentCreatedEvent = {
  caseId: bigint;
  auditEventId: bigint;
};

type AuditEventLoggedEvent = {
  caseId: bigint;
  auditEventId: bigint;
};

export class CaseNotFoundError extends Error {
  constructor() {
    super("caseId does not exist");
    this.name = "CaseNotFoundError";
  }
}

type AuditEventRecord = {
  id: bigint;
  caseId: bigint;
  eventId: string;
  eventType: string;
  incidentId: string;
  resourceId: string;
  alertId: string;
  performedBy: string;
  performedRole: string;
  previousStatus: string;
  newStatus: string;
  district: string;
  notes: string;
  correlationId: string;
  timestamp: bigint;
};

const RESOURCE_EVENT_TYPES = [
  "RESOURCE_ASSIGNED",
  "RESCUE_DISPATCHED",
] as const;

function mapAuditEventRecordToCaseEvent(auditEvent: AuditEventRecord): CaseEvent {
  return {
    auditEventId: auditEvent.id.toString(),
    caseId: auditEvent.caseId.toString(),
    eventId: auditEvent.eventId,
    eventType: auditEvent.eventType,
    incidentId: auditEvent.incidentId,
    resourceId: auditEvent.resourceId,
    alertId: auditEvent.alertId,
    performedBy: auditEvent.performedBy,
    performedRole: auditEvent.performedRole,
    previousStatus: auditEvent.previousStatus,
    newStatus: auditEvent.newStatus,
    district: auditEvent.district,
    notes: auditEvent.notes,
    correlationId: auditEvent.correlationId,
    timestamp: auditEvent.timestamp.toString(),
  };
}

async function getAuditEventsByCaseId(caseId: string): Promise<AuditEventRecord[]> {
  const caseExists = await incidentAuditLogContract.doesCaseExist(caseId);

  if (!caseExists) {
    throw new CaseNotFoundError();
  }

  const auditEventIds = await incidentAuditLogContract.getEventIdsByCaseId(caseId);

  return Promise.all(
    auditEventIds.map((auditEventId: bigint) =>
      incidentAuditLogContract
        .getFunction("getEvent")
        .staticCall(auditEventId) as Promise<AuditEventRecord>,
    ),
  );
}

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

function readAuditEventLoggedEvent(
  receipt: TransactionReceipt,
): AuditEventLoggedEvent | null {
  for (const log of receipt.logs) {
    try {
      const parsedLog = incidentAuditLogContract.interface.parseLog(log as Log);

      if (parsedLog?.name === "AuditEventLogged") {
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

export async function getManualIncidentCasesFromChain(): Promise<ManualIncidentCasesResult> {
  const auditEventIds =
    await incidentAuditLogContract.getEventIdsByType("MANUAL_INCIDENT_CREATED");

  const auditEvents = await Promise.all(
    auditEventIds.map((auditEventId: bigint) =>
      incidentAuditLogContract
        .getFunction("getEvent")
        .staticCall(auditEventId) as Promise<AuditEventRecord>,
    ),
  );

  const cases: ManualIncidentCase[] = auditEvents.map((auditEvent) => ({
    caseId: auditEvent.caseId.toString(),
    auditEventId: auditEvent.id.toString(),
    eventId: auditEvent.eventId,
    eventType: auditEvent.eventType,
    incidentId: auditEvent.incidentId,
    performedBy: auditEvent.performedBy,
    performedRole: auditEvent.performedRole,
    district: auditEvent.district,
    newStatus: auditEvent.newStatus,
    notes: auditEvent.notes,
    correlationId: auditEvent.correlationId,
    timestamp: auditEvent.timestamp.toString(),
  }));

  return {
    eventType: "MANUAL_INCIDENT_CREATED",
    count: cases.length,
    cases,
  };
}

export async function getResourceEventsByCaseIdFromChain(
  caseId: string,
): Promise<ResourceEventsByCaseIdResult> {
  const auditEvents = await getAuditEventsByCaseId(caseId);

  const events: ResourceEvent[] = auditEvents
    .filter((auditEvent) =>
      RESOURCE_EVENT_TYPES.includes(
        auditEvent.eventType as (typeof RESOURCE_EVENT_TYPES)[number],
      ),
    )
    .map(mapAuditEventRecordToCaseEvent);

  return {
    caseId,
    includedEventTypes: ["RESOURCE_ASSIGNED", "RESCUE_DISPATCHED"],
    count: events.length,
    events,
  };
}

export async function getCaseEventsFromChain(
  caseId: string,
  eventTypes: string[] = [],
): Promise<CaseEventsResult> {
  const auditEvents = await getAuditEventsByCaseId(caseId);

  const events = auditEvents
    .map(mapAuditEventRecordToCaseEvent)
    .filter((event) =>
      eventTypes.length === 0 ? true : eventTypes.includes(event.eventType),
    );

  return {
    caseId,
    appliedFilter: eventTypes,
    count: events.length,
    events,
  };
}

export async function logAuditEventOnChain(
  input: LogAuditEventInput,
): Promise<LogAuditEventResult> {
  const caseExists = await incidentAuditLogContract.doesCaseExist(input.caseId);

  if (!caseExists) {
    throw new CaseNotFoundError();
  }

  const predictedAuditEventId =
    await incidentAuditLogContract.logAuditEvent.staticCall(
      input.caseId,
      input.eventId,
      input.eventType,
      input.incidentId,
      input.resourceId || "",
      input.alertId || "",
      input.performedBy,
      input.performedRole,
      input.previousStatus || "",
      input.newStatus || "",
      input.district || "",
      input.notes || "",
      input.correlationId || "",
    );

  const transaction = await incidentAuditLogContract.logAuditEvent(
    input.caseId,
    input.eventId,
    input.eventType,
    input.incidentId,
    input.resourceId || "",
    input.alertId || "",
    input.performedBy,
    input.performedRole,
    input.previousStatus || "",
    input.newStatus || "",
    input.district || "",
    input.notes || "",
    input.correlationId || "",
  );

  const receipt = await transaction.wait();

  if (!receipt) {
    throw new Error("Transaction receipt not found");
  }

  const eventData = readAuditEventLoggedEvent(receipt) ?? {
    caseId: BigInt(input.caseId),
    auditEventId: predictedAuditEventId,
  };

  return {
    caseId: eventData.caseId.toString(),
    auditEventId: eventData.auditEventId.toString(),
    eventType: input.eventType,
    incidentId: input.incidentId,
    transactionHash: receipt.hash,
  };
}
