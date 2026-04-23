import bcrypt from "bcryptjs";

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, 12);
}

export async function verifyPassword(plainPassword: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}
