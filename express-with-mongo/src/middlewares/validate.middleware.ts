import { type Request, type Response, type NextFunction } from "express";
import { type ZodType } from "zod";
import { AppError } from "../utils/app-errors.ts";

export const validate = (schema: ZodType) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      throw new AppError("Validation failed", 400, details);
    }

    req.body = result.data;
    next();
  };
};
