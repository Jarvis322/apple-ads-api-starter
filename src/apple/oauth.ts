import { createPrivateKey } from "node:crypto";
import { SignJWT } from "jose";

export type OAuthCredentials = {
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
};

export async function createClientSecret(
  credentials: OAuthCredentials,
  nowSeconds = Math.floor(Date.now() / 1000)
): Promise<string> {
  const key = createPrivateKey(credentials.privateKey);
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: credentials.keyId })
    .setIssuer(credentials.teamId)
    .setSubject(credentials.clientId)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + 5 * 60)
    .sign(key);
}

type TokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
};

export class AppleTokenProvider {
  private cached?: { token: string; expiresAt: number };

  constructor(
    private readonly credentials: OAuthCredentials,
    private readonly fetcher: typeof fetch = fetch,
    private readonly timeoutMs = 15_000
  ) {}

  invalidate(): void {
    this.cached = undefined;
  }

  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cached && this.cached.expiresAt > now + 60_000) return this.cached.token;

    const clientSecret = await createClientSecret(this.credentials);
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.credentials.clientId,
      client_secret: clientSecret,
      scope: "searchadsorg"
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetcher("https://appleid.apple.com/auth/oauth2/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Apple OAuth failed (${response.status}): ${detail.slice(0, 300)}`);
    }

    const token = (await response.json()) as TokenResponse;
    this.cached = { token: token.access_token, expiresAt: now + token.expires_in * 1000 };
    return token.access_token;
  }
}
