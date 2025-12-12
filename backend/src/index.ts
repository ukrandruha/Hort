import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { PrismaClient } from "@prisma/client";

import { authRoutes } from "./auth/auth.routes.ts";
import { robotRoutes } from "./robots/robot.routes.ts";

const prisma = new PrismaClient();
const app = Fastify();

await app.register(cors, { origin: "*" });
await app.register(jwt, { secret: "HORT_SECRET_KEY" });

// Auth decorator (JWT)
app.decorate("auth", async (req, reply) => {
  try {
    const decoded = await req.jwtVerify();
    req.user = decoded;
  } catch {
    reply.code(401).send({ error: "Unauthorized" });
  }
});

// Routes
await app.register(authRoutes);
await app.register(robotRoutes);

app.get("/", () => ({ ok: true, service: "Hort backend" }));

app.listen({ port: 3000, host: "0.0.0.0" }, () => {
  console.log("HORT backend running on port 3000");
});
