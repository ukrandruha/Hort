import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { PrismaClient } from "@prisma/client";

import { robotRoutes } from "./robots/robot.routes.js";
import { authRoutes } from "./auth/auth.routes.js";

const prisma = new PrismaClient();

const app = Fastify({
  logger: true
});

const start = async () => {
  try {
    await app.register(cors, { origin: "*" });
    await app.register(jwt, { secret: "HORT_SECRET_KEY" });

    app.decorate("auth", async (req: any, reply: any) => {
      await req.jwtVerify();
    });

    await app.register(authRoutes);
    await app.register(robotRoutes);

    await app.listen({
      port: 3000,
      host: "0.0.0.0"
    });

    console.log("Backend started");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
