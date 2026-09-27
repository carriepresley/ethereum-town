# Ethereum health semantics review

Reviewed 2026-09-27 UTC against the existing telemetry, selected bridge/settlement, staking and stablecoin supply feeds. This is guidance for the health redesign, not a claim that every recommended feed is implemented.

## Visual contract

Keep **reliability**, **capacity** and **adoption** separate. Do not invent a combined health score. Green means an observation satisfies the stated display rule, not that Ethereum or an application is free of risk. Gray means missing, unsupported or stale data. Provider failure is not proof of a network outage. Ambient people and cars must remain explicitly illustrative.

| Area | Defensible measurement and wording | Avoid |
| --- | --- | --- |
| Town Hall | Latest and finalized execution blocks, each with a source timestamp. “Latest observed block” and “Head → finalized time gap.” Pulse only when a new block hash is observed. | Inferring validator participation, missed slots, all-network availability or actual per-transaction finalization time from two execution block heads. |
| Capacity | `gasUsed / gasLimit`, labeled “Block capacity used”; show the EIP-1559 target marker at half the limit. Base fee in gwei per gas, not a transaction price. | Calling the normal target “full,” assigning generic red to high fees, or confusing low fees with low reliability. |
| Blob station | `blobGasUsed / 131072` is a blob count for that block. Use current verified blob configuration before showing a utilization percentage. | Hardcoding historic 3/6 or 6/9 blob target/maximum forever; treating all blobs as uniquely identified L2 users or counting contents as money transfers. |
| L2 streets | Latest observed block and block age for each chain. Separate asset bridge stages, data publication, commitments and execution. | Comparing chains by one latest block’s transaction count, presenting it as TPS, or treating all event types as finalized settlement. |
| Foundation | “Reported ETH staked,” checked time, source and unknown metric timestamp. | Deriving live validator participation or decentralization from the amount staked, or calculating validator count by dividing stake by 32. |
| Financial district | Ethereum-only USDC and USDT token supplies. Other products remain documented connections unless a real metric exists. | USD valuation, transfer volume, whole-issuer circulation, all financial adoption or price-driven market-cap changes described as usage growth. |

The standard JSON-RPC block tags distinguish latest, safe and finalized heads. A finalized block head retrieved from one provider is a provider-reported consensus result, not an independent consensus audit. [Ethereum JSON-RPC](https://ethereum.org/developers/docs/apis/json-rpc/)

## Conservative display rules

- **Fresh feed:** a successful, validated observation within the feed’s stated TTL. Preserve the original observation and block timestamps when retaining last-known data. Never refresh their dates on failure.
- **Head age:** the health feed’s 90-second Ethereum freshness ceiling is an operational application rule. Beyond it say “Head observation delayed” or “Feed delayed.” One public RPC cannot establish an Ethereum outage.
- **Finality:** show the actual finalized block age and latest-to-finalized timestamp gap first. If a warning is needed, a conservative application threshold is a fresh latest head with head-to-finalized timestamp gap above four epochs (25.6 minutes), ideally repeated on successive successful checks. Label it “Finality observation delayed”; expose that this is an application threshold, not an Ethereum protocol rule. A fresh finalized head alone does not prove it advanced during the user’s session. Block-height gaps are not slot counts.
- **Capacity:** neutral numerical display is preferable to a generic good/bad threshold. Distinguish latest-block utilization from a sampled or complete rolling average. A normal EIP-1559 target is 50% of the block gas limit; capacity above the target drives subsequent base-fee pressure. This is not itself a fault. [Gas and fees](https://ethereum.org/developers/docs/gas/), [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559)
- **Missing values:** show “Unavailable,” not zero; do not interpolate a continuous history when only sampled observations exist. If displaying session trends, identify them as “Since this page opened” and deduplicate blocks.

The finality warning above is deliberately an engineering display choice. Ethereum currently uses 12-second slots and 32-slot epochs; checkpoint finality naturally advances in epochs rather than on every execution block. Its normal lag must not look like a missed-block alarm. [Proof of stake](https://ethereum.org/developers/docs/consensus-mechanisms/pos/), [Finality design](https://ethereum.org/roadmap/single-slot-finality/)

## Blob capacity must follow upgrades

EIP-4844 assigns 131,072 blob gas per blob. Blob target, maximum and fee parameters can change independently through BPO upgrades. The documented BPO2 schedule activated on January 7, 2026 with target 14 and maximum 21 blobs; that is a dated configuration, not a permanent constant. Prefer a validated `eth_config.current.blobSchedule` when the public provider supports it. If not, retain the observed blob count and omit an unverified percentage. [EIP-4844](https://eips.ethereum.org/EIPS/eip-4844), [EIP-7892](https://eips.ethereum.org/EIPS/eip-7892), [Fusaka/BPO announcement](https://blog.ethereum.org/2025/11/06/fusaka-mainnet-announcement), [EIP-7910](https://eips.ethereum.org/EIPS/eip-7910)

## Existing coverage limits that must remain visible

- `telemetry-loader.server.ts` polls each chain’s latest block. It does not collect every block between polls, so latest-block transaction counts do not measure a common interval across chains.
- `bridges.ts` and its loader cover selected contracts and stages, roughly 100 L1 blocks; Base/OP batch calls are sampled. “No matching event observed in this window” is valid. “This L2 stopped posting” is not. A last observed event is not necessarily the latest actual event.
- Rollup publication cadence is chain- and configuration-specific. Even OP Stack distinguishes batch policy from its allowed sequencing window. Do not apply one universal train-delay threshold or use the short feed window to assert a breach. [OP Stack configurability](https://specs.optimism.io/protocol/configurability.html), [Derivation and sequencing window](https://specs.optimism.io/protocol/overview.html)
- `staking-loader.server.ts` reads a public reported aggregate with no metric epoch. Its fetch time must remain “Source checked,” not “Stake as of.” No validator participation or concentration series is supplied. [Ethereum staking](https://ethereum.org/staking/)
- Stablecoin supplies are token quantities on Ethereum mainnet, read at a pinned execution block. USDT total supply can include treasury inventory. The existing scope notes must stay accessible. Supply, transfers and valuation are separate concepts.

## Necessary follow-up for deeper health claims

The implemented 16-block sample infers empty canonical slots and block-capacity history within its explicit window. To add validator participation, operator concentration, reliably complete rollup delay alerts, adoption trends or historical uptime, first add appropriately scoped consensus/history sources and their explicit measurement windows. The current feeds support useful observations, not comprehensive Ethereum-system health certification.
