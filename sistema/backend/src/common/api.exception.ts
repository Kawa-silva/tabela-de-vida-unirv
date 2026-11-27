import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * ApiException — exceção de domínio padronizada (RN024).
 * Contém statusCode, message e details, e é convertida em JSON pelo ErrorHandlerFilter.
 */
export class ApiException extends HttpException {
  constructor(
    statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super({ message, details }, statusCode);
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiException(HttpStatus.BAD_REQUEST, message, details);
  }

  static notFound(message: string) {
    return new ApiException(HttpStatus.NOT_FOUND, message);
  }

  static conflict(message: string) {
    return new ApiException(HttpStatus.CONFLICT, message);
  }
}
