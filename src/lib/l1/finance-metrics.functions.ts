import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import {
  emptyFinanceMetrics,
  isFinanceMetricFresh,
  type FinanceMetricsSnapshot,
} from "./finance-metrics";
import { loadFinanceMetrics } from "./finance-metrics-loader.server";
import { publicFeedCache } from "./public-feed-cache.server";

export const getFinanceMetrics = createServerFn({ method: "GET" }).handler(
  async (): Promise<FinanceMetricsSnapshot> => {
    setResponseHeader("Cache-Control", "no-store, max-age=0");
    try {
      return await publicFeedCache<FinanceMetricsSnapshot>({
        requestUrl: getRequest().url,
        key: "ethereum-stablecoin-supply",
        ttlSeconds: 60,
        load: () => loadFinanceMetrics(),
        timestamp: (value) => value.checkedAt,
        cacheable: (value) =>
          value.status === "current" &&
          value.metrics.length === 2 &&
          value.metrics.every((metric) => isFinanceMetricFresh(metric)),
      });
    } catch {
      return emptyFinanceMetrics();
    }
  },
);
