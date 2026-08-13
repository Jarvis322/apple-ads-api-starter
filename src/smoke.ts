import { AppleAdsClient } from "./apple/client.js";
import { AppleTokenProvider } from "./apple/oauth.js";
import { assertAppleCredentials, loadConfig } from "./config.js";

const config = loadConfig();
if (config.mock) throw new Error("Live smoke test requires APPLE_ADS_MOCK=false");
assertAppleCredentials(config);

const tokenProvider = new AppleTokenProvider(config);
const bootstrapClient = new AppleAdsClient(tokenProvider, undefined, fetch, {
  maxAttempts: config.retryAttempts,
  timeoutMs: config.timeoutMs
});
const accounts = await bootstrapClient.accounts();
const orgId = config.orgId ?? accounts[0]?.orgId.toString();
if (!orgId) throw new Error("No Apple Ads organization is available; configure APPLE_ADS_ORG_ID");

const client = new AppleAdsClient(tokenProvider, orgId, fetch, {
  maxAttempts: config.retryAttempts,
  timeoutMs: config.timeoutMs
});
const campaigns = await client.campaigns();
const end = new Date();
const start = new Date();
start.setUTCDate(start.getUTCDate() - 6);
const report = await client.campaignReport(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));

console.log(
  JSON.stringify(
    {
      ok: true,
      accountCount: accounts.length,
      campaignCount: campaigns.length,
      reportRowCount: report.length
    },
    null,
    2
  )
);
