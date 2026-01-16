import {
  Catch,
  ArgumentsHost,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Response, Request } from "express";

interface ErrorDetail {
  field?: string;
  message: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Normalize all errors to a single shape for clients.
    const { statusCode, code, message, details } =
      this.normalizeException(exception);

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `Unhandled error ${statusCode} on ${request.method} ${request.url}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(statusCode).json({
      error: {
        code,
        message,
        details: details?.length ? details : undefined,
      },
    });
  }

  private normalizeException(exception: unknown): {
    statusCode: number;
    code: string;
    message: string;
    details?: ErrorDetail[];
  } {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === "string") {
        return {
          statusCode,
          code: this.normalizeCode(exception.name),
          message: response,
        };
      }

      if (response && typeof response === "object") {
        const payload = response as Record<string, unknown>;
        const rawMessage = payload.message;
        const rawError = payload.error;

        const { message, details } = this.extractMessageAndDetails(rawMessage);

        return {
          statusCode,
          code: this.normalizeCode(
            typeof rawError === "string" ? rawError : exception.name,
          ),
          message,
          details,
        };
      }
    }

    const fallbackMessage =
      exception instanceof Error
        ? exception.message
        : "Error interno del servidor";

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: "INTERNAL_SERVER_ERROR",
      message: fallbackMessage,
    };
  }

  private extractMessageAndDetails(rawMessage: unknown): {
    message: string;
    details?: ErrorDetail[];
  } {
    if (Array.isArray(rawMessage)) {
      return {
        message: "Error de validación",
        details: rawMessage.map((entry) => ({ message: String(entry) })),
      };
    }

    if (typeof rawMessage === "string" && rawMessage.length > 0) {
      return { message: rawMessage };
    }

    return { message: "Solicitud inválida" };
  }

  private normalizeCode(value: string): string {
    return value
      .trim()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, "_")
      .toUpperCase();
  }
}
