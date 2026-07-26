import { randomBytes } from 'crypto';

export function deriveUsernameFromEmail(email: string): string {
  const local = email.split('@')[0].toLowerCase();
  const sanitized = local.replace(/[^a-z0-9]/g, '');
  return sanitized.length >= 3 ? sanitized : `${sanitized}user`;
}

export function randomUsernameSuffix(length = 4): string {
  return randomBytes(length).toString('hex').slice(0, length);
}

export function generateTemporaryPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%^&*';
  const all = upper + lower + digits + special;

  const pick = (charset: string) => charset[randomBytes(1)[0] % charset.length];

  const chars = [pick(upper), pick(lower), pick(digits), pick(special)];
  for (let i = 0; i < 8; i++) chars.push(pick(all));

  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}
