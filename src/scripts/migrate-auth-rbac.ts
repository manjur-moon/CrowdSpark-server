import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { Campaign } from "../models/Campaign.js";
import { UserProfile } from "../models/UserProfile.js";

async function run() {
  await connectDatabase();

  const [profiles, campaigns] = await Promise.all([
    UserProfile.updateMany(
      { $or: [{ authVersion: { $exists: false } }, { authVersion: { $lt: 1 } }] },
      { $set: { authVersion: 1 } }
    ),
    Campaign.updateMany(
      { moderationReason: { $exists: false } },
      { $set: { moderationReason: null, suspendedAt: null } }
    )
  ]);

  console.log(`Profiles migrated: ${profiles.modifiedCount}`);
  console.log(`Campaigns migrated: ${campaigns.modifiedCount}`);
  await disconnectDatabase();
}

run().catch(async (error) => {
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});
