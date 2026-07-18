import bcrypt from "bcrypt";
import crypto from "crypto";
import type {
  SignupInputSchema,
  SigninInputSchema,
} from "../schemas/auth.schema.ts";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt.ts";

const SALT_ROUNDS = 10;

export const createUserService = async (userData: SignupInputSchema) => {
  const { fullName, username, email, password } = userData;

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  // TODO: once DB is wired up:
  // 1. check if email/username already exists -> throw AppError("User already exists", 409)
  // 2. save { fullName, username, email, hashedPassword } to DB
  // 3. use the real DB-generated user._id below instead of this fake one

  const fakeUserId = crypto.randomUUID();

  const accessToken = generateAccessToken({ userId: fakeUserId, email });
  const refreshToken = generateRefreshToken({ userId: fakeUserId, email });

  return {
    user: { fullName, username, email },
    accessToken,
    refreshToken,
  };
};

export const signinService = async (credentials: SigninInputSchema) => {
  const { username, email, password } = credentials;

  // TODO: once DB is wired up:
  // 1. find user by email or username
  // 2. if not found -> throw new AppError("Invalid credentials", 401)
  // 3. const isMatch = await bcrypt.compare(password, user.hashedPassword)
  // 4. if (!isMatch) -> throw new AppError("Invalid credentials", 401)

  const fakeUserId = crypto.randomUUID();
  const resolvedEmail = email || "stub@example.com";

  const accessToken = generateAccessToken({
    userId: fakeUserId,
    email: resolvedEmail,
  });
  const refreshToken = generateRefreshToken({
    userId: fakeUserId,
    email: resolvedEmail,
  });

  return {
    user: { username, email: resolvedEmail },
    accessToken,
    refreshToken,
  };
};
