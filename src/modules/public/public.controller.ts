import type { Request, Response } from "express";
import {
  createContactMessage,
  getCampaignUpdates,
  getCategories,
  getPublicCampaign,
  getPublicStats,
  listPublicCampaigns
} from "./public.service.js";

export function health(_req: Request, res: Response) {
  res.json({
    success: true,
    message: "CrowdSpark API is healthy",
    data: { status: "ok", timestamp: new Date().toISOString() }
  });
}

export async function stats(_req: Request, res: Response) {
  res.json({ success: true, data: await getPublicStats() });
}

export async function categories(_req: Request, res: Response) {
  res.json({ success: true, data: await getCategories() });
}

export async function campaigns(req: Request, res: Response) {
  const result = await listPublicCampaigns(req.query as Record<string, unknown>);
  res.json({ success: true, ...result });
}

export async function campaign(req: Request, res: Response) {
  res.json({ success: true, data: await getPublicCampaign(String(req.params.campaignId)) });
}

export async function updates(req: Request, res: Response) {
  res.json({ success: true, data: await getCampaignUpdates(String(req.params.campaignId)) });
}

export async function contact(req: Request, res: Response) {
  await createContactMessage(req.body);
  res.status(201).json({ success: true, message: "Message received" });
}
