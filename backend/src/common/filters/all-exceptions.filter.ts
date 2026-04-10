import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";
import { PinoLogger } from "nestjs-pino";
import { Prisma } from "@prisma/client";

interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  requestId?: string;
  timestamp: string;
  path: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const requestId = (request.headers["x-request-id"] as string) ?? "unknown";
    const path = request.url;
    const timestamp = new Date().toISOString();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = "Internal server error";
    let error = "InternalServerError";

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === "string") {
        message = response;
      } else if (typeof response === "object" && response !== null) {
        const r = response as Record<string, unknown>;
        message = (r["message"] as string | string[]) ?? message;
        error = (r["error"] as string) ?? error;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle Prisma-specific errors
      if (exception.code === "P2002") {
        statusCode = HttpStatus.CONFLICT;
        message = "Resource already exists";
        error = "Conflict";
      } else if (exception.code === "P2025") {
        statusCode = HttpStatus.NOT_FOUND;
        message = "Resource not found";
        error = "NotFound";
      } else {
        statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
        message = "Database constraint violation";
        error = "DatabaseError";
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      statusCode = HttpStatus.BAD_REQUEST;
      message = "Invalid data format";
      error = "ValidationError";
    }

    // Log server errors only (not 4xx client errors)
    if (statusCode >= 500) {
      this.logger.error(
        { requestId, path, exception },
        `Unhandled exception: ${String(exception)}`,
      );
    } else {
      this.logger.warn(
        { requestId, path, statusCode },
        `Client error: ${String(message)}`,
      );
    }

    const errorResponse: ErrorResponse = {
      statusCode,
      error,
      message,
      requestId,
      timestamp,
      path,
    };

    void reply.status(statusCode).send(errorResponse);
  }
}
