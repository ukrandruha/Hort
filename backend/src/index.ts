import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";

import { robotRoutes } from "./robots/robot.routes.js";
import {robotCameraRoutes} from "./robots/robotCamera.routes.js";
import { adminRoutes } from "./admin/admin.routes.js";
import { authRoutes } from "./auth/auth.routes.js";
import { errorHandler } from "./utils/errors.js";

const app = Fastify({
  logger: true
});

// Централізована обробка помилок
app.setErrorHandler(errorHandler);

const start = async () => {
  try {
    // Обовʼязково реєструємо плагіни для парсування JSON та CORS
    await app.register(cors, { 
      origin: process.env.CORS_ORIGIN 
        ? process.env.CORS_ORIGIN.split(",").map(origin => origin.trim())
        : ["http://localhost:5173"]
    });
    
    // JWT secret з env змінної
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error("JWT_SECRET environment variable is required");
    }
    await app.register(jwt, { secret: jwtSecret });

    app.decorate("auth", async (req: any, reply: any) => {
      await req.jwtVerify();
      // Встановлюємо req.user з payload після верифікації
      const payload = req.user as { id: number; role: string; email?: string };
      req.user = payload;
    });

    await app.register(authRoutes);
    await app.register(robotRoutes);
    await app.register(robotCameraRoutes);
    await app.register(adminRoutes);

    const port = Number(process.env.PORT) || 3001;
    const host = process.env.HOST || "0.0.0.0";
    
    await app.listen({
      port,
      host
    });

    console.log("Backend started");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
