import type { FastifyInstance } from "fastify";

import { 
  syncRobotCameras,
  getRobotCameras
} from "./robotCamera.service.js";

export async function robotCameraRoutes(app: FastifyInstance) {

 app.post<{ Params: { robotId: string} }>("/api/robots/cameras:robotId", async (req, reply) => {
     
      const { robotId } = req.params.robotId;
      const cameras = req.body as any[];

      await syncRobotCameras(robotId, cameras);

      reply.send({ ok: true });
    },
  );

  app.get("/api/robots/cameras:robotId", async (req, reply) => {
  const { robotId } = req.params as any;
  const cameras = getRobotCameras(robotId);
  reply.send(cameras);
});

}
