import { prisma } from "../db/prisma.js";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 10;

export async function registerUser(email: string, password: string, role: string) {
  const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);

  return prisma.user.create({
    data: { email, password: hashed, role }
  });
}

export async function validateUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return null;

  return user;
}



