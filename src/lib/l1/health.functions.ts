import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import {
  emptyHealthSnapshot,
  isHealthMetricFresh,
  type HealthSnapshot,
} from "./health";
import { loadHealth } from "./health-loader.server";
import { publicFeedCache } from "./public-feed-cache.server";
export const getHealth = createServerFn({ method: "GET" }).handler(
  async (): Promise<HealthSnapshot> => {
    setResponseHeader("Cache-Control", "no-store, max-age=0");
    try {
      return await publicFeedCache<HealthSnapshot>({
        requestUrl: getRequest().url,
        key: "ethereum-health",
        ttlSeconds: 12,
        load: () => loadHealth(),
        timestamp: (value) => value.checkedAt,
        cacheable: (value) =>
          value.status !== "unavailable" &&
          isHealthMetricFresh(
            value.metrics.find((metric) => metric.id === "head-age"),
          ),
      });
    } catch {
      return emptyHealthSnapshot();
    }
  },
);
