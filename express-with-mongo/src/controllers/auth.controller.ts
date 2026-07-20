import { type Request, type Response, type NextFunction } from "express";
import {
  createUserService,
  signinService,
  refreshSessionService,
  signoutService,
  changePasswordService,
} from "../services/auth.service.ts";
import type {
  ChangePasswordInput,
  SigninInputSchema,
  SignupInputSchema,
} from "../schemas/auth.schema.ts";
import { AppError } from "../utils/app-errors.ts";
import { verifyRefreshToken } from "../utils/jwt.ts";

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
};

const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // matches JWT_REFRESH_EXPIRY default

export const signup = async (
  req: Request<{}, {}, SignupInputSchema>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { user, accessToken, refreshToken } = await createUserService(
      req.body,
      req.headers["user-agent"],
    );

    res.cookie("refreshToken", refreshToken, {
      ...REFRESH_COOKIE_OPTIONS,
      maxAge: REFRESH_COOKIE_MAX_AGE,
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
    const { user, accessToken, refreshToken } = await signinService(
      req.body,
      req.headers["user-agent"],
    );

    res.cookie("refreshToken", refreshToken, {
      ...REFRESH_COOKIE_OPTIONS,
      maxAge: REFRESH_COOKIE_MAX_AGE,
    });

    return res.status(200).json({
      status: "success",
      message: "Login successful",
      data: { user, accessToken },
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

    const { accessToken, refreshToken } = await refreshSessionService(
      decoded.sessionId,
      decoded.userId,
      decoded.email,
    );

    // Rotation means a new refresh token every time — always reset the cookie
    res.cookie("refreshToken", refreshToken, {
      ...REFRESH_COOKIE_OPTIONS,
      maxAge: REFRESH_COOKIE_MAX_AGE,
    });

    return res.status(200).json({
      status: "success",
      data: { accessToken },
    });
  } catch (error) {
    next(error);
  }
};

export const signout = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = req.cookies.refreshToken;

    if (token) {
      try {
        const decoded = verifyRefreshToken(token);
        await signoutService(decoded.sessionId);
      } catch {
        // Token already invalid/expired — nothing left to revoke, just clear the cookie
      }
    }

    res.clearCookie("refreshToken", REFRESH_COOKIE_OPTIONS);
    return res
      .status(200)
      .json({ status: "success", message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (
  req: Request<{}, {}, ChangePasswordInput>,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    await changePasswordService(
      req.user.id,
      req.body.currentPassword,
      req.body.newPassword,
    );

    return res.status(200).json({
      status: "success",
      message: "Password changed successfully",
    });
  } catch (error) {
    next(error);
  }
};
