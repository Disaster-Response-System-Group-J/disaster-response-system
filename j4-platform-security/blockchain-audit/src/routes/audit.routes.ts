import { Router } from "express";

import { createAuditCase } from "../controllers/audit.controller.js";

const auditRouter = Router();

auditRouter.post("/cases", createAuditCase);

export { auditRouter };
