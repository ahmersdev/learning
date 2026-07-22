import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/app-errors.ts";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const validateUuid = (...paramNames: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const paramName of paramNames) {
      const value = req.params[paramName];

      if (typeof value !== "string" || !UUID_REGEX.test(value)) {
        return next(new AppError(`Invalid ${paramName}`, 400));
      }
    }

    next();
  };
};
