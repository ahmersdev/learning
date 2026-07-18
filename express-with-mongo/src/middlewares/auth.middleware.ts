import { type Request, type Response, type NextFunction } from "express";
import { AppError } from "../utils/app-errors.ts";

// Extend Express Request type locally to include the user object
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

export const requireAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError("Authentication required", 401);
    }

    const _token = authHeader.split(" ")[1];

    // TODO: Verify JWT and fetch user from DB
    // const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Stubbing a mock authorized user payload
    req.user = {
      id: "mock-user-id-123",
      email: "mock-user@example.com",
    };

    next();
  } catch (error) {
    next(error);
  }
};
