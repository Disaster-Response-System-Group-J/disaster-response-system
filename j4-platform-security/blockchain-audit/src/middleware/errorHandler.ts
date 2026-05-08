import type { ErrorRequestHandler } from "express";

import { errorResponse } from "../utils/response.js";

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const message =
    error instanceof Error ? error.message : "Internal server error";

  response.status(500).json(errorResponse(message));
};
