import { describe, expect, it, vi } from "vitest";
import { AppleAdsClient, AppleAdsResponseError, reportRows } from "../src/apple/client.js";

const campaign = (id: number) => ({ id, name: `Campaign ${id}` });

describe("AppleAdsClient", () => {
  it("adds bearer and organization headers", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: [campaign(1)] }), { status: 200 }));
    const client = new AppleAdsClient({ getAccessToken: async () => "access-token" }, "42", fetcher);
    await client.campaigns();
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("/api/v5/campaigns"),
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer access-token",
          "x-ap-context": "orgId=42"
        })
      })
    );
  });

  it("fetches every page instead of truncating at 1000 records", async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => campaign(index + 1));
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: firstPage, pagination: { totalResults: 1001 } }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [campaign(1001)], pagination: { totalResults: 1001 } }), {
          status: 200
        })
      );
    const client = new AppleAdsClient({ getAccessToken: async () => "token" }, "42", fetcher);

    const campaigns = await client.campaigns();

    expect(campaigns).toHaveLength(1001);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1]?.[0]).toContain("offset=1000");
  });

  it("retries rate-limited requests with exponential backoff", async () => {
    const delays: number[] = [];
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [campaign(1)] }), { status: 200 }));
    const client = new AppleAdsClient({ getAccessToken: async () => "token" }, "42", fetcher, {
      maxAttempts: 2,
      sleep: async (milliseconds) => {
        delays.push(milliseconds);
      }
    });

    await expect(client.campaigns()).resolves.toHaveLength(1);
    expect(delays).toEqual([2000]);
  });

  it("refreshes an invalid access token once", async () => {
    const tokenProvider = {
      getAccessToken: vi.fn().mockResolvedValueOnce("old").mockResolvedValueOnce("new"),
      invalidate: vi.fn()
    };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [campaign(1)] }), { status: 200 }));
    const client = new AppleAdsClient(tokenProvider, "42", fetcher);

    await expect(client.campaigns()).resolves.toHaveLength(1);
    expect(tokenProvider.invalidate).toHaveBeenCalledOnce();
    expect(tokenProvider.getAccessToken).toHaveBeenCalledTimes(2);
  });

  it("rejects malformed upstream objects at runtime", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [{ id: "not-a-number", name: "Bad" }] }), { status: 200 })
      );
    const client = new AppleAdsClient({ getAccessToken: async () => "token" }, "42", fetcher);

    await expect(client.campaigns()).rejects.toBeInstanceOf(AppleAdsResponseError);
  });

  it("calls keyword and search-term reporting endpoints", async () => {
    const fetcher = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ data: { reportingDataResponse: { row: [] } } }), {
          status: 200
        })
    );
    const client = new AppleAdsClient({ getAccessToken: async () => "token" }, "42", fetcher);

    await client.keywordReport("123", "2026-08-01", "2026-08-13");
    await client.searchTermReport("123", "2026-08-01", "2026-08-13");

    expect(fetcher.mock.calls[0]?.[0]).toContain("/reports/campaigns/123/keywords");
    expect(fetcher.mock.calls[1]?.[0]).toContain("/reports/campaigns/123/searchterms");
  });

  it("extracts report rows from Apple's reporting response", () => {
    expect(reportRows({ reportingDataResponse: { row: [{ total: { taps: 3 } }] } })).toEqual([
      { total: { taps: 3 } }
    ]);
  });
});
