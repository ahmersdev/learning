import app from "./app.ts";
import { connectDB, disconnectDB } from "./config/db.ts";

const port = process.env.PORT || 4000;

const startServer = async () => {
  await connectDB();

  const server = app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`${signal} received, shutting down gracefully`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

startServer();
