import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiException } from './api.exception';

/**
 * ErrorHandlerFilter — equivalente NestJS do "ErrorHandlerMiddleware" do enunciado (RN024 / RNF010).
 * Captura QUALQUER erro lançado nos controllers/services e devolve sempre o mesmo JSON:
 *   { status, erro, mensagem, detalhes, caminho, timestamp }
 * 400 = validação, 404 = recurso/rota inexistente, 500 = falha interna.
 */
@Catch()
export class ErrorHandlerFilter implements ExceptionFilter {
  private readonly logger = new Logger('ErrorHandler');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let mensagem = 'Erro interno do servidor';
    let detalhes: unknown = undefined;

    if (exception instanceof ApiException) {
      status = exception.getStatus();
      mensagem = exception.message;
      detalhes = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const corpo = exception.getResponse();
      mensagem =
        typeof corpo === 'string'
          ? corpo
          : String((corpo as { message?: unknown }).message ?? exception.message);
      if (status === HttpStatus.NOT_FOUND && !(exception instanceof ApiException)) {
        mensagem = `Rota não encontrada: ${req.method} ${req.originalUrl}`;
      }
    } else if (exception instanceof Error) {
      // erros de restrição do PostgreSQL viram 400 com mensagem legível
      const codigoPg = (exception as { code?: string }).code;
      if (codigoPg && /^(23|22)/.test(codigoPg)) {
        status = HttpStatus.BAD_REQUEST;
        mensagem = 'Dados inválidos para o banco de dados';
        detalhes = exception.message;
      } else {
        this.logger.error(exception.message, exception.stack);
      }
    }

    res.status(status).json({
      status,
      erro: HttpStatus[status] ?? 'ERROR',
      mensagem,
      detalhes,
      caminho: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }
}
