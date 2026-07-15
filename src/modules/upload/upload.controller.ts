import type { Request, Response } from "express";
import { AppError } from "../../utils/AppError.js";
import { uploadImage } from "./upload.service.js";

export async function image(req: Request, res: Response) {
  if (!req.file) throw new AppError(422, "IMAGE_REQUIRED", "Select an image to upload");
  const data = await uploadImage(req.file);
  res.status(201).json({
    success: true,
    message: data.provider === "demo" ? "Image stored in demo data URL mode" : "Image uploaded",
    data
  });
}
