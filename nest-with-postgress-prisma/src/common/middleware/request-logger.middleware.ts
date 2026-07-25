import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

const SENSITIVE_PARAMS = [
  'token',
  'password',
  'refreshToken',
  'accessToken',
  'secret',
];

function sanitizeUrl(originalUrl: string): string {
  const [path, query] = originalUrl.split('?');
  if (!query) return originalUrl;

  const params = new URLSearchParams(query);
  for (const key of params.keys()) {
    if (
      SENSITIVE_PARAMS.some((s) => key.toLowerCase().includes(s.toLowerCase()))
    ) {
      params.set(key, '[REDACTED]');
    }
  }

  return `${path}?${params.toString()}`;
}

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const start = performance.now();

    res.on('finish', () => {
      const duration = (performance.now() - start).toFixed(2);
      const safeUrl = sanitizeUrl(req.originalUrl);
      this.logger.log(
        `${req.method} ${safeUrl} ${res.statusCode} - ${duration}ms`,
      );
    });

    next();
  }
}
