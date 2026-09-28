# Ethereum Town

A live 3D miniature of the Ethereum network: **https://ethereum-town.vercel.app**

Every train that pulls into Mainnet Station is a real block. The 14 busiest layer-2 networks are shops, sized by real usage. Trucks carry their data to the station as blobs, and the Beacon Vault shows the real staking queues. Click any building to see what it is, its latest numbers, and links to the sources behind them.

## Reading the town

| Place | What it shows |
| --- | --- |
| Mainnet Station | Ethereum's base layer. One real block every 12 seconds; coach windows light up with its transaction count, and each container is one blob, colored by the L2 that posted it. |
| L2 shops | The 14 busiest L2s by 7-day activity on L2BEAT. Height grows with the square root of value secured, the crowd with the square root of activity. Colors follow each network's brand (no logos). Stage 1 shops fly a green flag; L2BEAT's "Others" are shown as Not rated. |
| Trucks and couriers | L2s that post data to Ethereum send trucks with their real batches; those that keep data elsewhere (EigenDA, their own network) send couriers. |
| Beacon Vault | Staking. The people lined up outside are ETH waiting to be staked (about 20,000 ETH per figure); the short row at the OUT door is the exit queue. Gold sparks leaving the vault are staking rewards, flying to the homes on the hill, which stand in for everyone who stakes. |
| The Burn | The base fee burned by each block, and a running count of total ETH supply. |

People, cars, courier timing and truck routes are decoration scaled from the data. Numbers in the cards are real and dated; estimates are labeled.

## Data sources

- Blocks, gas, base fee and blob counts: a public Ethereum JSON-RPC node (each block links to Etherscan)
- L2 activity, value secured and stages: [L2BEAT](https://l2beat.com)
- Blob attribution: [Blobscan](https://blobscan.com), matched to L2BEAT batch-poster addresses
- Staking and queues: [validatorqueue.com](https://www.validatorqueue.com/) (beaconcha.in data)
- Issuance, burn and supply: [ultrasound.money](https://ultrasound.money); stablecoins: [DefiLlama](https://defillama.com/stablecoins/Ethereum)

## How it works

- `index.html` is the whole town: three.js 0.170 from jsDelivr, fonts from Google Fonts, and an embedded snapshot from Sep 28, 2026.
- `api/pulse.js` returns the latest mainnet blocks and which L2s posted blobs in them (cached at the edge for about 8 seconds).
- `api/town.js` returns L2 rankings, staking queues, supply, burn and stablecoins (cached for 15 minutes).
- If the functions are unavailable, the page replays three hours of real blocks from the snapshot.

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
