import { type Request, type Response } from "express";
import type { ISigninBody, ISignupBody } from "../types/auth.types.ts";
import {
  getMissingFields,
  isValidEmail,
  validatePassword,
} from "../utils/validators.ts";
import { AppError } from "../utils/app-errors.ts";
import { createUserService, signinService } from "../services/auth.service.ts";

export const signup = async (
  req: Request<{}, {}, ISignupBody>,
  res: Response,
) => {
  const { fullName, username, email, password } = req.body;

  const missingFields = getMissingFields({
    fullName,
    username,
    email,
    password,
  });
  if (missingFields.length > 0) {
    throw new AppError("Missing required fields", 400, missingFields);
  }

  if (!isValidEmail(email)) {
    throw new AppError("Invalid email format", 400);
  }

  const passwordErrors = validatePassword(password);
  if (passwordErrors.length > 0) {
    throw new AppError("Weak password", 400, passwordErrors);
  }

  const result = await createUserService(req.body);

  res.status(201).json({
    message: "User registered successfully",
    data: result,
  });
};

export const signin = async (
  req: Request<{}, {}, ISigninBody>,
  res: Response,
) => {
  const { username, email, password } = req.body;

  if (!password || (!username && !email)) {
    throw new AppError("Please provide email/username and password", 400);
  }

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
