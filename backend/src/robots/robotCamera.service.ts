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

    const normalized = cameras
      .map((c) => ({
        name: (c.name ?? "").trim(),
        port: (c.port ?? "").trim(),
      }))
      .filter((c) => c.port.length > 0);

    // Якщо в payload прийшли дублікати портів, залишаємо останній.
    const incomingByPort = new Map<string, { name: string; port: string }>();
    for (const camera of normalized) {
      incomingByPort.set(camera.port, camera);
    }

    const incoming = Array.from(incomingByPort.values());
    const incomingPorts = incoming.map((c) => c.port);

    const existing: Array<{ id: number; port: string; name: string }> = await tx.robotCamera.findMany({
      where: { robotId },
      select: {
        id: true,
        port: true,
        name: true,
      },
    });

    const existingByPort = new Map<string, { id: number; port: string; name: string }>(
      existing.map((c) => [c.port, c]),
    );

    // 1) Видалити камери, яких більше немає в списку cameras.
    if (incomingPorts.length === 0) {
      await tx.robotCamera.deleteMany({ where: { robotId } });
    } else {
      await tx.robotCamera.deleteMany({
        where: {
          robotId,
          port: { notIn: incomingPorts },
        },
      });
    }

    // 2) Додати нові камери зі списку cameras.
    const toCreate = incoming.filter((c) => !existingByPort.has(c.port));
    if (toCreate.length > 0) {
      await tx.robotCamera.createMany({
        data: toCreate.map((c) => ({
          robotId,
          name: c.name,
          port: c.port,
        })),
      });
    }

    // 3) Оновити назву для камер, що вже існують.
    const toUpdate = incoming.filter((c) => {
      const prev = existingByPort.get(c.port);
      return !!prev && prev.name !== c.name;
    });
    if (toUpdate.length > 0) {
      await Promise.all(
        toUpdate.map((c) =>
          tx.robotCamera.update({
            where: { robotId_port: { robotId, port: c.port } },
            data: { name: c.name },
          }),
        ),
      );
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
