# Ethereum Town

A live 3D miniature of the Ethereum network: **https://ethereum-town.vercel.app**

Every train that pulls into Mainnet Station is a real block, and the builder who assembled it lights up across the tracks. Fourteen layer-2 networks are shops, sized by real usage, with L2BEAT's risk rosette on each roof. Trucks carry their data to the station as blobs, the Beacon Vault shows the real staking queues and pays out each block's real rewards, and the Mint stacks up the stablecoins that live on Ethereum. Click any building to see what it is, its latest numbers, and links to the sources behind them.

## Reading the town

| Place | What it shows |
| --- | --- |
| Mainnet Station | Ethereum's base layer. One real block every 12 seconds; coach windows light up with its transaction count, and each container is one blob, colored by the L2 that posted it. In live mode the card also shows the block's builder tag, how far behind finality is, and what a transfer or swap costs right now. |
| Builders' Row | Across the tracks: block builders, sized by their share of recent blocks as tagged in each block's extra data. The workshop that built the arriving train lights up and sends it over; self-built blocks come from the proposer's own node. |
| L2 shops | The 14 L2s with the best average of their activity rank and value-secured rank on L2BEAT (7-day averages). Height grows with the square root of value secured (not counting the chain's own token, such as ARB or OP), the crowd with the square root of activity. The rosette on each roof is L2BEAT's five-part risk summary. Colors follow each network's brand (no logos). Stage 1 shops fly a green flag; L2BEAT's "Others" are shown as Not rated. |
| Trucks and couriers | L2s that post data to Ethereum send trucks with their real batches; those that keep data elsewhere (EigenDA, their own network) send couriers. |
| Beacon Vault | Staking. The people lined up outside are ETH waiting to be staked (about 20,000 ETH per figure); the short row at the OUT door is the exit queue. Gold sparks are each block's real reward payouts (up to 16 withdrawals per block), flying to the homes on the hill, which stand in for everyone who stakes; a figure leaving the OUT door marks a withdrawal of 1 ETH or more, usually stake leaving. |
| The Burn | The base fee burned by each block, and a running count of total ETH supply. |
| The Mint | Dollar stablecoins on Ethereum mainnet: the five largest, plus everything else, as coin stacks sized by supply. |

People, cars, courier timing and truck routes are decoration scaled from the data. Numbers in the cards are real and dated; estimates are labeled.

Every place has its own link, such as [#base](https://ethereum-town.vercel.app/#base), [#builders](https://ethereum-town.vercel.app/#builders) or [#mint](https://ethereum-town.vercel.app/#mint), and the Share button in each card copies it. Add `night`, `dusk`, `dawn` or `day` to set the time of day (for example `#night-station`). First-time visitors get a 30-second guided intro; it can be replayed from the About panel. On phones the card is a bottom sheet: drag the handle or tap the title.

## Data sources

- Blocks, gas, base fee, blob counts, builder tags and withdrawals: a public Ethereum JSON-RPC node (each block links to Etherscan)
- L2 activity, value secured, stages and risk summaries: [L2BEAT](https://l2beat.com)
- Blob attribution: [Blobscan](https://blobscan.com), matched to L2BEAT batch-poster addresses
- Staking and queues: [validatorqueue.com](https://www.validatorqueue.com/) (beaconcha.in data)
- Issuance, burn and supply: [ultrasound.money](https://ultrasound.money); stablecoins and their issuers: [DefiLlama](https://defillama.com/stablecoins/Ethereum)

## How it works

- `index.html` is the whole town: three.js 0.170 from jsDelivr, fonts from Google Fonts, and an embedded snapshot from Sep 28, 2026.
- `api/pulse.js` returns the latest mainnet blocks, which L2s posted blobs in them, each block's builder tag and withdrawals, the finalized block and the typical tip (cached at the edge for about 8 seconds).
- `api/town.js` returns the L2 district with risk summaries, builder shares and payouts over the last 200 blocks, staking queues, supply, burn and stablecoins (cached for 15 minutes).
- If the functions are unavailable, the page replays three hours of real blocks from the snapshot.
- Phones and weaker machines render fewer pixels without shadows from people and cars; standard-density desktop screens get multisampled antialiasing. If the first seconds run slowly, the page steps quality down once.

No build step, environment variables, accounts, wallets or analytics. Vercel serves the root folder as-is.

## Editing

The page is assembled from the files in `source/`:

```
source/head.html        page shell, styles, About panel
source/js/*.js          the town (scene, buildings, actors, simulation, cards, main loop)
source/data.js          embedded snapshot used before live data loads, and for the replay
source/api_src/*.js     serverless function templates
source/build.py         rebuilds index.html and api/ at the repo root
source/devserver.js     local stand-in for Vercel (serves the root and runs api/)
source/prep.py          how data.js was generated (needs the raw snapshot files, not included)
```

```
python3 source/build.py          # rebuild after editing anything in source/
node source/devserver.js         # http://localhost:8787
```

## History

This version replaced an earlier Ethereum Town app (TanStack Start, "Ethereum Hall"). That app is preserved in this repository's history at commit `f5c5b91`.

The idea of a data-sized town was sparked by Ryan Sael's Token Town.
