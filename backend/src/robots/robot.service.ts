import { PrismaClient } from "@prisma/client";
import {RobotUpdateData} from "../types/robot.types.js";
//import { RobotUpdateData } from "./robot.types";


const prisma = new PrismaClient();


// Get all robots
export function getAllRobots() {
  return prisma.robot.findMany({
    orderBy: { updatedAt: "desc" }
  });
}

// Get robot by ID
export function getRobot(robotId: string) {
  return prisma.robot.findUnique({ where: { robotId } });
}

export async function updateRobotStatus(data:RobotUpdateData) {
  return prisma.robot.upsert({
    where: { robotId: data.robotId },
    update: { 
      status: data.status ?? undefined,
      battery: data.battery ?? undefined,
      cpu: data.cpu ?? undefined,
      memory: data.memory ?? undefined,
      disk: data.disk ?? undefined,
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
      disk: data.disk,
      temperature: data.temperature,
      lat: data.position?.lat,
      lng: data.position?.lng,
    },
  });
}

export async function deleteRobot(id: string) {
  return prisma.robot.delete({ where: { robotId: id } });
}

export async function editRobot(id: string, data:RobotUpdateData) {
  return prisma.robot.update({
    where: { robotId: id },
    data,
  });
}

// export async function updateStatusWebRtc(id: string,userconnect:number) {
//   return prisma.robot.upsert({
//     where: { robotId: id },
//     update: { 
//       webrtclient: userconnect,
//     },
//   });
// }
