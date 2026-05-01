import { Router } from "express";

import {
  createAuditCase,
  getCaseEvents,
  getManualIncidentCases,
  getResourceEventsByCaseId,
  logAuditEvent,
} from "../controllers/audit.controller.js";

const auditRouter = Router();

auditRouter.get("/cases", getManualIncidentCases);
auditRouter.get("/cases/:caseId/events", getCaseEvents);
auditRouter.get("/cases/:caseId/resource-events", getResourceEventsByCaseId);
auditRouter.post("/cases", createAuditCase);
auditRouter.post("/events", logAuditEvent);

export { auditRouter };
