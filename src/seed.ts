import { connectDatabase, disconnectDatabase } from "./config/db.js";
import { seedData } from "./seed-data.js";

async function run() {
  await connectDatabase();
  await seedData();
  await disconnectDatabase();
}

run().catch(async (error) => {
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});
