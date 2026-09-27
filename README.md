# Ethereum Town

Public city: https://ethereumtown.vercel.app/

A walkable financial city inspired by Token Town. Nine selected products and protocols occupy connected storefronts: Circle USDC, Tether USDT, Uniswap, Aave, BlackRock BUIDL, Franklin BENJI, JPM Coin/JPMD, Visa's live settlement pilot, and Lido. Six surrounding sector buildings represent the wider financial world. They are contextual, not claims that entire industries are unconnected or destined for Ethereum.

## What is live

- Ethereum-only USDC and USDT `totalSupply` values, checked every minute against issuer-verified token contracts at a shared Ethereum block. Chain ID, decimals, freshness and block-hash consistency are verified. Quantities are tokens, not USD valuation, global circulating supply or transaction volume. Tether's contract supply may include treasury inventory.
- Ten mainnet block feeds checked every 30 seconds while visible: Ethereum and nine selected L2s. Network lights pulse on new observed blocks.
- Selected bridge and rollup infrastructure events over a rolling 100-block Ethereum window. Pulses travel along shared network infrastructure, not from institution storefronts. Six L2s have selected infrastructure monitoring; three have selected canonical asset-bridge monitoring.
- Ethereum.org's reported staking figure, checked every 15 minutes. Its underlying measurement time is not published. Staking lights are symbolic and liquid-staking receipt tokens are not counted twice.

Product status and routes are editorial, primary-source documented information. They are not inferred from blockchain traffic. Source dates and limitations are in each product card and `docs/financial-city-review.md`. Street people, vehicles, building sizes, and city geometry are illustrative. They do not measure customers, adoption, assets or market share.

## Development and checks

Use Node 24 and Bun. Run `bun install --frozen-lockfile`, then `bun run dev`.

Before release: `bun run typecheck`, `bun test`, `bun audit`, `bun run build`, and `TEST_BUILT_SECURITY=1 bun test tests/*.test.ts`. `bun start` serves the production Node build. Vercel uses TanStack Start + Nitro and deploys the connected GitHub main branch.

The site has no visitor login, wallet connection, signing, private keys, transaction submission, accounts, database or analytics. Server handlers are read-only and use fixed provider/contract registries, timeouts, bounded response bodies and short completed-value caches. Secrets and deployment files are excluded from Git.

## Operational limits

Public RPC providers are best-effort and rate-limited. Failures retain dated last-known values with explicit stale labels. The Node cache is bounded and local to each warm server instance. Higher traffic may require dedicated provider capacity and shared caching. No synthetic institution activity is generated when a feed fails. Latest-block inclusion is not consensus finality.

`security-review.md` records the engineering review and limitations; it is not a penetration-test certification.
