import { createFileRoute } from "@tanstack/react-router";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  CITY_PLACES,
  CONNECTED_PLACES,
  CONTEXT_PLACES,
  CITY_SCOPE_NOTE,
  cityStatusLabel,
} from "@/lib/l1/financial-city";
import { NETWORKS } from "@/lib/l1/networks";
import { useLiveFeeds, shortTime, age } from "@/lib/l1/live-hooks";
import { useFinanceMetrics } from "@/lib/l1/use-finance-metrics";
import { isFinanceMetricFresh } from "@/lib/l1/finance-metrics";
import { isTelemetryFresh } from "@/lib/l1/telemetry";
import { exact, short } from "@/lib/l1/data";
import type { FinancialCityController } from "@/lib/l1/financial-city-scene";
export const Route = createFileRoute("/")({
  component: FinancialCity,
  head: () => ({
    links: [{ rel: "canonical", href: "https://ethereumtown.vercel.app/" }],
  }),
});
function FinancialCity() {
  const feeds = useLiveFeeds(),
    finance = useFinanceMetrics();
  const [selected, setSelected] = useState<string | null>(null),
    [layer, setLayer] = useState<"all" | "connected" | "context">("all");
  const [night, setNight] = useState(true),
    [paused, setPaused] = useState(false),
    [speed, setSpeed] = useState(1),
    [ready, setReady] = useState(false),
    [error, setError] = useState(false);
  const host = useRef<HTMLDivElement>(null),
    city = useRef<FinancialCityController | null>(null),
    dialog = useRef<HTMLDialogElement>(null);
  const place = CITY_PLACES.find((p) => p.id === selected),
    isStaking = selected === "staking",
    isEthereum = selected === "ethereum";
  const freshCount = feeds.telemetry.chains.filter((row) =>
    isTelemetryFresh(row, feeds.now),
  ).length;
  const eventFresh =
    !!feeds.bridges &&
    feeds.bridges.status !== "unavailable" &&
    feeds.now - Date.parse(feeds.bridges.fetchedAt) < 90000 &&
    !!feeds.bridges.observedThrough &&
    feeds.now - Date.parse(feeds.bridges.observedThrough) < 180000;
  const observedEvents = useMemo(
    () =>
      eventFresh
        ? (feeds.bridges?.events ?? []).map((e) => ({
            id: e.id,
            networkId: e.chainId,
            kind: e.kind,
            direction:
              e.direction === "l2-to-ethereum"
                ? ("to-l1" as const)
                : ("to-l2" as const),
          }))
        : [],
    [feeds.bridges, eventFresh],
  );
  const activity = useMemo(
    () =>
      feeds.telemetry.chains
        .filter(
          (r) =>
            r.blockHash &&
            r.transactionCount !== null &&
            isTelemetryFresh(r, feeds.now),
        )
        .map((r) => ({
          id: r.id,
          blockHash: r.blockHash!,
          transactionCount: r.transactionCount!,
        })),
    [feeds.telemetry, feeds.now],
  );
  const state = useRef({
    selected,
    layer,
    night,
    paused,
    speed,
    observedEvents,
    activity,
  });
  state.current = {
    selected,
    layer,
    night,
    paused,
    speed,
    observedEvents,
    activity,
  };
  useEffect(() => {
    let disposed = false;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      setPaused(true);
    import("@/lib/l1/financial-city-scene")
      .then(({ mountFinancialCity }) => {
        if (disposed || !host.current) return;
        const controller = mountFinancialCity(
          host.current,
          CITY_PLACES,
          (id) => {
            if (id) setLayer("all");
            setSelected(
              id && NETWORKS.some((n) => n.id === id) ? "ethereum" : id,
            );
          },
        );
        city.current = controller;
        const s = state.current;
        controller.setNight(s.night);
        controller.setPaused(s.paused);
        controller.setSpeed(s.speed);
        controller.setLayers(s.layer);
        controller.select(s.selected);
        controller.setNetworkActivity(s.activity);
        controller.setObservedEvents(s.observedEvents);
        setReady(true);
      })
      .catch(() => {
        if (!disposed) {
          setError(true);
          setReady(true);
        }
      });
    return () => {
      disposed = true;
      city.current?.dispose();
      city.current = null;
    };
  }, []);
  useEffect(() => city.current?.select(selected), [selected]);
  useEffect(() => city.current?.setNight(night), [night]);
  useEffect(() => city.current?.setPaused(paused), [paused]);
  useEffect(() => city.current?.setSpeed(speed), [speed]);
  useEffect(() => city.current?.setLayers(layer), [layer]);
  useEffect(() => city.current?.setNetworkActivity(activity), [activity]);
  useEffect(
    () => city.current?.setObservedEvents(observedEvents),
    [observedEvents],
  );
  const visiblePlaces = layer === "context" ? CONTEXT_PLACES : CONNECTED_PLACES;
  function choose(id: string | null) {
    const next = CITY_PLACES.find((p) => p.id === id);
    if (next?.status === "context" && layer === "connected") setLayer("all");
    if (next && next.status !== "context" && layer === "context")
      setLayer("all");
    setSelected(id);
  }
  function changeLayer(value: "all" | "connected" | "context") {
    setLayer(value);
    setSelected(null);
    city.current?.resetView();
  }
  function step(amount: number) {
    const at = visiblePlaces.findIndex((p) => p.id === selected);
    choose(
      visiblePlaces[
        ((at < 0 ? (amount > 0 ? -1 : 0) : at) +
          amount +
          visiblePlaces.length) %
          visiblePlaces.length
      ].id,
    );
  }
  const network = NETWORKS.find((n) => n.id === place?.networkId),
    networkRow = feeds.telemetry.chains.find(
      (n) => n.id === (place?.networkId ?? "ethereum"),
    );
  const metric = finance.snapshot?.metrics.find((m) => m.id === place?.id);
  const metricCurrent =
    isFinanceMetricFresh(metric, feeds.now) && !finance.failed;
  const stakingCurrent =
    !feeds.staking.warning &&
    feeds.now - Date.parse(feeds.staking.capturedAt) < 1200000;
  const stakingChecked =
    feeds.staking.capturedAt.replace("T", " ").slice(0, 19) + " UTC";
  const liveProducts = CONNECTED_PLACES.filter(
      (p) => p.status === "live",
    ).length,
    pilots = CONNECTED_PLACES.filter((p) => p.status === "pilot").length;
  const currentEvent = feeds.bridges?.events[0];
  return (
    <main className="financial-city" data-light={night ? "night" : "day"}>
      <div
        className="fc-scene"
        ref={host}
        role="img"
        aria-label="Interactive financial city. Documented Ethereum products occupy illuminated shops, with the wider financial system in surrounding city blocks. Use the place buttons to explore."
      />
      <div className="fc-vignette" />
      <header className="fc-header">
        <a className="fc-brand" href="/" aria-label="Ethereum Town home">
          <span aria-hidden="true">◇</span>
          <div>
            <strong>Ethereum Town</strong>
            <small>A growing financial district.</small>
          </div>
        </a>
        <div className="fc-header-right">
          <span className="fc-live">
            <i data-live={freshCount > 0} />
            {freshCount === NETWORKS.length
              ? "Network feeds live"
              : freshCount > 0
                ? "Some feeds delayed"
                : "Connecting feeds"}
          </span>
          <button
            onClick={() => dialog.current?.showModal()}
            aria-haspopup="dialog"
            aria-controls="city-data"
          >
            About & data ↗
          </button>
        </div>
      </header>
      <nav className="fc-view-switch" aria-label="City view">
        {(
          [
            ["all", "The whole city"],
            ["connected", "On Ethereum"],
            ["context", "Wider finance"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            aria-pressed={layer === value}
            onClick={() => changeLayer(value)}
          >
            {label}
          </button>
        ))}
      </nav>
      <nav className="fc-place-rail" aria-label="Explore financial products">
        {visiblePlaces.map((p) => (
          <button
            key={p.id}
            aria-pressed={selected === p.id}
            onClick={() => choose(p.id)}
          >
            <i style={{ background: p.color }} />
            {p.name}
          </button>
        ))}
        <button aria-pressed={isEthereum} onClick={() => choose("ethereum")}>
          ◇ Ethereum
        </button>
        <button aria-pressed={isStaking} onClick={() => choose("staking")}>
          ETH staking
        </button>
      </nav>
      <div className="fc-traverse">
        <button
          onClick={() => step(-1)}
          aria-label="Previous financial building"
        >
          ← <span>Previous</span>
        </button>
        <span>
          {place
            ? visiblePlaces.findIndex((p) => p.id === place.id) + 1
            : "Explore"}
          {place ? " / " + visiblePlaces.length : ""}
        </span>
        <button onClick={() => step(1)} aria-label="Next financial building">
          <span>Next</span> →
        </button>
      </div>
      <aside
        className="fc-card"
        style={{ "--place-color": place?.color ?? "#a1a2ff" } as CSSProperties}
      >
        {place ? (
          <>
            <div className="fc-card-eyebrow">
              <span>{place.category}</span>
              <button
                className="fc-card-close"
                onClick={() => choose(null)}
                aria-label="Back to city overview"
              >
                ×
              </button>
            </div>
            <div className="fc-place-title">
              <span className="fc-place-icon" aria-hidden="true">
                {place.name.slice(0, 1)}
              </span>
              <div>
                <h1>{place.name}</h1>
                <p>{place.product}</p>
              </div>
              <span className="fc-status" data-status={place.status}>
                {place.status === "live"
                  ? "Live"
                  : place.status === "pilot"
                    ? "Pilot"
                    : "Context"}
              </span>
            </div>

            {place.status !== "context" && (
              <div className="fc-connection">
                <span>{place.product}</span>
                <b>→</b>
                {place.networkId !== "ethereum" && (
                  <>
                    <span>{network?.name ?? "L2"}</span>
                    <b>→</b>
                  </>
                )}
                <button onClick={() => choose("ethereum")}>◇ Ethereum</button>
              </div>
            )}
            {metric ? (
              <div className="fc-product-metric">
                <div>
                  <span className="fc-metric-state">
                    <i data-live={metricCurrent} />
                    {metricCurrent
                      ? "Onchain observation"
                      : "Last known / unavailable"}
                  </span>
                  <strong>
                    {metric.value === null ? "—" : short(metric.value)}{" "}
                    <small>{place.id === "usdc" ? "USDC" : "USDT"}</small>
                  </strong>
                  <span>Contract token supply on Ethereum</span>
                </div>
                <p>
                  {metric.value !== null
                    ? exact(metric.value) + " tokens · "
                    : ""}
                  {metric.asOfBlock
                    ? "block " + exact(metric.asOfBlock)
                    : "Waiting for a verified read"}
                  <br />
                  Checked {shortTime(metric.observedAt)} · excludes other chains
                </p>
              </div>
            ) : place.id === "lido" ? (
              <div className="fc-product-metric">
                <span>Ethereum security, shared across the city</span>
                <strong>
                  {short(feeds.staking.reportedStakedEth)} <small>ETH</small>
                </strong>
                <p>
                  Total reported ETH staked across Ethereum, not a Lido balance.{" "}
                  {stakingCurrent ? "Source checked" : "Last known report"}{" "}
                  {stakingChecked}.{" "}
                  <button onClick={() => choose("staking")}>
                    See staking →
                  </button>
                </p>
              </div>
            ) : place.status !== "context" ? (
              <div className="fc-verified">
                <span>↗</span>
                <p>
                  <strong>{cityStatusLabel(place.status)}</strong>
                  <small>
                    Product connection documented by source. Product volume is
                    not measured.
                  </small>
                </p>
              </div>
            ) : (
              <div className="fc-context-note">
                <strong>The financial world extends beyond this map.</strong>
                <p>
                  These blocks represent sectors, including offchain finance and
                  activity on other networks. They are not a list of businesses
                  waiting to join Ethereum.
                </p>
              </div>
            )}
            <details className="fc-scope">
              <summary>What this connection means</summary>
              <p>{place.description}</p>
              <p>{place.scopeNote}</p>
              {metric && (
                <p>
                  {metric.scopeNote}{" "}
                  <a href={metric.sourceUrl} target="_blank" rel="noreferrer">
                    Token contract ↗
                  </a>
                </p>
              )}
              <p>
                Source reviewed {place.reviewedAt}. Building size and street
                crowds do not represent assets, adoption or customer counts.
              </p>
            </details>
            <div className="fc-card-bottom">
              {place.sourceUrl ? (
                <a href={place.sourceUrl} target="_blank" rel="noreferrer">
                  View product source ↗
                </a>
              ) : (
                <span>Sector context · illustrative scale</span>
              )}
              {place.networkId && (
                <span>
                  <i data-live={isTelemetryFresh(networkRow, feeds.now)} />
                  {network?.name}{" "}
                  {isTelemetryFresh(networkRow, feeds.now)
                    ? "feed current"
                    : "feed delayed"}
                </span>
              )}
            </div>
          </>
        ) : isStaking ? (
          <>
            <div className="fc-card-eyebrow">
              <span>The security foundation</span>
              <button
                className="fc-card-close"
                onClick={() => choose(null)}
                aria-label="Back to city overview"
              >
                ×
              </button>
            </div>
            <h1>ETH at stake.</h1>
            <p className="fc-description">
              Validators commit ETH to propose blocks and agree on Ethereum’s
              history. The lights around the hall symbolize that commitment.
            </p>
            <div className="fc-product-metric">
              <span>Reported ETH staked</span>
              <strong>
                {short(feeds.staking.reportedStakedEth)} <small>ETH</small>
              </strong>
              <p>
                {exact(feeds.staking.reportedStakedEth)} ETH ·{" "}
                {stakingCurrent
                  ? "source checked"
                  : "last known report checked"}{" "}
                {stakingChecked}
              </p>
            </div>
            <p className="fc-small">
              Reported by ethereum.org, checked every 15 minutes. Its
              measurement time is not published. Lights are symbolic;
              liquid-staking tokens are not counted again.
            </p>
            <a
              className="fc-source-link"
              href={feeds.staking.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Staking source ↗
            </a>
          </>
        ) : isEthereum ? (
          <>
            <div className="fc-card-eyebrow">
              <span>The shared foundation</span>
              <button
                className="fc-card-close"
                onClick={() => choose(null)}
                aria-label="Back to city overview"
              >
                ×
              </button>
            </div>
            <h1>Ethereum</h1>
            <p className="fc-description">
              The connected district uses Ethereum directly or through L2s. L2s
              execute their own transactions and publish data or state updates
              to Ethereum.
            </p>
            <div className="fc-product-metric">
              <span>Latest observed Ethereum block</span>
              <strong>
                {networkRow?.blockNumber ? exact(networkRow.blockNumber) : "—"}
              </strong>
              <p>
                {networkRow?.transactionCount ?? "—"} transactions ·{" "}
                {shortTime(networkRow?.blockTimestamp)}
                <br />
                {isTelemetryFresh(networkRow, feeds.now)
                  ? "Current"
                  : "Checking / stale"}{" "}
                · finality not verified
              </p>
            </div>
            <div className="fc-network-chips">
              {NETWORKS.filter((n) => n.kind === "l2").map((n) => (
                <span key={n.id}>
                  <i
                    data-live={isTelemetryFresh(
                      feeds.telemetry.chains.find((r) => r.id === n.id),
                      feeds.now,
                    )}
                  />
                  {n.name}
                </span>
              ))}
            </div>
            <button
              className="fc-text-button"
              onClick={() => dialog.current?.showModal()}
            >
              Inspect observed L2 connections ↗
            </button>
          </>
        ) : (
          <>
            <div className="fc-card-eyebrow">
              <span>
                {layer === "context"
                  ? "The wider financial world"
                  : "A city of real connections"}
              </span>
              <span className="fc-mini-diamond">◇</span>
            </div>
            <h1>
              {layer === "context"
                ? "Finance is a much bigger city."
                : "Explore finance on Ethereum."}
            </h1>
            <p className="fc-description">
              {layer === "context"
                ? "Banks, markets, insurers and asset owners operate across many systems. Their whole businesses are not represented by the products connected here."
                : "Step into the shops already operating on Ethereum and its L2s. Around them, a much larger financial world carries on."}
            </p>
            {layer !== "context" && (
              <div className="fc-overview-metrics">
                {(["usdc", "usdt"] as const).map((id) => {
                  const value = finance.snapshot?.metrics.find(
                    (m) => m.id === id,
                  );
                  return (
                    <button key={id} onClick={() => choose(id)}>
                      <span>
                        <i
                          data-live={
                            isFinanceMetricFresh(value, feeds.now) &&
                            !finance.failed
                          }
                        />
                        {id.toUpperCase()}
                      </span>
                      <strong>
                        {value?.value === null || value?.value === undefined
                          ? "—"
                          : short(value.value)}
                      </strong>
                      <small>
                        Ethereum tokens ·{" "}
                        {isFinanceMetricFresh(value, feeds.now) &&
                        !finance.failed
                          ? "Current"
                          : value?.value !== null && value?.value !== undefined
                            ? "Last known"
                            : finance.snapshot
                              ? "Unavailable"
                              : "Checking"}
                      </small>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="fc-intro-counts">
              <button onClick={() => changeLayer("connected")}>
                <strong>{liveProducts}</strong>
                <span>live products mapped</span>
              </button>
              <button
                onClick={() =>
                  choose(
                    CONNECTED_PLACES.find((p) => p.status === "pilot")?.id ??
                      null,
                  )
                }
              >
                <strong>{pilots}</strong>
                <span>documented pilot</span>
              </button>
              <button onClick={() => changeLayer("context")}>
                <strong>{CONTEXT_PLACES.length}</strong>
                <span>wider finance sectors</span>
              </button>
            </div>
            <div className="fc-intro-legend">
              <span>
                <i className="fc-key-live" />
                Documented connection
              </span>
              <span>
                <i className="fc-key-pilot" />
                Pilot
              </span>
              <span>
                <i className="fc-key-context" />
                Wider finance context
              </span>
            </div>
            <p className="fc-small">
              Select a shop to see its product, network and evidence. This is a
              selected map, not a measure of Ethereum’s share of global finance.
            </p>
          </>
        )}
      </aside>
      <div className="fc-story-label">
        <span>
          {layer === "connected"
            ? "THE CONNECTED DISTRICT"
            : layer === "context"
              ? "THE WIDER FINANCIAL WORLD"
              : "ONE FINANCIAL WORLD. MANY SYSTEMS."}
        </span>
        <p>
          {layer === "connected"
            ? "Real products. Traceable connections."
            : layer === "context"
              ? "More than any single network."
              : "A growing district on Ethereum."}
        </p>
      </div>
      <div className="fc-live-strip">
        <i data-live={eventFresh} />
        {eventFresh && currentEvent ? (
          <span>
            {currentEvent.direction === "l2-to-ethereum"
              ? currentEvent.chainName + " → Ethereum"
              : "Ethereum → " + currentEvent.chainName}{" "}
            ·{" "}
            {currentEvent.kind === "settlement"
              ? "observed infrastructure activity"
              : "observed bridge event"}{" "}
            · {age(currentEvent.timestamp, feeds.now)}
          </span>
        ) : (
          <span>
            {freshCount}/{NETWORKS.length} network feeds current ·{" "}
            {eventFresh
              ? "No matching recent connection events"
              : "Connection feed checking / delayed"}
          </span>
        )}
        <button onClick={() => dialog.current?.showModal()}>Inspect ↗</button>
      </div>
      <footer className="fc-footer">
        <div className="fc-controls">
          <button
            onClick={() => setPaused((v) => !v)}
            aria-label={
              paused ? "Resume town animation" : "Pause town animation"
            }
          >
            {paused ? "▶" : "Ⅱ"} <span>{paused ? "Play" : "Pause"}</span>
          </button>
          <label>
            <span>Speed</span>
            <select
              aria-label="Animation speed"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            >
              <option value={0.5}>½×</option>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
            </select>
          </label>
          <button onClick={() => setNight((v) => !v)}>
            {night ? "☀ Day" : "☾ Night"}
          </button>
          <button
            onClick={() => {
              choose(null);
              city.current?.resetView();
            }}
          >
            ↗ <span>City view</span>
          </button>
        </div>
        <p>
          Street life is illustrative. Light pulses show observed network
          activity.
        </p>
        <button
          className="fc-refresh"
          disabled={feeds.refreshing || finance.loading}
          onClick={() => {
            feeds.refresh();
            finance.refresh();
          }}
        >
          ↻{" "}
          <span>
            {feeds.refreshing || finance.loading ? "Checking" : "Refresh data"}
          </span>
        </button>
      </footer>
      {!ready && (
        <div className="fc-loading">
          <span>◇</span>Opening the financial district…
        </div>
      )}
      {error && (
        <div className="fc-scene-error">
          The 3D view could not start. Product details and live data remain
          available.
        </div>
      )}
      <dialog
        ref={dialog}
        className="fc-dialog"
        id="city-data"
        aria-labelledby="city-data-title"
      >
        <div className="fc-dialog-top">
          <div>
            <span>ETHEREUM TOWN</span>
            <h2 id="city-data-title">A map you can read.</h2>
          </div>
          <button
            autoFocus
            onClick={() => dialog.current?.close()}
            aria-label="Close about and data"
          >
            ×
          </button>
        </div>
        <div className="fc-dialog-body">
          <p className="fc-dialog-lead">
            The illuminated shops are selected financial products with
            documented Ethereum connections. The surrounding city represents the
            larger financial system, whose activity spans offchain
            infrastructure and many networks.
          </p>
          <div className="fc-guide-grid">
            <section>
              <h3>Read the streets</h3>
              <p>
                Bright paths show documented product relationships. Amber paths
                identify a pilot. Context buildings have no asserted Ethereum
                route. Geometry and pedestrian traffic are illustrative, not
                market share or asset value.
              </p>
            </section>
            <section>
              <h3>Follow real observations</h3>
              <p>
                Light pulses show observed L1 infrastructure or bridge events at
                shared network routes. They never imply a named institution just
                moved money. Block feeds refresh every 30 seconds; token supply
                every minute.
              </p>
            </section>
            <section>
              <h3>Inspect the shops</h3>
              <p>
                USDC and USDT show their Ethereum contract’s totalSupply at a
                verified block. This is a token count, not dollar valuation,
                global circulation or transfer volume. Other shops have
                documented deployment information, not invented activity
                metrics.
              </p>
            </section>
            <section>
              <h3>A wider world</h3>
              <p>
                {CITY_SCOPE_NOTE} Muted context blocks do not mean an entire
                sector is unconnected, and they are not promised future
                arrivals. A product connection does not put its parent
                institution’s whole balance sheet on Ethereum.
              </p>
            </section>
          </div>
          <h3>Mapped products</h3>
          <div className="fc-product-directory">
            {CONNECTED_PLACES.map((p) => (
              <div key={p.id}>
                <button
                  onClick={() => {
                    choose(p.id);
                    dialog.current?.close();
                  }}
                >
                  {p.name}
                  <small>{p.product}</small>
                </button>
                <span>{cityStatusLabel(p.status)}</span>
                <a href={p.sourceUrl!} target="_blank" rel="noreferrer">
                  Source ↗
                </a>
              </div>
            ))}
          </div>
          <h3>
            Observed network data{" "}
            <small>
              {freshCount}/{NETWORKS.length} current
            </small>
          </h3>
          <div className="fc-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Network</th>
                  <th>Block</th>
                  <th>Transactions in block</th>
                  <th>Observed block time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {NETWORKS.map((n) => {
                  const row = feeds.telemetry.chains.find((r) => r.id === n.id);
                  return (
                    <tr key={n.id}>
                      <td>{n.name}</td>
                      <td>
                        {row?.explorerUrl ? (
                          <a
                            href={row.explorerUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {row.blockNumber} ↗
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{row?.transactionCount ?? "—"}</td>
                      <td>{shortTime(row?.blockTimestamp)}</td>
                      <td>
                        {isTelemetryFresh(row, feeds.now)
                          ? "Current"
                          : row?.blockNumber
                            ? "Last known / stale"
                            : "Unavailable"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p>
            Block counts describe each network, not a shop’s customers or
            product usage. Blocks have different durations and semantics.
            Latest-block finality is not verified. Missing or delayed
            observations are marked; they are not zero.
          </p>
          <h3>Selected Ethereum connections</h3>
          <p>
            Six of nine displayed L2 networks have selected data / settlement
            monitoring; three have selected canonical asset-bridge monitoring.
            Base and OP batch submissions are sampled, at most six newest
            verified calls each. Mantle, Ink and Unichain have block feeds but
            no connection-event monitoring.
          </p>
          <p>{feeds.bridges?.note}</p>
          <p>
            Window {shortTime(feeds.bridges?.periodStart)}–
            {shortTime(feeds.bridges?.observedThrough)} · checked{" "}
            {shortTime(feeds.bridges?.fetchedAt)} ·{" "}
            {eventFresh ? "recent observation" : "checking / stale"}
          </p>
          <div className="fc-events-directory">
            {feeds.bridges?.events.slice(0, 16).map((e) => (
              <a
                key={e.id}
                href={e.explorerUrl}
                target="_blank"
                rel="noreferrer"
              >
                <span>
                  {e.chainName}
                  <small>
                    {e.stage.replaceAll("-", " ")} ·{" "}
                    {e.kind === "bridge" ? "asset bridge" : "infrastructure"}
                  </small>
                </span>
                <span>{shortTime(e.timestamp)} ↗</span>
              </a>
            ))}
          </div>
          <details>
            <summary>Monitored routes and primary sources</summary>
            {feeds.bridges?.coverage.map((c) => (
              <section key={c.chainId}>
                <h4>{c.chainName}</h4>
                <p>
                  Asset bridge: {c.bridgeStatus} · Infrastructure:{" "}
                  {c.settlementStatus}. {c.note}
                </p>
                {c.sources
                  .filter(
                    (s, i, sources) =>
                      sources.findIndex((source) => source.url === s.url) === i,
                  )
                  .map((s) => (
                    <a
                      key={s.url}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {s.label} ↗{" "}
                    </a>
                  ))}
              </section>
            ))}
          </details>
          <h3>Reported ETH staking</h3>
          <p>
            {exact(feeds.staking.reportedStakedEth)} ETH reported by{" "}
            <a href={feeds.staking.sourceUrl} target="_blank" rel="noreferrer">
              ethereum.org
            </a>
            , {stakingCurrent ? "source checked" : "last known report checked"}{" "}
            {stakingChecked}. {feeds.staking.warning ?? ""} The source credits
            Dune and does not publish the metric’s measurement time. The lights
            are symbolic; liquid-staking receipt tokens are not added again.
            Staking secures Ethereum consensus and does not guarantee every
            product.
          </p>
          <p className="fc-attribution">
            Inspired by{" "}
            <a
              href="https://sael.net/token-town/"
              target="_blank"
              rel="noreferrer"
            >
              Ryan Sael’s Token Town
            </a>
            . Original scene and code. Independent educational visualization; no
            affiliation with the named organizations. Public feeds may be
            rate-limited or delayed.
          </p>
        </div>
      </dialog>
    </main>
  );
}
