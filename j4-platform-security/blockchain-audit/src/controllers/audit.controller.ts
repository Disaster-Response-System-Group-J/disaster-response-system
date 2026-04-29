import type { Request, Response } from "express";

import {
  createManualIncidentAuditCase,
  type CreateAuditCaseInput,
} from "../services/audit.service.js";
import { errorResponse, successResponse } from "../utils/response.js";

type AuditCaseRequestBody = Partial<{
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
}>;

function getRequiredString(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  return value.trim();
}

export async function createAuditCase(request: Request, response: Response) {
  const body = (request.body ?? {}) as AuditCaseRequestBody;

  const eventId = getRequiredString(body.eventId, "eventId");
  if (!eventId) {
    return response.status(400).json(errorResponse("eventId is required"));
  }

  const incidentId = getRequiredString(body.incidentId, "incidentId");
  if (!incidentId) {
    return response.status(400).json(errorResponse("incidentId is required"));
  }

  const performedBy = getRequiredString(body.performedBy, "performedBy");
  if (!performedBy) {
    return response.status(400).json(errorResponse("performedBy is required"));
  }

  const performedRole = getRequiredString(body.performedRole, "performedRole");
  if (!performedRole) {
    return response.status(400).json(errorResponse("performedRole is required"));
  }

  const district = getRequiredString(body.district, "district");
  if (!district) {
    return response.status(400).json(errorResponse("district is required"));
  }

  const input: CreateAuditCaseInput = {
    eventId,
    incidentId,
    performedBy,
    performedRole,
    district,
    notes: typeof body.notes === "string" ? body.notes : "",
    correlationId:
      typeof body.correlationId === "string" ? body.correlationId : "",
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
