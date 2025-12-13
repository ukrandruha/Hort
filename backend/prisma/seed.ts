import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = "uuauu@ua.fm";
  const adminPassword = "andrey24081975";

  const hash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      password: hash,
      role: "admin",
    },
  });

  console.log("Admin user created");
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
