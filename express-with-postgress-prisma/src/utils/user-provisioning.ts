import crypto from "crypto";
import bcrypt from "bcrypt";
import { prisma } from "../config/db.ts";
import { ConflictError } from "./app-errors.ts";
import { Prisma } from "../../generated/prisma/client.ts";

const SALT_ROUNDS = 10;
const MAX_USERNAME_ATTEMPTS = 5;

const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const NUMBERS = "0123456789";
const SPECIAL = "!@#$%^&*";

const randomChar = (charset: string) =>
  charset[crypto.randomInt(charset.length)]!;

export const generateTempPassword = (length = 14): string => {
  // guarantee at least one of each class so it always satisfies signupSchema's password regex
  const guaranteed = [
    randomChar(LOWERCASE),
    randomChar(UPPERCASE),
    randomChar(NUMBERS),
    randomChar(SPECIAL),
  ];

  const allChars = LOWERCASE + UPPERCASE + NUMBERS + SPECIAL;
  const remaining = Array.from(
    { length: Math.max(length - guaranteed.length, 0) },
    () => randomChar(allChars),
  );

  const combined = [...guaranteed, ...remaining];

  // Fisher-Yates shuffle — otherwise the guaranteed chars always sit in positions 0-3
  for (let i = combined.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [combined[i], combined[j]] = [combined[j]!, combined[i]!];
  }

  return combined.join("");
};

const sanitizeUsernameBase = (email: string): string => {
  const localPart = email.split("@")[0] ?? "";
  const cleaned = localPart.toLowerCase().replace(/[^a-z0-9]/g, "");
  // userSchema/signupSchema require min 3 chars — pad if sanitizing left it too short
  return cleaned.length >= 3 ? cleaned : cleaned.padEnd(3, "0");
};

const randomSuffix = () => crypto.randomBytes(3).toString("hex"); // 6 chars

interface ProvisionedUser {
  id: string;
  fullName: string;
  username: string;
  email: string;
  role: string;
}

interface FindOrCreateInvitedUserResult {
  user: ProvisionedUser;
  isNewUser: boolean;
  tempPassword?: string;
}

export const findOrCreateInvitedUser = async (
  email: string,
  fullName: string,
): Promise<FindOrCreateInvitedUserResult> => {
  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    return {
      user: {
        id: existingUser.id,
        fullName: existingUser.fullName,
        username: existingUser.username,
        email: existingUser.email,
        role: existingUser.role,
      },
      isNewUser: false,
    };
  }

  const usernameBase = sanitizeUsernameBase(email);
  const tempPassword = generateTempPassword();
  const hashedPassword = await bcrypt.hash(tempPassword, SALT_ROUNDS);

  for (let attempt = 0; attempt < MAX_USERNAME_ATTEMPTS; attempt++) {
    const username =
      attempt === 0 ? usernameBase : `${usernameBase}${randomSuffix()}`;

    try {
      const user = await prisma.user.create({
        data: {
          fullName,
          username,
          email,
          password: hashedPassword,
          role: "user",
          mustChangePassword: true,
        },
      });

      return {
        user: {
          id: user.id,
          fullName: user.fullName,
          username: user.username,
          email: user.email,
          role: user.role,
        },
        isNewUser: true,
        tempPassword,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const target = (error.meta?.target as string[] | undefined) ?? [];

        if (target.includes("email")) {
          // race: someone else created this email between our findUnique check and now
          throw new ConflictError("User already exists");
        }

        // username collision — retry with a suffixed variant
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    `Failed to generate a unique username for ${email} after ${MAX_USERNAME_ATTEMPTS} attempts`,
  );
};

export const deriveDisplayNameFromEmail = (email: string): string => {
  const localPart = email.split("@")[0] ?? "";
  const words = localPart
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "New Member";

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};
