import type { UserUpdateInput } from "../schemas/users.schema.ts";
import { User } from "../models/user.model.ts";
import { AppError, ConflictError } from "../utils/app-errors.ts";

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

export const getAllUsersService = async (currentUserId: string) => {
  const users = await User.find({ _id: { $ne: currentUserId } });

  return users.map((user) => ({
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    role: user.role,
  }));
};

export const getUserService = async (userId: string) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
};

export const updateUserService = async (
  userId: string,
  updates: UserUpdateInput,
) => {
  let user;
  try {
    user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true },
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ConflictError("Username already taken");
    }
    throw error;
  }

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    email: user.email,
  };
};
