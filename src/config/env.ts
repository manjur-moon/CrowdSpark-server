import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1),
  MONGODB_DB_NAME: z.string().default("crowdspark"),
  CLIENT_URL: z.string().url().default("http://localhost:5173"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:5000"),
  BETTER_AUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  STRIPE_SECRET_KEY: z.string().optional().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(""),
  DEMO_PAYMENTS: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  IMGBB_API_KEY: z.string().optional().default(""),
  WITHDRAWAL_ENCRYPTION_KEY: z
    .string()
    .regex(/^[a-fA-F0-9]{64}$/, "WITHDRAWAL_ENCRYPTION_KEY must be 64 hexadecimal characters")
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;
