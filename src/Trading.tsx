import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  CircleHelp,
  FastForward,
  Pause,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Star,
  X,
} from "lucide-react";
import PriceChart from "./Chart";
import type { Asset, OrderInput, OrderType, Session, Side } from "./types";
import {
  availableCash,
  availableShares,
  cancelOrder,
  closePosition,
  equity,
  submitOrder,
} from "./engine";
import { compact, dateLabel, percent, rupee } from "./format";

export type Mutate = (fn: (s: Session) => Session, success?: string) => void;
export function Replay({
  session,
  playing,
  setPlaying,
  speed,
  setSpeed,
  seek,
}: {
  session: Session;
  playing: boolean;
  setPlaying: (b: boolean) => void;
  speed: number;
  setSpeed: (v: number) => void;
  seek: (v: number) => void;
}) {
  const cursor = session.account.cursor,
    last = session.assets[0].bars.length - 1,
    date = session.assets[0].bars[cursor].date;
  return (
    <div className="replay">
      <div className="replay-top">
        <div className="replay-title">
          <span className="live-dot" />
          <b>Market replay</b>
          <span className="badge">
            {cursor === last ? "Finished" : "Daily bars"}
          </span>
        </div>
        <span className="replay-date">{dateLabel(date)}</span>
      </div>
      <div className="replay-controls">
        <button
          className="icon-button"
          aria-label="Restart replay"
          title="Restore the initial account; journal and lessons stay"
          disabled={cursor === session.startCursor}
          onClick={() => seek(session.startCursor)}
        >
          <RotateCcw size={17} />
        </button>
        <button
          className="icon-button"
          aria-label="Previous session"
          title="Previous session (←). Restores account and discards the later branch."
          disabled={cursor === session.startCursor}
          onClick={() => seek(cursor - 1)}
        >
          <SkipBack size={17} />
        </button>
        <button
          className="play-button"
          aria-label={playing ? "Pause replay" : "Play replay"}
          disabled={cursor === last && !playing}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? (
            <Pause size={18} fill="currentColor" />
          ) : (
            <Play size={18} fill="currentColor" />
          )}
        </button>
        <button
          className="icon-button"
          aria-label="Next session"
          title="Next session (→)"
          disabled={cursor === last}
          onClick={() => seek(cursor + 1)}
        >
          <SkipForward size={17} />
        </button>
        <button
          className="icon-button"
          aria-label="Advance five sessions"
          disabled={cursor === last}
          onClick={() => seek(Math.min(last, cursor + 5))}
        >
          <FastForward size={17} />
        </button>
        <input
          className="replay-range"
          aria-label="Replay timeline"
          type="range"
          min={session.startCursor}
          max={last}
          value={cursor}
          onChange={(e) => seek(Number(e.target.value))}
        />
        <select
          className="speed-select"
          aria-label="Replay speed"
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
        >
          <option value={2000}>0.5×</option>
          <option value={1000}>1×</option>
          <option value={500}>2×</option>
          <option value={250}>4×</option>
        </select>
      </div>
      <div className="replay-bottom">
        <span>
          Session {cursor - session.startCursor + 1} of{" "}
          {last - session.startCursor + 1}
        </span>
        <span>Space to play · ← → to step</span>
      </div>
    </div>
  );
}

export function OrderTicket({
  session,
  asset,
  mutate,
}: {
  session: Session;
  asset: Asset;
  mutate: Mutate;
}) {
  const price = asset.bars[session.account.cursor].close;
  const [side, setSide] = useState<Side>("buy"),
    [type, setType] = useState<OrderType>("market"),
    [quantity, setQuantity] = useState("10"),
    [limit, setLimit] = useState(price.toFixed(2)),
    [stop, setStop] = useState((price * 1.02).toFixed(2)),
    [tif, setTif] = useState<"GTC" | "DAY">("GTC"),
    [bracket, setBracket] = useState(false),
    [sl, setSl] = useState((price * 0.95).toFixed(2)),
    [tp, setTp] = useState((price * 1.1).toFixed(2));
  const reference =
      type === "limit" || type === "stop-limit"
        ? Number(limit)
        : type === "stop"
          ? Number(stop)
          : price,
    q = Number(quantity),
    notional = Math.max(0, q * reference),
    fee = (notional * session.settings.feeBps) / 10000,
    available = availableCash(
      session.account,
      session.assets,
      session.settings,
    ),
    shares = availableShares(session.account, asset.symbol),
    estimate =
      notional *
      (1 + (session.settings.feeBps + session.settings.slippageBps) / 10000),
    risk =
      Number(sl) < reference && Number(sl) > 0
        ? q * (reference - Number(sl))
        : 0;
  const size = (fraction: number) =>
    setQuantity(
      String(
        Math.max(
          0,
          Math.floor(
            side === "buy"
              ? (available * fraction) /
                  (reference *
                    (1 +
                      (session.settings.feeBps + session.settings.slippageBps) /
                        10000))
              : shares * fraction,
          ),
        ),
      ),
    );
  const submit = () => {
    const input: OrderInput = {
      symbol: asset.symbol,
      side,
      type,
      quantity: q,
      tif,
    };
    if (type === "limit" || type === "stop-limit") input.limit = Number(limit);
    if (type === "stop" || type === "stop-limit") input.stop = Number(stop);
    if (bracket && side === "buy") {
      if (sl) input.stopLoss = Number(sl);
      if (tp) input.takeProfit = Number(tp);
    }
    mutate(
      (s) => submitOrder(s, input),
      "Paper order queued. Advance replay to execute.",
    );
  };
  return (
    <section className="panel order-ticket">
      <div className="panel-title">
        <h2>Place an order</h2>
        <ShieldCheck size={17} className="muted" />
      </div>
      <div className="trade-toggle">
        <button
          className={side === "buy" ? "buy active" : ""}
          onClick={() => setSide("buy")}
        >
          <ArrowDownLeft size={16} />
          Buy
        </button>
        <button
          className={side === "sell" ? "sell active" : ""}
          onClick={() => setSide("sell")}
        >
          <ArrowUpRight size={16} />
          Sell
        </button>
      </div>
      <div className="field-row">
        <label>
          Order type
          <select
            value={type}
            onChange={(e) => setType(e.target.value as OrderType)}
          >
            <option value="market">Market</option>
            <option value="limit">Limit</option>
            <option value="stop">Stop market</option>
            <option value="stop-limit">Stop limit</option>
          </select>
        </label>
        <label>
          Validity
          <select
            value={tif}
            onChange={(e) => setTif(e.target.value as "GTC" | "DAY")}
          >
            <option value="GTC">GTC</option>
            <option value="DAY">Day</option>
          </select>
        </label>
      </div>
      <label>
        Quantity <span className="label-side">Whole shares</span>
        <input
          aria-label="Order quantity"
          inputMode="numeric"
          type="number"
          min="1"
          max="1000000"
          step="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </label>
      <div className="allocation">
        {[0.25, 0.5, 0.75, 1].map((n) => (
          <button key={n} onClick={() => size(n)}>
            {n === 1 ? "Max" : `${n * 100}%`}
          </button>
        ))}
      </div>
      {(type === "limit" || type === "stop-limit") && (
        <label>
          Limit price (₹)
          <input
            type="number"
            min=".01"
            step=".01"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
        </label>
      )}
      {(type === "stop" || type === "stop-limit") && (
        <label>
          Trigger price (₹)
          <input
            type="number"
            min=".01"
            step=".01"
            value={stop}
            onChange={(e) => setStop(e.target.value)}
          />
        </label>
      )}
      {side === "buy" && (
        <>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={bracket}
              onChange={(e) => setBracket(e.target.checked)}
            />
            <span>Add stop-loss & profit target</span>
            <CircleHelp size={14} />
          </label>
          {bracket && (
            <div className="bracket-fields">
              <div className="field-row">
                <label>
                  Stop-loss (₹)
                  <input
                    type="number"
                    min=".01"
                    step=".01"
                    value={sl}
                    onChange={(e) => setSl(e.target.value)}
                  />
                </label>
                <label>
                  Target (₹)
                  <input
                    type="number"
                    min=".01"
                    step=".01"
                    value={tp}
                    onChange={(e) => setTp(e.target.value)}
                  />
                </label>
              </div>
              <button
                className="text-button"
                disabled={!(Number(sl) > 0 && Number(sl) < reference)}
                onClick={() => {
                  const cost =
                    reference -
                    Number(sl) +
                    (reference *
                      (session.settings.feeBps * 2 +
                        session.settings.slippageBps * 2)) /
                      10000;
                  setQuantity(
                    String(
                      Math.max(
                        0,
                        Math.min(
                          Math.floor(
                            (equity(session.account, session.assets) *
                              session.settings.riskPercent) /
                              100 /
                              cost,
                          ),
                          Math.floor(
                            available /
                              (reference *
                                (1 +
                                  (session.settings.feeBps +
                                    session.settings.slippageBps) /
                                    10000)),
                          ),
                        ),
                      ),
                    ),
                  );
                }}
              >
                Size for {session.settings.riskPercent}% risk{" "}
                <ChevronRight size={14} />
              </button>
              <small>
                OCO exits activate after the entry bar. Gaps can exceed planned
                risk.
              </small>
            </div>
          )}
        </>
      )}
      <div className="order-summary">
        <div>
          <span>Reference price</span>
          <b>{rupee(reference || 0)}</b>
        </div>
        <div>
          <span>Estimated fee</span>
          <b>{rupee(fee || 0)}</b>
        </div>
        <div>
          <span>{side === "buy" ? "Available cash" : "Available shares"}</span>
          <b>{side === "buy" ? rupee(available, 0) : shares}</b>
        </div>
        {bracket && side === "buy" && (
          <div>
            <span>Planned price risk</span>
            <b>{rupee(risk || 0)}</b>
          </div>
        )}
        <div className="total">
          <span>Estimated {side === "buy" ? "cost" : "proceeds"}</span>
          <b>{rupee((side === "buy" ? estimate : notional - fee) || 0)}</b>
        </div>
      </div>
      <button
        className={`place-order ${side}`}
        disabled={session.account.cursor === asset.bars.length - 1}
        onClick={submit}
      >
        Place paper {side}
        <ChevronRight size={16} />
      </button>
      <p className="ticket-note">
        Eligible from the next daily bar. Fees and slippage apply; final fill
        may differ.
      </p>
    </section>
  );
}

export function Watchlist({
  session,
  mutate,
}: {
  session: Session;
  mutate: Mutate;
}) {
  const [search, setSearch] = useState("");
  const assets = session.assets.filter(
    (a) =>
      (search || session.watchlist.includes(a.symbol)) &&
      (a.symbol + " " + a.name).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="panel watchlist">
      <div className="panel-title">
        <h2>Watchlist</h2>
        <span className="muted">{session.watchlist.length} stocks</span>
      </div>
      <div className="search-input">
        <Search size={15} />
        <input
          aria-label="Find a stock"
          placeholder="Find a stock…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {assets.map((a) => {
        const bar = a.bars[session.account.cursor],
          previous = a.bars[Math.max(0, session.account.cursor - 1)],
          change = (bar.close - previous.close) / previous.close;
        return (
          <div
            className={`watch-row ${session.selected === a.symbol ? "active" : ""}`}
            key={a.symbol}
          >
            <button
              className="watch-select"
              onClick={() => mutate((s) => ({ ...s, selected: a.symbol }))}
            >
              <span className="asset-dot" style={{ background: a.color }} />
              <span>
                <b>{a.symbol}</b>
                <small>{a.sector}</small>
              </span>
              <span className="watch-price">
                <b>{rupee(bar.close)}</b>
                <small className={change >= 0 ? "positive" : "negative"}>
                  {percent(change)}
                </small>
              </span>
            </button>
            <button
              className="star-button"
              aria-label={`${session.watchlist.includes(a.symbol) ? "Remove" : "Add"} ${a.symbol} ${session.watchlist.includes(a.symbol) ? "from" : "to"} watchlist`}
              onClick={() =>
                mutate((s) => ({
                  ...s,
                  watchlist: s.watchlist.includes(a.symbol)
                    ? s.watchlist.filter((v) => v !== a.symbol)
                    : [...s.watchlist, a.symbol],
                }))
              }
            >
              <Star
                size={13}
                fill={
                  session.watchlist.includes(a.symbol) ? "currentColor" : "none"
                }
              />
            </button>
          </div>
        );
      })}
      {!assets.length && (
        <p className="empty-small">Search to add a stock to your watchlist.</p>
      )}
    </section>
  );
}

export function AccountTable({
  session,
  mutate,
}: {
  session: Session;
  mutate: Mutate;
}) {
  const [tab, setTab] = useState<"positions" | "orders" | "fills">("positions"),
    [activeOnly, setActiveOnly] = useState(false);
  const positions = Object.entries(session.account.positions),
    orders = [...session.account.orders]
      .reverse()
      .filter(
        (o) => !activeOnly || ["pending", "triggered"].includes(o.status),
      ),
    fills = [...session.account.fills].reverse();
  return (
    <section className="panel account-table">
      <div className="table-tabs">
        {(["positions", "orders", "fills"] as const).map((t) => (
          <button
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
            key={t}
          >
            {t[0].toUpperCase() + t.slice(1)}
            <span>
              {t === "positions"
                ? positions.length
                : t === "orders"
                  ? session.account.orders.length
                  : fills.length}
            </span>
          </button>
        ))}
        {tab === "orders" && (
          <label className="checkbox-label compact-check">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
            />
            Open only
          </label>
        )}
      </div>
      <div className="table-scroll">
        <table>
          {tab === "positions" ? (
            <>
              <thead>
                <tr>
                  <th>Stock</th>
                  <th>Quantity</th>
                  <th>Avg. cost incl. fee</th>
                  <th>Last price</th>
                  <th>Market value</th>
                  <th>Unrealised P&L</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {positions.map(([symbol, p]) => {
                  const asset = session.assets.find(
                      (a) => a.symbol === symbol,
                    )!,
                    price = asset.bars[session.account.cursor].close,
                    pnl = (price - p.averageCost) * p.quantity;
                  return (
                    <tr key={symbol}>
                      <td>
                        <b>{symbol}</b>
                        <small>{asset.sector}</small>
                      </td>
                      <td>{p.quantity}</td>
                      <td>{rupee(p.averageCost)}</td>
                      <td>{rupee(price)}</td>
                      <td>{rupee(price * p.quantity)}</td>
                      <td className={pnl >= 0 ? "positive" : "negative"}>
                        {rupee(pnl)}
                      </td>
                      <td>
                        <button
                          className="small-button"
                          onClick={() =>
                            mutate(
                              (s) => closePosition(s, symbol),
                              "Exit queued; existing exit orders cancelled.",
                            )
                          }
                        >
                          Close
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </>
          ) : tab === "orders" ? (
            <>
              <thead>
                <tr>
                  <th>Stock / order</th>
                  <th>Side</th>
                  <th>Type</th>
                  <th>Quantity</th>
                  <th>Price / trigger</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <b>{o.symbol}</b>
                      <small>
                        {o.id}
                        {o.group ? " · OCO" : ""} · {o.tif}
                      </small>
                    </td>
                    <td className={o.side === "buy" ? "positive" : "negative"}>
                      {o.side.toUpperCase()}
                    </td>
                    <td>{o.type}</td>
                    <td>{o.quantity}</td>
                    <td>
                      {o.fillPrice !== undefined
                        ? rupee(o.fillPrice)
                        : o.limit
                          ? rupee(o.limit)
                          : "Market"}
                      {o.stop && <small>Trigger {rupee(o.stop)}</small>}
                    </td>
                    <td>
                      <span className={`status ${o.status}`} title={o.message}>
                        {o.status}
                      </span>
                      {o.status === "rejected" && <small>{o.message}</small>}
                    </td>
                    <td>
                      {["pending", "triggered"].includes(o.status) && (
                        <button
                          className="icon-button"
                          aria-label={`Cancel order ${o.id}`}
                          onClick={() =>
                            mutate(
                              (s) => cancelOrder(s, o.id),
                              "Order cancelled.",
                            )
                          }
                        >
                          <X size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          ) : (
            <>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Stock</th>
                  <th>Side</th>
                  <th>Quantity</th>
                  <th>Fill price</th>
                  <th>Fee</th>
                  <th>Realised P&L</th>
                </tr>
              </thead>
              <tbody>
                {fills.map((f) => (
                  <tr key={f.id}>
                    <td>{dateLabel(f.date)}</td>
                    <td>
                      <b>{f.symbol}</b>
                    </td>
                    <td className={f.side === "buy" ? "positive" : "negative"}>
                      {f.side.toUpperCase()}
                    </td>
                    <td>{f.quantity}</td>
                    <td>{rupee(f.price)}</td>
                    <td>{rupee(f.fee)}</td>
                    <td
                      className={
                        (f.realised ?? 0) >= 0 ? "positive" : "negative"
                      }
                    >
                      {f.realised === null ? "—" : rupee(f.realised)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </table>
      </div>
      {!(tab === "positions" ? positions : tab === "orders" ? orders : fills)
        .length && (
        <div className="table-empty">
          <div className="empty-icon">
            <ChartIcon />
          </div>
          <h3>
            {tab === "positions"
              ? "Your next lesson starts with a trade."
              : tab === "orders"
                ? "No orders here yet."
                : "Your fills will tell the story."}
          </h3>
          <p>
            {tab === "positions"
              ? "Choose a stock, plan your risk and place a paper order."
              : tab === "orders"
                ? "Market, limit, stop and stop-limit orders appear here."
                : "Advance the replay after placing an order to see its execution."}
          </p>
          <span className="badge">100% practice capital</span>
        </div>
      )}
    </section>
  );
}
function ChartIcon() {
  return <ArrowUpRight size={23} />;
}

export function FundamentalsPanel({
  asset,
  session,
}: {
  asset: Asset;
  session: Session;
}) {
  const f = asset.fundamentals,
    p = asset.bars[session.account.cursor].close;
  if (!f)
    return (
      <div className="fundamentals">
        <h3>No financial statements in this dataset</h3>
        <p>
          CSV imports contain prices and volume only. Open Learn for fundamental
          analysis examples.
        </p>
      </div>
    );
  const eps = f.profit / f.shares,
    metrics = [
      ["Earnings per share", rupee(eps), "Profit ÷ shares"],
      ["Price / earnings", `${(p / eps).toFixed(1)}×`, "Price ÷ EPS"],
      [
        "Debt / equity",
        `${(f.debt / f.equity).toFixed(2)}×`,
        "Debt ÷ book equity",
      ],
      [
        "Return on equity",
        `${((f.profit / f.equity) * 100).toFixed(1)}%`,
        "Profit ÷ book equity",
      ],
      [
        "Net profit margin",
        `${((f.profit / f.revenue) * 100).toFixed(1)}%`,
        "Profit ÷ revenue",
      ],
      [
        "Revenue growth",
        `${f.growth.toFixed(1)}%`,
        "Illustrative annual change",
      ],
      [
        "Dividend yield",
        `${((f.dividend / p) * 100).toFixed(2)}%`,
        "Dividend per share ÷ price",
      ],
      [
        "Market capitalisation",
        `₹${compact(p * f.shares)} cr`,
        "Price × shares (crore)",
      ],
    ];
  return (
    <div className="fundamentals">
      <div className="section-intro">
        <div>
          <h3>Read the business behind the price.</h3>
          <p>
            Fictional financials for worked examples; these are not company
            disclosures.
          </p>
        </div>
        <span className="badge">Illustrative data</span>
      </div>
      <div className="fund-grid">
        {metrics.map(([label, value, formula]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{formula}</small>
          </div>
        ))}
      </div>
      <p className="fund-note">
        An attractive multiple is a starting question. Compare cash flows, debt,
        competitive position and sector economics before forming a view. Banking
        ratios need sector-specific interpretation.
      </p>
    </div>
  );
}

export function TradingChart({ session }: { session: Session }) {
  const [tab, setTab] = useState("chart"),
    asset = session.assets.find((a) => a.symbol === session.selected)!;
  return (
    <section className="panel main-chart">
      <div className="view-tabs">
        <button
          className={tab === "chart" ? "active" : ""}
          onClick={() => setTab("chart")}
        >
          Price action
        </button>
        <button
          className={tab === "fundamentals" ? "active" : ""}
          onClick={() => setTab("fundamentals")}
        >
          Fundamentals
        </button>
        <span className="muted">{asset.sector}</span>
      </div>
      {tab === "chart" ? (
        <PriceChart asset={asset} session={session} />
      ) : (
        <FundamentalsPanel asset={asset} session={session} />
      )}
    </section>
  );
}
