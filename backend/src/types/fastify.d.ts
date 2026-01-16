import "fastify";
import { FastifyRequest, FastifyReply } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    auth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    user: {
      id: number;
      role: string;
      email?: string;
    };
  }
}


