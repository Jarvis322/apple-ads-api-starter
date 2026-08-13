import "dotenv/config";
import { readFileSync } from "node:fs";
import { z } from "zod";

const schema = z.object({
  APPLE_ADS_CLIENT_ID: z.string().min(1).optional(),
  APPLE_ADS_TEAM_ID: z.string().min(1).optional(),
  APPLE_ADS_KEY_ID: z.string().min(1).optional(),
  APPLE_ADS_PRIVATE_KEY: z.string().min(1).optional(),
  APPLE_ADS_PRIVATE_KEY_PATH: z.string().min(1).optional(),
  APPLE_ADS_ORG_ID: z.string().regex(/^\d+$/).optional(),
  APPLE_ADS_MOCK: z.enum(["true", "false"]).default("false"),
  APPLE_ADS_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(15_000),
  APPLE_ADS_RETRY_ATTEMPTS: z.coerce.number().int().min(1).max(8).default(4),
  DASHBOARD_AUTH_USER: z.string().min(1).optional(),
  DASHBOARD_AUTH_PASSWORD: z.string().min(12).optional(),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000)
});

export type AppConfig = {
  clientId?: string;
  teamId?: string;
  keyId?: string;
  privateKey?: string;
  orgId?: string;
  mock: boolean;
  timeoutMs: number;
  retryAttempts: number;
  dashboardAuth?: { user: string; password: string };
  port: number;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const value = schema.parse(env);
  let privateKey = value.APPLE_ADS_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!privateKey && value.APPLE_ADS_PRIVATE_KEY_PATH) {
    privateKey = readFileSync(value.APPLE_ADS_PRIVATE_KEY_PATH, "utf8");
  }

  if (Boolean(value.DASHBOARD_AUTH_USER) !== Boolean(value.DASHBOARD_AUTH_PASSWORD)) {
    throw new Error("DASHBOARD_AUTH_USER and DASHBOARD_AUTH_PASSWORD must be configured together");
  }

  return {
    clientId: value.APPLE_ADS_CLIENT_ID,
    teamId: value.APPLE_ADS_TEAM_ID,
    keyId: value.APPLE_ADS_KEY_ID,
    privateKey,
    orgId: value.APPLE_ADS_ORG_ID,
    mock: value.APPLE_ADS_MOCK === "true",
    timeoutMs: value.APPLE_ADS_TIMEOUT_MS,
    retryAttempts: value.APPLE_ADS_RETRY_ATTEMPTS,
    dashboardAuth:
      value.DASHBOARD_AUTH_USER && value.DASHBOARD_AUTH_PASSWORD
        ? { user: value.DASHBOARD_AUTH_USER, password: value.DASHBOARD_AUTH_PASSWORD }
        : undefined,
    port: value.PORT
  };
}

export function assertAppleCredentials(config: AppConfig): asserts config is AppConfig & {
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
} {
  const missing = [
    ["APPLE_ADS_CLIENT_ID", config.clientId],
    ["APPLE_ADS_TEAM_ID", config.teamId],
    ["APPLE_ADS_KEY_ID", config.keyId],
    ["APPLE_ADS_PRIVATE_KEY or APPLE_ADS_PRIVATE_KEY_PATH", config.privateKey]
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length) {
    throw new Error(`Missing Apple Ads configuration: ${missing.join(", ")}`);
  }
}
