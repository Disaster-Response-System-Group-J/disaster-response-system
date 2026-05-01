import type { Request, Response } from "express";

import {
  CaseNotFoundError,
  createManualIncidentAuditCase,
  getManualIncidentCasesFromChain,
  type CreateAuditCaseInput,
  logAuditEventOnChain,
  type LogAuditEventInput,
} from "../services/audit.service.js";
import { errorResponse, successResponse } from "../utils/response.js";

type AuditCaseRequestBody = Partial<{
  caseId: number | string | null;
  eventId: string | null;
  eventType: string | null;
  incidentId: string | null;
  resourceId: string | null;
  alertId: string | null;
  performedBy: string | null;
  performedRole: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  district: string | null;
  notes: string | null;
  correlationId: string | null;
  timestamp: string | null;
}>;

function getRequiredString(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  return value.trim();
}

function getOptionalString(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function getPositiveInteger(
  value: number | string | null | undefined,
): string | null {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value <= 0) {
      return null;
    }

    return value.toString();
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();

    if (!/^[1-9]\d*$/.test(trimmedValue)) {
      return null;
    }

    return trimmedValue;
  }

  return null;
}

export async function createAuditCase(request: Request, response: Response) {
  const body = (request.body ?? {}) as AuditCaseRequestBody;

  const eventId = getRequiredString(body.eventId);
  if (!eventId) {
    return response.status(400).json(errorResponse("eventId is required"));
  }

  const incidentId = getRequiredString(body.incidentId);
  if (!incidentId) {
    return response.status(400).json(errorResponse("incidentId is required"));
  }

  const performedBy = getRequiredString(body.performedBy);
  if (!performedBy) {
    return response.status(400).json(errorResponse("performedBy is required"));
  }

  const performedRole = getRequiredString(body.performedRole);
  if (!performedRole) {
    return response.status(400).json(errorResponse("performedRole is required"));
  }

  const district = getRequiredString(body.district);
  if (!district) {
    return response.status(400).json(errorResponse("district is required"));
  }

  const input: CreateAuditCaseInput = {
    eventId,
    incidentId,
    performedBy,
    performedRole,
    district,
    notes: getOptionalString(body.notes),
    correlationId: getOptionalString(body.correlationId),
  };

  try {
    const result = await createManualIncidentAuditCase(input);

    return response.status(201).json(successResponse(result));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create audit case";

    return response.status(500).json(errorResponse(message));
  }
}

export async function getManualIncidentCases(
  _request: Request,
  response: Response,
) {
  try {
    const result = await getManualIncidentCasesFromChain();

    return response.status(200).json(successResponse(result));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to get manual incident cases";

    return response.status(500).json(errorResponse(message));
  }
}

export async function logAuditEvent(request: Request, response: Response) {
  const body = (request.body ?? {}) as AuditCaseRequestBody;

  const caseId = getPositiveInteger(body.caseId);
  if (!caseId) {
    return response.status(400).json(errorResponse("caseId is required"));
  }

  const eventId = getRequiredString(body.eventId);
  if (!eventId) {
    return response.status(400).json(errorResponse("eventId is required"));
  }

  const eventType = getRequiredString(body.eventType);
  if (!eventType) {
    return response.status(400).json(errorResponse("eventType is required"));
  }

  const incidentId = getRequiredString(body.incidentId);
  if (!incidentId) {
    return response.status(400).json(errorResponse("incidentId is required"));
  }

  const performedBy = getRequiredString(body.performedBy);
  if (!performedBy) {
    return response.status(400).json(errorResponse("performedBy is required"));
  }

  const performedRole = getRequiredString(body.performedRole);
  if (!performedRole) {
    return response.status(400).json(errorResponse("performedRole is required"));
  }

  const input: LogAuditEventInput = {
    caseId,
    eventId,
    eventType,
    incidentId,
    resourceId: getOptionalString(body.resourceId),
    alertId: getOptionalString(body.alertId),
    performedBy,
    performedRole,
    previousStatus: getOptionalString(body.previousStatus),
    newStatus: getOptionalString(body.newStatus),
    district: getOptionalString(body.district),
    notes: getOptionalString(body.notes),
    correlationId: getOptionalString(body.correlationId),
  };

  try {
    const result = await logAuditEventOnChain(input);

    return response.status(201).json(successResponse(result));
  } catch (error) {
    if (error instanceof CaseNotFoundError) {
      return response.status(404).json(errorResponse("caseId does not exist"));
    }

    const message =
      error instanceof Error ? error.message : "Failed to log audit event";

    return response.status(500).json(errorResponse(message));
  }
}
