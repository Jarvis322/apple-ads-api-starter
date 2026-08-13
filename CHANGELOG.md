# Changelog

All notable changes to this project are documented here.

## 1.0.1 - 2026-08-13

- Limited grouped Dependabot version updates to compatible minor and patch releases.
- Kept major security updates enabled while preventing broken automated major-upgrade bundles.

## 1.0.0 - 2026-08-13

- Added complete pagination for campaigns, ad groups, targeting keywords, and reports.
- Added bounded exponential backoff, request timeouts, and one-time token refresh.
- Added runtime validation for Apple Ads response envelopes and entities.
- Added campaign, ad-group, keyword, and search-term performance reporting.
- Added optional HTTP Basic authentication, security headers, and rate limiting.
- Added a credential-safe live smoke-test command.
- Added CI, CodeQL, Dependabot, coverage thresholds, secret scanning, and community templates.
