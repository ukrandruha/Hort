import type { FastifyInstance } from "fastify";
//import { updateRobotStatus, getAllRobots, getRobot } from "./robot.service.ts";
import { 
  updateRobotStatus, 
  getAllRobots, 
  getRobot,
  editRobot,
  deleteRobot
} from "./robot.service.ts";

export async function robotRoutes(app: FastifyInstance) {

  // Raspberry update (open endpoint)
  app.post("/api/robots/update", async (req, reply) => {
    try {
      const robot = await updateRobotStatus(req.body);
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
  app.get("/api/robots/:id", { preHandler: [app.auth] }, async (req, reply) => {
    const id = req.params.id;
    const robot = await getRobot(id);

    if (!robot) {
      return reply.code(404).send({ error: "Robot not found" });
    }

    return robot;
  });


  // Update robot (admin only)
app.patch("/api/robots/:id", { preHandler: [app.auth] }, async (req, reply) => {

  if (req.user.role !== "admin") {
    return reply.code(403).send({ error: "Forbidden" });
  }

  const robotId = req.params.id;
  const data = req.body;

  try {
    //const updated = await prisma.robot.update({where: { robotId },data});
    const updated = editRobot(robotId,data);
    return updated;
  } catch (err) {
    return reply.code(404).send({ error: `err: ${err}`});
  }
});

// Delete robot (admin only)
app.delete("/api/robots/:id", { preHandler: [app.auth] }, async (req, reply) => {

  if (req.user.role !== "admin") {
    return reply.code(403).send({ error: "Forbidden" });
  }

  const robotId = req.params.id;

  try {
   // await prisma.robot.delete({ where: { robotId } });
    deleteRobot(robotId);
    return { success: true };
  } catch (err) {
    //return reply.code(404).send({ error: `Robot not found ${robotId}`  });
    return reply.code(404).send({ error: `err: ${err}`});
  }
});



}
