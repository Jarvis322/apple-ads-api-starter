import type { AppleTokenProvider } from "./oauth.js";
import type { Account, AdGroup, AppleEnvelope, Campaign, Keyword, ReportRequest, ReportRow } from "./types.js";

const API_BASE = "https://api.searchads.apple.com/api/v5";

export class AppleAdsApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export interface AppleAdsGateway {
  accounts(): Promise<Account[]>;
  campaigns(orgId?: string): Promise<Campaign[]>;
  adGroups(campaignId: string, orgId?: string): Promise<AdGroup[]>;
  keywords(campaignId: string, orgId?: string): Promise<Keyword[]>;
  campaignReport(startTime: string, endTime: string, orgId?: string): Promise<ReportRow[]>;
}

export class AppleAdsClient implements AppleAdsGateway {
  constructor(
    private readonly tokenProvider: Pick<AppleTokenProvider, "getAccessToken">,
    private readonly defaultOrgId?: string,
    private readonly fetcher: typeof fetch = fetch
  ) {}

  async accounts(): Promise<Account[]> {
    const data = await this.request<Account[] | Account>("/acls", { orgRequired: false });
    return Array.isArray(data) ? data : [data];
  }

  campaigns(orgId?: string): Promise<Campaign[]> {
    return this.request<Campaign[]>("/campaigns?limit=1000&offset=0", { orgId });
  }

  adGroups(campaignId: string, orgId?: string): Promise<AdGroup[]> {
    return this.request<AdGroup[]>(`/campaigns/${id(campaignId)}/adgroups?limit=1000&offset=0`, { orgId });
  }

  keywords(campaignId: string, orgId?: string): Promise<Keyword[]> {
    return this.request<Keyword[]>(`/campaigns/${id(campaignId)}/adgroups/targetingkeywords/find`, {
      method: "POST",
      orgId,
      body: { pagination: { offset: 0, limit: 1000 }, conditions: [] }
    });
  }

  async campaignReport(startTime: string, endTime: string, orgId?: string): Promise<ReportRow[]> {
    const body: ReportRequest = {
      startTime,
      endTime,
      selector: {
        pagination: { offset: 0, limit: 1000 },
        orderBy: [{ field: "campaignId", sortOrder: "ASCENDING" }]
      },
      timeZone: "ORTZ",
      returnRecordsWithNoMetrics: true,
      returnRowTotals: true,
      returnGrandTotals: true
    };
    const data = await this.request<unknown>("/reports/campaigns", { method: "POST", body, orgId });
    return reportRows(data);
  }

  private async request<T>(
    path: string,
    options: { method?: "GET" | "POST"; body?: unknown; orgId?: string; orgRequired?: boolean } = {}
  ): Promise<T> {
    const token = await this.tokenProvider.getAccessToken();
    const orgId = options.orgId ?? this.defaultOrgId;
    if (options.orgRequired !== false && !orgId) throw new Error("APPLE_ADS_ORG_ID is required for this request");

    const headers: Record<string, string> = { authorization: `Bearer ${token}`, accept: "application/json" };
    if (orgId) headers["x-ap-context"] = `orgId=${orgId}`;
    if (options.body) headers["content-type"] = "application/json";

    const response = await this.fetcher(`${API_BASE}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const text = await response.text();
    if (!response.ok) throw new AppleAdsApiError(response.status, `Apple Ads API failed (${response.status}): ${text.slice(0, 500)}`);
    const envelope = JSON.parse(text) as AppleEnvelope<T>;
    return envelope.data;
  }
}

function id(value: string): string {
  if (!/^\d+$/.test(value)) throw new Error("Invalid Apple Ads identifier");
  return value;
}

export function reportRows(value: unknown): ReportRow[] {
  if (!value || typeof value !== "object") return [];
  const root = value as Record<string, unknown>;
  const response = (root.reportingDataResponse ?? root) as Record<string, unknown>;
  return Array.isArray(response.row) ? response.row as ReportRow[] : [];
}
