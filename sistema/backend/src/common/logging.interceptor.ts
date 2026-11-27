import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

/**
 * LoggingInterceptor — log HTTP de todas as requisições:
 *   [HTTP] GET /api/cenarios -> 200 (12 ms)
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const inicio = Date.now();
    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse<Response>();
          this.logger.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - inicio} ms)`);
        },
        error: (erro: { status?: number }) => {
          this.logger.warn(`${req.method} ${req.originalUrl} -> ${erro?.status ?? 500} (${Date.now() - inicio} ms)`);
        },
      }),
    );
  }
}
