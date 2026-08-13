export type Money = { amount: string; currency: string };

export type AppleEnvelope<T> = {
  data: T;
  pagination?: { totalResults?: number; startIndex?: number; itemsPerPage?: number } | null;
  error?: unknown;
};

export type Account = {
  orgId: number;
  orgName?: string;
  displayName?: string;
  currency?: string;
  timeZone?: string;
  roleNames?: string[];
};

export type Campaign = {
  id: number;
  name: string;
  status?: string;
  displayStatus?: string;
  servingStatus?: string;
  countriesOrRegions?: string[];
  budgetAmount?: Money;
  dailyBudgetAmount?: Money;
};

export type AdGroup = {
  id: number;
  campaignId: number;
  name: string;
  status?: string;
  displayStatus?: string;
  defaultBidAmount?: Money;
};

export type Keyword = {
  id: number;
  adGroupId: number;
  text: string;
  status?: string;
  matchType?: string;
  bidAmount?: Money;
};

export type ReportRequest = {
  startTime: string;
  endTime: string;
  selector: { pagination: { offset: number; limit: number }; orderBy?: Array<{ field: string; sortOrder: string }> };
  timeZone: string;
  returnRecordsWithNoMetrics: boolean;
  returnRowTotals: boolean;
  returnGrandTotals: boolean;
};

export type ReportRow = {
  metadata?: Record<string, unknown>;
  total?: Record<string, unknown>;
  granularity?: Array<Record<string, unknown>>;
};
