import "fastify";

declare module "fastify" {
  interface FastifyInstance {
    auth: any;
  }

  interface FastifyRequest {
    user: {
      id: number;
      role: string;
    };
  }
}
