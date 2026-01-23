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
  error: Error | AppError | any,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Логування помилки
  if (request.log) {
    request.log.error(error);
  } else {
    console.error(error);
  }

  // Обробка JWT помилок
  if (error?.code === "FST_JWT_NO_AUTHORIZATION_IN_HEADER") {
    return reply.status(401).send({
      error: "Missing or invalid authorization header",
      code: "UNAUTHORIZED",
    });
  }

  if (error?.code === "FST_JWT_AUTHORIZATION_TOKEN_EXPIRED") {
    return reply.status(401).send({
      error: "Token has expired",
      code: "TOKEN_EXPIRED",
    });
  }

  if (error?.code === "FST_JWT_BAD_REQUEST") {
    return reply.status(401).send({
      error: "Invalid token",
      code: "INVALID_TOKEN",
    });
  }

  // Якщо це наша кастомна помилка
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: error.message,
      code: error.code,
    });
  }

  // Неочікувані помилки
  const statusCode = error?.statusCode || 500;
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : (error?.message || "Unknown error");

  return reply.status(statusCode).send({
    error: message,
    code: "INTERNAL_ERROR",
  });
}
