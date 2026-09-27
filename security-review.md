# Ethereum Town release review

Reviewed 2026-09-27 UTC. Scope: the standalone public application, source and static assets, dependencies, production Node build, live data behavior, and desktop/mobile UI. This is a bounded engineering review, not a penetration-test certification or an assessment of Ethereum or third-party bridges.

## Results

- The production build and TypeScript checks pass. All 55 tests pass, including tests against the freshly built Nitro server.
- `bun audit --json` returned `{}` after the final Nitro dependency installation: no known advisories reported for the resolved lockfile at review time.
- Five public GET server functions accept no caller-selected destinations, methods, credentials, or account state. The app has no wallet connection, signing, transaction submission, accounts, or database.
- Provider endpoints and contract addresses are fixed registries. Wrong chain IDs, malformed blocks/events, reorganization mismatches, stale observations, failed providers, and oversized responses fail closed. No synthetic traffic replaces missing observations.
- Upstream reads enforce timeouts, bounded response bytes, and bounded bridge concurrency. Completed-value caching preserves source timestamps and expires them without renewing freshness. The Node cache has feed-key and TTL allowlists, a 12-entry limit, a 1 MiB entry limit, and a 4 MiB total limit.
- React escapes displayed values. Canvas text is generated locally. No active HTML injection sink or CSV formula path was found. Emitted client/static files do not intentionally contain environment files, credentials, private keys, or source maps.
- The server rejects non-GET/HEAD methods and oversized URLs, uses generic error responses, and applies CSP, HSTS, nosniff, referrer and browser-permission headers. Inline scripts/styles remain allowed for TanStack hydration and the current UI. Public assets also receive Vercel-level nosniff/referrer/permission headers.

## Verification

`TEST_BUILT_SECURITY=1 bun test tests/*.test.ts` verifies the production SSR entry and exact five-function manifest. Representative requests cover environment/git file paths, encoded traversal, external-looking redirect paths, malformed and unknown functions, cross-site POSTs, wrong methods, and oversized URLs. The test blocks outbound network access and verifies no external redirects or obvious file/stack disclosure. Malformed server-function requests currently return a generic 500; this is an error-status limitation, not a data-disclosure finding.

The application review also verified ten live block sources, actual advancement on repeat observation, source links, selected bridge/settlement events, staking report parsing, selection retained across refreshes, desktop/mobile rendering, and day/night controls. The in-app guide separates execution from settlement, asset bridging from data publication, latest-block counts from TPS/users, and real institutional products from hypothetical expansion.

## Operational limits

The displayed ecosystem is a selected sample. Six of nine L2s have selected infrastructure monitoring; three have selected canonical asset-bridge monitoring. All ten displayed networks have block feeds. Public RPC services are rate-limited and offer no application-specific uptime guarantee. Node caches are per warm instance, so a high-traffic launch may require dedicated provider capacity and shared caching. No sustained load test, provider attack, external penetration test, or hosting-infrastructure audit was performed.

The reported staking figure has no published measurement timestamp; the app labels the source-check time and does not call it a live validator-balance calculation. Latest blocks and event inclusion are not promises of consensus finality. Production access, metadata, static assets and feed refreshes are checked separately after deployment.

## Public release verification

The production Vercel alias https://ethereumtown.vercel.app returned HTTP 200 without cookies or authentication and rendered the town in a fresh browser tab. Its canonical URL, security headers and GitHub-linked production deployment were verified. The browser showed all ten network feeds current, timestamped verified connection events, the Economy guide and no captured JavaScript errors or warnings. The source repository is private; the website is public.

## Financial city revision — 2026-09-27 UTC

The main scene now maps documented financial products within a wider contextual city. Added a fifth fixed, read-only GET feed for USDC/USDT Ethereum contract totalSupply, with chain ID and decimals checks, one pinned block, a block-hash consistency recheck, strict ABI parsing, bounded responses, deadlines, and a fixed 60-second completed-value cache. No caller-selected RPC target or contract address is accepted. Values are tokens, not dollars or issuer-wide circulating supply.

Product connections were independently reviewed against primary sources. Wider finance is sector context; no institution's entire assets or future migration is asserted. Decorative pedestrians and vehicles are labeled illustrative, and only supplied network observations produce pulses. Supply failures preserve original observation times and visibly say Last known. Staking cards distinguish a last-known report and include its complete source-check date.

The revised build passes all 55 automated tests, including the five-function production manifest and hostile-request tests. TypeScript checking and dependency audit pass. Desktop and mobile scene views, shop selection, live supply values and network refreshes were visually checked. Public-host verification follows deployment of this revision.
