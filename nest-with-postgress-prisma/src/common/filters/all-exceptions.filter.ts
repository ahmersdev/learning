import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsFilter');

  constructor(private readonly configService: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const isDevelopment =
      this.configService.get<string>('NODE_ENV') === 'development';

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      let message: string;
      let details: unknown;

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else {
        const body = exceptionResponse as Record<string, unknown>;
        message = (body.message as string) ?? exception.message;
        details = body.details;
      }

      response.status(status).json({
        status: 'fail',
        message,
        ...(details ? { details } : {}),
        ...(isDevelopment ? { stack: (exception as Error).stack } : {}),
      });
      return;
    }

    const error = exception as Error;
    this.logger.error('UNEXPECTED ERROR 🔥:', error.stack);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: isDevelopment ? error.message : 'Something went wrong',
      ...(isDevelopment ? { stack: error.stack } : {}),
    });
  }
}
