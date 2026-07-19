import { type Request, type Response, type NextFunction } from "express";

// Query param keys whose values should never hit the logs
const SENSITIVE_PARAMS = [
  "token",
  "password",
  "refreshToken",
  "accessToken",
  "secret",
];

const sanitizeUrl = (originalUrl: string): string => {
  const [path, query] = originalUrl.split("?");
  if (!query) return originalUrl;

  const params = new URLSearchParams(query);
  for (const key of params.keys()) {
    if (
      SENSITIVE_PARAMS.some((s) => key.toLowerCase().includes(s.toLowerCase()))
    ) {
      params.set(key, "[REDACTED]");
    }
  }

  return `${path}?${params.toString()}`;
};

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const start = performance.now();

  res.on("finish", () => {
    const duration = (performance.now() - start).toFixed(2);
    const timestamp = new Date().toISOString();
    const safeUrl = sanitizeUrl(req.originalUrl);
    console.log(
      `[${timestamp}] ${req.method} ${safeUrl} ${res.statusCode} - ${duration}ms`,
    );
  });

  next();
};
