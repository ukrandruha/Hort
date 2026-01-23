import type { FastifyInstance } from "fastify";
import {RobotUpdateData} from "../types/robot.types.js";
import { 
  updateRobotStatus, 
  getAllRobots, 
  getRobot,
  editRobot,
  deleteRobot,
 // updateStatusWebRtc,
  createSession,
  disconnectSession,
  confirmDisconnect,
  createMission,
  deleteMission,
  getMission,
  getRobotMissions,
  deleteRobotMissions
} from "./robot.service.js";


export async function robotRoutes(app: FastifyInstance) {

  // Raspberry update endpoint
  // TODO: Додати API ключ або інший механізм автентифікації для роботів
  app.post("/api/robots/update", async (req, reply) => {
    try {
      const robot = await updateRobotStatus(req.body as RobotUpdateData);
      return { success: true, robot };
    } catch (err) {
      reply.code(400).send({ error: "Update failed: " + (err instanceof Error ? err.message : String(err)) });
    }
  });

  // app.post<{ Params: { idRobot: string, userconnect: number } }>("/api/robots/updatewebrtcclient", async (req, reply) => {
  //   try {
  //     const upd = req.body as { idRobot: string, userconnect: number } 
  //     if (!upd.idRobot || upd.userconnect === undefined) {
  //         throw new Error('robotId або userconnect відсутні');
  //       }
  //     await updateStatusWebRtc(upd.idRobot,upd.userconnect);
  //     return { success: true };
  //   } catch (err) {
  //     reply.code(400).send({ error: "Update failed:"+err});
  //   }
  // });

  // List robots (JWT) - показувати тільки роботи користувача
  app.get("/api/robots/", { preHandler: [app.auth] }, async (req) => {
    const user = req.user as { id: number; role: string; email?: string };
    // Адміни бачать всіх роботів, інші - тільки своїх
    return getAllRobots(user.role === "admin" ? undefined : user.id);
  });

  // Single robot (JWT) - з перевіркою доступу
  app.get<{ Params: { id: string } }>("/api/robots/:id", { preHandler: [app.auth] }, async (req, reply) => {
    const id = req.params.id;
    const user = req.user as { id: number; role: string; email?: string };
    
    // Адміни мають доступ до всіх роботів
    const robot = user.role === "admin" 
      ? await getRobot(id)
      : await getRobot(id, user.id);

    if (!robot) {
      return reply.code(404).send({ error: "Robot not found or access denied" });
    }

    return robot;
  });


  // Update robot (admin only)
app.patch<{ Params: { id: string } }>("/api/robots/:id", { preHandler: [app.auth] }, async (req, reply) => {
  // Перевірка ролі адміністратора
  const user = req.user as { id: number; role: string; email?: string };
  if (user.role !== "admin") {
    return reply.code(403).send({ error: "Forbidden: Admin access required" });
  }

  const robotId = req.params.id;
  const data:RobotUpdateData = req.body as RobotUpdateData;

  try {
    const updated = await editRobot(robotId, data);
    return updated;
  } catch (err) {
    return reply.code(404).send({ error: `Update failed: ${err}`});
  }
});

// Delete robot (admin only)
app.delete<{ Params: { id: string } }>(
  "/api/robots/:id",
  { preHandler: [app.auth] },
  async (req, reply) => {
    // Перевірка ролі адміністратора
    const user = req.user as { id: number; role: string; email?: string };
    if (user.role !== "admin") {
      return reply.status(403).send({ error: "Forbidden: Admin access required" });
    }

    const { id } = req.params;

    await deleteRobot(id);

    return reply.send({ success: true });
  }
);


/**
   * Create robot session
   */
  app.post<{ Params: { robotId: string, operatorId: number } }>(
     "/api/robots/robot-sessions/create",
     async (req, reply) => {

      try {
        const param = req.body as { robotId: string, operatorId: number };

        const session = await createSession(
          param
        );

        return reply.code(201).send(session);
      } catch (err: any) {
        return reply.code(400).send({ message: err.message });
      }
    },
  );

  /**
   * Disconnect robot session
   */
  app.post(
    '/api/robots/robot-sessions/disconnect',

    async (req, reply) => {

      const param = req.body as {robotId: string, reason: string, disconnectedBy:string,force: boolean} ;

      try {
        const session = await disconnectSession(param);

        return reply.send(session);
      } catch (err: any) {
        return reply.code(400).send({ message: err.message });
      }
    },
  );

    app.post(
    '/api/robots/robot-sessions/confirmDisconnect',

    async (req, reply) => {

      const param = req.body as {robotId: string} ;

      try {
        const session = await confirmDisconnect(param.robotId);

        return reply.send(session);
      } catch (err: any) {
        return reply.code(400).send({ message: err.message });
      }
    },
  )


  app.post("/api/robots/:robotId/missions", async (req, reply) => {
  const { robotId } = req.params as { robotId: string };
  const { name, points } = req.body as any;

  const mission = await createMission(robotId.trim(), name, points);

  reply.send(mission);
});

app.delete("/api/missions/:missionId", async (req, reply) => {
  const { missionId } = req.params as { missionId: string };

  await deleteMission(missionId);


  reply.send({ ok: true });
});


app.get("/api/missions/:missionId", async (req, reply) => {
  const { missionId } = req.params as { missionId: string };
  const mission = await getMission(missionId);
  reply.send(mission);
});

app.get("/api/robots/:robotId/missions", async (req, reply) => {
  const { robotId } = req.params as { robotId: string };
  const missions = await getRobotMissions(robotId.trim());
  reply.send(missions);
});

app.delete("/api/robots/:robotId/missions", async (req, reply) => {
  const { robotId } = req.params as { robotId: string };
  await deleteRobotMissions(robotId.trim());
  reply.send({ ok: true });
});


}
