# Ethereum Town

Public city: https://ethereumtown.vercel.app/

A live miniature Ethereum town inspired by Token Town. Ethereum Hall is the focal point for reliability and capacity observations, with nine selectable L2 neighborhoods and continuous routes into the hall. Nine selected products and protocols occupy connected storefronts: Circle USDC, Tether USDT, Uniswap, Aave, BlackRock BUIDL, Franklin BENJI, JPM Coin/JPMD, Visa's live settlement pilot, and Lido. Six surrounding sector buildings represent the wider financial world. They are contextual, not claims that entire industries are unconnected or destined for Ethereum.

## What is live

- Ethereum health observations every 30 seconds: identity-checked latest and finalized execution blocks, their timestamp gap, gas usage against the actual block limit, execution base fee, blob count and separately observed blob base fee. A validated chain of 16 execution blocks provides recent canonical slot coverage and block-capacity history. Missing history is unavailable, not a perfect score. Every field retains its original timestamp and explicit last-known state on failure.
- The hall beacon acknowledges observed blocks and uses a documented application attention threshold (head observation above 60 seconds, or head-to-finalized timestamp gap above 25.6 minutes). It is not a consensus audit or overall health score. Provider failures are gray rather than an Ethereum-outage assertion.

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

Public RPC providers are best-effort and rate-limited. Failures retain dated last-known values with explicit stale labels. The Node cache is bounded and local to each warm server instance. Higher traffic may require dedicated provider capacity and shared caching. No synthetic institution activity is generated when a feed fails. General latest-block inclusion is not consensus finality. The dedicated health feed separately reports the provider’s finalized Ethereum head; it does not independently verify consensus. Validator participation, operator concentration and complete historical uptime are not measured.

`security-review.md` records the engineering review and limitations; it is not a penetration-test certification.

## Visual implementation

The public reference code was inspected to identify its rendering techniques, not copied. This scene uses original procedural geometry with Three.js perspective framing, rounded main facades, contact shadows, bloom and restrained depth of field. Selection centers one place, and a compact card explains its observations. The phone rendering path reduces postprocessing. See `docs/token-town-reference-audit.md` and `docs/ethereum-health-review.md` for the source audit and data semantics.
