import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  /**
   * 1. Users (upsert — безпечно для production)
   */
  await prisma.user.upsert({
    where: { id: 4 },
    update: {},
    create: {
      id: 4,
      email: 'uuauu@ua.fm',
      password: '$2a$10$Fk0Bydfe2aKOAhRlv6WCKeLloo/PhkIvGrwnS.rq4H97Hpx4Jh4Ny',
      role: 'admin',
    },
  });

  await prisma.user.upsert({
    where: { id: 5 },
    update: {},
    create: {
      id: 5,
      email: 'hort',
      password: '$2a$10$NilCVYgIAKrINObR0dFjs.RWYN4WnQ5VYCrj3Wp0YcGh9nfASN3xa',
      role: 'admin',
    },
  });

  /**
   * 2. Robot — таблиця не критична → чистимо і сіємо
   */
  await prisma.robot.deleteMany();

  await prisma.robot.createMany({
    data: [
      {
        robotId: '1000000012a168a1',
        name: 'ubuntu',


      },
      {
        robotId: '1000000074eefecf',
        name: 'Hort1',


      },
    ],
  });
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
