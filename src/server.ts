import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { AppleAdsApiError, AppleAdsClient, type AppleAdsGateway } from "./apple/client.js";
import { AppleTokenProvider } from "./apple/oauth.js";
import { MockAppleAdsGateway } from "./apple/mock.js";
import { assertAppleCredentials, loadConfig } from "./config.js";

export function createApp(gateway: AppleAdsGateway) {
  const app = express();
  const publicDir = join(dirname(fileURLToPath(import.meta.url)), "../public");
  app.use(express.static(publicDir));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.get("/api/accounts", asyncRoute(async (_req, res) => res.json({ data: await gateway.accounts() })));
  app.get("/api/campaigns", asyncRoute(async (req, res) => res.json({ data: await gateway.campaigns(queryOrg(req.query.orgId)) })));
  app.get("/api/campaigns/:campaignId/adgroups", asyncRoute(async (req, res) => res.json({ data: await gateway.adGroups(requiredParam(req.params.campaignId), queryOrg(req.query.orgId)) })));
  app.get("/api/campaigns/:campaignId/keywords", asyncRoute(async (req, res) => res.json({ data: await gateway.keywords(requiredParam(req.params.campaignId), queryOrg(req.query.orgId)) })));
  app.get("/api/reports/campaigns", asyncRoute(async (req, res) => {
    const end = date(req.query.end, new Date());
    const startDefault = new Date(`${end}T00:00:00.000Z`); startDefault.setUTCDate(startDefault.getUTCDate() - 29);
    const start = date(req.query.start, startDefault);
    if (start > end) throw new Error("start date must be before or equal to end date");
    res.json({ data: await gateway.campaignReport(start, end, queryOrg(req.query.orgId)), range: { start, end } });
  }));

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = error instanceof AppleAdsApiError ? error.status : 400;
    const message = error instanceof Error ? error.message : "Unexpected error";
    res.status(status >= 400 && status < 600 ? status : 500).json({ error: message });
  });
  return app;
}

function asyncRoute(handler: (req: express.Request, res: express.Response) => Promise<unknown>) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => { handler(req, res).catch(next); };
}

function requiredParam(value: string | string[] | undefined): string {
  if (typeof value !== "string") throw new Error("Missing campaignId");
  return value;
}

function queryOrg(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new Error("orgId must be numeric");
  return value;
}

function date(value: unknown, fallback: Date): string {
  if (value === undefined) return fallback.toISOString().slice(0, 10);
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) throw new Error("Dates must use YYYY-MM-DD");
  return value;
}

if (process.env.NODE_ENV !== "test") {
  const config = loadConfig();
  let gateway: AppleAdsGateway;
  if (config.mock) {
    gateway = new MockAppleAdsGateway();
  } else {
    assertAppleCredentials(config);
    gateway = new AppleAdsClient(new AppleTokenProvider(config), config.orgId);
  }
  createApp(gateway).listen(config.port, () => {
    console.log(`Apple Ads dashboard: http://localhost:${config.port} (${config.mock ? "mock" : "live"})`);
  });
}
