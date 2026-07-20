import bcrypt from "bcrypt";
import type {
  SignupInputSchema,
  SigninInputSchema,
} from "../schemas/auth.schema.ts";
import {
  generateAccessToken,
  generateRefreshToken,
  REFRESH_EXPIRY_MS,
} from "../utils/jwt.ts";
import { User } from "../models/user.model.ts";
import { Session } from "../models/session.model.ts";
import { AppError, ConflictError } from "../utils/app-errors.ts";

const SALT_ROUNDS = 10;

const isDuplicateKeyError = (
  error: unknown,
): error is { code: number; keyPattern?: Record<string, unknown> } => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === 11000
  );
};

// Creates a Session document and issues a matching access + refresh token
// pair. The refresh token embeds the session's _id so it can be looked up
// (and revoked) later without touching the User document at all.
const issueTokens = async (
  userId: string,
  email: string,
  fullName: string,
  username: string,
  role: "admin" | "user",
  userAgent?: string,
) => {
  const session = await Session.create({
    userId,
    userAgent,
    expiresAt: new Date(Date.now() + REFRESH_EXPIRY_MS),
  });

  const accessToken = generateAccessToken({
    userId,
    email,
    fullName,
    username,
    role,
  });
  const refreshToken = generateRefreshToken({
    userId,
    email,
    sessionId: session.id,
  });

  return { accessToken, refreshToken };
};

export const createUserService = async (
  userData: SignupInputSchema,
  userAgent?: string,
) => {
  const { fullName, username, email, password } = userData;

  const existingUser = await User.findOne({ $or: [{ email }, { username }] });

  if (existingUser) {
    throw new ConflictError(
      existingUser.email === email
        ? "Email already in use"
        : "Username already taken",
    );
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  let user;
  try {
    user = await User.create({
      fullName,
      username,
      email,
      password: hashedPassword,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const field = error.keyPattern && Object.keys(error.keyPattern)[0];
      throw new ConflictError(
        field === "email" ? "Email already in use" : "Username already taken",
      );
    }
    throw error;
  }

  const { accessToken, refreshToken } = await issueTokens(
    user.id,
    user.email,
    user.fullName,
    user.username,
    user.role,
    userAgent,
  );

  return {
    user: {
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      role: user.role,
    },
    accessToken,
    refreshToken,
  };
};

export const signinService = async (
  credentials: SigninInputSchema,
  userAgent?: string,
) => {
  const { username, email, password } = credentials;

  const user = await User.findOne({ $or: [{ email }, { username }] }).select(
    "+password",
  );

  if (!user) {
    throw new AppError("Invalid credentials", 401);
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new AppError("Invalid credentials", 401);
  }

  const { accessToken, refreshToken } = await issueTokens(
    user.id,
    user.email,
    user.fullName,
    user.username,
    user.role,
    userAgent,
  );

  return {
    user: { username: user.username, email: user.email, role: user.role },
    accessToken,
    refreshToken,
  };
};

export const refreshSessionService = async (
  sessionId: string,
  userId: string,
  email: string,
) => {
  const session = await Session.findById(sessionId).catch(() => null);

  if (!session) {
    throw new AppError("Session expired or revoked, please sign in again", 401);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User no longer exists", 401);
  }

  await session.deleteOne();

  return issueTokens(
    userId,
    email,
    user.fullName,
    user.username,
    user.role,
    session.userAgent,
  );
};

export const signoutService = async (sessionId: string | undefined) => {
  if (!sessionId) return;
  await Session.findByIdAndDelete(sessionId);
};
