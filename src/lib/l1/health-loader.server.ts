import {
  readBoundedJson,
  UPSTREAM_RESPONSE_LIMITS,
} from "./bounded-response.server";
import {
  emptyHealthSnapshot,
  HEALTH_MAX_AGE_MS,
  HEALTH_SAMPLE_BLOCKS,
  type HealthBlock,
  type HealthMetricId,
  type HealthSnapshot,
} from "./health";

export const HEALTH_RPC = "https://ethereum-rpc.publicnode.com";
const REQUEST_TIMEOUT_MS = 6_000;
const TOTAL_TIMEOUT_MS = 12_000;
const SLOT_SECONDS = 12;
const BLOB_GAS_PER_BLOB = 131_072;
type RpcCall = { id: number; method: string; params: unknown[] };
type RpcResult = { result?: unknown; error?: unknown };
type ParsedBlock = HealthBlock & {
  parentHash: string;
  raw: Record<string, unknown>;
};
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function quantity(value: unknown): number {
  if (
    typeof value !== "string" ||
    !/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]{0,63})$/.test(value)
  )
    throw new Error("Invalid quantity");
  const number = BigInt(value);
  if (number > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Unsafe quantity");
  return Number(number);
}
function hash(value: unknown): string {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value))
    throw new Error("Invalid hash");
  return value.toLowerCase();
}
function block(
  value: unknown,
  observedMs: number,
  expectedNumber?: number,
): ParsedBlock {
  if (!record(value)) throw new Error("Block unavailable");
  const number = quantity(value.number),
    seconds = quantity(value.timestamp);
  if (expectedNumber !== undefined && number !== expectedNumber)
    throw new Error("Wrong block");
  // Mainnet after the Merge; reject nonsensical timestamps, but finalized heads may legitimately be old.
  if (seconds < 1_663_224_162 || seconds * 1000 > observedMs + 30_000)
    throw new Error("Invalid timestamp");
  return {
    number,
    hash: hash(value.hash),
    parentHash: hash(value.parentHash),
    timestamp: new Date(seconds * 1000).toISOString(),
    raw: value,
  };
}
function optionalQuantity(value: unknown): number | null {
  try {
    return quantity(value);
  } catch {
    return null;
  }
}
async function rpc(
  calls: RpcCall[],
  fetchImpl: typeof fetch,
  deadline: AbortSignal,
): Promise<Map<number, RpcResult>> {
  const response = await fetchImpl(HEALTH_RPC, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.any([
      deadline,
      AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    ]),
    body: JSON.stringify(calls.map((call) => ({ jsonrpc: "2.0", ...call }))),
  });
  if (!response.ok) throw new Error("Health provider unavailable");
  const payload = await readBoundedJson(
    response,
    UPSTREAM_RESPONSE_LIMITS.telemetry,
  );
  if (!Array.isArray(payload) || payload.length !== calls.length)
    throw new Error("Incomplete health response");
  const expected = new Set(calls.map((call) => call.id)),
    responses = new Map<number, RpcResult>();
  for (const row of payload) {
    if (
      !record(row) ||
      row.jsonrpc !== "2.0" ||
      typeof row.id !== "number" ||
      !expected.has(row.id) ||
      responses.has(row.id) ||
      "result" in row === "error" in row
    )
      throw new Error("Invalid health response");
    responses.set(row.id, row);
  }
  return responses;
}
function result(rows: Map<number, RpcResult>, id: number): unknown {
  const row = rows.get(id);
  if (!row || row.error !== undefined || !("result" in row))
    throw new Error("Health method unavailable");
  return row.result;
}
function publicBlock(value: ParsedBlock): HealthBlock {
  return { number: value.number, hash: value.hash, timestamp: value.timestamp };
}
function gasObservation(raw: Record<string, unknown>) {
  const gasUsed = optionalQuantity(raw.gasUsed),
    gasLimit = optionalQuantity(raw.gasLimit);
  if (
    gasUsed === null ||
    gasLimit === null ||
    gasLimit <= 0 ||
    gasUsed > gasLimit
  )
    return { gasUsed: null, gasLimit: null, percent: null };
  return { gasUsed, gasLimit, percent: (gasUsed / gasLimit) * 100 };
}

/** Read-only, one fixed provider, identity checked, bounded historical window and a pinned reorg check. */
export async function loadHealth(
  fetchImpl: typeof fetch = fetch,
): Promise<HealthSnapshot> {
  const deadline = AbortSignal.timeout(TOTAL_TIMEOUT_MS);
  try {
    const rows = await rpc(
      [
        { id: 1, method: "eth_chainId", params: [] },
        { id: 2, method: "eth_getBlockByNumber", params: ["latest", false] },
        { id: 3, method: "eth_getBlockByNumber", params: ["finalized", false] },
        { id: 4, method: "eth_blobBaseFee", params: [] },
      ],
      fetchImpl,
      deadline,
    );
    if (quantity(result(rows, 1)) !== 1)
      throw new Error("Not Ethereum mainnet");
    const latest = block(result(rows, 2), Date.now());
    if (
      latest.number < HEALTH_SAMPLE_BLOCKS ||
      Date.now() - Date.parse(latest.timestamp) > HEALTH_MAX_AGE_MS
    )
      throw new Error("Provider head is stale");
    let finalized: ParsedBlock | null = null;
    try {
      const candidate = block(result(rows, 3), Date.now());
      if (
        candidate.number > latest.number ||
        Date.parse(candidate.timestamp) > Date.parse(latest.timestamp) ||
        (candidate.number === latest.number && candidate.hash !== latest.hash)
      )
        throw new Error("Inconsistent finalized block");
      finalized = candidate;
    } catch {
      /* A missing finalized method does not hide current execution observations. */
    }
    let blobBaseFeeGwei: number | null = null;
    try {
      blobBaseFeeGwei = quantity(result(rows, 4)) / 1e9;
    } catch {
      /* Optional provider capability. */
    }
    let sample: HealthSnapshot["sample"] = null,
      missedSlots: HealthSnapshot["missedSlots"] = null;
    let recentBlocks: HealthSnapshot["recentBlocks"] = [];
    try {
      const calls = Array.from(
        { length: HEALTH_SAMPLE_BLOCKS - 1 },
        (_, i) => ({
          id: 100 + i,
          method: "eth_getBlockByNumber",
          params: ["0x" + (latest.number - i - 1).toString(16), false],
        }),
      );
      const history = await rpc(calls, fetchImpl, deadline);
      const blocks = [
        latest,
        ...calls.map((call, index) =>
          block(
            result(history, call.id),
            Date.now(),
            latest.number - index - 1,
          ),
        ),
      ];
      for (let i = 0; i < blocks.length - 1; i++) {
        const gap =
          (Date.parse(blocks[i].timestamp) -
            Date.parse(blocks[i + 1].timestamp)) /
          1000;
        if (
          blocks[i].parentHash !== blocks[i + 1].hash ||
          gap <= 0 ||
          gap % SLOT_SECONDS !== 0
        )
          throw new Error("Sample is not a consistent canonical chain");
      }
      const oldest = blocks[blocks.length - 1],
        elapsedSeconds =
          (Date.parse(latest.timestamp) - Date.parse(oldest.timestamp)) / 1000;
      const sampledSlots = elapsedSeconds / SLOT_SECONDS,
        count = sampledSlots - (blocks.length - 1);
      sample = {
        blocks: blocks.length,
        intervals: blocks.length - 1,
        elapsedSeconds,
        inferredEmptySlots: count,
        firstBlock: oldest.number,
        lastBlock: latest.number,
      };
      missedSlots = {
        count,
        sampledSlots,
        start: oldest.timestamp,
        end: latest.timestamp,
      };
      recentBlocks = blocks
        .slice()
        .reverse()
        .map((item) => ({
          number: item.number,
          timestamp: item.timestamp,
          gasUsedPercent: gasObservation(item.raw).percent,
        }));
    } catch {
      /* Missing history is represented independently, never as zero missed slots. */
    }
    const pinned = await rpc(
      [
        {
          id: 5,
          method: "eth_getBlockByNumber",
          params: ["0x" + latest.number.toString(16), false],
        },
      ],
      fetchImpl,
      deadline,
    );
    const recheck = block(result(pinned, 5), Date.now(), latest.number);
    if (recheck.hash !== latest.hash || recheck.timestamp !== latest.timestamp)
      throw new Error("Head changed during observation");
    const checkedAt = new Date().toISOString();
    if (
      Date.parse(checkedAt) - Date.parse(latest.timestamp) >
      HEALTH_MAX_AGE_MS
    )
      throw new Error("Provider head is stale");
    const { gasUsed, gasLimit } = gasObservation(latest.raw);
    const baseFeeWei = optionalQuantity(latest.raw.baseFeePerGas);
    let blobGasUsed = optionalQuantity(latest.raw.blobGasUsed);
    if (blobGasUsed !== null && blobGasUsed % BLOB_GAS_PER_BLOB !== 0)
      blobGasUsed = null;
    const finalityLagSeconds = finalized
      ? (Date.parse(latest.timestamp) - Date.parse(finalized.timestamp)) / 1000
      : null;
    const values: Record<HealthMetricId, number | null> = {
      "head-age": Math.max(
        0,
        (Date.parse(checkedAt) - Date.parse(latest.timestamp)) / 1000,
      ),
      "finality-lag": finalityLagSeconds,
      "gas-used":
        gasUsed !== null && gasLimit !== null
          ? (gasUsed / gasLimit) * 100
          : null,
      "base-fee": baseFeeWei !== null ? baseFeeWei / 1e9 : null,
      "blob-count":
        blobGasUsed !== null ? blobGasUsed / BLOB_GAS_PER_BLOB : null,
      "blob-base-fee": blobBaseFeeGwei,
      "slot-delivery":
        sample && missedSlots
          ? (sample.intervals / missedSlots.sampledSlots) * 100
          : null,
    };
    const metrics = emptyHealthSnapshot(checkedAt).metrics.map((metric) => ({
      ...metric,
      value: values[metric.id],
      status:
        values[metric.id] === null
          ? ("unavailable" as const)
          : ("current" as const),
      observedAt: values[metric.id] === null ? null : checkedAt,
      blockTimestamp: values[metric.id] === null ? null : latest.timestamp,
      asOfBlock:
        metric.id === "blob-base-fee" || values[metric.id] === null
          ? null
          : latest.number,
      sourceUrl:
        metric.id === "blob-base-fee"
          ? "https://ethereum.publicnode.com/"
          : "https://etherscan.io/block/" + latest.number,
    }));
    return {
      checkedAt,
      status: metrics.every((metric) => metric.status === "current")
        ? "current"
        : "partial",
      latest: {
        ...publicBlock(latest),
        gasUsed,
        gasLimit,
        baseFeeGwei: values["base-fee"],
        blobGasUsed,
      },
      finalized: finalized ? publicBlock(finalized) : null,
      finalityLagSeconds,
      sample,
      missedSlots,
      blobBaseFeeGwei,
      recentBlocks,
      metrics,
    };
  } catch {
    return emptyHealthSnapshot();
  }
}
