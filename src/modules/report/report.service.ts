import type { Types } from "mongoose";
import { Campaign } from "../../models/Campaign.js";
import { Report } from "../../models/Report.js";
import { AppError } from "../../utils/AppError.js";
import type { CreateReportInput } from "./report.validation.js";

export async function createCampaignReport(
  reporter: { id: Types.ObjectId; name: string; email: string },
  input: CreateReportInput
) {
  const campaign = await Campaign.findById(input.campaignId);
  if (!campaign) throw new AppError(404, "CAMPAIGN_NOT_FOUND", "Campaign not found");

  const existing = await Report.findOne({
    reporterId: reporter.id,
    campaignId: campaign._id,
    status: "pending"
  });
  if (existing) {
    throw new AppError(
      409,
      "REPORT_ALREADY_EXISTS",
      "You already have a pending report for this campaign"
    );
  }

  return Report.create({
    reporterId: reporter.id,
    reporterName: reporter.name,
    reporterEmail: reporter.email,
    campaignId: campaign._id,
    campaignTitle: campaign.title,
    reason: input.reason,
    description: input.description ?? null
  });
}
