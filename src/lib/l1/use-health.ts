import { useCallback, useEffect, useRef, useState } from "react";
import { getHealth } from "./health.functions";
import {
  HEALTH_POLL_MS,
  markHealthUnavailable,
  mergeHealthSnapshot,
  type HealthSnapshot,
} from "./health";
import { createFeedPoller } from "./telemetry-polling";
export function useHealth() {
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [failed, setFailed] = useState(false),
    [loading, setLoading] = useState(false);
  const poller = useRef<ReturnType<typeof createFeedPoller> | null>(null);
  if (!poller.current)
    poller.current = createFeedPoller(() =>
      setLoading(Boolean(poller.current?.busy("health"))),
    );
  const refresh = useCallback(() => {
    void poller.current!.run("health", {
      request: (signal) => getHealth({ signal }),
      timeoutMs: 20_000,
      success: (next) => {
        setSnapshot((previous) =>
          previous ? mergeHealthSnapshot(previous, next) : next,
        );
        setFailed(next.status === "unavailable");
      },
      failure: () => {
        setSnapshot((previous) =>
          previous ? markHealthUnavailable(previous) : null,
        );
        setFailed(true);
      },
    });
  }, []);
  useEffect(() => {
    refresh();
    const visible = () => {
      if (!document.hidden) refresh();
    };
    const interval = setInterval(visible, HEALTH_POLL_MS);
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
