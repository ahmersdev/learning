import { type Request, type Response, type NextFunction } from "express";
import { createUserService, signinService } from "../services/auth.service.ts";
import type {
  SigninInputSchema,
  SignupInputSchema,
} from "../schemas/auth.schema.ts";

export const signup = async (
  req: Request<{}, {}, SignupInputSchema>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const newUser = await createUserService(req.body);

    return res.status(201).json({
      status: "success",
      message: "User registered successfully",
      data: newUser,
    });
  } catch (error) {
    next(error);
  }
};

export const signin = async (
  req: Request<{}, {}, SigninInputSchema>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userData = await signinService(req.body);

    return res.status(200).json({
      status: "success",
      message: "Login successful",
      data: userData,
    });
  } catch (error) {
    next(error);
  }
};

export const signout = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // TODO: Clear HTTP-only JWT cookies here if you are using them
    return res.status(200).json({
      status: "success",
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};
