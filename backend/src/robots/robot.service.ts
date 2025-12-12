import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Raspberry Pi update or auto-register
export async function updateRobotStatus(data) {
  const { robotId, name, cpu, memory, disk, cloud } = data;

  return prisma.robot.upsert({
    where: { robotId },
    update: { name, cpu, memory, disk, cloud },
    create: { robotId, name, cpu, memory, disk, cloud }
  });
}

// Get all robots
export function getAllRobots() {
  return prisma.robot.findMany({
    orderBy: { lastSeen: "desc" }
  });
}

// Get single robot
export function getRobot(robotId: string) {
  return prisma.robot.findUnique({
    where: { robotId }
  });
}

// Update robot (admin edit)
export function editRobot(robotId: string, data: any) {
  return prisma.robot.update({
    where: { robotId },
    data
  });
}

// Delete robot
export function deleteRobot(robotId: string) {
  return prisma.robot.delete({
    where: { robotId }
  });
}
