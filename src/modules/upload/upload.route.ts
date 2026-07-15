import { Router } from "express";
import multer from "multer";
import { requireAuth, requireSession } from "../../middleware/auth.js";
import { AppError } from "../../utils/AppError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./upload.controller.js";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from "./upload.validation.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype as (typeof ALLOWED_IMAGE_TYPES)[number])) {
      callback(
        new AppError(422, "INVALID_IMAGE_TYPE", "Only JPEG, PNG and WebP images are allowed")
      );
      return;
    }
    callback(null, true);
  }
});

export const uploadRouter = Router();
uploadRouter.use(requireSession, requireAuth);
uploadRouter.post("/images", upload.single("image"), asyncHandler(controller.image));
