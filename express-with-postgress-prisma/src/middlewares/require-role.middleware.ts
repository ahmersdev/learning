import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/app-errors.ts";

export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.user) {
    return next(new AppError("Unauthorized", 401));
  }

  if (req.user.role !== "admin") {
    return next(new AppError("Admin access required", 403));
  }

  next();
};
