import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import dotenv from "dotenv";
import authRouter from "./routes/auth.routes.ts";
import { errorHandler } from "./middlewares/error-handler.middleware.ts";
import { requestLogger } from "./middlewares/logger.middleware.ts";
import { NotFoundError } from "./utils/app-errors.ts";

// 1. Initialize environment variables immediately
dotenv.config();

const app: Express = express();
const port = process.env.PORT || 4000;

// 2. Global Middleware
app.use(express.json());
app.use(requestLogger);

// 3. Base Diagnostic Route
app.get("/", (_req: Request, res: Response) => {
  res.send("Hello World!");
});

// 4. Application Domain Routes
app.use("/api/v1/auth", authRouter);

// 5. Catch-All 404 Handler for Unhandled Routes (Express v5 Native Throw)
app.use((req: Request, _res: Response, _next: NextFunction) => {
  throw new NotFoundError(`Route ${req.originalUrl} not found`);
});

// 6. Global Error Handler (MUST BE THE FINAL MIDDLEWARE)
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
