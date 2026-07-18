import { type Request, type Response } from "express";
import { createUserService, signinService } from "../services/auth.service.ts";
import type {
  SigninInputSchema,
  SignupInputSchema,
} from "../schemas/auth.schema.ts";

export const signup = async (
  req: Request<{}, {}, SignupInputSchema>,
  res: Response,
) => {
  const newUser = await createUserService(req.body);

  res.status(201).json({
    message: "User registered successfully",
    data: newUser,
  });
};

export const signin = async (
  req: Request<{}, {}, SigninInputSchema>,
  res: Response,
) => {
  const userData = await signinService(req.body);

  res.status(200).json({
    message: "Login successful",
    user: userData,
  });
};

export const signout = async (_req: Request, res: Response) => {
  // TODO: Clear HTTP-only JWT cookies here if you are using them

  res.status(200).json({
    message: "Logged out successfully",
  });
};
