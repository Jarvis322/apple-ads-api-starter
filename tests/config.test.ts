import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("configuration", () => {
  it("requires both dashboard authentication values", () => {
    expect(() => loadConfig({ DASHBOARD_AUTH_USER: "admin" })).toThrow(/configured together/);
  });

  it("normalizes escaped PEM newlines", () => {
    const config = loadConfig({ APPLE_ADS_PRIVATE_KEY: "line1\\nline2" });
    expect(config.privateKey).toBe("line1\nline2");
  });
});
