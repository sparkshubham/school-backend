import bcrypt from 'bcryptjs';

export function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export function comparePassword(plain, hashed) {
  return bcrypt.compare(plain, hashed);
}
