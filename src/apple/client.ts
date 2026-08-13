import { z } from "zod";
import type { AppleTokenProvider } from "./oauth.js";
import {
  accountSchema,
  adGroupSchema,
  appleEnvelopeSchema,
  campaignSchema,
  keywordSchema,
  reportRowSchema
} from "./schemas.js";
import type { Account, AdGroup, Campaign, Keyword, ReportKind, ReportRequest, ReportRow } from "./types.js";

const API_BASE = "https://api.searchads.apple.com/api/v5";
const PAGE_SIZE = 1000;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

type TokenProvider = Pick<AppleTokenProvider, "getAccessToken"> &
  Partial<Pick<AppleTokenProvider, "invalidate">>;
type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  orgId?: string;
  orgRequired?: boolean;
};

export type ClientRuntimeOptions = {
  maxAttempts?: number;
  timeoutMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
};

export class AppleAdsApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly requestId?: string
  ) {
    super(message);
  }
}

export class AppleAdsResponseError extends Error {}

export interface AppleAdsGateway {
  accounts(): Promise<Account[]>;
  campaigns(orgId?: string): Promise<Campaign[]>;
  adGroups(campaignId: string, orgId?: string): Promise<AdGroup[]>;
  keywords(campaignId: string, orgId?: string): Promise<Keyword[]>;
  campaignReport(startTime: string, endTime: string, orgId?: string): Promise<ReportRow[]>;
  adGroupReport(campaignId: string, startTime: string, endTime: string, orgId?: string): Promise<ReportRow[]>;
  keywordReport(campaignId: string, startTime: string, endTime: string, orgId?: string): Promise<ReportRow[]>;
  searchTermReport(
    campaignId: string,
    startTime: string,
    endTime: string,
    orgId?: string
  ): Promise<ReportRow[]>;
}

export class AppleAdsClient implements AppleAdsGateway {
  private readonly maxAttempts: number;
  private readonly timeoutMs: number;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(
    private readonly tokenProvider: TokenProvider,
    private readonly defaultOrgId?: string,
    private readonly fetcher: typeof fetch = fetch,
    runtime: ClientRuntimeOptions = {}
  ) {
    this.maxAttempts = runtime.maxAttempts ?? 4;
    this.timeoutMs = runtime.timeoutMs ?? 15_000;
    this.sleep =
      runtime.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  async accounts(): Promise<Account[]> {
    const schema = z.union([z.array(accountSchema), accountSchema]);
    const { data } = await this.request("/acls", schema, { orgRequired: false });
    return Array.isArray(data) ? data : [data];
  }

  campaigns(orgId?: string): Promise<Campaign[]> {
    return this.paginateGet("/campaigns", campaignSchema, orgId);
  }

  adGroups(campaignId: string, orgId?: string): Promise<AdGroup[]> {
    return this.paginateGet(`/campaigns/${numericId(campaignId)}/adgroups`, adGroupSchema, orgId);
  }

  keywords(campaignId: string, orgId?: string): Promise<Keyword[]> {
    return this.paginateFind(
      `/campaigns/${numericId(campaignId)}/adgroups/targetingkeywords/find`,
      keywordSchema,
      orgId
    );
  }

  campaignReport(startTime: string, endTime: string, orgId?: string): Promise<ReportRow[]> {
    return this.paginatedReport("/reports/campaigns", startTime, endTime, orgId, "campaignId");
  }

  adGroupReport(
    campaignId: string,
    startTime: string,
    endTime: string,
    orgId?: string
  ): Promise<ReportRow[]> {
    return this.detailReport(campaignId, "adgroups", startTime, endTime, orgId, "adGroupId");
  }

  keywordReport(
    campaignId: string,
    startTime: string,
    endTime: string,
    orgId?: string
  ): Promise<ReportRow[]> {
    return this.detailReport(campaignId, "keywords", startTime, endTime, orgId, "keywordId");
  }

  searchTermReport(
    campaignId: string,
    startTime: string,
    endTime: string,
    orgId?: string
  ): Promise<ReportRow[]> {
    return this.detailReport(campaignId, "searchterms", startTime, endTime, orgId, "impressions");
  }

  private detailReport(
    campaignId: string,
    kind: ReportKind,
    startTime: string,
    endTime: string,
    orgId: string | undefined,
    orderField: string
  ): Promise<ReportRow[]> {
    return this.paginatedReport(
      `/reports/campaigns/${numericId(campaignId)}/${kind}`,
      startTime,
      endTime,
      orgId,
      orderField
    );
  }

  private async paginateGet<T>(path: string, itemSchema: z.ZodType<T>, orgId?: string): Promise<T[]> {
    const results: T[] = [];
    for (let offset = 0, page = 0; page < 1000; offset += PAGE_SIZE, page += 1) {
      const separator = path.includes("?") ? "&" : "?";
      const response = await this.request(
        `${path}${separator}limit=${PAGE_SIZE}&offset=${offset}`,
        z.array(itemSchema),
        { orgId }
      );
      results.push(...response.data);
      if (isLastPage(response.data.length, results.length, response.pagination?.totalResults)) return results;
    }
    throw new Error("Apple Ads pagination safety limit exceeded");
  }

  private async paginateFind<T>(path: string, itemSchema: z.ZodType<T>, orgId?: string): Promise<T[]> {
    const results: T[] = [];
    for (let offset = 0, page = 0; page < 1000; offset += PAGE_SIZE, page += 1) {
      const response = await this.request(path, z.array(itemSchema), {
        method: "POST",
        orgId,
        body: { pagination: { offset, limit: PAGE_SIZE }, conditions: [] }
      });
      results.push(...response.data);
      if (isLastPage(response.data.length, results.length, response.pagination?.totalResults)) return results;
    }
    throw new Error("Apple Ads pagination safety limit exceeded");
  }

  private async paginatedReport(
    path: string,
    startTime: string,
    endTime: string,
    orgId: string | undefined,
    orderField: string
  ): Promise<ReportRow[]> {
    const results: ReportRow[] = [];
    for (let offset = 0, page = 0; page < 1000; offset += PAGE_SIZE, page += 1) {
      const body: ReportRequest = {
        startTime,
        endTime,
        selector: {
          pagination: { offset, limit: PAGE_SIZE },
          orderBy: [{ field: orderField, sortOrder: "ASCENDING" }]
        },
        timeZone: "ORTZ",
        returnRecordsWithNoMetrics: true,
        returnRowTotals: true,
        returnGrandTotals: true
      };
      const { data } = await this.request(path, z.unknown(), { method: "POST", body, orgId });
      const rows = reportRows(data);
      results.push(...rows);
      if (rows.length < PAGE_SIZE) return results;
    }
    throw new Error("Apple Ads report pagination safety limit exceeded");
  }

  private async request<T>(
    path: string,
    schema: z.ZodType<T>,
    options: RequestOptions = {}
  ): Promise<{ data: T; pagination?: { totalResults?: number } }> {
    const orgId = options.orgId ?? this.defaultOrgId;
    if (options.orgRequired !== false && !orgId)
      throw new Error("APPLE_ADS_ORG_ID is required for this request");

    for (let authAttempt = 0; authAttempt < 2; authAttempt += 1) {
      const token = await this.tokenProvider.getAccessToken();
      const headers: Record<string, string> = {
        authorization: `Bearer ${token}`,
        accept: "application/json"
      };
      if (orgId) headers["x-ap-context"] = `orgId=${orgId}`;
      if (options.body !== undefined) headers["content-type"] = "application/json";

      const response = await this.fetchWithRetry(`${API_BASE}${path}`, {
        method: options.method ?? "GET",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
      });

      if (response.status === 401 && authAttempt === 0 && this.tokenProvider.invalidate) {
        this.tokenProvider.invalidate();
        continue;
      }

      const text = await response.text();
      if (!response.ok) {
        const requestId = response.headers.get("x-request-id") ?? undefined;
        throw new AppleAdsApiError(
          response.status,
          `Apple Ads API failed (${response.status}): ${text.slice(0, 500)}`,
          requestId
        );
      }

      try {
        const envelope = appleEnvelopeSchema.parse(JSON.parse(text));
        return {
          data: schema.parse(envelope.data),
          pagination: envelope.pagination ? { totalResults: envelope.pagination.totalResults } : undefined
        };
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Unknown validation error";
        throw new AppleAdsResponseError(`Invalid Apple Ads response: ${detail}`);
      }
    }
    throw new AppleAdsApiError(401, "Apple Ads authentication failed after token refresh");
  }

  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetcher(url, { ...init, signal: controller.signal });
        if (!RETRYABLE_STATUSES.has(response.status) || attempt === this.maxAttempts - 1) return response;
        const wait = retryDelay(response.headers.get("retry-after"), attempt);
        await response.arrayBuffer();
        await this.sleep(wait);
      } catch (error) {
        lastError = error;
        if (attempt === this.maxAttempts - 1) break;
        await this.sleep(retryDelay(null, attempt));
      } finally {
        clearTimeout(timer);
      }
    }
    const reason = lastError instanceof Error ? lastError.message : "Unknown network error";
    throw new Error(`Apple Ads network request failed after ${this.maxAttempts} attempts: ${reason}`);
  }
}

function numericId(value: string): string {
  if (!/^\d+$/.test(value)) throw new Error("Invalid Apple Ads identifier");
  return value;
}

function isLastPage(pageLength: number, accumulated: number, totalResults?: number): boolean {
  if (totalResults !== undefined) return accumulated >= totalResults;
  return pageLength < PAGE_SIZE;
}

function retryDelay(retryAfter: string | null, attempt: number): number {
  if (retryAfter && /^\d+$/.test(retryAfter)) return Math.min(Number(retryAfter) * 1000, 16_000);
  return Math.min(2_000 * 2 ** attempt, 16_000);
}

export function reportRows(value: unknown): ReportRow[] {
  if (!value || typeof value !== "object")
    throw new AppleAdsResponseError("Invalid Apple Ads report response");
  const root = value as Record<string, unknown>;
  const response = (root.reportingDataResponse ?? root) as Record<string, unknown>;
  const parsed = z.array(reportRowSchema).safeParse(response.row ?? []);
  if (!parsed.success)
    throw new AppleAdsResponseError(`Invalid Apple Ads report rows: ${parsed.error.message}`);
  return parsed.data;
}
