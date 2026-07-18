import { type Request, type Response, type NextFunction } from "express";

export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // TODO: verify real JWT from Authorization header
  console.log("auth check stub — not enforcing anything yet");
  next();
};
