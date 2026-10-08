import { useEffect, useMemo, useRef, useState } from "react";
import { CandlestickChart, ChartLine, ZoomIn, ZoomOut } from "lucide-react";
import { aggregate, bollinger, ema, rsi, sma } from "./market";
import type { Asset, Session } from "./types";
import { compact, dateLabel, rupee } from "./format";

export function EquityChart({
  values,
  baseline,
}: {
  values: number[];
  baseline?: number;
}) {
  const data = values.length > 1 ? values : [values[0] ?? 0, values[0] ?? 0],
    min = Math.min(...data, baseline ?? Infinity),
    max = Math.max(...data, baseline ?? -Infinity),
    range = max - min || 1;
  const points = data
    .map(
      (v, i) =>
        `${(i / (data.length - 1)) * 800},${145 - ((v - min) / range) * 120}`,
    )
    .join(" ");
  return (
    <svg
      className="equity-chart"
      viewBox="0 0 800 170"
      role="img"
      aria-label="Account equity over observed replay sessions"
    >
      <defs>
        <linearGradient id="equity-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity=".25" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`M0 170 L${points.replaceAll(" ", " L")} L800 170 Z`}
        fill="url(#equity-fill)"
      />
      {baseline !== undefined && (
        <line
          x1="0"
          x2="800"
          y1={145 - ((baseline - min) / range) * 120}
          y2={145 - ((baseline - min) / range) * 120}
          stroke="var(--muted)"
          strokeDasharray="4 6"
        />
      )}
      <polyline
        points={points}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default function PriceChart({
  asset,
  session,
}: {
  asset: Asset;
  session: Session;
}) {
  const [period, setPeriod] = useState<"1D" | "1W" | "1M">("1D"),
    [kind, setKind] = useState<"candles" | "line">("candles"),
    [indicators, setIndicators] = useState(["sma"]),
    [showRSI, setShowRSI] = useState(true),
    [window, setWindow] = useState(70),
    [hover, setHover] = useState<number | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(920);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      setChartWidth(Math.max(320, entry.contentRect.width));
    });
    observer.observe(container.current!);
    return () => observer.disconnect();
  }, []);
  const bars = useMemo(
    () => aggregate(asset.bars.slice(0, session.account.cursor + 1), period),
    [asset, session.account.cursor, period],
  );
  const closes = bars.map((b) => b.close),
    ma = sma(closes, 20),
    ex = ema(closes, 50),
    bands = bollinger(closes, 20),
    strength = rsi(closes, 14);
  const offset = Math.max(
      0,
      bars.length - Math.min(window, chartWidth < 550 ? 36 : 200),
    ),
    visible = bars.slice(offset),
    w = chartWidth,
    h = chartWidth < 550 ? 260 : 315,
    left = 16,
    right = 78,
    bottom = 28,
    plot = w - left - right,
    step = plot / visible.length;
  const overlays = visible.flatMap((_, i) =>
    [
      indicators.includes("sma") ? ma[offset + i] : null,
      indicators.includes("ema") ? ex[offset + i] : null,
      ...(indicators.includes("bands") && bands[offset + i]
        ? [bands[offset + i]!.upper, bands[offset + i]!.lower]
        : []),
    ].filter((v): v is number => v !== null),
  );
  const low = Math.min(...visible.map((b) => b.low), ...overlays),
    high = Math.max(...visible.map((b) => b.high), ...overlays),
    padding = (high - low) * 0.12 || 1,
    min = low - padding,
    max = high + padding;
  const y = (v: number) => 15 + ((max - v) / (max - min)) * (h - bottom - 25),
    x = (i: number) => left + (i + 0.5) * step;
  const line = (values: (number | null)[]) =>
    visible
      .map((_, i) =>
        values[offset + i] === null
          ? null
          : `${x(i)},${y(values[offset + i]!)}`,
      )
      .filter(Boolean)
      .join(" ");
  const current =
      visible[Math.min(hover ?? visible.length - 1, visible.length - 1)],
    maxVolume = Math.max(...visible.map((b) => b.volume), 1);
  const toggle = (name: string) =>
    setIndicators((v) =>
      v.includes(name) ? v.filter((i) => i !== name) : [...v, name],
    );
  const last = bars.at(-1)!,
    prev = bars.at(-2) ?? last,
    change = (last.close - prev.close) / prev.close;
  return (
    <div className="chart-component" ref={container}>
      <div className="chart-heading">
        <div className="stock-heading">
          <span
            className="stock-icon"
            style={{ background: asset.color + "22", color: asset.color }}
          >
            {asset.symbol.slice(0, 2)}
          </span>
          <div>
            <h2>
              {asset.symbol}{" "}
              <span className="exchange">
                NSE · {asset.fundamentals ? "SIMULATED" : "IMPORTED"}
              </span>
            </h2>
            <span className="muted">{asset.name}</span>
          </div>
        </div>
        <div className="quote">
          <strong>{rupee(last.close)}</strong>
          <span className={change >= 0 ? "positive" : "negative"}>
            {change >= 0 ? "+" : ""}
            {rupee(last.close - prev.close)} ({(change * 100).toFixed(2)}%)
          </span>
        </div>
      </div>
      <div className="chart-toolbar">
        <div className="segments">
          {(["1D", "1W", "1M"] as const).map((p) => (
            <button
              key={p}
              className={period === p ? "active" : ""}
              onClick={() => {
                setPeriod(p);
                setHover(null);
              }}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="segments">
          <button
            aria-label="Candlestick chart"
            className={kind === "candles" ? "active" : ""}
            onClick={() => setKind("candles")}
          >
            <CandlestickChart size={16} />
          </button>
          <button
            aria-label="Line chart"
            className={kind === "line" ? "active" : ""}
            onClick={() => setKind("line")}
          >
            <ChartLine size={16} />
          </button>
        </div>
        <div className="indicator-buttons">
          <button
            className={indicators.includes("sma") ? "selected" : ""}
            onClick={() => toggle("sma")}
          >
            <i className="dot blue" />
            SMA 20
          </button>
          <button
            className={indicators.includes("ema") ? "selected" : ""}
            onClick={() => toggle("ema")}
          >
            <i className="dot orange" />
            EMA 50
          </button>
          <button
            className={indicators.includes("bands") ? "selected" : ""}
            onClick={() => toggle("bands")}
          >
            Bollinger
          </button>
          <button
            className={showRSI ? "selected" : ""}
            onClick={() => setShowRSI((v) => !v)}
          >
            RSI 14
          </button>
        </div>
        <div className="zoom-buttons">
          <button
            className="icon-button"
            aria-label="Zoom in chart"
            onClick={() => setWindow((v) => Math.max(20, v - 20))}
          >
            <ZoomIn size={16} />
          </button>
          <button
            className="icon-button"
            aria-label="Zoom out chart"
            onClick={() => setWindow((v) => Math.min(200, v + 20))}
          >
            <ZoomOut size={16} />
          </button>
        </div>
      </div>
      <div className="ohlc">
        <span>{dateLabel(current.date)}</span>
        <span>
          O <b>{current.open.toFixed(2)}</b>
        </span>
        <span>
          H <b>{current.high.toFixed(2)}</b>
        </span>
        <span>
          L <b>{current.low.toFixed(2)}</b>
        </span>
        <span>
          C{" "}
          <b
            className={current.close >= current.open ? "positive" : "negative"}
          >
            {current.close.toFixed(2)}
          </b>
        </span>
        <span>
          Vol <b>{compact(current.volume)}</b>
        </span>
      </div>
      <svg
        className="price-chart"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`${asset.symbol} ${period} ${kind} chart through ${last.date}. Last close ${last.close}. Only revealed bars are displayed.`}
        onPointerLeave={() => setHover(null)}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setHover(
            Math.max(
              0,
              Math.min(
                visible.length - 1,
                Math.floor(
                  (((event.clientX - rect.left) / rect.width) * w - left) /
                    step,
                ),
              ),
            ),
          );
        }}
      >
        {[0, 1, 2, 3, 4].map((i) => {
          const price = min + ((max - min) * i) / 4;
          return (
            <g key={i}>
              <line
                x1={left}
                x2={w - right}
                y1={y(price)}
                y2={y(price)}
                className="grid-line"
              />
              <text x={w - right + 12} y={y(price) + 4} className="axis-text">
                {price.toFixed(2)}
              </text>
            </g>
          );
        })}
        {visible.map((b, i) => (
          <rect
            key={`v${i}`}
            x={x(i) - step * 0.3}
            y={h - bottom - (45 * b.volume) / maxVolume}
            width={Math.max(1, step * 0.6)}
            height={(45 * b.volume) / maxVolume}
            fill={b.close >= b.open ? "var(--green)" : "var(--red)"}
            opacity=".15"
          />
        ))}
        {indicators.includes("bands") && (
          <>
            <polyline
              points={line(bands.map((v) => v?.upper ?? null))}
              fill="none"
              stroke="var(--purple)"
              strokeWidth="1"
              opacity=".6"
            />
            <polyline
              points={line(bands.map((v) => v?.lower ?? null))}
              fill="none"
              stroke="var(--purple)"
              strokeWidth="1"
              opacity=".6"
            />
          </>
        )}
        {kind === "candles" ? (
          visible.map((b, i) => {
            const color = b.close >= b.open ? "var(--green)" : "var(--red)";
            return (
              <g key={b.date}>
                <line
                  x1={x(i)}
                  x2={x(i)}
                  y1={y(b.high)}
                  y2={y(b.low)}
                  stroke={color}
                  strokeWidth="1.2"
                />
                <rect
                  x={x(i) - step * 0.3}
                  y={y(Math.max(b.open, b.close))}
                  width={Math.max(1, step * 0.6)}
                  height={Math.max(1, Math.abs(y(b.open) - y(b.close)))}
                  fill={color}
                  rx=".7"
                />
              </g>
            );
          })
        ) : (
          <polyline
            points={line(closes)}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
          />
        )}
        {indicators.includes("sma") && (
          <polyline
            points={line(ma)}
            fill="none"
            stroke="var(--blue)"
            strokeWidth="1.5"
          />
        )}
        {indicators.includes("ema") && (
          <polyline
            points={line(ex)}
            fill="none"
            stroke="var(--orange)"
            strokeWidth="1.5"
          />
        )}
        {session.account.fills
          .filter((f) => f.symbol === asset.symbol)
          .map((f) => {
            const index = visible.findIndex(
              (b, i) =>
                f.date <= b.date &&
                (i === 0
                  ? f.date >= (bars[offset - 1]?.date ?? "")
                  : f.date > visible[i - 1].date),
            );
            return index < 0 ? null : (
              <g key={f.id}>
                <circle
                  cx={x(index)}
                  cy={y(f.price)}
                  r="4"
                  fill={f.side === "buy" ? "var(--blue)" : "var(--orange)"}
                  stroke="var(--panel)"
                  strokeWidth="1.5"
                />
                <title>
                  {f.side} {f.quantity} at {rupee(f.price)}
                </title>
              </g>
            );
          })}
        <line
          x1={left}
          x2={w - right}
          y1={y(last.close)}
          y2={y(last.close)}
          stroke="var(--green)"
          strokeDasharray="3 5"
          opacity=".6"
        />
        <rect
          x={w - right + 3}
          y={y(last.close) - 10}
          width="72"
          height="21"
          rx="4"
          fill="var(--green)"
        />
        <text
          x={w - right + 39}
          y={y(last.close) + 4}
          fill="var(--panel)"
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
        >
          {last.close.toFixed(2)}
        </text>
        {visible
          .filter(
            (_, i) => i % Math.max(1, Math.floor(visible.length / 5)) === 0,
          )
          .map((b) => {
            const i = visible.indexOf(b);
            return (
              <text
                key={b.date}
                x={x(i)}
                y={h - 5}
                textAnchor="middle"
                className="axis-text"
              >
                {new Date(b.date + "T00:00:00").toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}
              </text>
            );
          })}
        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1="10"
            y2={h - bottom}
            stroke="var(--muted)"
            strokeDasharray="3 4"
          />
        )}
      </svg>
      {showRSI && (
        <div className="rsi-chart">
          <div className="rsi-label">
            RSI (14) <b>{strength.at(-1)?.toFixed(1) ?? "—"}</b>
            <span>70 / 30 reference levels</span>
          </div>
          <svg
            viewBox={`0 0 ${w} 72`}
            role="img"
            aria-label="Relative strength index; reference levels are not automatic buy or sell signals"
          >
            {[30, 70].map((level) => (
              <line
                key={level}
                x1={left}
                x2={w - right}
                y1={62 - level * 0.5}
                y2={62 - level * 0.5}
                stroke="var(--border)"
                strokeDasharray="3 4"
              />
            ))}
            <polyline
              points={visible
                .map((_, i) =>
                  strength[offset + i] === null
                    ? null
                    : `${x(i)},${62 - strength[offset + i]! * 0.5}`,
                )
                .filter(Boolean)
                .join(" ")}
              fill="none"
              stroke="var(--purple)"
              strokeWidth="1.6"
            />
            <text x={w - right + 12} y="31" className="axis-text">
              70
            </text>
            <text x={w - right + 12} y="51" className="axis-text">
              30
            </text>
          </svg>
        </div>
      )}
      <div className="chart-caption">
        <span>
          <i className="dot" />
          No future candles revealed
        </span>
        <span>
          Daily OHLC execution · {period === "1D" ? "daily" : "aggregated"}{" "}
          chart
        </span>
      </div>
    </div>
  );
}
