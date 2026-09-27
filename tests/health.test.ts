import { describe, expect, test } from "bun:test";
import {
  emptyHealthSnapshot,
  HEALTH_MAX_AGE_MS,
  HEALTH_SAMPLE_BLOCKS,
  isHealthMetricFresh,
  markHealthUnavailable,
  mergeHealthSnapshot,
} from "../src/lib/l1/health";
import { HEALTH_RPC, loadHealth } from "../src/lib/l1/health-loader.server";
import { publicFeedCache } from "../src/lib/l1/public-feed-cache.server";
const hex = (value: number) => "0x" + value.toString(16);
const hash = (value: number) => "0x" + value.toString(16).padStart(64, "0");
type Call = { jsonrpc: string; id: number; method: string; params: unknown[] };
type Reply = { jsonrpc: string; id: number; result?: unknown; error?: unknown };
function source(
  mutate?: (replies: Reply[], calls: Call[], attempt: number) => void,
  emptySlots = 0,
) {
  const requests: Call[][] = [];
  const headTime = Math.floor(Date.now() / 1000) - 4;
  const block = (number: number) => ({
    number: hex(number),
    hash: hash(number),
    parentHash: hash(number - 1),
    timestamp: hex(
      headTime - (256 - number) * 12 - (number < 250 ? emptySlots * 12 : 0),
    ),
    gasUsed: hex(15_000_000),
    gasLimit: hex(60_000_000),
    baseFeePerGas: hex(150_000_000),
    blobGasUsed: hex(262_144),
  });
  const fetchImpl = (async (url: unknown, init?: RequestInit) => {
    expect(url).toBe(HEALTH_RPC);
    expect(init?.method).toBe("POST");
    expect(init?.cache).toBe("no-store");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    const calls: Call[] = JSON.parse(String(init?.body));
    requests.push(calls);
    const replies: Reply[] = calls.map((call) => ({
      jsonrpc: "2.0",
      id: call.id,
      result:
        call.method === "eth_chainId"
          ? "0x1"
          : call.method === "eth_blobBaseFee"
            ? "0x1"
            : block(
                call.params[0] === "latest"
                  ? 256
                  : call.params[0] === "finalized"
                    ? 192
                    : Number(call.params[0]),
              ),
    }));
    mutate?.(replies, calls, requests.length);
    return Response.json(replies.reverse());
  }) as typeof fetch;
  return { fetchImpl, requests };
}
function metric(snapshot: Awaited<ReturnType<typeof loadHealth>>, id: string) {
  return snapshot.metrics.find((item) => item.id === id)!;
}

describe("Ethereum health observations", () => {
  test("verifies mainnet and a pinned head, normalizes units and bounds linked-block history", async () => {
    const { fetchImpl, requests } = source();
    const snapshot = await loadHealth(fetchImpl);
    expect(snapshot.status).toBe("current");
    expect(snapshot.latest?.number).toBe(256);
    expect(snapshot.finalized?.number).toBe(192);
    expect(snapshot.finalityLagSeconds).toBe(768);
    expect(metric(snapshot, "gas-used").value).toBe(25);
    expect(metric(snapshot, "base-fee").value).toBe(0.15);
    expect(metric(snapshot, "blob-count").value).toBe(2);
    expect(metric(snapshot, "blob-base-fee").value).toBe(1e-9);
    expect(metric(snapshot, "blob-base-fee").asOfBlock).toBeNull();
    expect(snapshot.sample?.blocks).toBe(HEALTH_SAMPLE_BLOCKS);
    expect(snapshot.recentBlocks.map((row) => row.number)).toEqual(
      Array.from({ length: 16 }, (_, i) => 241 + i),
    );
    expect(
      snapshot.recentBlocks.every((row) => row.gasUsedPercent === 25),
    ).toBe(true);
    expect(
      snapshot.recentBlocks.every(
        (row, i, rows) =>
          i === 0 ||
          Date.parse(row.timestamp) > Date.parse(rows[i - 1].timestamp),
      ),
    ).toBe(true);
    expect(snapshot.missedSlots).toMatchObject({ count: 0, sampledSlots: 15 });
    expect(metric(snapshot, "slot-delivery").value).toBe(100);
    expect(snapshot.metrics.every((row) => isHealthMetricFresh(row))).toBe(
      true,
    );
    expect(requests).toHaveLength(3);
    expect(requests[1]).toHaveLength(15);
    expect(requests[2][0].params).toEqual(["0x100", false]);
    expect(
      requests
        .flat()
        .every((call) =>
          ["eth_chainId", "eth_getBlockByNumber", "eth_blobBaseFee"].includes(
            call.method,
          ),
        ),
    ).toBe(true);
  });

  test("sampled gas history preserves missing readings and validates zero-to-100 bounds without more calls", async () => {
    const { fetchImpl, requests } = source((rows, _calls, attempt) => {
      if (attempt !== 2) return;
      for (const row of rows) {
        const raw = row.result as Record<string, unknown>;
        if (row.id === 100) delete raw.gasUsed;
        if (row.id === 101) raw.gasUsed = hex(60_000_001);
        if (row.id === 102) raw.gasLimit = "0x0";
        if (row.id === 103) raw.gasUsed = "0x0";
        if (row.id === 104) raw.gasUsed = hex(60_000_000);
        if (row.id === 105) raw.gasLimit = "0x20000000000000";
      }
    });
    const snapshot = await loadHealth(fetchImpl);
    const gasAt = (blockNumber: number) =>
      snapshot.recentBlocks.find((row) => row.number === blockNumber)
        ?.gasUsedPercent;
    expect(snapshot.recentBlocks).toHaveLength(16);
    expect(gasAt(255)).toBeNull();
    expect(gasAt(254)).toBeNull();
    expect(gasAt(253)).toBeNull();
    expect(gasAt(252)).toBe(0);
    expect(gasAt(251)).toBe(100);
    expect(gasAt(250)).toBeNull();
    expect(requests).toHaveLength(3);
    expect(requests.flat()).toHaveLength(20);
  });

  test("timestamp gaps infer recent empty canonical slots, never validator participation", async () => {
    const snapshot = await loadHealth(source(undefined, 2).fetchImpl);
    expect(snapshot.status).toBe("current");
    expect(snapshot.missedSlots).toMatchObject({ count: 2, sampledSlots: 17 });
    expect(metric(snapshot, "slot-delivery").value).toBeCloseTo(
      (15 / 17) * 100,
    );
    expect(metric(snapshot, "slot-delivery").scopeNote).toContain(
      "not validator attestation participation",
    );
  });

  test("wrong chain, malformed response identity, stale or future heads and unsafe heights fail closed", async () => {
    const mutations: Array<
      (rows: Reply[], calls: Call[], attempt: number) => void
    > = [
      (rows) => {
        const item = rows.find((r) => r.id === 1);
        if (item) item.result = "0xa";
      },
      (rows, _calls, attempt) => {
        if (attempt === 1) rows[1].id = rows[0].id;
      },
      (rows, _calls, attempt) => {
        if (attempt === 1) rows.pop();
      },
      (rows) => {
        const item = rows.find((r) => r.id === 2);
        if (item)
          (item.result as Record<string, unknown>).number = "0x20000000000000";
      },
      (rows) => {
        const item = rows.find((r) => r.id === 2);
        if (item)
          (item.result as Record<string, unknown>).timestamp = hex(
            Math.floor((Date.now() - HEALTH_MAX_AGE_MS - 10_000) / 1000),
          );
      },
      (rows) => {
        const item = rows.find((r) => r.id === 2);
        if (item)
          (item.result as Record<string, unknown>).timestamp = hex(
            Math.floor(Date.now() / 1000) + 120,
          );
      },
      (rows) => {
        const item = rows.find((r) => r.id === 2);
        if (item) (item.result as Record<string, unknown>).hash = "0xdead";
      },
      (rows, _calls, attempt) => {
        if (attempt === 1)
          rows[0].error = { message: "do not expose this upstream text" };
      },
    ];
    for (const mutation of mutations) {
      const snapshot = await loadHealth(source(mutation).fetchImpl);
      expect(snapshot.status).toBe("unavailable");
      expect(snapshot.latest).toBeNull();
      expect(
        snapshot.metrics.every(
          (row) => row.value === null && row.status === "unavailable",
        ),
      ).toBe(true);
      expect(JSON.stringify(snapshot)).not.toContain("do not expose");
    }
  });

  test("reorg during sampling rejects the whole observation", async () => {
    const snapshot = await loadHealth(
      source((rows, _calls, attempt) => {
        if (attempt === 3)
          (rows[0].result as Record<string, unknown>).hash = hash(123);
      }).fetchImpl,
    );
    expect(snapshot.status).toBe("unavailable");
  });

  test("missing finalized and blob fee methods leave independent execution metrics current", async () => {
    const snapshot = await loadHealth(
      source((rows) => {
        for (const row of rows)
          if (row.id === 3 || row.id === 4) {
            delete row.result;
            row.error = { code: -32601 };
          }
      }).fetchImpl,
    );
    expect(snapshot.status).toBe("partial");
    expect(snapshot.finalized).toBeNull();
    expect(snapshot.blobBaseFeeGwei).toBeNull();
    expect(metric(snapshot, "gas-used").value).toBe(25);
    expect(metric(snapshot, "finality-lag").status).toBe("unavailable");
    expect(metric(snapshot, "blob-base-fee").status).toBe("unavailable");
    expect(metric(snapshot, "slot-delivery").status).toBe("current");
  });

  test("old finalized timestamp remains measurable with a current head rather than hiding possible finality trouble", async () => {
    const snapshot = await loadHealth(
      source((rows) => {
        const row = rows.find((item) => item.id === 3);
        if (row)
          (row.result as Record<string, unknown>).timestamp = hex(
            Math.floor(Date.now() / 1000) - 3600,
          );
      }).fetchImpl,
    );
    expect(snapshot.finalityLagSeconds).toBeGreaterThan(3500);
    expect(isHealthMetricFresh(metric(snapshot, "finality-lag"))).toBe(true);
  });

  test("inconsistent finalized head, broken parent links and non-slot timestamp gaps become unavailable individually", async () => {
    for (const mode of ["finality", "parent", "time"]) {
      const snapshot = await loadHealth(
        source((rows, _calls, attempt) => {
          if (mode === "finality") {
            const row = rows.find((item) => item.id === 3);
            if (row) (row.result as Record<string, unknown>).number = "0x101";
          } else if (attempt === 2) {
            (rows[0].result as Record<string, unknown>)[
              mode === "parent" ? "hash" : "timestamp"
            ] =
              mode === "parent"
                ? hash(555)
                : hex(Math.floor(Date.now() / 1000) - 19);
          }
        }).fetchImpl,
      );
      expect(snapshot.status).toBe("partial");
      expect(metric(snapshot, "head-age").status).toBe("current");
      expect(
        metric(snapshot, mode === "finality" ? "finality-lag" : "slot-delivery")
          .status,
      ).toBe("unavailable");
      if (mode !== "finality") expect(snapshot.recentBlocks).toEqual([]);
    }
  });

  test("impossible gas usage and malformed blob counts do not become a plausible capacity percentage", async () => {
    const snapshot = await loadHealth(
      source((rows) => {
        const row = rows.find((item) => item.id === 2);
        if (row) {
          const block = row.result as Record<string, unknown>;
          block.gasUsed = hex(70_000_000);
          block.blobGasUsed = "0x3";
          delete block.baseFeePerGas;
        }
      }).fetchImpl,
    );
    expect(snapshot.status).toBe("partial");
    expect(metric(snapshot, "gas-used").value).toBeNull();
    expect(metric(snapshot, "blob-count").value).toBeNull();
    expect(metric(snapshot, "base-fee").value).toBeNull();
  });

  test("network and over-limit bodies produce a bounded unavailable result", async () => {
    const fixtures = [
      (async () => {
        throw new Error("secret upstream error");
      }) as typeof fetch,
      (async () =>
        new Response("oversize", {
          headers: { "content-length": String(3 * 1024 * 1024) },
        })) as typeof fetch,
      (async () => new Response("failed", { status: 503 })) as typeof fetch,
    ];
    for (const fetchImpl of fixtures) {
      const snapshot = await loadHealth(fetchImpl);
      expect(snapshot.status).toBe("unavailable");
      expect(JSON.stringify(snapshot)).not.toContain("secret upstream");
    }
  });

  test("failure retention preserves source times and never marks old values current", async () => {
    const previous = await loadHealth(source().fetchImpl);
    const checkedAt = new Date(
      Date.parse(previous.checkedAt) + 30_000,
    ).toISOString();
    const merged = mergeHealthSnapshot(
      previous,
      emptyHealthSnapshot(checkedAt),
    );
    expect(merged.checkedAt).toBe(checkedAt);
    expect(merged.latest).toEqual(previous.latest);
    expect(merged.recentBlocks).toEqual(previous.recentBlocks);
    expect(markHealthUnavailable(previous).recentBlocks).toEqual(
      previous.recentBlocks,
    );
    const invalidSample = await loadHealth(
      source((rows, _calls, attempt) => {
        if (attempt === 2)
          (rows[0].result as Record<string, unknown>).hash = hash(555);
      }).fetchImpl,
    );
    expect(mergeHealthSnapshot(previous, invalidSample).recentBlocks).toEqual(
      [],
    );
    expect(metric(merged, "gas-used").value).toBe(25);
    expect(metric(merged, "gas-used").observedAt).toBe(
      metric(previous, "gas-used").observedAt,
    );
    expect(merged.metrics.every((row) => !isHealthMetricFresh(row))).toBe(true);
    expect(
      markHealthUnavailable(previous).metrics.every(
        (row) => !isHealthMetricFresh(row),
      ),
    ).toBe(true);
    expect(
      isHealthMetricFresh(
        metric(previous, "head-age"),
        Date.parse(previous.checkedAt) + HEALTH_MAX_AGE_MS + 1,
      ),
    ).toBe(false);
  });

  test("completed cache uses the fixed health key and does not advance its observation time", async () => {
    const observed = await loadHealth(source().fetchImpl);
    let count = 0;
    const options = {
      requestUrl: "https://health-cache-test.example/get",
      key: "ethereum-health",
      ttlSeconds: 12,
      load: async () => {
        count++;
        return observed;
      },
      timestamp: (value: typeof observed) => value.checkedAt,
      cacheable: (value: typeof observed) => value.status === "current",
    };
    const one = await publicFeedCache(options),
      two = await publicFeedCache(options);
    expect(count).toBe(1);
    expect(two.checkedAt).toBe(one.checkedAt);
    expect(two.latest).toEqual(one.latest);
  });
});
