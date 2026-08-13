# Roadmap

## Next: recommendation-only optimizer

- Normalize keyword, search-term, and ad-group metrics across date windows.
- Produce explainable bid and negative-keyword recommendations without mutations.
- Add configurable minimum-spend and minimum-conversion confidence thresholds.

## Later: guarded mutations

- Add dry-run plans with per-bid and per-day budget limits.
- Require explicit human approval before Apple API write calls.
- Store immutable before/after audit records with request identifiers.
- Add organization/role-aware authorization for multi-user deployments.

## Out of scope for the starter

- Hosting an unauthenticated dashboard on the public internet.
- Fully autonomous bid changes without limits, approvals, or auditability.
- Storing Apple Ads credentials in the repository or browser.
