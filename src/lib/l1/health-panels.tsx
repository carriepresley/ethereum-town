import { useState } from "react";
import { isHealthMetricFresh, type HealthSnapshot } from "./health";
import { age, shortTime } from "./live-hooks";
import { exact } from "./data";
import { NETWORKS } from "./networks";
import { isTelemetryFresh, type ChainTelemetry } from "./telemetry";
import type { BridgeSnapshot } from "./bridges";

export const FINALITY_ATTENTION_SECONDS = 1536;
export function healthBeaconState(
  snapshot: HealthSnapshot | null,
  failed: boolean,
  now: number,
): "normal" | "attention" | "unknown" {
  const head = snapshot?.metrics.find((m) => m.id === "head-age");
  const finality = snapshot?.metrics.find((m) => m.id === "finality-lag");
  if (
    failed ||
    !isHealthMetricFresh(head, now) ||
    !isHealthMetricFresh(finality, now)
  )
    return "unknown";
  return finality!.value! > FINALITY_ATTENTION_SECONDS || head!.value! > 60
    ? "attention"
    : "normal";
}
function duration(seconds: number | null | undefined) {
  if (seconds == null) return "—";
  return seconds < 60
    ? Math.round(seconds) + "s"
    : Math.floor(seconds / 60) + "m " + Math.round(seconds % 60) + "s";
}
function number(value: number | null | undefined, digits = 2) {
  if (value == null) return "—";
  if (value > 0 && value < 0.0001) return value.toExponential(2);
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function EthereumHealthCard({
  snapshot,
  failed,
  now,
  inspect,
}: {
  snapshot: HealthSnapshot | null;
  failed: boolean;
  now: number;
  inspect: () => void;
}) {
  const [view, setView] = useState<"reliability" | "capacity">("reliability");
  const metric = (id: string) => snapshot?.metrics.find((m) => m.id === id);
  const current = (id: string) =>
    !failed && isHealthMetricFresh(metric(id), now);
  const value = (id: string) => metric(id)?.value;
  const state = healthBeaconState(snapshot, failed, now);
  const stateText =
    state === "unknown"
      ? "Awaiting fresh data"
      : state === "attention"
        ? "Check reliability readings"
        : "Finality observed";
  const rows =
    view === "reliability"
      ? [
          {
            id: "finality-lag",
            label: "Head → finalized",
            text: duration(value("finality-lag")),
            unit: "time gap",
          },
          {
            id: "slot-delivery",
            label: "Slots with blocks",
            text: number(value("slot-delivery"), 1),
            unit: "% of sampled slots",
          },
        ]
      : [
          {
            id: "base-fee",
            label: "Execution base fee",
            text: number(value("base-fee"), 4),
            unit: "gwei / gas",
          },
          {
            id: "blob-count",
            label: "Blobs in latest block",
            text: number(value("blob-count"), 0),
            unit: "data blobs",
          },
        ];
  return (
    <>
      <div className="fc-health-heading">
        <div>
          <span className="fc-kicker">ETHEREUM MAINNET</span>
          <h1>Town Hall</h1>
        </div>
        <span className="fc-reading-status" data-state={state}>
          {stateText}
        </span>
      </div>
      <div className="fc-health-tabs" aria-label="Ethereum readings">
        {(["reliability", "capacity"] as const).map((id) => (
          <button
            key={id}
            aria-pressed={view === id}
            onClick={() => setView(id)}
          >
            {id === "reliability" ? "Reliability" : "Capacity & fees"}
          </button>
        ))}
      </div>
      {view === "reliability" ? (
        <div className="fc-block-reading">
          <span>
            <i data-live={current("head-age")} />
            Latest observed block
          </span>
          <strong>
            {snapshot?.latest ? exact(snapshot.latest.number) : "—"}
          </strong>
          <small>
            {snapshot?.latest
              ? shortTime(snapshot.latest.timestamp)
              : "Waiting for a verified block"}{" "}
            ·{" "}
            {current("head-age")
              ? "Current"
              : snapshot?.latest
                ? "Last known"
                : "Checking"}
          </small>
        </div>
      ) : (
        <div className="fc-capacity-reading">
          <div>
            <span>
              Latest block capacity used
              <br />
              <small>
                {current("gas-used")
                  ? "Current"
                  : value("gas-used") != null
                    ? "Last known"
                    : "Unavailable"}
              </small>
            </span>
            <strong>
              {number(value("gas-used"), 1)}
              <small>%</small>
            </strong>
          </div>
          <div className="fc-capacity-history">
            <svg
              viewBox="0 0 320 38"
              role="img"
              aria-label="Gas usage as a percentage of the block limit for the last 16 linked Ethereum blocks. Dashed line is the 50 percent target."
            >
              <line
                x1="0"
                y1="19"
                x2="320"
                y2="19"
                stroke="currentColor"
                strokeOpacity=".3"
                strokeDasharray="3 4"
              />
              {(snapshot?.recentBlocks ?? []).map((block, i) => (
                <rect
                  key={block.number}
                  x={i * 20 + 2}
                  y={
                    block.gasUsedPercent == null
                      ? 36
                      : 36 - block.gasUsedPercent * 0.34
                  }
                  width="14"
                  height={
                    block.gasUsedPercent == null
                      ? 2
                      : block.gasUsedPercent * 0.34
                  }
                  rx="1"
                  className={
                    block.gasUsedPercent == null
                      ? "fc-bar-missing"
                      : "fc-bar-observed"
                  }
                  opacity={current("slot-delivery") ? 1 : 0.45}
                >
                  <title>
                    Block {block.number}:{" "}
                    {block.gasUsedPercent == null
                      ? "unavailable"
                      : number(block.gasUsedPercent, 1) + "% gas used"}{" "}
                    · {shortTime(block.timestamp)}
                  </title>
                </rect>
              ))}
            </svg>
          </div>
          <small>
            {snapshot?.recentBlocks.length || 0} linked blocks · target 50% ·{" "}
            {current("slot-delivery")
              ? "Current"
              : snapshot?.recentBlocks.length
                ? "Last known"
                : "Unavailable"}
          </small>
        </div>
      )}
      <div className="fc-reading-grid">
        {rows.map((row) => (
          <div key={row.id}>
            <span>{row.label}</span>
            <strong>{row.text}</strong>
            <small>
              {row.unit} ·{" "}
              {current(row.id)
                ? "Current"
                : value(row.id) != null
                  ? "Last known"
                  : "Unavailable"}
            </small>
          </div>
        ))}
      </div>
      <div className="fc-health-foot">
        <span>
          {view === "reliability"
            ? snapshot?.missedSlots
              ? `${current("slot-delivery") ? "" : "Last known · "}${snapshot.missedSlots.count} inferred empty slots / ${snapshot.missedSlots.sampledSlots} sampled`
              : "Slot sample unavailable"
            : "Higher usage or fees is not a health score."}
        </span>
        <button onClick={inspect}>Sources & detail ↗</button>
      </div>
    </>
  );
}

export function NetworkHealthCard({
  id,
  row,
  bridges,
  now,
  choose,
}: {
  id: string;
  row: ChainTelemetry | undefined;
  bridges: BridgeSnapshot | null;
  now: number;
  choose: (id: string) => void;
}) {
  const network = NETWORKS.find((n) => n.id === id)!;
  const current = isTelemetryFresh(row, now);
  const freshEvents =
    !!bridges &&
    bridges.status !== "unavailable" &&
    now - Date.parse(bridges.fetchedAt) < 90000 &&
    !!bridges.observedThrough &&
    now - Date.parse(bridges.observedThrough) < 180000;
  const event = freshEvents
    ? bridges?.events.find((e) => e.chainId === id && e.kind === "settlement")
    : undefined;
  const coverage = bridges?.coverage.find((c) => c.chainId === id);
  return (
    <>
      <div className="fc-health-heading">
        <div>
          <span className="fc-kicker">L2 NEIGHBORHOOD</span>
          <h1>{network.name}</h1>
        </div>
        <span
          className="fc-reading-status"
          data-state={current ? "normal" : "unknown"}
        >
          {current ? "Block observed" : "Feed delayed"}
        </span>
      </div>
      <div className="fc-connection">
        <span>{network.name}</span>
        <b>→</b>
        <button onClick={() => choose("ethereum")}>Ethereum Town Hall</button>
      </div>
      <div className="fc-block-reading">
        <span>Transactions in latest observed block</span>
        <strong>
          {row?.transactionCount == null ? "—" : exact(row.transactionCount)}
        </strong>
        <small>
          Block {row?.blockNumber ?? "—"} · {shortTime(row?.blockTimestamp)} ·{" "}
          {current ? "Current" : "Last known / unavailable"}
        </small>
      </div>
      <div className="fc-posting-note">
        <i data-live={!!event} />
        <div>
          <strong>
            {event ? "Infrastructure activity observed" : "Ethereum connection"}
          </strong>
          <span>
            {event
              ? `${event.stage.replaceAll("-", " ")} · ${age(event.timestamp, now)}`
              : !freshEvents
                ? "Connection feed checking / delayed"
                : coverage?.settlementStatus === "unsupported"
                  ? "This connection is not monitored"
                  : !coverage || coverage.settlementStatus === "unavailable"
                    ? "This connection feed is unavailable"
                    : "No matching event in the selected window"}
          </span>
        </div>
        {event && (
          <a href={event.explorerUrl} target="_blank" rel="noreferrer">
            Inspect ↗
          </a>
        )}
      </div>
      <details className="fc-scope">
        <summary>What this route means</summary>
        <p>{network.connection}</p>
        <p>
          Data publication is separate from asset bridging. This is a sampled
          feed; missing events do not prove a delay. A latest-block count is not
          TPS and cannot rank networks.
        </p>
        <a href={network.connectionSource} target="_blank" rel="noreferrer">
          Architecture source ↗
        </a>
      </details>
      <div className="fc-card-bottom">
        {row?.explorerUrl && (
          <a href={row.explorerUrl} target="_blank" rel="noreferrer">
            View observed block ↗
          </a>
        )}
        <span>Execution on {network.name}</span>
      </div>
    </>
  );
}

export function HealthDataDetails({
  snapshot,
  failed,
  now,
}: {
  snapshot: HealthSnapshot | null;
  failed: boolean;
  now: number;
}) {
  return (
    <section className="fc-health-data">
      <h3>Ethereum reliability and capacity</h3>
      {snapshot?.finalized && (
        <p>
          Latest:{" "}
          <a
            href={`https://etherscan.io/block/${snapshot.latest?.number}`}
            target="_blank"
            rel="noreferrer"
          >
            {snapshot.latest?.number}
          </a>{" "}
          at {shortTime(snapshot.latest?.timestamp)}. Finalized:{" "}
          <a
            href={`https://etherscan.io/block/${snapshot.finalized.number}`}
            target="_blank"
            rel="noreferrer"
          >
            {snapshot.finalized.number}
          </a>{" "}
          at {shortTime(snapshot.finalized.timestamp)}.{" "}
          {!failed &&
          isHealthMetricFresh(
            snapshot.metrics.find((m) => m.id === "finality-lag"),
            now,
          )
            ? "Current pair."
            : "Last known finality observation."}
        </p>
      )}
      {snapshot?.missedSlots && (
        <p>
          Canonical slot sample: {shortTime(snapshot.missedSlots.start)}–
          {shortTime(snapshot.missedSlots.end)}.{" "}
          {!failed &&
          isHealthMetricFresh(
            snapshot.metrics.find((m) => m.id === "slot-delivery"),
            now,
          )
            ? "Current sample."
            : "Last known sample."}
        </p>
      )}
      <p>
        The hall beacon acknowledges observed blocks and finality. It is not an
        overall security rating. An unavailable provider turns the reading gray;
        it does not mean Ethereum is down. A head age above 60 seconds or
        head-to-finalized gap above 25.6 minutes asks you to inspect the
        readings. These are display thresholds, not outage declarations.
      </p>
      <div className="fc-table-scroll">
        <table>
          <thead>
            <tr>
              <th>Reading</th>
              <th>Value</th>
              <th>Observation</th>
            </tr>
          </thead>
          <tbody>
            {snapshot?.metrics.map((m) => (
              <tr key={m.id}>
                <td>
                  <a href={m.sourceUrl} target="_blank" rel="noreferrer">
                    {m.label} ↗
                  </a>
                </td>
                <td>
                  {number(m.value, 5)} {m.unit}
                </td>
                <td>
                  {!failed && isHealthMetricFresh(m, now)
                    ? "Current"
                    : m.value != null
                      ? "Last known"
                      : "Unavailable"}{" "}
                  · {shortTime(m.observedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details>
        <summary>How to interpret these readings</summary>
        {snapshot?.metrics.map((m) => (
          <p key={m.id}>
            <strong>{m.label}:</strong> {m.scopeNote}
          </p>
        ))}
        <p>
          Validator participation and operator concentration are not measured in
          this version. Reported stake is shown separately. Asset supply is an
          adoption context metric, not a reliability score.
        </p>
      </details>
    </section>
  );
}
