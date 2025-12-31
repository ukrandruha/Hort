// src/services/robotCamera.service.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function getRobotCameras(
    robotId: string
)
{
    return  await prisma.robotCamera.findMany({
    where: { robotId },
    orderBy: { port: "asc" },
  });
}

export async function syncRobotCameras(
  robotId: string,
  cameras: { name: string; port: string }[],
) {
  return prisma.$transaction(async tx => {

    const robot = await tx.robot.findUnique({
      where: { robotId },
    });

    if (!robot) {
      throw new Error(`Robot ${robotId} not registered`);
    }


    // 1️⃣ видалити старі
    await tx.robotCamera.deleteMany({
      where: { robotId },
    });

    // 2️⃣ вставити актуальні
    if (cameras.length > 0) {
      await tx.robotCamera.createMany({
        data: cameras.map(c => ({
          robotId,
          name: c.name,
          port: c.port,
        })),
      });
    }

    return true;
  });
}
