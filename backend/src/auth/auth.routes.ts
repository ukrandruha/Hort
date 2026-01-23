import { FastifyInstance , RouteShorthandOptions } from "fastify";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma.js";
import { validateEmail, validatePassword } from "../utils/validation.js";
import { AppError } from "../utils/errors.js";

export async function authRoutes(fastify: FastifyInstance) {

const opts: RouteShorthandOptions = {
  schema: {
    response: {
      200: {
        type: 'object',
        properties: {
          pong: {
            type: 'string'
          }
        }
      }
    }
  }
}

  fastify.get('/api/auth/ping', opts, async (request, reply) => {
  return { pong: 'it worked!' }
})

  // --------------------------
  // POST /api/auth/login
  // --------------------------
  fastify.post("/api/auth/login", async (req, reply) => {
    const body = req.body as { email?: string; password?: string };
    const email = body?.email?.trim();
    const password = body?.password;

    if (!email || !password) {
      throw new AppError(400, "Email and password required", "MISSING_CREDENTIALS");
    }

    validateEmail(email);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    const token = fastify.jwt.sign({ id: user.id, role: user.role });

    return reply.send({ token });
  });

  // --------------------------
  // POST /api/auth/register
  // --------------------------
  fastify.post("/api/auth/register", async (req, reply) => {
    const { email, password, role } = req.body as {
      email: string;
      password: string;
      role?: string;
    };

    if (!email || !password) {
      throw new AppError(400, "Email and password required", "MISSING_CREDENTIALS");
    }

    try {
      validateEmail(email);
      validatePassword(password);
    } catch (error) {
      throw error;
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
  fastify.get("/api/auth/check", async (req, reply) => {
    try {
      await req.jwtVerify();
      return reply.send({ ok: true });
    } catch (err) {
      return reply.status(401).send({ error: "Invalid token" });
    }
  });

// --------------------------
// GET /api/auth/user-email/:id
// --------------------------
fastify.get<{ Params: { id: number } }>("/api/auth/user-email/:id", async (req, reply) => {
  try {
    
    await req.jwtVerify();

    const userId = Number(req.params.id);

    if (isNaN(userId)) {
      return reply.status(400).send({ error: "Invalid user ID" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true
      }
    });

    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }

    return reply.send(user);

  } catch (err) {
    console.error(err);
    return reply.status(401).send({ error: "Invalid token" });
  }
});
  
}
