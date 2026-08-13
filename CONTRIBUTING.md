# Contributing

Contributions are welcome. Please keep the starter small, secure, and aligned with Apple's current official API documentation.

## Development

1. Fork and clone the repository.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and use `APPLE_ADS_MOCK=true` unless live API access is required.
4. Create a focused branch and make your change.
5. Run `npm run check` before opening a pull request.

Never commit Apple Ads credentials, private keys, access tokens, real account data, or screenshots containing customer information. Tests must use generated keys and synthetic data.

For API changes, link to the relevant official Apple documentation in the pull request and include tests for authentication, headers, response normalization, or failure handling as appropriate.
