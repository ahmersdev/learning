import { type Request, type Response, type NextFunction } from "express";
import { AppError } from "../utils/app-errors.ts";
import { verifyAccessToken } from "../utils/jwt.ts";

// Extend Express Request type locally to include the user object
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        fullName: string;
        username: string;
        role: "admin" | "user";
      };
    }
  }
}

export const requireAuth = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError("Authentication required", 401);
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      throw new AppError("Authentication required", 401);
    }

    const decoded = verifyAccessToken(token);

    req.user = {
      id: decoded.userId,
      email: decoded.email,
      fullName: decoded.fullName,
      username: decoded.username,
      role: decoded.role,
    };

    next();
  } catch (error) {
    next(error);
  }
};
