import mongoose from "mongoose";
import { MongoClient } from "mongodb";
import { env } from "./env.js";

export const mongoClient = new MongoClient(env.MONGODB_URI);
export const mongoDb = mongoClient.db(env.MONGODB_DB_NAME);

let connected = false;

export async function connectDatabase(): Promise<void> {
  if (connected) return;
  await Promise.all([
    mongoClient.connect(),
    mongoose.connect(env.MONGODB_URI, { dbName: env.MONGODB_DB_NAME })
  ]);
  connected = true;
  console.log(`MongoDB connected: ${env.MONGODB_DB_NAME}`);
}

export async function disconnectDatabase(): Promise<void> {
  await Promise.allSettled([mongoClient.close(), mongoose.disconnect()]);
  connected = false;
}
