import { PrismaClient } from "@prisma/client";

// Singleton pattern для PrismaClient
// Запобігає створенню багатьох інстансів у development
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

// Graceful shutdown
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});
