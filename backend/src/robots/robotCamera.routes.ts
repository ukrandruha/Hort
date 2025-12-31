import type { FastifyInstance } from "fastify";

import { 
  syncRobotCameras,
  getRobotCameras
} from "./robotCamera.service.js";

export async function robotCameraRoutes(app: FastifyInstance) {

 app.post("/api/robots/:robotId/cameras", async (req, reply) => {
     
      const { robotId } = req.params as { robotId: string };
      const cameras = req.body as any[];

      await syncRobotCameras(robotId, cameras);

      reply.send({ ok: true });
    },
  );

  app.get("/api/robots/:robotId/cameras", async (req, reply) => {
  const { robotId } = req.params as { robotId: string };
  const cameras = getRobotCameras(robotId);
  reply.send(cameras);
});

}
