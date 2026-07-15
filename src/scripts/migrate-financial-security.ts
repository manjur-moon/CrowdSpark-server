import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { encryptSensitiveValue, getLastFourCharacters } from "../utils/encryption.js";

async function migrateWithdrawals(): Promise<number> {
  const collection = mongoose.connection.collection("withdrawals");
  const cursor = collection.find({
    accountReference: { $type: "string" },
    accountReferenceEncrypted: { $exists: false }
  });

  let migrated = 0;
  for await (const document of cursor) {
    const accountReference = String(document.accountReference ?? "").trim();
    if (!accountReference) continue;

    await collection.updateOne(
      { _id: document._id },
      {
        $set: {
          accountReferenceEncrypted: encryptSensitiveValue(accountReference),
          accountReferenceLast4: getLastFourCharacters(accountReference)
        },
        $unset: { accountReference: "" }
      }
    );
    migrated += 1;
  }

  return migrated;
}

async function migrateCampaignBalances(): Promise<number> {
  const result = await mongoose.connection.collection("campaigns").updateMany({}, [
    {
      $set: {
        availableBalanceCredits: {
          $ifNull: ["$availableBalanceCredits", "$raisedCredits"]
        },
        withdrawnCredits: {
          $ifNull: ["$withdrawnCredits", 0]
        }
      }
    }
  ]);

  return result.modifiedCount;
}

async function migrateCreatorLifetimeRaised(): Promise<number> {
  const result = await mongoose.connection
    .collection("userprofiles")
    .updateMany(
      { lifetimeRaisedCredits: { $exists: false } },
      { $set: { lifetimeRaisedCredits: 0 } }
    );

  return result.modifiedCount;
}

async function run(): Promise<void> {
  await connectDatabase();

  const [withdrawals, campaigns, profiles] = await Promise.all([
    migrateWithdrawals(),
    migrateCampaignBalances(),
    migrateCreatorLifetimeRaised()
  ]);

  console.log(
    JSON.stringify(
      {
        message: "Financial security migration completed",
        migratedWithdrawals: withdrawals,
        migratedCampaigns: campaigns,
        migratedProfiles: profiles
      },
      null,
      2
    )
  );

  await disconnectDatabase();
}

run().catch(async (error: unknown) => {
  console.error("Financial security migration failed", error);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
