import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  API_PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().url().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  SWAGGER_ENABLED: z.enum(["true", "false"]).optional(),
  JWT_ACCESS_SECRET: z.string().min(24),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().default(30),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  DEMO_TEACHER_PASSWORD: z.string().min(8).optional(),
  DEMO_STUDENT_PASSWORD: z.string().min(8).optional()
});

export function validateEnv(config: Record<string, unknown>) {
  const parsed = envSchema.parse(config);
  if (parsed.NODE_ENV === "production" && parsed.SWAGGER_ENABLED === "true") {
    console.warn("SWAGGER_ENABLED=true in production — disable unless you protect /docs");
  }
  return parsed;
}
