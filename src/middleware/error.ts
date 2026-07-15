import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError.js";

export const notFound: RequestHandler = (req, _res, next) => {
  next(
    new AppError(404, "ROUTE_NOT_FOUND", `Route ${req.method} ${req.originalUrl} was not found`)
  );
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(422).json({
      success: false,
      message: "Validation failed",
      error: { code: "VALIDATION_ERROR", message: "Validation failed", details: error.flatten() }
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      error: { code: error.code, message: error.message, details: error.details }
    });
    return;
  }

  const mongoCode = (error as { code?: number }).code;
  if (mongoCode === 11000) {
    res.status(409).json({
      success: false,
      message: "Duplicate request",
      error: { code: "DUPLICATE_RESOURCE", message: "This operation has already been processed" }
    });
    return;
  }

  console.error(error);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: { code: "INTERNAL_ERROR", message: "Something went wrong" }
  });
};
