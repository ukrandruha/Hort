import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { registerUser, validateUser } from "./auth.service.js";

export async function authRoutes(app: FastifyInstance) {
  // Register
  app.post<{
    Body: { email: string; password: string; role?: string };
  }>("/api/register", async (req, reply) => {
    const { email, password, role } = req.body;

    const user = await registerUser(email, password, role ?? "user");

    return reply.send({ user });
  });

  // Login
  app.post<{
    Body: { email: string; password: string };
  }>("/api/login", async (req, reply) => {
    const { email, password } = req.body;

    const user = await validateUser(email, password);
    if (!user) return reply.status(401).send({ error: "Invalid credentials" });

    const token = app.jwt.sign({ id: user.id, role: user.role });

    return reply.send({ token });
  });
}
