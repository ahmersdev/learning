import jwt, { type SignOptions } from "jsonwebtoken";
import { AppError } from "./app-errors.ts";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  throw new Error(
    "Missing required env vars: JWT_ACCESS_SECRET and/or JWT_REFRESH_SECRET",
  );
}

const ACCESS_EXPIRY = (process.env.JWT_ACCESS_EXPIRY ||
  "15m") as SignOptions["expiresIn"];
const REFRESH_EXPIRY = (process.env.JWT_REFRESH_EXPIRY ||
  "7d") as SignOptions["expiresIn"];

export interface AccessTokenPayload {
  userId: string;
  email: string;
  username: string;
  fullName: string;
  role: string;
}

export interface RefreshTokenPayload {
  userId: string;
  email: string;
  tokenId: string;
}

export const generateAccessToken = (payload: AccessTokenPayload): string => {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY });
};

export const generateRefreshToken = (payload: RefreshTokenPayload): string => {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY });
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  try {
    return jwt.verify(token, ACCESS_SECRET) as AccessTokenPayload;
  } catch {
    throw new AppError("Invalid or expired access token", 401);
  }
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  try {
    return jwt.verify(token, REFRESH_SECRET) as RefreshTokenPayload;
  } catch {
    throw new AppError("Invalid or expired refresh token", 401);
  }
};

// Matches JWT_REFRESH_EXPIRY so Session.expiresAt stays in sync with the token's own lifetime
export const REFRESH_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
