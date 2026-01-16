import { FastifyReply, FastifyRequest } from "fastify";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  error: Error | AppError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Логування помилки
  request.log.error(error);

  // Якщо це наша кастомна помилка
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: error.message,
      code: error.code,
    });
  }

  // Неочікувані помилки
  const statusCode = 500;
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : error.message;

  return reply.status(statusCode).send({
    error: message,
    code: "INTERNAL_ERROR",
  });
}
