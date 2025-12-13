import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function authRoutes(app: FastifyInstance) {

  // --------------------------
  // POST /api/auth/login
  // --------------------------
  app.post("/login", async (req, reply) => {
    const { email, password } = req.body as {
      email: string;
      password: string;
    };

    if (!email || !password) {
      return reply.status(400).send({ error: "Email and password required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    const token = app.jwt.sign({ id: user.id, role: user.role });

    return reply.send({ token });
  });

  // --------------------------
  // POST /api/auth/register
  // --------------------------
  app.post("/register", async (req, reply) => {
    const { email, password, role } = req.body as {
      email: string;
      password: string;
      role?: string;
    };

    if (!email || !password) {
      return reply.status(400).send({ error: "Email and password required" });
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return reply.status(400).send({ error: "User already exists" });
    }

    const hash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        email,
        password: hash,
        role: role ?? "user",
      },
    });

    return reply.send({ user: newUser });
  });

  // --------------------------
  // GET /api/auth/check
  // --------------------------
  app.get("/check", async (req, reply) => {
    try {
      await req.jwtVerify();
      return reply.send({ ok: true });
    } catch (err) {
      return reply.status(401).send({ error: "Invalid token" });
    }
  });
}
