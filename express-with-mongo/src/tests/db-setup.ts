import { beforeAll, afterEach, afterAll } from "@jest/globals";
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../config/db.ts";

beforeAll(async () => {
  await connectDB();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key]!.deleteMany({});
  }
});

afterAll(async () => {
  await disconnectDB();
});
