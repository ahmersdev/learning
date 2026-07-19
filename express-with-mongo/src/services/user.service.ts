// TODO: once DB is wired up, replace with real user lookups/updates

import type { UserUpdateInput } from "../schemas/user.schema.ts";

export const getUserService = async (userId: string) => {
  // TODO: find user by id in DB -> if not found, throw new AppError("User not found", 404)

  return {
    id: userId,
    fullName: "Stub User",
    username: "stubuser",
    email: "stub@example.com",
  };
};

export const updateUserService = async (
  userId: string,
  updates: UserUpdateInput,
) => {
  // TODO: find user by id, apply updates, save to DB
  // if user not found -> throw new AppError("User not found", 404)

  return {
    id: userId,
    fullName: updates.fullName ?? "Stub User",
    username: updates.username ?? "stubuser",
  };
};
