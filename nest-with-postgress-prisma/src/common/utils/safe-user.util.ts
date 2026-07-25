import type { User } from '../../generated/prisma/client';

export type SafeUser = Omit<User, 'password'>;

export function toSafeUser(user: User): SafeUser {
  const { password, ...safeUser } = user;
  return safeUser;
}
