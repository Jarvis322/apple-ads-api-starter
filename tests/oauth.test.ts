import { generateKeyPairSync } from "node:crypto";
import { decodeJwt, decodeProtectedHeader } from "jose";
import { describe, expect, it, vi } from "vitest";
import { AppleTokenProvider, createClientSecret } from "../src/apple/oauth.js";

const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256", privateKeyEncoding: { format: "pem", type: "sec1" }, publicKeyEncoding: { format: "pem", type: "spki" } });
const credentials = { clientId: "SEARCHADS.client", teamId: "SEARCHADS.team", keyId: "key-id", privateKey };

describe("Apple OAuth", () => {
  it("creates the ES256 client secret expected by Apple", async () => {
    const jwt = await createClientSecret(credentials, 1_700_000_000);
    expect(decodeProtectedHeader(jwt)).toMatchObject({ alg: "ES256", kid: "key-id" });
    expect(decodeJwt(jwt)).toMatchObject({ iss: "SEARCHADS.team", sub: "SEARCHADS.client", aud: "https://appleid.apple.com", iat: 1_700_000_000, exp: 1_700_000_300 });
  });

  it("caches access tokens", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: "token", token_type: "Bearer", expires_in: 3600, scope: "searchadsorg" }), { status: 200 }));
    const provider = new AppleTokenProvider(credentials, fetcher);
    expect(await provider.getAccessToken()).toBe("token"); expect(await provider.getAccessToken()).toBe("token");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
