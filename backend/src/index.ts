import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { PrismaClient } from "@prisma/client";

import { authRoutes } from "./auth/auth.routes";
import { robotRoutes } from "./robots/robot.routes";

const prisma = new PrismaClient();
const app = Fastify();

(async () => {
   await app.register(cors, { origin: "*" });
   await app.register(jwt, { secret: "HORT_SECRET_KEY" });

   app.decorate("auth", async (req: any, reply: any) => {
      await req.jwtVerify();
   });

   await app.register(authRoutes);
   await app.register(robotRoutes);

   app.listen({ port: 3000 }, () => console.log("Backend started"));
})();
