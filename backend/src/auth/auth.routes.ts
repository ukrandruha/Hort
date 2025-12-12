import type { FastifyInstance } from "fastify";
import { registerUser, validateUser } from "./auth.service.ts";

export async function authRoutes(app: FastifyInstance) {
  
  // REGISTER USER (admin only)
  app.post("/api/auth/register", { preHandler: [app.auth] }, async (req, reply) => {
    const user = req.user;

    if (user.role !== "admin") {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const { email, password, role } = req.body;

    if (!["admin", "viewer"].includes(role)) {
      return reply.code(400).send({ error: "Invalid role" });
    }

    const newUser = await registerUser(email, password, role);

    return { id: newUser.id, email: newUser.email, role: newUser.role };
  });

  // LOGIN
  app.post("/api/auth/login", async (req, reply) => {
    const { email, password } = req.body;
    const user = await validateUser(email, password);

    if (!user) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const token = app.jwt.sign({
      id: user.id,
      role: user.role
    });

    return { token };
  });
}
