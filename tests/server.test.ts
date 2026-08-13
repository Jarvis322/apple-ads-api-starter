import request from "supertest";
import { describe, expect, it } from "vitest";
import { AppleAdsApiError, type AppleAdsGateway } from "../src/apple/client.js";
import { createApp } from "../src/server.js";

function gateway(overrides: Partial<AppleAdsGateway> = {}): AppleAdsGateway {
  return {
    accounts: async () => [],
    campaigns: async () => [],
    adGroups: async () => [],
    keywords: async () => [],
    campaignReport: async () => [],
    adGroupReport: async () => [],
    keywordReport: async () => [],
    searchTermReport: async () => [],
    ...overrides
  };
}

const silentLogger = { error: () => undefined };

describe("HTTP server", () => {
  it("keeps health public and protects the dashboard when auth is configured", async () => {
    const app = createApp(gateway(), {
      auth: { user: "admin", password: "long-test-password" },
      logger: silentLogger
    });

    await request(app).get("/api/health").expect(200, { ok: true });
    await request(app).get("/api/campaigns").expect(401);
    await request(app).get("/api/campaigns").auth("admin", "long-test-password").expect(200, { data: [] });
  });

  it("validates identifiers and date ranges", async () => {
    const app = createApp(gateway(), { logger: silentLogger });

    await request(app).get("/api/campaigns/not-a-number/adgroups").expect(400);
    await request(app).get("/api/reports/campaigns?start=2026-08-13&end=2026-08-01").expect(400);
  });

  it("exposes keyword report data without exposing upstream error bodies", async () => {
    const good = createApp(
      gateway({ keywordReport: async () => [{ metadata: { keyword: "tracker" }, total: { taps: 4 } }] }),
      { logger: silentLogger }
    );
    const response = await request(good)
      .get("/api/campaigns/123/reports/keywords?start=2026-08-01&end=2026-08-13")
      .expect(200);
    expect(response.body.data[0].metadata.keyword).toBe("tracker");

    const bad = createApp(
      gateway({
        campaigns: async () => Promise.reject(new AppleAdsApiError(403, "sensitive upstream body", "req-1"))
      }),
      { logger: silentLogger }
    );
    const error = await request(bad).get("/api/campaigns").expect(403);
    expect(error.body.error).toContain("req-1");
    expect(error.body.error).not.toContain("sensitive upstream body");
  });
});
