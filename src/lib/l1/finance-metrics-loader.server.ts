import {
  readBoundedJson,
  UPSTREAM_RESPONSE_LIMITS,
} from "./bounded-response.server";
import {
  emptyFinanceMetrics,
  FINANCE_METRICS_MAX_AGE_MS,
  FINANCE_TOKEN_CONTRACTS,
  type FinanceMetric,
  type FinanceMetricsSnapshot,
} from "./finance-metrics";

export const FINANCE_METRICS_RPC = "https://ethereum-rpc.publicnode.com";
const TOTAL_SUPPLY_SELECTOR = "0x18160ddd";
const DECIMALS_SELECTOR = "0x313ce567";
const REQUEST_TIMEOUT_MS = 6_000;
const TOTAL_TIMEOUT_MS = 12_000;
type RpcCall = { id: number; method: string; params: unknown[] };
type RpcResult = { result?: unknown; error?: unknown };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function quantity(value: unknown): bigint {
  if (
    typeof value !== "string" ||
    !/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(value)
  )
    throw new Error("Invalid Ethereum quantity");
  return BigInt(value);
}
function safeQuantity(value: unknown): number {
  const number = quantity(value);
  if (number > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Unsafe Ethereum quantity");
  return Number(number);
}
function abiUint(value: unknown): bigint {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value))
    throw new Error("Invalid ABI uint256");
  return BigInt(value);
}

export function parseTokenSupply(value: unknown, decimals: unknown): number {
  if (abiUint(decimals) !== 6n)
    throw new Error("Unexpected stablecoin decimals");
  const raw = abiUint(value);
  // Keep conversion finite and within the realistic display range. Values are rounded for display.
  if (raw > 1_000_000_000_000_000n * 1_000_000n)
    throw new Error("Stablecoin supply is out of range");
  return Number(raw / 1_000_000n) + Number(raw % 1_000_000n) / 1_000_000;
}

function parseBlock(
  value: unknown,
  requestedBlock: number,
  observedMs: number,
) {
  if (
    !record(value) ||
    safeQuantity(value.number) !== requestedBlock ||
    typeof value.hash !== "string" ||
    !/^0x[0-9a-fA-F]{64}$/.test(value.hash)
  )
    throw new Error("Ethereum block could not be verified");
  const timestampMs = safeQuantity(value.timestamp) * 1000;
  if (
    timestampMs <= 0 ||
    timestampMs > observedMs + 60_000 ||
    observedMs - timestampMs > FINANCE_METRICS_MAX_AGE_MS
  ) {
    throw new Error("Ethereum block is not current");
  }
  return {
    hash: value.hash.toLowerCase(),
    timestamp: new Date(timestampMs).toISOString(),
  };
}

async function rpcBatch(
  calls: RpcCall[],
  fetchImpl: typeof fetch,
  deadline: AbortSignal,
): Promise<Map<number, RpcResult>> {
  const response = await fetchImpl(FINANCE_METRICS_RPC, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.any([
      deadline,
      AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    ]),
    body: JSON.stringify(calls.map((call) => ({ jsonrpc: "2.0", ...call }))),
  });
  if (!response.ok) throw new Error("Ethereum supply RPC unavailable");
  const payload = await readBoundedJson(
    response,
    UPSTREAM_RESPONSE_LIMITS.telemetry,
  );
  if (!Array.isArray(payload) || payload.length !== calls.length)
    throw new Error("Incomplete Ethereum supply response");
  const expected = new Set(calls.map((call) => call.id)),
    results = new Map<number, RpcResult>();
  for (const value of payload) {
    if (
      !record(value) ||
      value.jsonrpc !== "2.0" ||
      typeof value.id !== "number" ||
      !expected.has(value.id) ||
      results.has(value.id) ||
      "result" in value === "error" in value
    )
      throw new Error("Invalid Ethereum supply response");
    results.set(value.id, value);
  }
  return results;
}

function result(results: Map<number, RpcResult>, id: number): unknown {
  const response = results.get(id);
  if (!response || response.error !== undefined || !("result" in response))
    throw new Error("Ethereum supply method unavailable");
  return response.result;
}

/** Fixed issuer-verified contracts, read-only RPC methods, and one shared Ethereum block. */
export async function loadFinanceMetrics(
  fetchImpl: typeof fetch = fetch,
): Promise<FinanceMetricsSnapshot> {
  const deadline = AbortSignal.timeout(TOTAL_TIMEOUT_MS);
  try {
    const head = await rpcBatch(
      [
        { id: 1, method: "eth_chainId", params: [] },
        { id: 2, method: "eth_blockNumber", params: [] },
      ],
      fetchImpl,
      deadline,
    );
    if (quantity(result(head, 1)) !== 1n)
      throw new Error("Ethereum mainnet identity check failed");
    const blockNumber = safeQuantity(result(head, 2)),
      blockTag = "0x" + blockNumber.toString(16);
    const calls: RpcCall[] = [
      { id: 3, method: "eth_getBlockByNumber", params: [blockTag, false] },
    ];
    for (const [index, token] of FINANCE_TOKEN_CONTRACTS.entries()) {
      calls.push({
        id: 10 + index * 2,
        method: "eth_call",
        params: [{ to: token.address, data: TOTAL_SUPPLY_SELECTOR }, blockTag],
      });
      calls.push({
        id: 11 + index * 2,
        method: "eth_call",
        params: [{ to: token.address, data: DECIMALS_SELECTOR }, blockTag],
      });
    }
    const observations = await rpcBatch(calls, fetchImpl, deadline);
    const block = parseBlock(result(observations, 3), blockNumber, Date.now());
    // A reorg during the pinned calls invalidates the entire observation.
    const confirmed = await rpcBatch(
      [{ id: 4, method: "eth_getBlockByNumber", params: [blockTag, false] }],
      fetchImpl,
      deadline,
    );
    const checkedAt = new Date().toISOString();
    const recheckedBlock = parseBlock(
      result(confirmed, 4),
      blockNumber,
      Date.parse(checkedAt),
    );
    if (
      recheckedBlock.hash !== block.hash ||
      recheckedBlock.timestamp !== block.timestamp
    )
      throw new Error("Ethereum block changed during observation");
    const empty = emptyFinanceMetrics(checkedAt);
    const metrics: FinanceMetric[] = empty.metrics.map((metric, index) => {
      try {
        const value = parseTokenSupply(
          result(observations, 10 + index * 2),
          result(observations, 11 + index * 2),
        );
        return {
          ...metric,
          value,
          status: "current",
          asOfBlock: blockNumber,
          blockTimestamp: block.timestamp,
          observedAt: checkedAt,
        };
      } catch {
        return metric;
      }
    });
    const current = metrics.filter(
      (metric) => metric.status === "current",
    ).length;
    return {
      checkedAt,
      status:
        current === metrics.length
          ? "current"
          : current > 0
            ? "partial"
            : "unavailable",
      metrics,
    };
  } catch {
    // No guessed supply, copied snapshot, fabricated zero, or raw provider error is exposed.
    return emptyFinanceMetrics();
  }
}
