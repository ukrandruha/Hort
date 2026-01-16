import { prisma } from "../db/prisma.js";

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
  return prisma.$transaction(async (tx: any) => {

    const robot = await tx.robot.findUnique({
      where: { robotId },
    });

    if (!robot) {
      throw new Error(`Robot ${robotId} not registered`);
    }

    // Видалити старі камери перед синхронізацією
    await tx.robotCamera.deleteMany({
      where: { robotId },
    });

    // Вставити актуальні камери
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

export async function setActiveCamera(
  robotId: string,
  cameraId: number,
) {
  return prisma.$transaction(async (tx: any) => {
    // 1️⃣ деактивуємо всі
    await tx.robotCamera.updateMany({
      where: { robotId },
      data: { active: false },
    });

    // 2️⃣ активуємо одну
    await tx.robotCamera.update({
      where: { id: cameraId },
      data: { active: true },
    });

    return true;
  });
}

export async function getActiveRobotCamera(robotId: string) {
  return prisma.robotCamera.findFirst({
    where: {
      robotId,
      active: true,
    },
  });
}
