import crypto from "crypto";
import { User } from "../models/user.model.ts";

const MIN_USERNAME_LENGTH = 3;

// Derives a username from the local part of an email (before the @),
// sanitizes it to match the username field's constraints, and appends a
// short random suffix if the base is already taken by another user
export const generateUsernameFromEmail = async (
  email: string,
): Promise<string> => {
  const localPart = email.split("@")[0] ?? "user";
  let base = localPart.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (base.length < MIN_USERNAME_LENGTH) {
    base = `${base}user`.slice(0, Math.max(base.length, MIN_USERNAME_LENGTH));
  }

  let username = base;
  while (await User.findOne({ username })) {
    const suffix = crypto.randomBytes(2).toString("hex"); // 4 hex chars
    username = `${base}${suffix}`;
  }

  return username;
};

// I/O and 0/O excluded from the upper/lower sets to avoid ambiguous
// characters in a password someone has to manually type out
const PASSWORD_CHARSETS = {
  upper: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  lower: "abcdefghijkmnpqrstuvwxyz",
  digits: "23456789",
  special: "!@#$%^&*",
};

const pickRandom = (chars: string): string =>
  chars[crypto.randomInt(chars.length)]!;

// Guarantees at least one char from each required class (matching
// signupSchema's password regex rules), then fills the rest randomly and
// shuffles so the guaranteed chars aren't predictably at the front
export const generateTempPassword = (length = 12): string => {
  const { upper, lower, digits, special } = PASSWORD_CHARSETS;
  const all = upper + lower + digits + special;

  const required = [
    pickRandom(upper),
    pickRandom(lower),
    pickRandom(digits),
    pickRandom(special),
  ];

  const remaining = Math.max(length - required.length, 0);
  const rest = Array.from({ length: remaining }, () => pickRandom(all));
  const chars = [...required, ...rest];

  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }

  return chars.join("");
};
