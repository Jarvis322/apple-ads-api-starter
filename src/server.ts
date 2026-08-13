import { timingSafeEqual } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { AppleAdsApiError, AppleAdsClient, type AppleAdsGateway } from "./apple/client.js";
import { MockAppleAdsGateway } from "./apple/mock.js";
import { AppleTokenProvider } from "./apple/oauth.js";
import { assertAppleCredentials, loadConfig } from "./config.js";

type AppOptions = {
  auth?: { user: string; password: string };
  logger?: Pick<Console, "error">;
};

export function createApp(gateway: AppleAdsGateway, options: AppOptions = {}) {
  const app = express();
  const logger = options.logger ?? console;
  const publicDir = join(dirname(fileURLToPath(import.meta.url)), "../public");

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: "draft-8",
      legacyHeaders: false
    })
  );
  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  if (options.auth) app.use(basicAuth(options.auth));
  app.use(express.static(publicDir));
  app.use("/api", (_req, res, next) => {
    res.setHeader("cache-control", "no-store");
    next();
  });

  app.get(
    "/api/accounts",
    asyncRoute(async (_req, res) => res.json({ data: await gateway.accounts() }))
  );
  app.get(
    "/api/campaigns",
    asyncRoute(async (req, res) => res.json({ data: await gateway.campaigns(queryOrg(req.query.orgId)) }))
  );
  app.get(
    "/api/campaigns/:campaignId/adgroups",
    asyncRoute(async (req, res) =>
      res.json({
        data: await gateway.adGroups(requiredParam(req.params.campaignId), queryOrg(req.query.orgId))
      })
    )
  );
  app.get(
    "/api/campaigns/:campaignId/keywords",
    asyncRoute(async (req, res) =>
      res.json({
        data: await gateway.keywords(requiredParam(req.params.campaignId), queryOrg(req.query.orgId))
      })
    )
  );
  app.get(
    "/api/reports/campaigns",
    asyncRoute(async (req, res) => {
      const range = reportRange(req);
      res.json({
        data: await gateway.campaignReport(range.start, range.end, queryOrg(req.query.orgId)),
        range
      });
    })
  );
  app.get(
    "/api/campaigns/:campaignId/reports/adgroups",
    reportRoute((gateway, campaignId, start, end, orgId) =>
      gateway.adGroupReport(campaignId, start, end, orgId)
    )
  );
  app.get(
    "/api/campaigns/:campaignId/reports/keywords",
    reportRoute((gateway, campaignId, start, end, orgId) =>
      gateway.keywordReport(campaignId, start, end, orgId)
    )
  );
  app.get(
    "/api/campaigns/:campaignId/reports/searchterms",
    reportRoute((gateway, campaignId, start, end, orgId) =>
      gateway.searchTermReport(campaignId, start, end, orgId)
    )
  );

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error(error);
    if (error instanceof AppleAdsApiError) {
      const requestId = error.requestId ? ` Request ID: ${error.requestId}.` : "";
      res.status(error.status).json({ error: `Apple Ads request failed.${requestId}` });
      return;
    }
    const message = error instanceof Error ? error.message : "Unexpected error";
    res.status(400).json({ error: message });
  });

  return app;

  function reportRoute(
    report: (
      gateway: AppleAdsGateway,
      campaignId: string,
      start: string,
      end: string,
      orgId?: string
    ) => Promise<unknown>
  ) {
    return asyncRoute(async (req, res) => {
      const range = reportRange(req);
      const campaignId = requiredParam(req.params.campaignId);
      res.json({
        data: await report(gateway, campaignId, range.start, range.end, queryOrg(req.query.orgId)),
        range
      });
    });
  }
}

function basicAuth(credentials: { user: string; password: string }): express.RequestHandler {
  return (req, res, next) => {
    const authorization = req.headers.authorization;
    if (authorization?.startsWith("Basic ")) {
      const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
      const separator = decoded.indexOf(":");
      if (separator >= 0) {
        const userMatches = constantTimeEqual(decoded.slice(0, separator), credentials.user);
        const passwordMatches = constantTimeEqual(decoded.slice(separator + 1), credentials.password);
        if (userMatches && passwordMatches) {
          next();
          return;
        }
      }
    }
    res.setHeader("www-authenticate", 'Basic realm="Apple Ads Dashboard", charset="UTF-8"');
    res.status(401).json({ error: "Authentication required" });
  };
}

function constantTimeEqual(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  const size = Math.max(actualBytes.length, expectedBytes.length, 1);
  const paddedActual = Buffer.alloc(size);
  const paddedExpected = Buffer.alloc(size);
  actualBytes.copy(paddedActual);
  expectedBytes.copy(paddedExpected);
  return timingSafeEqual(paddedActual, paddedExpected) && actualBytes.length === expectedBytes.length;
}

function asyncRoute(handler: (req: express.Request, res: express.Response) => Promise<unknown>) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    handler(req, res).catch(next);
  };
}

function requiredParam(value: string | string[] | undefined): string {
  if (typeof value !== "string") throw new Error("Missing campaignId");
  if (!/^\d+$/.test(value)) throw new Error("campaignId must be numeric");
  return value;
}

function queryOrg(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new Error("orgId must be numeric");
  return value;
}

function reportRange(req: express.Request): { start: string; end: string } {
  const end = date(req.query.end, new Date());
  const startDefault = new Date(`${end}T00:00:00.000Z`);
  startDefault.setUTCDate(startDefault.getUTCDate() - 29);
  const start = date(req.query.start, startDefault);
  if (start > end) throw new Error("start date must be before or equal to end date");
  return { start, end };
}

function date(value: unknown, fallback: Date): string {
  if (value === undefined) return fallback.toISOString().slice(0, 10);
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  ) {
    throw new Error("Dates must use YYYY-MM-DD");
  }
  return value;
}

if (process.env.NODE_ENV !== "test") {
  const config = loadConfig();
  let gateway: AppleAdsGateway;
  if (config.mock) {
    gateway = new MockAppleAdsGateway();
  } else {
    assertAppleCredentials(config);
    gateway = new AppleAdsClient(new AppleTokenProvider(config), config.orgId, fetch, {
      maxAttempts: config.retryAttempts,
      timeoutMs: config.timeoutMs
    });
  }
  createApp(gateway, { auth: config.dashboardAuth }).listen(config.port, () => {
    console.log(`Apple Ads dashboard: http://localhost:${config.port} (${config.mock ? "mock" : "live"})`);
  });
}
