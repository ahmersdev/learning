import { type Request, type Response, type NextFunction } from "express";
import { createUserService, signinService } from "../services/auth.service.ts";
import type {
  SigninInputSchema,
  SignupInputSchema,
} from "../schemas/auth.schema.ts";
import { AppError } from "../utils/app-errors.ts";
import { generateAccessToken, verifyRefreshToken } from "../utils/jwt.ts";

export const signup = async (
  req: Request<{}, {}, SignupInputSchema>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { user, accessToken, refreshToken } = await createUserService(
      req.body,
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // only over HTTPS in prod
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, matches JWT_REFRESH_EXPIRY
    });

    return res.status(201).json({
      status: "success",
      message: "User registered successfully",
      data: { user, accessToken },
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

export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = req.cookies.refreshToken;

    if (!token) {
      throw new AppError("No refresh token provided", 401);
    }

    const decoded = verifyRefreshToken(token);

    const newAccessToken = generateAccessToken({
      userId: decoded.userId,
      email: decoded.email,
    });

    return res.status(200).json({
      status: "success",
      data: { accessToken: newAccessToken },
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
    res.clearCookie("refreshToken");
    return res
      .status(200)
      .json({ status: "success", message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
};
