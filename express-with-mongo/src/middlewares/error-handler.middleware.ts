import { type Request, type Response, type NextFunction } from "express";
import { AppError } from "../utils/app-errors.ts";

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: "fail",
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  console.error("UNEXPECTED ERROR:", err);
  console.error(err.stack);
  res.status(500).json({ status: "error", message: "Something went wrong" });
};
