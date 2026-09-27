# Ethereum Town

A public, read-only, interactive Ethereum ecosystem visualization. Ethereum is the central settlement and consensus foundation, with nine selected Layer 2 neighborhoods and a documented wider financial district.

## What the town shows

- Ten mainnet block feeds checked every 30 seconds while the page is visible. Walkers represent the latest observed block's transaction count at a shared scale, not TPS, unique users, or money volume.
- Selected Ethereum settlement and canonical bridge observations over a rolling 100-block window. Moving packets correspond to verified observations; stages and source transactions are available in the activity panel.
- Reported staked ETH from ethereum.org, checked every 15 minutes. Validator lights are symbolic; liquid staking receipt tokens are not counted as extra stake.
- Documented institutional products, pilots, and hypothetical future connections, labeled separately. Buildings and static paths are conceptual, not measured financial flows.

The map is a selected sample, not an exhaustive inventory. All ten networks have block feeds; selected infrastructure events cover six of nine L2s and selected canonical asset bridge events cover three. Mantle, Ink, and Unichain have live block feeds but do not yet have connection-event monitoring. More coverage and source links are available inside the town.

## Development and checks

Use Node 24 and Bun. Run `bun install --frozen-lockfile`, then `bun run dev`.

Before release, run `bun run typecheck`, `bun test`, `bun audit`, `bun run build`, and `TEST_BUILT_SECURITY=1 bun test tests/public-security.test.ts`. `bun start` serves the production Node build locally. Vercel uses the official TanStack Start + Nitro integration and the checked-in configuration.

No wallet connection, signing, private keys, user accounts, database, analytics, or transaction submission is implemented. Server requests use fixed public data providers, validation, timeouts, bounded response sizes, and a short completed-value cache. Secrets and generated deployment files are excluded from Git.

## Operational limits

Public RPC providers are best-effort and rate-limited. Failure retains clearly marked last-known observations; it never invents traffic. The Node cache is bounded and shared only within a warm server instance, not across all Vercel instances. A large public launch may require dedicated provider capacity and shared caching. The staking source does not publish a metric-as-of timestamp, so the UI distinguishes the source check time from when the underlying figure was measured.

`security-review.md` records the scope and results of the release review. It is not a penetration-test certification.
