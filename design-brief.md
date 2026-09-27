# Ethereum Town
User revision: Ethereum bullish ecosystem illustration, with Ethereum a central town hall and connected L2 neighborhoods. Original live visualization only; no video.
Concept: Many neighborhoods. One Ethereum foundation.
Scope: Ethereum L1, Base, Arbitrum One, OP Mainnet, Starknet, ZKsync Era and Linea.
Visual: Monumental Ethereum civic hall, diamond, central plaza, six radial neighborhoods, physical bridge spokes and water channels. Original procedural geometry.
Meaning: Building sizes are architectural roles, not metrics. L2s execute locally; Ethereum supplies data and settlement services. Hall does not govern L2s.
Data: growthepie txcount, latest common completed UTC day across all seven. Selected L2 aggregate separated from Ethereum L1 count. Exact sourced baseline retained on failure.
Animation: Local crowds use one shared linear transaction scale. Equal bridge packets illustrate settlement connections, not asset flows, fees, batches or proofs measured.
Backend: Public read-only data, 15-minute refresh check, bounded fetch, no accounts or secrets.
Palette: Sky-blue canal, pale civic stone, Ethereum periwinkle, muted network colors. Day/night controls retained.
Type: Space Grotesk + IBM Plex Mono.
Interaction: Select town hall or neighborhoods/bridges, inspect daily activity, orbit, zoom, pause, speed, day/night, source ledger, CSV.
Accessibility: Keyboard navigation, reduced-motion pause, readable data fallback.
Mobile: Dedicated scene viewport, compact scrollable information card, concise connection legend.
Assets: Original 3D scene, updated real scene cover and Ethereum-inspired diamond favicon.
Reference: Ryan Sael Token Town (https://sael.net/token-town/); original code/assets, no affiliation.
Integrity: Not a token price forecast. Transactions are not users or dollars. No false bridge flows, no relabeling L2 transactions as L1.
Existing scroll film engine remains unused and preserved because user explicitly asked for a live visualization.
Same existing hosted link. No community feed listing requested.

Staking revision: Add 30 symbolic validator beacons around the Ethereum plaza and a clickable security foundation. Selecting staking focuses the hall. Pulses illustrate proposals and attestations and respect pause. Labels describe a schematic distributed network.
Stakingmetric: Reported Total ETH staked from ethereum.org/staking, with a source-checked timestamp. The source publishes no metric timestamp or epoch. Kept separate from daily transaction counts.


## Live Ethereum ecosystem update
The town consumes public network observations every 30 seconds while visible. Seven independently verified network feeds return latest block hashes, timestamps and transaction counts. Walkers scale from each latest block and update without rebuilding the scene; they are neither people nor TPS comparisons. Failed feeds retain their last observation and visibly become stale.

Connections use observed Ethereum events over a rolling 100-block window. Six selected L2 data/state routes are monitored. Base, OP Mainnet and Arbitrum also have selected canonical asset bridge coverage. Base and OP blob submissions are sampled and independently verified against Ethereum transactions, receipts and blocks. Every packet refers to a sourced, timestamped observation. Initial packets replay the observed window; repeated IDs are deduplicated. No synthetic traffic or inferred dollar volumes.

The outer financial district contains selected documented products: JPM Coin on Base, BlackRock BUIDL on Ethereum, Franklin Templeton BENJI on Arbitrum and a Visa stablecoin settlement pilot. Static paths document relationships, not money flows. Banks and insurance are explicitly hypothetical expansion opportunities, not commitments and not assertions that their entire sectors are unconnected.

ETH staking is separate from block activity. ethereum.org's reported eligible-ETH-at-stake figure is rechecked every 15 minutes. The source does not publish its measurement epoch; the UI distinguishes the check time from the measurement time. Validator beacons are symbolic.

The activity and sources dialog exposes live block observations, source endpoints, connection coverage and events, timestamps and finality limits, downloadable block CSV, reported staking provenance, and separately labeled historical daily counts. Pause/speed controls change animation only.
