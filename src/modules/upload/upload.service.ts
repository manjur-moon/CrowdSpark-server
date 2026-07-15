import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";

export async function uploadImage(file: Express.Multer.File) {
  if (!env.IMGBB_API_KEY) {
    return {
      url: `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
      provider: "demo" as const
    };
  }

  const form = new FormData();
  form.set("image", file.buffer.toString("base64"));
  const response = await fetch(
    `https://api.imgbb.com/1/upload?key=${encodeURIComponent(env.IMGBB_API_KEY)}`,
    { method: "POST", body: form }
  );
  const result = (await response.json()) as {
    success?: boolean;
    data?: { url?: string };
    error?: { message?: string };
  };

  if (!response.ok || !result.success || !result.data?.url) {
    throw new AppError(502, "IMAGE_UPLOAD_FAILED", result.error?.message ?? "ImgBB upload failed");
  }
  return { url: result.data.url, provider: "imgbb" as const };
}
