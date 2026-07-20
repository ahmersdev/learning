import { type Request, type Response, type NextFunction } from "express";
import { AppError, ForbiddenError } from "../utils/app-errors.ts";

export const requireAdmin = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  if (!req.user) {
    return next(new AppError("Unauthorized", 401));
  }

  if (req.user.role !== "admin") {
    return next(new ForbiddenError("Admin access required"));
  }

  next();
};
