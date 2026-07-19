import { type Request, type Response, type NextFunction } from "express";
import { AppError } from "../utils/app-errors.ts";

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const isDevelopment = process.env.NODE_ENV === "development";

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: "fail",
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
      ...(isDevelopment ? { stack: err.stack } : {}),
    });
  }

  // Log unexpected internal system crashes
  console.error("UNEXPECTED ERROR 🔥:", err);

  return res.status(500).json({
    status: "error",
    message: isDevelopment ? err.message : "Something went wrong",
    ...(isDevelopment ? { stack: err.stack } : {}),
  });
};
