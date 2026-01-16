import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

interface StandardResponse<T> {
  data: T;
}

@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<
  T,
  T | StandardResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<T | StandardResponse<T>> {
    return next.handle().pipe(
      map((value) => {
        if (value === undefined) {
          return value;
        }

        // Keep paginated or already standardized responses untouched.
        if (this.isStandardResponse(value)) {
          return value;
        }

        // Wrap all other payloads under "data" for a consistent API shape.
        return { data: value };
      }),
    );
  }

  private isStandardResponse(value: unknown): boolean {
    if (!value || typeof value !== "object") {
      return false;
    }

    if (Array.isArray(value)) {
      return false;
    }

    const record = value as Record<string, unknown>;
    const hasData = Object.prototype.hasOwnProperty.call(record, "data");
    const hasMeta = Object.prototype.hasOwnProperty.call(record, "meta");
    const hasError = Object.prototype.hasOwnProperty.call(record, "error");

    return (hasData && hasMeta) || hasError;
  }
}
