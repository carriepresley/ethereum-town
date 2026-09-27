import { useCallback, useEffect, useRef, useState } from "react";
import { getFinanceMetrics } from "./finance-metrics.functions";
import type { FinanceMetricsSnapshot } from "./finance-metrics";
import { createFeedPoller } from "./telemetry-polling";
export function useFinanceMetrics() {
  const [snapshot, setSnapshot] = useState<FinanceMetricsSnapshot | null>(null);
  const [failed, setFailed] = useState(false),
    [loading, setLoading] = useState(false);
  const poller = useRef<ReturnType<typeof createFeedPoller> | null>(null);
  if (!poller.current)
    poller.current = createFeedPoller(() =>
      setLoading(Boolean(poller.current?.busy("finance"))),
    );
  const refresh = useCallback(() => {
    void poller.current!.run("finance", {
      request: (signal) => getFinanceMetrics({ signal }),
      timeoutMs: 20000,
      success: (value) => {
        setSnapshot((previous) => ({
          ...value,
          metrics: value.metrics.map((metric) => {
            const old = previous?.metrics.find((m) => m.id === metric.id);
            return metric.status === "unavailable" &&
              old?.value !== null &&
              old?.value !== undefined
              ? { ...old, status: "unavailable" }
              : metric;
          }),
        }));
        setFailed(false);
      },
      failure: () => setFailed(true),
    });
  }, []);
  useEffect(() => {
    refresh();
    const interval = setInterval(() => {
      if (!document.hidden) refresh();
    }, 60000);
    const visible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("online", visible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("online", visible);
      poller.current?.cancelAll();
    };
  }, [refresh]);
  return { snapshot, failed, loading, refresh };
}
