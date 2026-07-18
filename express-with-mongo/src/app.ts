import express, { type Express, type Request, type Response } from "express";
import authRouter from "./routes/auth.routes.ts";
import { errorHandler } from "./middlewares/error-handler.middleware.ts";
import { requestLogger } from "./middlewares/logger.middleware.ts";
import { NotFoundError } from "./utils/app-errors.ts";

const app: Express = express();
const port = 4000;

// 1. Global Middleware
app.use(express.json());
app.use(requestLogger);

// 2. Base Diagnostic Route
app.get("/", (_req: Request, res: Response) => {
  res.send("Hello World!");
});

// 3. Application Domain Routes
app.use("/api/v1/auth", authRouter);

// To use the requireAuth Check
// router.get("/tasks", requireAuth, getTasks);

// 4. Catch-All 404 Handler for Unhandled Routes (Express v5 Native Throw)
app.use((req: Request, _res: Response) => {
  throw new NotFoundError(`Route ${req.originalUrl} not found`);
});

// 5. Global Error Handler (MUST BE THE FINAL MIDDLEWARE)
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
