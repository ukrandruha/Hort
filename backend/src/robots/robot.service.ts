import { PrismaClient } from "@prisma/client";
import {RobotUpdateData} from "../types/robot.types.js";
import { RobotSessionStatus } from '@prisma/client';
//import { RobotUpdateData } from "./robot.types";


const prisma = new PrismaClient();


// Get all robots
// export function getAllRobots() {
//   return prisma.robot.findMany({
//     orderBy: { updatedAt: "desc" }
//   });
// }
export function getAllRobots() {
  return prisma.robot.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      sessions: {
        where: {
         status: {
            in: ['ACTIVE', 'DISCONNECT_REQUESTED'],
          },
        },
        take: 1,
        select: {
          operator: {
            select: {
              email: true,
            },
          },
        },
      },
    },
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

 export async function updateStatusWebRtc(id: string,userconnect:number) {
   return prisma.robot.update({
    where: { robotId: id },
     data: { 
      webrtclient: userconnect,
     },
   });
}



   ////////////////////////////////////////////////////////////
   ////////////Create new robot control session////////////////
   ////////////////////////////////////////////////////////////


  export async function createSession(params: {
    robotId: string;
    operatorId: number;

  }) {

    const { robotId, operatorId} = params;


    // ensure no active session
    const activeSession = await prisma.robotSession.findFirst({
      where: {
        robotId,
        status: RobotSessionStatus.ACTIVE,
      },
    });

    if (activeSession) {
      throw new Error('Robot already has an active session');
    }

    return prisma.robotSession.create({
      data: {
        robotId,
        operatorId,
        status: RobotSessionStatus.ACTIVE,
        lastHeartbeatAt: new Date(),
      },
    });
  }



  /**
   * Request or force disconnect session
   */
   export async function disconnectSession(params: {
    robotId: string;
    reason?: string; // причіна: "admin_action"
    disconnectedBy: string;
    force?: boolean;
  }) {
    const { robotId, reason, disconnectedBy, force } = params;

    const session = await prisma.robotSession.findFirst({
      where: { robotId: robotId, status: RobotSessionStatus.ACTIVE },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status === RobotSessionStatus.DISCONNECTED) {
      return session;
    }

    // graceful vs force
    const newStatus = force
      ? RobotSessionStatus.DISCONNECT_REQUESTED
      : RobotSessionStatus.DISCONNECTED;

    return prisma.robotSession.update({
      where: { id: session.id
       },
      data: {
        status: newStatus,
        disconnectReason: reason,
        disconnectedBy,
        disconnectAt: new Date() ,
      },
    });
  }

  /**
   * Confirm disconnect (e.g. robot acknowledged)
   */
   export async function confirmDisconnect(sessionId: string) {
    return prisma.robotSession.update({
      where: { id: sessionId },
      data: {
        status: RobotSessionStatus.DISCONNECTED,
        disconnectAt: new Date(),
      },
    });
  }
