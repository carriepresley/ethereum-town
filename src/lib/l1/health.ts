export type HealthMetricId =
  | "head-age"
  | "finality-lag"
  | "gas-used"
  | "base-fee"
  | "blob-count"
  | "blob-base-fee"
  | "slot-delivery";
export type HealthMetric = {
  id: HealthMetricId;
  label: string;
  value: number | null;
  unit: "seconds" | "percent" | "gwei" | "blobs";
  status: "current" | "unavailable";
  observedAt: string | null;
  blockTimestamp: string | null;
  asOfBlock: number | null;
  sourceUrl: string;
  scopeNote: string;
};
export type HealthBlock = { number: number; hash: string; timestamp: string };
export type HealthSnapshot = {
  checkedAt: string;
  status: "current" | "partial" | "unavailable";
  latest:
    | (HealthBlock & {
        gasUsed: number | null;
        gasLimit: number | null;
        baseFeeGwei: number | null;
        blobGasUsed: number | null;
      })
    | null;
  finalized: HealthBlock | null;
  finalityLagSeconds: number | null;
  missedSlots: {
    count: number;
    sampledSlots: number;
    start: string;
    end: string;
  } | null;
  sample: {
    blocks: number;
    intervals: number;
    elapsedSeconds: number;
    inferredEmptySlots: number;
    firstBlock: number;
    lastBlock: number;
  } | null;
  blobBaseFeeGwei: number | null;
  recentBlocks: Array<{
    number: number;
    timestamp: string;
    gasUsedPercent: number | null;
  }>;
  metrics: HealthMetric[];
};
export const HEALTH_POLL_MS = 30_000;
export const HEALTH_MAX_AGE_MS = 90_000;
export const HEALTH_SAMPLE_BLOCKS = 16;
export const HEALTH_METRIC_DEFINITIONS = [
  {
    id: "head-age",
    label: "Latest block age",
    unit: "seconds",
    scopeNote:
      "Age of the latest canonical Ethereum execution block when this provider was checked. A single provider observation, not a network-wide outage diagnosis.",
  },
  {
    id: "finality-lag",
    label: "Finality distance",
    unit: "seconds",
    scopeNote:
      "Timestamp distance from this provider's latest block to its finalized execution block. Some distance is normal; this is not transaction confirmation time or a direct validator participation measure.",
  },
  {
    id: "gas-used",
    label: "Block space used",
    unit: "percent",
    scopeNote:
      "gasUsed divided by gasLimit in one observed block. This is the hard block limit, not the EIP-1559 target; higher utilization is not automatically healthier.",
  },
  {
    id: "base-fee",
    label: "Execution base fee",
    unit: "gwei",
    scopeNote:
      "Base fee per execution gas in the observed block, in gwei. Excludes priority fees and is not the total cost of a transaction.",
  },
  {
    id: "blob-count",
    label: "Blobs in latest block",
    unit: "blobs",
    scopeNote:
      "blobGasUsed divided by 131,072 blob gas per blob. Counts all blobs in the observed Ethereum block; does not identify an L2, measure bridged money, or assert current maximum blob capacity.",
  },
  {
    id: "blob-base-fee",
    label: "Blob gas base fee",
    unit: "gwei",
    scopeNote:
      "The provider's current eth_blobBaseFee reading, in gwei per blob gas. This method cannot be pinned to a block and is reported separately from the observed block. Not a total per-blob or per-transaction fee.",
  },
  {
    id: "slot-delivery",
    label: "Recent slot coverage",
    unit: "percent",
    scopeNote:
      "Canonical block intervals divided by elapsed 12-second slots across 16 linked execution blocks. Gaps infer slots without a surviving canonical block. Excludes the newest unfilled slot and is not validator attestation participation, global uptime, or a full consensus audit.",
  },
] as const;

export function emptyHealthSnapshot(
  checkedAt = new Date().toISOString(),
): HealthSnapshot {
  return {
    checkedAt,
    status: "unavailable",
    latest: null,
    finalized: null,
    finalityLagSeconds: null,
    missedSlots: null,
    sample: null,
    blobBaseFeeGwei: null,
    recentBlocks: [],
    metrics: HEALTH_METRIC_DEFINITIONS.map((metric) => ({
      ...metric,
      value: null,
      status: "unavailable",
      observedAt: null,
      blockTimestamp: null,
      asOfBlock: null,
      sourceUrl: "https://ethereum.publicnode.com/",
    })),
  };
}
export function isHealthMetricFresh(
  metric: HealthMetric | undefined,
  now = Date.now(),
): boolean {
  if (
    !metric ||
    metric.status !== "current" ||
    metric.value === null ||
    !metric.observedAt ||
    !metric.blockTimestamp
  )
    return false;
  const observed = Date.parse(metric.observedAt),
    head = Date.parse(metric.blockTimestamp);
  return (
    Number.isFinite(observed) &&
    Number.isFinite(head) &&
    now - observed >= -30_000 &&
    now - observed <= HEALTH_MAX_AGE_MS &&
    now - head >= -30_000 &&
    now - head <= HEALTH_MAX_AGE_MS
  );
}
/** Retain values for transparent last-known display, never their current status or a new observation time. */
export function mergeHealthSnapshot(
  previous: HealthSnapshot,
  next: HealthSnapshot,
): HealthSnapshot {
  return {
    ...next,
    latest: next.latest ?? previous.latest,
    finalized: next.finalized ?? previous.finalized,
    finalityLagSeconds: next.finalityLagSeconds ?? previous.finalityLagSeconds,
    missedSlots: next.missedSlots ?? previous.missedSlots,
    sample: next.sample ?? previous.sample,
    blobBaseFeeGwei: next.blobBaseFeeGwei ?? previous.blobBaseFeeGwei,
    recentBlocks:
      next.status === "unavailable" ? previous.recentBlocks : next.recentBlocks,
    metrics: next.metrics.map((metric) => {
      const old = previous.metrics.find((row) => row.id === metric.id);
      return metric.status === "unavailable" &&
        old?.value !== null &&
        old?.value !== undefined
        ? { ...old, status: "unavailable" }
        : metric;
    }),
  };
}
export function markHealthUnavailable(
  snapshot: HealthSnapshot,
): HealthSnapshot {
  return {
    ...snapshot,
    status: "unavailable",
    metrics: snapshot.metrics.map((metric) => ({
      ...metric,
      status: "unavailable",
    })),
  };
}
