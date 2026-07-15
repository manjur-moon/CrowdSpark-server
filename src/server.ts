import { app } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/db.js";
import { env } from "./config/env.js";

async function start() {
  await connectDatabase();
  const server = app.listen(env.PORT, () => {
    console.log(`CrowdSpark API: ${env.BETTER_AUTH_URL}`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
