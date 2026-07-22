import { prisma } from "../config/db.ts";
import { NotFoundError, ConflictError } from "../utils/app-errors.ts";
import type { UserUpdateInput } from "../schemas/users.schema.ts";
import { Prisma } from "../../generated/prisma/client.ts";

const PUBLIC_USER_FIELDS = {
  id: true,
  fullName: true,
  username: true,
  email: true,
};

export const getUserService = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: PUBLIC_USER_FIELDS,
  });

  if (!user) {
    throw new NotFoundError("User not found");
  }

  return user;
};

export const updateUserService = async (
  userId: string,
  updates: UserUpdateInput,
) => {
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: PUBLIC_USER_FIELDS,
    });

    return user;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new ConflictError("Username already taken");
      }
      if (error.code === "P2025") {
        throw new NotFoundError("User not found");
      }
    }
    throw error;
  }
};
