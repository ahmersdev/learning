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

// Parses simple duration strings ("15m", "7d") into milliseconds, so a
// Session document's expiresAt can be computed without decoding a JWT first
const parseDurationMs = (duration: string): number => {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match || !match[1] || !match[2]) {
    throw new Error(`Invalid duration format: ${duration}`);
  }
  const value = Number(match[1]);
  const unit = match[2] as "s" | "m" | "h" | "d";
  const unitMs: Record<"s" | "m" | "h" | "d", number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return value * unitMs[unit];
};

export const REFRESH_EXPIRY_MS = parseDurationMs(
  process.env.JWT_REFRESH_EXPIRY || "7d",
);

export interface AccessTokenPayload {
  userId: string;
  email: string;
  fullName: string;
  username: string;
}

export interface RefreshTokenPayload {
  userId: string;
  email: string;
  sessionId: string;
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
