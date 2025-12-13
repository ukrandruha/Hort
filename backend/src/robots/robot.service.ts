import { PrismaClient } from "@prisma/client";
//import { RobotUpdateData } from "./robot.types";

const prisma = new PrismaClient();

export async function getRobots() {
  return prisma.robot.findMany();
}

export async function updateRobotStatus(data) {
  return prisma.robot.upsert({
    where: { robotId: data.robotId },
    update: {
      name: data.name ?? undefined,
      status: data.status ?? undefined,
      battery: data.battery ?? undefined,
      cpu: data.cpu ?? undefined,
      memory: data.memory ?? undefined,
      temperature: data.temperature ?? undefined,
      lat: data.position?.lat,
      lng: data.position?.lng,
    },
    create: {
      robotId: data.robotId,
      name: data.name,
      status: data.status,
      battery: data.battery,
      cpu: data.cpu,
      memory: data.memory,
      temperature: data.temperature,
      lat: data.position?.lat,
      lng: data.position?.lng,
    },
  });
}

export async function deleteRobot(id: string) {
  return prisma.robot.delete({ where: { robotId: id } });
}

export async function editRobot(id: string, data: Partial<RobotUpdateData>) {
  return prisma.robot.update({
    where: { robotId: id },
    data,
  });
}
