# Apple Ads API 5 Starter

[![CI](https://github.com/Jarvis322/apple-ads-api-starter/actions/workflows/ci.yml/badge.svg)](https://github.com/Jarvis322/apple-ads-api-starter/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Jarvis322/apple-ads-api-starter/actions/workflows/codeql.yml/badge.svg)](https://github.com/Jarvis322/apple-ads-api-starter/actions/workflows/codeql.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

A secure, read-only TypeScript starter for Apple Ads Campaign Management API 5. It handles OAuth 2 client credentials, fetches accounts, campaigns, ad groups, targeting keywords, and campaign performance reports, then displays the data in a lightweight dashboard.

> This is an independent community project. It is not affiliated with or endorsed by Apple.

![Apple Ads campaign dashboard](docs/dashboard.png)

## Features

- ES256 client-secret JWT generation from a P-256 private key
- One-hour access-token caching with an expiration safety margin
- Account/ACL, campaign, ad-group, and targeting-keyword reads
- Campaign, ad-group, keyword, and search-term reporting by date range
- Complete offset pagination instead of silently truncating at 1,000 records
- Request timeouts, bounded exponential backoff, and one-time token refresh
- Runtime response validation with Zod
- Impressions, taps, installs, spend, average CPT, CPI, and TTR overview
- Mock mode for local evaluation without Apple Ads credentials
- Optional HTTP Basic authentication, secure headers, and rate limiting
- An `AppleAdsGateway` boundary ready for a future optimizer
- No secrets sent to the browser, written to disk, or committed to Git

## Official API references

This project was checked against Apple's official documentation on August 13, 2026:

- API base: `https://api.searchads.apple.com/api/v5`
- OAuth token endpoint: `https://appleid.apple.com/auth/oauth2/token`
- Grant and scope: `client_credentials` and `searchadsorg`
- Client secret: ES256-signed JWT with `iss=teamId`, `sub=clientId`, and `aud=https://appleid.apple.com`
- API calls use `Authorization: Bearer …`; organization calls also use `X-AP-Context: orgId=…`

References: [Apple Ads](https://developer.apple.com/documentation/apple_ads), [Implementing OAuth](https://developer.apple.com/documentation/apple_ads/implementing-oauth-for-the-apple-search-ads-api), [Calling the API](https://developer.apple.com/documentation/apple_ads/calling-the-apple-search-ads-api), and [Campaign-level reports](https://developer.apple.com/documentation/apple_ads/get-campaign-level-reports).

## Prerequisites in Apple Ads

1. In Apple Ads Advanced, have an administrator invite a user with API permissions.
2. Generate a P-256 key pair:

   ```bash
   openssl ecparam -genkey -name prime256v1 -noout -out private-key.pem
   openssl ec -in private-key.pem -pubout -out public-key.pem
   ```

3. Upload the complete `public-key.pem` content in Apple Ads > Account Settings > API.
4. Copy the `clientId`, `teamId`, and `keyId` shown by Apple.
5. Use the correct `orgId` from `GET /api/v5/acls`.

Never move the private key into this repository. Keep it in a user-readable file outside the checkout and configure `APPLE_ADS_PRIVATE_KEY_PATH`, or inject it from a secret manager.

## Quick start

Node.js 20.19 or newer is required.

```bash
npm install
cp .env.example .env
npm run dev
```

Fill in `.env` with your Apple Ads values, then open [http://localhost:3000](http://localhost:3000).

To try the dashboard without Apple credentials, set `APPLE_ADS_MOCK=true` in `.env`.

For an internet-facing deployment, configure both `DASHBOARD_AUTH_USER` and a long random `DASHBOARD_AUTH_PASSWORD`. Terminate TLS at a trusted reverse proxy and store all secrets outside the repository.

## Live API smoke test

After configuring real credentials, run a read-only smoke test:

```bash
npm run smoke:live
```

The command verifies OAuth, ACL access, campaign pagination, and a seven-day campaign report. It prints counts only and never prints tokens or private keys.

## Validation and production start

```bash
npm run check
npm run test:coverage
npm run build
npm start
```

## Local endpoints

| Local endpoint                                               | Apple API request                                                     |
| ------------------------------------------------------------ | --------------------------------------------------------------------- |
| `GET /api/accounts`                                          | `GET /api/v5/acls`                                                    |
| `GET /api/campaigns`                                         | `GET /api/v5/campaigns`                                               |
| `GET /api/campaigns/:campaignId/adgroups`                    | `GET /api/v5/campaigns/{campaignId}/adgroups`                         |
| `GET /api/campaigns/:campaignId/keywords`                    | `POST /api/v5/campaigns/{campaignId}/adgroups/targetingkeywords/find` |
| `GET /api/reports/campaigns?start=YYYY-MM-DD&end=YYYY-MM-DD` | `POST /api/v5/reports/campaigns`                                      |
| `GET /api/campaigns/:campaignId/reports/adgroups`            | `POST /api/v5/reports/campaigns/{campaignId}/adgroups`                |
| `GET /api/campaigns/:campaignId/reports/keywords`            | `POST /api/v5/reports/campaigns/{campaignId}/keywords`                |
| `GET /api/campaigns/:campaignId/reports/searchterms`         | `POST /api/v5/reports/campaigns/{campaignId}/searchterms`             |

You can append `?orgId=123` to local requests. If omitted, `APPLE_ADS_ORG_ID` is used. Identifiers are restricted to numeric values, and clients cannot provide arbitrary upstream Apple API paths.

## Security model

- `.env`, `*.pem`, `*.key`, and `client_secret.txt` are ignored by Git.
- The client-secret JWT is generated in memory and used only for the OAuth token request.
- Access tokens are cached in server memory and never logged or sent to the dashboard.
- Upstream error bodies remain server-side; clients receive a sanitized error and optional request ID.
- All included Apple Ads operations are read-only.
- Optional dashboard authentication, secure HTTP headers, and rate limiting are included. Production deployments still need TLS, centralized secrets, monitoring, and deployment-specific access control.

When adding bid or keyword mutation endpoints, use role checks, dry runs, per-change limits, human approval, and an immutable audit log.

## Optimizer roadmap

The Apple integration lives behind `AppleAdsGateway`. A safe next step is a metrics-normalization layer followed by a recommendation-only optimizer:

`recommendation -> dry run -> bid/budget guardrails -> human approval -> Apple PUT/bulk request -> audit record`

See [ROADMAP.md](ROADMAP.md) for planned optimizer guardrails, [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines, [CHANGELOG.md](CHANGELOG.md) for releases, and [SECURITY.md](SECURITY.md) for responsible disclosure.

## License

[MIT](LICENSE)
