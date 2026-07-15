import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./config/auth.js";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { adminRouter } from "./routes/admin.routes.js";
import { campaignRouter } from "./routes/campaign.routes.js";
import { contributionRouter } from "./routes/contribution.routes.js";
import { creatorRouter } from "./routes/creator.routes.js";
import { notificationRouter } from "./routes/notification.routes.js";
import { paymentRouter, stripeWebhookHandler } from "./routes/payment.routes.js";
import { publicRouter } from "./routes/public.routes.js";
import { reportRouter } from "./routes/report.routes.js";
import { uploadRouter } from "./routes/upload.routes.js";
import { userRouter } from "./routes/user.routes.js";

export const app = express();

app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"]
  })
);
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }));

app.all("/api/auth/*", toNodeHandler(auth));
app.post(
  "/api/v1/payments/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

app.use(express.json({ limit: "4mb" }));
app.use(express.urlencoded({ extended: true, limit: "4mb" }));

app.use("/api/v1/campaigns", campaignRouter);
app.use("/api/v1/contributions", contributionRouter);
app.use("/api/v1/creator", creatorRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/payments", paymentRouter);
app.use("/api/v1/notifications", notificationRouter);
app.use("/api/v1/reports", reportRouter);
app.use("/api/v1/uploads", uploadRouter);
app.use("/api/v1", publicRouter);

app.use(notFound);
app.use(errorHandler);
