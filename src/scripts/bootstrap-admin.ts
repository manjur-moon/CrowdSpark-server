import { ObjectId } from "mongodb";

import { auth } from "../config/auth.js";
import {
  connectDatabase,
  disconnectDatabase,
  mongoDb
} from "../config/db.js";
import { UserProfile } from "../models/UserProfile.js";

/**
 * Required environment variable পড়ে এবং নিশ্চিতভাবে string return করে।
 */
function getRequiredEnvironmentVariable(
  variableName: string
): string {
  const value =
    process.env[variableName]?.trim();

  if (!value) {
    throw new Error(
      `${variableName} is required`
    );
  }

  return value;
}

const adminEmail = getRequiredEnvironmentVariable(
  "BOOTSTRAP_ADMIN_EMAIL"
).toLowerCase();

const adminName =
  process.env.BOOTSTRAP_ADMIN_NAME?.trim() ||
  "CrowdSpark Admin";

const adminPassword =
  process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim();

async function bootstrapAdmin(): Promise<void> {
  await connectDatabase();

  const authUsers =
    mongoDb.collection("user");

  const existingAuthUser =
    await authUsers.findOne({
      email: adminEmail
    });

  let authUserId: string;

  if (existingAuthUser) {
    authUserId = String(
      existingAuthUser.id ??
        existingAuthUser._id
    );

    console.log(
      "Existing Better Auth user found."
    );
  } else {
    if (
      !adminPassword ||
      adminPassword.length < 12
    ) {
      throw new Error(
        "BOOTSTRAP_ADMIN_PASSWORD must contain at least 12 characters when creating a new admin account"
      );
    }

    const signUpResult =
      await auth.api.signUpEmail({
        body: {
          name: adminName,
          email: adminEmail,
          password: adminPassword
        }
      });

    authUserId =
      signUpResult.user.id;

    console.log(
      "New Better Auth user created."
    );
  }

  const existingProfile =
    await UserProfile.findOne({
      authUserId
    });

  const profile = existingProfile
    ? await updateExistingAdminProfile(
        existingProfile
      )
    : await createAdminProfile(
        authUserId
      );

  await revokeExistingSessions(
    authUserId
  );

  console.log(
    "Admin account configured successfully."
  );

  console.table([
    {
      name: profile.name,
      email: profile.email,
      role: profile.role,
      status: profile.status,
      profileId:
        profile._id.toString()
    }
  ]);
}

async function updateExistingAdminProfile(
  existingProfile: InstanceType<
    typeof UserProfile
  >
) {
  existingProfile.name =
    adminName;

  existingProfile.email =
    adminEmail;

  existingProfile.role =
    "admin";

  existingProfile.status =
    "active";

  existingProfile.onboardingCompleted =
    true;

  existingProfile.authVersion =
    (existingProfile.authVersion ?? 0) + 1;

  return existingProfile.save();
}

async function createAdminProfile(
  authUserId: string
) {
  return UserProfile.create({
    authUserId,
    name: adminName,
    email: adminEmail,
    image: null,
    role: "admin",
    status: "active",
    onboardingCompleted: true,
    authVersion: 1,
    credits: 0,
    creatorBalance: 0,
    reservedCreatorCredits: 0,
    lifetimeRaisedCredits: 0
  });
}

async function revokeExistingSessions(
  authUserId: string
): Promise<void> {
  const possibleUserIds: Array<
    string | ObjectId
  > = [authUserId];

  if (ObjectId.isValid(authUserId)) {
    possibleUserIds.push(
      new ObjectId(authUserId)
    );
  }

  const result = await mongoDb
    .collection("session")
    .deleteMany({
      userId: {
        $in: possibleUserIds
      }
    });

  console.log(
    `${result.deletedCount} existing session(s) revoked.`
  );
}

bootstrapAdmin()
  .catch((error: unknown) => {
    console.error(
      "Admin bootstrap failed:",
      error
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });