import { prisma } from "../db/prisma.js";
import {RobotUpdateData} from "../types/robot.types.js";
import { RobotSessionStatus } from '@prisma/client';
import { validateRobotId, validateCoordinates } from "../utils/validation.js";


export async function getAllRobots(userId?: number) {
  // Якщо переданий userId, показувати тільки його роботи
  const robots = await prisma.robot.findMany({
    where: userId ? {
      users: {
        some: {
          userid: userId,
        },
      },
    } : undefined,
    orderBy: { updatedAt: 'desc' },
    include: {
      sessions: {
        where: {
          status: {
            in: ['ACTIVE_WEBRTC', 'DISCONNECT_REQUESTED'],
          },
        },
        take: 1,
        select: {
          status: true, // ✅ ОБОВʼЯЗКОВО
          operator: {
            select: {
              email: true,
            },
          },
        },
      },
      users: {
        select: {
          userid: true,
        },
      },
    },
  });

  return robots.map((robot: any) => {
    const session = robot.sessions[0];

    return {
      ...robot, // ✅ всі поля Robot
      operatorEmail: session?.operator.email ?? null,
      sessionStatus: session?.status ?? null,
      groups: [],
      sessions: undefined, // опціонально
      users: undefined, // опціонально
    };
  });
}


// Get robot by ID з перевіркою доступу користувача
export async function getRobot(robotId: string, userId?: number) {
  const robot = await prisma.robot.findUnique({
    where: { robotId },
    include: {
      users: {
        where: userId ? { userid: userId } : undefined,
        select: {
          userid: true,
        },
      },
    },
  });

  // Якщо переданий userId і користувач не має доступу - повернути null
  if (userId && (!robot || robot.users.length === 0)) {
    return null;
  }

  return robot;
}

export async function updateRobotStatus(data:RobotUpdateData) {
  validateRobotId(data.robotId);
  
  // Валідація координат якщо вони є
  if (data.position) {
    validateCoordinates(data.position.lat, data.position.lng);
  }
  
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
   export async function confirmDisconnect(robotId: string) {
   
    const session = await prisma.robotSession.findFirst({
      where: { robotId: robotId, status: RobotSessionStatus.DISCONNECT_REQUESTED },
    });
   
    if (!session) {
      throw new Error('Session not found');
    }

    return prisma.robotSession.update({
      where: {id: session.id },
      data: {
        status: RobotSessionStatus.DISCONNECTED,
        disconnectAt: new Date(),
      },
    });
  }

  /**
   * Request reboot session (graceful reboot)
   */
  export async function requestRebootSession(params: {
    robotId: string;
    reason?: string;
    requestedBy: string;
  }) {
    const { robotId, reason, requestedBy } = params;

    const session = await prisma.robotSession.findFirst({
      where: { robotId: robotId, status: RobotSessionStatus.ACTIVE },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status === RobotSessionStatus.REBOOT_DISCONNECT_REQUESTED) {
      return session;
    }

    return prisma.robotSession.update({
      where: { id: session.id },
      data: {
        status: RobotSessionStatus.REBOOT_DISCONNECT_REQUESTED,
        disconnectReason: reason,
        disconnectedBy: requestedBy,
      },
    });
  }

  /**
   * Promote session from ACTIVE to ACTIVE_WEBRTC
   */
  export async function activateWebrtcSession(params: { robotId: string }) {
    const { robotId } = params;

    const session = await prisma.robotSession.findFirst({
      where: {
        robotId: robotId,
        status: { in: [RobotSessionStatus.ACTIVE, RobotSessionStatus.ACTIVE_WEBRTC] },
      },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status === RobotSessionStatus.ACTIVE_WEBRTC) {
      return session;
    }

    return prisma.robotSession.update({
      where: { id: session.id },
      data: {
        status: RobotSessionStatus.ACTIVE_WEBRTC,
      },
    });
  }

  /**
   * Revert session from ACTIVE_WEBRTC to ACTIVE
   */
  export async function deactivateWebrtcSession(params: { robotId: string }) {
    const { robotId } = params;

    const session = await prisma.robotSession.findFirst({
      where: {
        robotId: robotId,
        status: { in: [RobotSessionStatus.ACTIVE_WEBRTC, RobotSessionStatus.ACTIVE] },
      },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status === RobotSessionStatus.ACTIVE) {
      return session;
    }

    return prisma.robotSession.update({
      where: { id: session.id },
      data: {
        status: RobotSessionStatus.ACTIVE,
      },
    });
  }

export async function getMission(missionId: string)
{
    return await prisma.mission.findUnique({
    where: { id: Number(missionId)},
    include: {
      points: {
        orderBy: { order: "asc" },
      },
    },
  });
}

export async function getRobotMissions(robotId: string) {
  return await prisma.mission.findMany({
    where: { robotId },
    include: {
      points: {
        orderBy: { order: "asc" },
      },
    },
  });
}

export async function deleteRobotMissions(robotId: string) {
  return await prisma.mission.deleteMany({
    where: { robotId },
  });
}

export async function deleteMission(missionId: string)
{
  return await prisma.mission.delete({
    where: { id: Number(missionId) },
  });
}

export async function getRobotSessionStatusById(sessionId: string) {
  const session = await prisma.robotSession.findUnique({
    where: { id: sessionId },
    select: { status: true },
  });

  if (!session) {
    throw new Error('Session not found');
  }

  return session;
}

  export async function createMission(
  robotId: string,
  name: string,
  points: { lat: number; lng: number }[],
) {
  return prisma.$transaction(async (tx: any) => {
    const mission = await tx.mission.create({
      data: {
        robotId,
        name,
      },
    });

    await tx.missionPoint.createMany({
      data: points.map((p, index) => ({
        missionId: mission.id,
        order: index,
        lat: p.lat,
        lng: p.lng,
      })),
    });

    return mission;
  });
}
