import { auth } from "./config/auth.js";
import { mongoDb } from "./config/db.js";
import { Campaign } from "./models/Campaign.js";
import { CampaignUpdate } from "./models/CampaignUpdate.js";
import { Contribution } from "./models/Contribution.js";
import { Notification } from "./models/Notification.js";
import { Payment } from "./models/Payment.js";
import { ProcessedStripeEvent } from "./models/ProcessedStripeEvent.js";
import { Report } from "./models/Report.js";
import { UserProfile } from "./models/UserProfile.js";
import { WalletTransaction } from "./models/WalletTransaction.js";
import { Withdrawal } from "./models/Withdrawal.js";

type SeedRole = "supporter" | "creator" | "admin";

const users = [
  {
    name: "CrowdSpark Admin",
    email: "admin@crowdspark.demo",
    password: "Admin12345",
    role: "admin" as SeedRole,
    credits: 0
  },
  {
    name: "Demo Creator",
    email: "creator@crowdspark.demo",
    password: "Creator12345",
    role: "creator" as SeedRole,
    credits: 20
  },
  {
    name: "Demo Supporter",
    email: "supporter@crowdspark.demo",
    password: "Supporter12345",
    role: "supporter" as SeedRole,
    credits: 1200
  }
];

async function ensureAuthUser(input: (typeof users)[number]) {
  const authCollection = mongoDb.collection("user");
  const existingAuthUser = await authCollection.findOne({ email: input.email });
  let authUserId: string;
  if (existingAuthUser) {
    authUserId = String(existingAuthUser.id ?? existingAuthUser._id);
  } else {
    const result = await auth.api.signUpEmail({
      body: { name: input.name, email: input.email, password: input.password }
    });
    authUserId = result.user.id;
  }
  const profile = await UserProfile.findOneAndUpdate(
    { authUserId },
    {
      $set: {
        name: input.name,
        email: input.email,
        role: input.role,
        status: "active",
        onboardingCompleted: true,
        image: null
      },
      $setOnInsert: {
        credits: input.credits,
        creatorBalance: input.role === "creator" ? 640 : 0,
        reservedCreatorCredits: 0,
        lifetimeRaisedCredits: 0
      }
    },
    { new: true, upsert: true, runValidators: true }
  );
  return profile;
}

export async function seedData() {
  const [admin, creator, supporter] = await Promise.all(users.map(ensureAuthUser));
  if (!admin || !creator || !supporter) throw new Error("Could not create demo profiles");

  await Promise.all([
    CampaignUpdate.deleteMany({}),
    Contribution.deleteMany({}),
    Notification.deleteMany({}),
    Payment.deleteMany({}),
    ProcessedStripeEvent.deleteMany({}),
    Report.deleteMany({}),
    WalletTransaction.deleteMany({}),
    Withdrawal.deleteMany({}),
    Campaign.deleteMany({})
  ]);

  const campaigns = await Campaign.insertMany([
    {
      creatorId: creator._id,
      creatorName: creator.name,
      creatorEmail: creator.email,
      title: "Solar Water Pumps for Rural Communities",
      story:
        "We are installing solar-powered water pumps in communities where families currently walk several kilometres for safe water. Funding covers equipment, local installation training, maintenance kits and transparent progress reporting.",
      description:
        "Bring dependable clean water to three rural communities using solar-powered pumps.",
      category: "Community",
      goalCredits: 12000,
      minimumContribution: 20,
      raisedCredits: 4250,
      availableBalanceCredits: 4250,
      withdrawnCredits: 0,
      deadline: new Date(Date.now() + 45 * 86400000),
      rewardInfo: "Supporters receive monthly progress updates and a digital impact report.",
      coverImageUrl:
        "https://images.unsplash.com/photo-1542810634-71277d95dcbb?auto=format&fit=crop&w=1400&q=80",
      gallery: [
        "https://images.unsplash.com/photo-1594398901394-4e34939a4fd0?auto=format&fit=crop&w=1200&q=80"
      ],
      location: "South Asia",
      status: "approved",
      submittedAt: new Date(Date.now() - 20 * 86400000),
      reviewedAt: new Date(Date.now() - 18 * 86400000)
    },
    {
      creatorId: creator._id,
      creatorName: creator.name,
      creatorEmail: creator.email,
      title: "Mobile Science Lab for Students",
      story:
        "A travelling science lab will give hands-on physics, chemistry and robotics lessons to schools without laboratory facilities. The project includes safe equipment, trained facilitators and a twelve-month route plan.",
      description:
        "A mobile laboratory that brings practical STEM education to underserved schools.",
      category: "Education",
      goalCredits: 18000,
      minimumContribution: 25,
      raisedCredits: 7900,
      availableBalanceCredits: 7900,
      withdrawnCredits: 0,
      deadline: new Date(Date.now() + 65 * 86400000),
      rewardInfo: "Supporters receive classroom stories and an annual learning-outcome summary.",
      coverImageUrl:
        "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1400&q=80",
      gallery: [],
      location: "Bangladesh",
      status: "approved",
      submittedAt: new Date(Date.now() - 14 * 86400000),
      reviewedAt: new Date(Date.now() - 12 * 86400000)
    },
    {
      creatorId: creator._id,
      creatorName: creator.name,
      creatorEmail: creator.email,
      title: "Community Mental Health Support Hub",
      story:
        "This campaign will create a community-led mental health support hub with trained counsellors, confidential sessions and educational workshops. Funds cover venue setup, safeguarding and subsidised care.",
      description: "Accessible counselling and mental-health education for young adults.",
      category: "Health",
      goalCredits: 15000,
      minimumContribution: 10,
      raisedCredits: 0,
      availableBalanceCredits: 0,
      withdrawnCredits: 0,
      deadline: new Date(Date.now() + 80 * 86400000),
      rewardInfo: "Supporters receive anonymised impact updates.",
      coverImageUrl:
        "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1400&q=80",
      gallery: [],
      location: "Dhaka",
      status: "pending",
      submittedAt: new Date(),
      reviewedAt: null
    }
  ]);

  const approvedCampaign = campaigns[0];
  if (!approvedCampaign) throw new Error("Seed campaign missing");

  await CampaignUpdate.create({
    campaignId: approvedCampaign._id,
    creatorId: creator._id,
    title: "Site assessment completed",
    content:
      "Local engineers completed the water-table and solar exposure assessment. Procurement can begin after the next funding milestone."
  });

  const contribution = await Contribution.create({
    campaignId: approvedCampaign._id,
    campaignTitle: approvedCampaign.title,
    supporterId: supporter._id,
    supporterName: supporter.name,
    supporterEmail: supporter.email,
    creatorId: creator._id,
    creatorName: creator.name,
    creatorEmail: creator.email,
    credits: 150,
    message: "Wishing the project success.",
    status: "pending",
    idempotencyKey: "seed-contribution"
  });

  await Notification.create({
    userId: creator._id,
    type: "contribution_received",
    title: "New contribution",
    message: `${supporter.name} contributed 150 credits to ${approvedCampaign.title}`,
    actionUrl: "/dashboard/creator/contributions",
    metadata: { contributionId: contribution._id.toString() }
  });

  console.log("Seed complete");
  console.table(users.map(({ email, password, role }) => ({ role, email, password })));
}
