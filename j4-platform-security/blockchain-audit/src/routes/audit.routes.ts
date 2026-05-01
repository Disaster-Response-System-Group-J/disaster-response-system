import { Router } from "express";

import {
  createAuditCase,
  getManualIncidentCases,
  logAuditEvent,
} from "../controllers/audit.controller.js";

const auditRouter = Router();

auditRouter.get("/cases", getManualIncidentCases);
auditRouter.post("/cases", createAuditCase);
auditRouter.post("/events", logAuditEvent);

export { auditRouter };
