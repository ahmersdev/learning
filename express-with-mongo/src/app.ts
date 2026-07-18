import "dotenv/config";

import express, {
  Router,
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import cors from "cors";

import authRouter from "./routes/auth.routes.ts";
import userRouter from "./routes/user.routes.ts";
import { errorHandler } from "./middlewares/error-handler.middleware.ts";
import { requestLogger } from "./middlewares/logger.middleware.ts";
import { generalLimiter } from "./middlewares/rate-limiter.middleware.ts";
import { NotFoundError } from "./utils/app-errors.ts";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./config/swagger.ts";

const allowedOrigins = [
  "http://localhost:3000", // your React/Next frontend dev URL
  "http://localhost:5173", // if using Vite
  "http://localhost:4000", // For Swagger UI
];

const app: Express = express();

// Trust the first proxy hop (needed for correct req.ip / rate-limiting behind
// a reverse proxy or hosting platform like Heroku/Render/Nginx in prod)
app.set("trust proxy", 1);

// 1. Security headers — first, always
app.use(helmet());

// 2. CORS — before body parsing, before rate limiting, before routes
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // REQUIRED for cookies (refresh token) to be sent cross-origin
  }),
);

// 3. Body parsing
app.use(express.json({ limit: "10kb" })); // cap payload size to prevent abuse
app.use(cookieParser());

// 4. Logging + rate limiting
app.use(requestLogger);
app.use(generalLimiter);

// 5. Base Diagnostic Route
app.get("/", (_req: Request, res: Response) => {
  res.send("Hello World!");
});

// 6. Application Domain Routes — all mounted under one versioned API prefix
const apiRouter = Router();
apiRouter.use("/auth", authRouter);
apiRouter.use("/user", userRouter);

app.use("/api/v1", apiRouter);

// API Docs — dev/staging only, never exposed in production
if (process.env.NODE_ENV !== "production") {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// 7. Catch-All 404 Handler for Unhandled Routes (Express v5 Native Throw)
app.use((req: Request, _res: Response, _next: NextFunction) => {
  throw new NotFoundError(`Route ${req.originalUrl} not found`);
});

// 8. Global Error Handler (MUST BE THE FINAL MIDDLEWARE)
app.use(errorHandler);

export default app;
