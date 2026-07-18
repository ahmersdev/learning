import bcrypt from "bcrypt";
import type { ISigninBody, ISignupBody } from "../types/auth.types.ts";

const SALT_ROUNDS = 10;

export const createUserService = async (userData: ISignupBody) => {
  const { fullName, username, email, password } = userData;

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  // TODO: once DB is wired up, save { fullName, username, email, hashedPassword } to DB here
  // For now, just prove hashing works:

  return {
    fullName,
    username,
    email,
    hashedPasswordPreview: hashedPassword, // remove this once real DB save happens — never return hashes in real responses
  };
};

export const signinService = async (credentials: ISigninBody) => {
  const { username, email, password } = credentials;

  // TODO: DB lookup and bcrypt.compare validation here

  return {
    username,
    email,
  };
};
