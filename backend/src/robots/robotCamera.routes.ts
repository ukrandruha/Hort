import type { FastifyInstance } from "fastify";

import { 
  syncRobotCameras,
  getRobotCameras,
  setActiveCamera
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
  const cameras = await getRobotCameras(robotId);
  reply.send(cameras);
});


app.post(
  "/api/robots/:robotId/cameras/:cameraId/activate",
  async (req, reply) => {
    const { robotId, cameraId } = req.params as {
      robotId: string;
      cameraId: string;
    };

    await setActiveCamera(robotId.trim(), Number(cameraId));

    reply.send({ ok: true });
  },
);


}



