export type FinanceMetricId = "usdc" | "usdt";
export type FinanceMetric = {
  id: FinanceMetricId;
  label: string;
  value: number | null;
  unit: "tokens";
  asOfBlock: number | null;
  blockTimestamp: string | null;
  observedAt: string | null;
  sourceUrl: string;
  status: "current" | "unavailable";
  scopeNote: string;
};
export type FinanceMetricsSnapshot = {
  checkedAt: string;
  status: "current" | "partial" | "unavailable";
  metrics: FinanceMetric[];
};

export const FINANCE_METRICS_POLL_MS = 60_000;
export const FINANCE_METRICS_MAX_AGE_MS = 180_000;
export const FINANCE_TOKEN_CONTRACTS = [
  {
    id: "usdc" as const,
    symbol: "USDC",
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
    issuerSourceUrl:
      "https://developers.circle.com/stablecoins/usdc-contract-addresses",
    scopeNote:
      "USDC totalSupply on Ethereum mainnet only, read directly from its token contract. Excludes USDC on other chains. This is a token quantity, not USD valuation, transfer volume or issuer-wide circulating supply. Latest observed block; finality not verified.",
  },
  {
    id: "usdt" as const,
    symbol: "USDT",
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    decimals: 6,
    issuerSourceUrl: "https://tether.to/en/supported-protocols/",
    scopeNote:
      "USDT totalSupply on Ethereum mainnet only, read directly from its token contract. May include issuer treasury inventory and excludes USDT on other chains. This is a token quantity, not USD valuation, transfer volume or issuer-wide circulating supply. Latest observed block; finality not verified.",
  },
] as const;

export function emptyFinanceMetrics(
  checkedAt = new Date().toISOString(),
): FinanceMetricsSnapshot {
  return {
    checkedAt,
    status: "unavailable",
    metrics: FINANCE_TOKEN_CONTRACTS.map((token) => ({
      id: token.id,
      label: token.symbol + " supply on Ethereum",
      value: null,
      unit: "tokens",
      asOfBlock: null,
      blockTimestamp: null,
      observedAt: null,
      sourceUrl: "https://etherscan.io/token/" + token.address,
      status: "unavailable",
      scopeNote: token.scopeNote,
    })),
  };
}

export function isFinanceMetricFresh(
  metric: FinanceMetric | undefined,
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
    block = Date.parse(metric.blockTimestamp);
  return (
    Number.isFinite(observed) &&
    Number.isFinite(block) &&
    now - observed >= -60_000 &&
    now - observed <= FINANCE_METRICS_MAX_AGE_MS &&
    now - block >= -60_000 &&
    now - block <= FINANCE_METRICS_MAX_AGE_MS
  );
}

/** A failed poll can retain its last known value, but can never advance the observation time. */
export function mergeFinanceMetricsSnapshot(
  previous: FinanceMetricsSnapshot,
  next: FinanceMetricsSnapshot,
): FinanceMetricsSnapshot {
  return {
    ...next,
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

export function markFinanceMetricsUnavailable(
  snapshot: FinanceMetricsSnapshot,
): FinanceMetricsSnapshot {
  return {
    ...snapshot,
    status: "unavailable",
    metrics: snapshot.metrics.map((metric) => ({
      ...metric,
      status: "unavailable",
    })),
  };
}
