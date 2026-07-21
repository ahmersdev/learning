import bcrypt from "bcrypt";
import type {
  SignupInputSchema,
  SigninInputSchema,
} from "../schemas/auth.schema.ts";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt.ts";
import { prisma } from "../config/db.ts";
import { ConflictError, UnauthorizedError } from "../utils/app-errors.ts";
import { Prisma } from "../../generated/prisma/client.ts";

const SALT_ROUNDS = 10;

export const createUserService = async (userData: SignupInputSchema) => {
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

  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
  });
  const refreshToken = generateRefreshToken({
    userId: user.id,
    email: user.email,
  });

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

export const signinService = async (credentials: SigninInputSchema) => {
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

  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
  });
  const refreshToken = generateRefreshToken({
    userId: user.id,
    email: user.email,
  });

  return {
    user: { username: user.username, email: user.email },
    accessToken,
    refreshToken,
  };
};
