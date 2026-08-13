import { describe, expect, it, vi } from "vitest";
import { AppleAdsClient, reportRows } from "../src/apple/client.js";

describe("AppleAdsClient", () => {
  it("adds bearer and organization headers", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 1, name: "Campaign" }] }), { status: 200 }));
    const client = new AppleAdsClient({ getAccessToken: async () => "access-token" }, "42", fetcher);
    await client.campaigns();
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("/api/v5/campaigns"), expect.objectContaining({ headers: expect.objectContaining({ authorization: "Bearer access-token", "x-ap-context": "orgId=42" }) }));
  });

  it("extracts report rows from Apple's reporting response", () => {
    expect(reportRows({ reportingDataResponse: { row: [{ total: { taps: 3 } }] } })).toEqual([{ total: { taps: 3 } }]);
  });
});
