import { describe, expect, test } from "bun:test";
import {
  emptyFinanceMetrics,
  FINANCE_TOKEN_CONTRACTS,
  isFinanceMetricFresh,
  markFinanceMetricsUnavailable,
  mergeFinanceMetricsSnapshot,
} from "../src/lib/l1/finance-metrics";
import {
  FINANCE_METRICS_RPC,
  loadFinanceMetrics,
  parseTokenSupply,
} from "../src/lib/l1/finance-metrics-loader.server";
import { publicFeedCache } from "../src/lib/l1/public-feed-cache.server";

const abi = (value: bigint) => "0x" + value.toString(16).padStart(64, "0");
const hash = "0x" + "a".repeat(64);
const block = () => ({
  number: "0x100",
  hash,
  timestamp: "0x" + Math.floor(Date.now() / 1000).toString(16),
});
type RequestCall = {
  jsonrpc: string;
  id: number;
  method: string;
  params: unknown[];
};
type Reply = { jsonrpc: string; id: number; result?: unknown; error?: unknown };
function source(
  mutate?: (replies: Reply[], calls: RequestCall[], attempt: number) => void,
) {
  const requests: RequestCall[][] = [];
  const fetchImpl = (async (url: unknown, init?: RequestInit) => {
    expect(url).toBe(FINANCE_METRICS_RPC);
    expect(init?.method).toBe("POST");
    expect(init?.cache).toBe("no-store");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    const calls = JSON.parse(String(init?.body)) as RequestCall[];
    requests.push(calls);
    const replies: Reply[] = calls.map((call) => ({
      jsonrpc: "2.0",
      id: call.id,
      result:
        call.method === "eth_chainId"
          ? "0x1"
          : call.method === "eth_blockNumber"
            ? "0x100"
            : call.method === "eth_getBlockByNumber"
              ? block()
              : (call.params[0] as { data?: string }).data === "0x313ce567"
                ? abi(6n)
                : call.id === 10
                  ? abi(45_000_000_000_123456n)
                  : abi(80_000_000_000_654321n),
    }));
    mutate?.(replies, calls, requests.length);
    return Response.json(replies.reverse());
  }) as typeof fetch;
  return { fetchImpl, requests };
}

describe("Ethereum-only stablecoin observations", () => {
  test("both issuer-verified contracts are read at the same verified Ethereum block with six decimals", async () => {
    const { fetchImpl, requests } = source();
    const snapshot = await loadFinanceMetrics(fetchImpl);
    expect(snapshot.status).toBe("current");
    expect(snapshot.metrics.map((metric) => metric.id)).toEqual([
      "usdc",
      "usdt",
    ]);
    expect(snapshot.metrics.map((metric) => metric.value)).toEqual([
      45_000_000_000.123456, 80_000_000_000.654321,
    ]);
    expect(
      snapshot.metrics.every(
        (metric) => metric.asOfBlock === 256 && isFinanceMetricFresh(metric),
      ),
    ).toBe(true);
    expect(
      snapshot.metrics.every(
        (metric) =>
          metric.unit === "tokens" &&
          metric.scopeNote.includes("not USD valuation"),
      ),
    ).toBe(true);
    expect(requests).toHaveLength(3);
    const reads = requests.flat().filter((call) => call.method === "eth_call");
    expect(reads).toHaveLength(4);
    expect(reads.every((call) => call.params[1] === "0x100")).toBe(true);
    expect(
      reads
        .filter(
          (call) => (call.params[0] as { data?: string }).data === "0x18160ddd",
        )
        .map((call) => (call.params[0] as { to?: string }).to),
    ).toEqual(FINANCE_TOKEN_CONTRACTS.map((token) => token.address));
    expect(requests[2][0].method).toBe("eth_getBlockByNumber");
  });

  test("wrong chain, malformed identifiers, missing batch rows and future or old blocks fail closed", async () => {
    const cases: Array<
      (replies: Reply[], calls: RequestCall[], attempt: number) => void
    > = [
      (replies) => {
        const row = replies.find((row) => row.id === 1);
        if (row) row.result = "0x2";
      },
      (replies) => {
        if (replies.length > 1) replies[1].id = replies[0].id;
      },
      (replies) => {
        replies.pop();
      },
      (replies) => {
        const row = replies.find((row) => row.id === 2);
        if (row) row.result = "0x20000000000000";
      },
      (replies) => {
        const row = replies.find((row) => row.id === 3);
        if (row)
          (row.result as ReturnType<typeof block>).timestamp =
            "0x" + (Math.floor(Date.now() / 1000) - 181).toString(16);
      },
      (replies) => {
        const row = replies.find((row) => row.id === 3);
        if (row)
          (row.result as ReturnType<typeof block>).timestamp =
            "0x" + (Math.floor(Date.now() / 1000) + 120).toString(16);
      },
      (replies) => {
        const row = replies.find((row) => row.id === 3);
        if (row) (row.result as ReturnType<typeof block>).number = "0x101";
      },
    ];
    for (const mutate of cases) {
      const snapshot = await loadFinanceMetrics(source(mutate).fetchImpl);
      expect(snapshot.status).toBe("unavailable");
      expect(
        snapshot.metrics.every(
          (metric) => metric.value === null && metric.asOfBlock === null,
        ),
      ).toBe(true);
    }
  });

  test("a reorg during pinned contract reads invalidates both supplies", async () => {
    const snapshot = await loadFinanceMetrics(
      source((replies) => {
        const row = replies.find((row) => row.id === 4);
        if (row)
          (row.result as ReturnType<typeof block>).hash = "0x" + "b".repeat(64);
      }).fetchImpl,
    );
    expect(snapshot.status).toBe("unavailable");
    expect(snapshot.metrics.every((metric) => metric.value === null)).toBe(
      true,
    );
  });

  test("a single token error or wrong decimals keeps the independent valid observation", async () => {
    for (const mutate of [
      (row: Reply) => {
        delete row.result;
        row.error = { code: -32000, message: "Private provider detail" };
      },
      (row: Reply) => {
        row.result = abi(18n);
      },
    ]) {
      const snapshot = await loadFinanceMetrics(
        source((replies) => {
          const row = replies.find((row) => row.id === 13);
          if (row) mutate(row);
        }).fetchImpl,
      );
      expect(snapshot.status).toBe("partial");
      expect(snapshot.metrics[0].status).toBe("current");
      expect(snapshot.metrics[1].value).toBeNull();
      expect(JSON.stringify(snapshot)).not.toContain("Private provider detail");
    }
  });

  test("ABI values cannot silently truncate, overflow or accept non-six-decimal units; zero is legitimate", () => {
    expect(parseTokenSupply(abi(0n), abi(6n))).toBe(0);
    expect(parseTokenSupply(abi(1n), abi(6n))).toBe(0.000001);
    expect(() => parseTokenSupply("0x1", abi(6n))).toThrow();
    expect(() => parseTokenSupply(abi(1n), "0x6")).toThrow();
    expect(() => parseTokenSupply(abi(1n), abi(18n))).toThrow();
    expect(() => parseTokenSupply(abi(2n ** 255n), abi(6n))).toThrow();
  });

  test("HTTP failures, rejected requests and oversized responses never produce supply or raw errors", async () => {
    for (const fetchImpl of [
      async () => new Response("Private provider failure", { status: 429 }),
      async () => {
        throw new Error("Private provider failure");
      },
      async () =>
        new Response("[]", {
          headers: { "content-length": String(3 * 1024 * 1024) },
        }),
    ]) {
      const snapshot = await loadFinanceMetrics(fetchImpl as typeof fetch);
      expect(snapshot.status).toBe("unavailable");
      expect(
        snapshot.metrics.every(
          (metric) => metric.value === null && metric.observedAt === null,
        ),
      ).toBe(true);
      expect(JSON.stringify(snapshot)).not.toContain(
        "Private provider failure",
      );
    }
  });

  test("failed polls retain last known data without advancing timestamps or displaying it as current", async () => {
    const old = await loadFinanceMetrics(source().fetchImpl);
    const merged = mergeFinanceMetricsSnapshot(old, emptyFinanceMetrics());
    expect(merged.status).toBe("unavailable");
    expect(merged.metrics[0].value).toBe(old.metrics[0].value);
    expect(merged.metrics[0].observedAt).toBe(old.metrics[0].observedAt);
    expect(isFinanceMetricFresh(merged.metrics[0])).toBe(false);
    expect(isFinanceMetricFresh(old.metrics[0], Date.now() + 181_000)).toBe(
      false,
    );
    expect(
      markFinanceMetricsUnavailable(old).metrics.every(
        (metric) => !isFinanceMetricFresh(metric),
      ),
    ).toBe(true);
  });

  test("successful completed supply values cache for up to sixty seconds without changing checkedAt", async () => {
    const snapshot = await loadFinanceMetrics(source().fetchImpl);
    let reads = 0;
    const options = {
      requestUrl: "https://finance-metrics-test.example/",
      key: "ethereum-stablecoin-supply",
      ttlSeconds: 60,
      load: async () => {
        reads++;
        return snapshot;
      },
      timestamp: (value: typeof snapshot) => value.checkedAt,
      cacheable: (value: typeof snapshot) => value.status === "current",
    };
    const first = await publicFeedCache(options),
      second = await publicFeedCache(options);
    expect(reads).toBe(1);
    expect(first).toEqual(second);
    expect(second.checkedAt).toBe(snapshot.checkedAt);
    await publicFeedCache({ ...options, ttlSeconds: 61 });
    expect(reads).toBe(2);
  });
});
