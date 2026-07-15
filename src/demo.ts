import { randomBytes } from "node:crypto";
import { MongoMemoryReplSet } from "mongodb-memory-server";

async function startDemo() {
  const replicaSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" }
  });

  process.env.NODE_ENV = "development";
  process.env.PORT = process.env.PORT || "5000";
  process.env.MONGODB_URI = replicaSet.getUri();
  process.env.MONGODB_DB_NAME = "crowdspark_demo";
  process.env.CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
  process.env.BETTER_AUTH_URL = process.env.BETTER_AUTH_URL || "http://localhost:5000";
  process.env.BETTER_AUTH_SECRET =
    process.env.BETTER_AUTH_SECRET || "crowdspark_demo_secret_12345678901234567890";
  process.env.DEMO_PAYMENTS = "true";
  process.env.WITHDRAWAL_ENCRYPTION_KEY =
    process.env.WITHDRAWAL_ENCRYPTION_KEY || randomBytes(32).toString("hex");

  const [{ connectDatabase, disconnectDatabase }, { seedData }, { app }] = await Promise.all([
    import("./config/db.js"),
    import("./seed-data.js"),
    import("./app.js")
  ]);

  await connectDatabase();
  await seedData();

  const port = Number(process.env.PORT);
  const server = app.listen(port, () => {
    console.log(`CrowdSpark zero-config demo API: http://localhost:${port}`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await disconnectDatabase();
      await replicaSet.stop();
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startDemo().catch((error) => {
  console.error(error);
  process.exit(1);
});
