import bcrypt from "bcrypt";
import crypto from "crypto";
import type {
  SignupInputSchema,
  SigninInputSchema,
} from "../schemas/auth.schema.ts";
import {
  generateAccessToken,
  generateRefreshToken,
  REFRESH_EXPIRY_MS,
} from "../utils/jwt.ts";
import { ConflictError, UnauthorizedError } from "../utils/app-errors.ts";
import { prisma } from "../config/db.ts";
import { Prisma } from "../../generated/prisma/client.ts";

const SALT_ROUNDS = 10;

const createSessionAndTokens = async (
  user: {
    id: string;
    email: string;
    username: string;
    fullName: string;
    role: string;
  },
  deviceInfo?: string,
) => {
  const tokenId = crypto.randomUUID();

  await prisma.session.create({
    data: {
      tokenId,
      userId: user.id,
      deviceInfo,
      expiresAt: new Date(Date.now() + REFRESH_EXPIRY_MS),
    },
  });

  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
  });

  const refreshToken = generateRefreshToken({
    userId: user.id,
    email: user.email,
    tokenId,
  });

  return { accessToken, refreshToken };
};

export const createUserService = async (
  userData: SignupInputSchema,
  deviceInfo?: string,
) => {
  const { fullName, username, email, password } = userData;

  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });

  if (existingUser) {
    throw new ConflictError("User already exists");
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  let user;
  try {
    user = await prisma.user.create({
      data: {
        fullName,
        username,
        email,
        password: hashedPassword,
        role: "user",
        mustChangePassword: false,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictError("User already exists");
    }
    throw error;
  }

  const { accessToken, refreshToken } = await createSessionAndTokens(
    user,
    deviceInfo,
  );

  return {
    user: {
      fullName: user.fullName,
      username: user.username,
      email: user.email,
    },
    accessToken,
    refreshToken,
  };
};

export const signinService = async (
  credentials: SigninInputSchema,
  deviceInfo?: string,
) => {
  const { username, email, password } = credentials;

  const user = await prisma.user.findFirst({
    where: email ? { email } : { username },
  });

  if (!user) {
    throw new UnauthorizedError("Invalid credentials");
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new UnauthorizedError("Invalid credentials");
  }

  const { accessToken, refreshToken } = await createSessionAndTokens(
    user,
    deviceInfo,
  );

  return {
    user: { username: user.username, email: user.email },
    accessToken,
    refreshToken,
  };
};

export const refreshSessionService = async (tokenId: string) => {
  const session = await prisma.session.findUnique({
    where: { tokenId },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    throw new UnauthorizedError("Session expired or revoked");
  }

  return generateAccessToken({
    userId: session.user.id,
    email: session.user.email,
    username: session.user.username,
    fullName: session.user.fullName,
    role: session.user.role,
  });
};

export const signoutService = async (tokenId: string) => {
  await prisma.session.deleteMany({ where: { tokenId } });
};
