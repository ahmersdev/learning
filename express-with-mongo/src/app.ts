import "dotenv/config";

import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import cors from "cors";

import authRouter from "./routes/auth.routes.ts";
import { errorHandler } from "./middlewares/error-handler.middleware.ts";
import { requestLogger } from "./middlewares/logger.middleware.ts";
import { generalLimiter } from "./middlewares/rate-limiter.middleware.ts";
import { NotFoundError } from "./utils/app-errors.ts";

const allowedOrigins = [
  "http://localhost:3000", // your React/Next frontend dev URL
  "http://localhost:5173", // if using Vite
];

const app: Express = express();
const port = process.env.PORT || 4000;

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
app.use(express.json());
app.use(cookieParser());

// 4. Logging + rate limiting
app.use(requestLogger);
app.use(generalLimiter);

// 5. Base Diagnostic Route
app.get("/", (_req: Request, res: Response) => {
  res.send("Hello World!");
});

// 6. Application Domain Routes
app.use("/api/v1/auth", authRouter);

// 7. Catch-All 404 Handler for Unhandled Routes (Express v5 Native Throw)
app.use((req: Request, _res: Response, _next: NextFunction) => {
  throw new NotFoundError(`Route ${req.originalUrl} not found`);
});

// 8. Global Error Handler (MUST BE THE FINAL MIDDLEWARE)
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
