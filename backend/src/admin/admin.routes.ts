import { FastifyInstance } from "fastify";
import { prisma } from "../db/prisma.js";
import { AppError } from "../utils/errors.js";

export async function adminRoutes(fastify: FastifyInstance) {
  // Assign robots to a user (replace existing assignments)
  fastify.post(
    "/api/admin/assign-robots",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            userId: { type: "number" },
            devices: { type: "array", items: { type: "string" } },
          },
          required: ["userId", "devices"],
        },
      },
    },
    async (req: any, reply) => {
      try {
        // Verify JWT and ensure admin role
        await req.jwtVerify();
        const user = req.user as { id: number; role: string };
        if (!user || user.role !== "admin") {
          return reply.status(403).send({ error: "Forbidden" });
        }

        const { userId, devices } = req.body as { userId: number; devices: string[] };

        if (!Number.isInteger(userId) || userId <= 0) {
          throw new AppError(400, "Invalid userId");
        }

        if (!Array.isArray(devices)) {
          throw new AppError(400, "Invalid devices list");
        }

        // Ensure user exists
        const exists = await prisma.user.findUnique({ where: { id: userId } });
        if (!exists) {
          return reply.status(404).send({ error: "User not found" });
        }

        // Use a transaction: delete existing assignments for user, then insert provided devices
        await prisma.$transaction(async (tx: any) => {
          await tx.$executeRaw`DELETE FROM "Tc_user_device" WHERE userid = ${userId}`;

          for (const deviceid of devices) {
            await tx.$executeRaw`INSERT INTO "Tc_user_device" (userid, deviceid, "groupName", "createdAt", "updatedAt") VALUES (${userId}, ${deviceid}, ${null}, now(), now())`;
          }
        });

        return reply.send({ ok: true });
      } catch (err: any) {
        if (err instanceof AppError) throw err;
        console.error(err);
        return reply.status(500).send({ error: "Server error" });
      }
    },
  );

  // List users (id + email)
  fastify.get("/api/admin/users", async (req: any, reply) => {
    try {
      await req.jwtVerify();
      const user = req.user as { id: number; role: string };
      if (!user || user.role !== "admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const users = await prisma.user.findMany({ select: { id: true, email: true } });
      return reply.send(users);
    } catch (err: any) {
      console.error(err);
      return reply.status(500).send({ error: "Server error" });
    }
  });

  // Get devices assigned to a user
  fastify.get<{ Params: { id: number } }>("/api/admin/user-devices/:id", async (req: any, reply) => {
    try {
      await req.jwtVerify();
      const authUser = req.user as { id: number; role: string };
      if (!authUser || authUser.role !== "admin") {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const userId = Number(req.params.id);
      if (!Number.isInteger(userId) || userId <= 0) {
        return reply.status(400).send({ error: "Invalid user id" });
      }

      const devices = await prisma.tc_user_device.findMany({
        where: { userid: userId },
        select: { deviceid: true },
      });

      return reply.send(devices.map((d: any) => d.deviceid));
    } catch (err: any) {
      console.error(err);
      return reply.status(500).send({ error: "Server error" });
    }
  });
}
