import type { Asset, Bar, Scenario } from "./types";

export function seeded(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const universe = [
  ["NALCO", "National Aluminium", "Metals", "#b9ed5c", 172],
  ["RELIANCE", "Reliance Industries", "Diversified", "#82abff", 2470],
  ["TCS", "Tata Consultancy Services", "Technology", "#c5a0fa", 3590],
  ["HDFCBANK", "HDFC Bank", "Banking", "#f5be79", 1450],
  ["INFY", "Infosys", "Technology", "#70d8c2", 1480],
  ["HINDALCO", "Hindalco Industries", "Metals", "#f28da5", 510],
] as const;

export function generateMarket(
  seed = 615,
  scenario: Scenario = "balanced",
): Asset[] {
  const dates: string[] = [];
  const day = new Date("2024-01-02T00:00:00Z");
  while (dates.length < 420) {
    if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6)
      dates.push(day.toISOString().slice(0, 10));
    day.setUTCDate(day.getUTCDate() + 1);
  }
  const common = seeded(seed);
  const market = dates.map(
    (_, i) => (common() - 0.48) * 0.022 + 0.003 * Math.sin(i / 33),
  );
  return universe.map(([symbol, name, sector, color, initial], a) => {
    const rng = seeded(seed + a * 479 + 11);
    let previous: number = initial;
    const bars = dates.map((date, i) => {
      const trend =
        scenario === "momentum" ? 0.0012 + 0.001 * Math.sin(i / 48) : 0.00035;
      const volatility = scenario === "volatile" ? 2.1 : 1;
      const open = previous * Math.exp((rng() - 0.5) * 0.012 * volatility);
      const close =
        open *
        Math.exp((market[i] + (rng() - 0.5) * 0.027 + trend) * volatility);
      const high =
        Math.max(open, close) * (1 + (0.002 + rng() * 0.012) * volatility);
      const low =
        Math.min(open, close) * (1 - (0.002 + rng() * 0.012) * volatility);
      previous = close;
      return {
        date,
        open: round(open),
        high: round(high),
        low: round(low),
        close: round(close),
        volume: Math.floor(250000 + rng() * 6500000),
      };
    });
    const shares = 60 + a * 22;
    return {
      symbol,
      name,
      sector,
      color,
      bars,
      fundamentals: {
        revenue: initial * shares * 0.7,
        profit: (initial * shares) / (12 + a * 4),
        equity: (initial * shares) / (2.3 + a * 0.6),
        debt: initial * shares * (a % 3) * 0.13,
        shares,
        growth: 6 + rng() * 17,
        dividend: 1.2 + rng() * 2.4,
        sectorPE: 18 + a * 3,
      },
    };
  });
}
function round(n: number) {
  return Math.round(n * 100) / 100;
}
export function sma(values: number[], period: number): (number | null)[] {
  let sum = 0;
  return values.map((v, i) => {
    sum += v;
    if (i >= period) sum -= values[i - period];
    return i >= period - 1 ? sum / period : null;
  });
}
export function ema(values: number[], period: number): number[] {
  const a = 2 / (period + 1);
  let current = values[0] ?? 0;
  return values.map((v) => (current = a * v + (1 - a) * current));
}
export function rsi(values: number[], period = 14): (number | null)[] {
  let gain = 0,
    loss = 0;
  return values.map((v, i) => {
    if (i === 0) return null;
    const d = v - values[i - 1];
    if (i <= period) {
      gain += Math.max(d, 0) / period;
      loss += Math.max(-d, 0) / period;
    } else {
      gain = (gain * (period - 1) + Math.max(d, 0)) / period;
      loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    }
    return i < period
      ? null
      : loss === 0
        ? gain === 0
          ? 50
          : 100
        : 100 - 100 / (1 + gain / loss);
  });
}
export function bollinger(values: number[], period = 20) {
  const average = sma(values, period);
  return values.map((_, i) => {
    const mean = average[i];
    if (mean === null) return null;
    const window = values.slice(i - period + 1, i + 1);
    const sd = Math.sqrt(
      window.reduce((s, v) => s + (v - mean) ** 2, 0) / period,
    );
    return { upper: mean + 2 * sd, lower: mean - 2 * sd };
  });
}
export function aggregate(bars: Bar[], period: "1D" | "1W" | "1M"): Bar[] {
  if (period === "1D") return bars;
  const groups = new Map<string, Bar>();
  for (const bar of bars) {
    const date = new Date(bar.date + "T00:00:00Z");
    if (period === "1W")
      date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    const key =
      period === "1M" ? bar.date.slice(0, 7) : date.toISOString().slice(0, 10);
    const prior = groups.get(key);
    groups.set(
      key,
      prior
        ? {
            ...prior,
            high: Math.max(prior.high, bar.high),
            low: Math.min(prior.low, bar.low),
            close: bar.close,
            volume: prior.volume + bar.volume,
            date: bar.date,
          }
        : { ...bar },
    );
  }
  return [...groups.values()];
}

export function parseCSV(text: string, symbol = "CUSTOM"): Asset {
  if (text.length > 3_000_000)
    throw new Error("CSV is too large. Use at most 5,000 daily bars.");
  const lines = text
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n/);
  if (lines.length < 62 || lines.length > 5001)
    throw new Error("Import 61–5,000 daily bars, including indicator warm-up.");
  const cells = (line: string) => {
    const result: string[] = [];
    let field = "",
      quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (quoted && line[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = !quoted;
      } else if (c === "," && !quoted) {
        result.push(field.trim());
        field = "";
      } else field += c;
    }
    if (quoted) throw new Error("Unclosed CSV quote");
    result.push(field.trim());
    return result;
  };
  const headers = cells(lines[0]).map((x) => x.toLowerCase());
  for (const name of ["date", "open", "high", "low", "close"])
    if (!headers.includes(name)) throw new Error(`Missing ${name} column`);
  if (new Set(headers).size !== headers.length)
    throw new Error("Duplicate column names");
  const bars = lines
    .slice(1)
    .map((line, i) => {
      const row = cells(line);
      const get = (name: string) => row[headers.indexOf(name)];
      const date = get("date");
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        new Date(date).toISOString().slice(0, 10) !== date
      )
        throw new Error(`Row ${i + 2}: use valid YYYY-MM-DD dates`);
      const nums = ["open", "high", "low", "close"].map((n) =>
        Number(get(n)?.replaceAll(",", "")),
      );
      if (nums.some((n) => !Number.isFinite(n) || n < 0.0001 || n > 1e9))
        throw new Error(
          `Row ${i + 2}: prices must be from 0.0001 to 1 billion`,
        );
      const [open, high, low, close] = nums;
      if (
        low > high ||
        Math.min(open, close) < low ||
        Math.max(open, close) > high
      )
        throw new Error(`Row ${i + 2}: invalid OHLC range`);
      const volume = headers.includes("volume")
        ? Number(get("volume")?.replaceAll(",", ""))
        : 0;
      if (!Number.isFinite(volume) || volume < 0 || volume > 1e12)
        throw new Error(`Row ${i + 2}: invalid volume`);
      return { date, open, high, low, close, volume };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  if (new Set(bars.map((b) => b.date)).size !== bars.length)
    throw new Error("Duplicate dates are not allowed");
  const clean =
    symbol
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, "")
      .slice(0, 16) || "CUSTOM";
  return {
    symbol: clean,
    name: "Imported historical data",
    sector: "Your dataset",
    color: "#82abff",
    bars,
    fundamentals: null,
  };
}
