import crypto from 'crypto';

export function generateShortCode(length = 8): string {
  // Use a base of alphanumeric characters without confusing letters (O, 0, I, l)
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}
