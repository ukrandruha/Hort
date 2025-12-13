import type { FastifyInstance } from "fastify";
import {RobotUpdateData} from "../types/robot.types";
import { 
  updateRobotStatus, 
  getAllRobots, 
  getRobot,
  editRobot,
  deleteRobot
} from "./robot.service.js";


export async function robotRoutes(app: FastifyInstance) {

  // Raspberry update (open endpoint)
  app.post("/api/robots/update", async (req, reply) => {
    try {
      const robot = await updateRobotStatus(req.body as RobotUpdateData);
      return { success: true, robot };
    } catch (err) {
      reply.code(400).send({ error: "Update failed" });
    }
  });

  // List robots (JWT)
  app.get("/api/robots", { preHandler: [app.auth] }, async () => {
    return getAllRobots();
  });

  // Single robot (JWT)
  app.get<{ Params: { id: string } }>("/api/robots/:id", { preHandler: [app.auth] }, async (req, reply) => {
    const id = req.params.id;
    const robot = await getRobot(id);

    if (!robot) {
      return reply.code(404).send({ error: "Robot not found" });
    }

    return robot;
  });


  // Update robot (admin only)
app.patch<{ Params: { id: string } }>("/api/robots/:id", { preHandler: [app.auth] }, async (req, reply) => {

  //if (req.user.role !== "admin") {
  //  return reply.code(403).send({ error: "Forbidden" });
  //}

  const robotId = req.params.id;
  const data:RobotUpdateData = req.body as RobotUpdateData;

  try {
    //const updated = await prisma.robot.update({where: { robotId },data});
  
    const updated = editRobot(robotId,data);
    return updated;
  } catch (err) {
    return reply.code(404).send({ error: `err: ${err}`});
  }
});

// Delete robot (admin only)
app.delete<{ Params: { id: string } }>(
  "/api/robots/:id",
  async (req, reply) => {
    const { id } = req.params;

    //if (req.user.role !== "admin")
    //  return reply.status(403).send({ error: "Forbidden" });

    await deleteRobot(id);

    return reply.send({ success: true });
  }
);


}
