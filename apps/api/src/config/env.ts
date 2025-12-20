import { z } from "zod";

const ZEnv = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  DATABASE_URL: z.string().min(1),

  // Auth
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).default(60 * 60), // 1h
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().min(1).default(30),

  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PLATFORM_FEE_BPS: z.coerce.number().int().min(0).max(5000).default(500), // 5%

  // Payout policy
  PAYOUT_DELAY_HOURS: z.coerce.number().int().min(0).max(24 * 30).default(24), // 24h buffer

  // App URLs (used for Stripe Connect redirect + deep links)
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),

  // Admin (MVP)
  ADMIN_API_KEY: z.string().min(16).optional(),

  // Uploads (placeholder – wire later)
  UPLOAD_PROVIDER: z.enum(["mock", "s3", "r2"]).default("mock"),
  UPLOAD_PUBLIC_BASE_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof ZEnv>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = ZEnv.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables. Check server logs.");
  }
  cached = parsed.data;
  return cached;
}
