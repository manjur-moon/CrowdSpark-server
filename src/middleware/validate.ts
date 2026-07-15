import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

export interface RequestSchema {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

export function validateRequest(schema: RequestSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (schema.params) req.params = schema.params.parse(req.params) as Request["params"];
    if (schema.query) req.query = schema.query.parse(req.query) as Request["query"];
    if (schema.body) req.body = schema.body.parse(req.body);
    next();
  };
}
