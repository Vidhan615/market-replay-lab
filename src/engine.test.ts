import { describe, expect, it } from "vitest";
import {
  advance,
  availableCash,
  availableShares,
  cancelOrder,
  closePosition,
  createSession,
  equity,
  performance,
  rewind,
  skip,
  submitOrder,
} from "./engine";
import type { Asset, Bar, OrderInput, Session } from "./types";
import { importSession } from "./persistence";
import {
  aggregate,
  bollinger,
  ema,
  generateMarket,
  parseCSV,
  rsi,
  sma,
} from "./market";

function fixture(overrides: Partial<Bar>[] = []): Session {
  const bars: Bar[] = Array.from({ length: 80 }, (_, i) => ({
    date: new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10),
    open: 100,
    high: 110,
    low: 90,
    close: 100,
    volume: 1000,
    ...(i >= 60 ? overrides[i - 60] : {}),
  }));
  const asset: Asset = {
    symbol: "TEST",
    name: "Test",
    sector: "Test",
    color: "#82abff",
    bars,
    fundamentals: null,
  };
  const s = createSession({ assets: [asset], capital: 10000 });
  s.settings = { feeBps: 0, slippageBps: 0, riskPercent: 1 };
  return s;
}
const buy: OrderInput = {
  symbol: "TEST",
  side: "buy",
  type: "market",
  quantity: 10,
  tif: "GTC",
};

describe("cash ledger and order execution", () => {
  it("queues a market order without filling on the observed candle", () => {
    const s = submitOrder(fixture(), buy);
    expect(s.account.cash).toBe(10000);
    expect(s.account.positions).toEqual({});
    expect(s.account.fills).toHaveLength(0);
    expect(availableCash(s.account, s.assets, s.settings)).toBe(9000);
  });
  it("fills at the next open with adverse slippage and fees, then reconciles net realised P&L", () => {
    let s = fixture([
      { open: 110, high: 120, low: 100, close: 115 },
      { open: 120, high: 125, low: 110, close: 120 },
    ]);
    s.settings = { feeBps: 10, slippageBps: 10, riskPercent: 1 };
    s = advance(submitOrder(s, buy));
    expect(s.account.fills[0].price).toBe(110.11);
    expect(s.account.cash).toBe(8897.8);
    expect(s.account.positions.TEST.averageCost).toBeCloseTo(110.22);
    s = advance(submitOrder(s, { ...buy, side: "sell" }));
    expect(s.account.fills[1].price).toBe(119.88);
    expect(s.account.realisedPnl).toBe(95.4);
    expect(s.account.totalFees).toBe(2.3);
    expect(s.account.cash).toBe(10095.4);
    expect(s.account.positions).toEqual({});
    expect(equity(s.account, s.assets)).toBe(
      s.initialCapital + s.account.realisedPnl,
    );
  });
  it("includes entry fees in weighted cost and partial-exit P&L", () => {
    let s = fixture();
    s.settings.feeBps = 10;
    s = advance(submitOrder(s, buy));
    s = advance(submitOrder(s, { ...buy, quantity: 10 }));
    expect(s.account.positions.TEST.averageCost).toBeCloseTo(100.1);
    s = advance(submitOrder(s, { ...buy, side: "sell", quantity: 5 }));
    expect(s.account.positions.TEST.quantity).toBe(15);
    expect(s.account.realisedPnl).toBe(-1);
    expect(performance(s).unrealised).toBeCloseTo(-1.5);
  });
  it("rejects insufficient actual gap-open cash without a negative balance", () => {
    let s = fixture([{ open: 200, high: 210, low: 190, close: 200 }]);
    s = advance(submitOrder(s, { ...buy, quantity: 100 }));
    expect(s.account.orders[0].status).toBe("rejected");
    expect(s.account.cash).toBe(10000);
    expect(s.account.fills).toHaveLength(0);
  });
  it("reserves cash across orders and releases it on cancellation", () => {
    let s = submitOrder(fixture(), { ...buy, quantity: 70 });
    expect(() => submitOrder(s, { ...buy, quantity: 31 })).toThrow(
      /unreserved cash/,
    );
    s = cancelOrder(s, s.account.orders[0].id);
    expect(availableCash(s.account, s.assets, s.settings)).toBe(10000);
  });
  it("does not use the unrevealed close when calculating other order reservations", () => {
    let a = submitOrder(fixture([{ close: 100 }]), buy);
    let b = submitOrder(fixture([{ close: 900, high: 1000 }]), buy);
    a = submitOrder(a, { ...buy, quantity: 20 });
    b = submitOrder(b, { ...buy, quantity: 20 });
    const aa = advance(a),
      bb = advance(b);
    expect(aa.account.cash).toBe(bb.account.cash);
    expect(aa.account.fills.map((f) => f.price)).toEqual(
      bb.account.fills.map((f) => f.price),
    );
  });
  it("prevents naked shorts, fractional shares and duplicate share reservations", () => {
    const s = fixture();
    expect(() => submitOrder(s, { ...buy, side: "sell" })).toThrow(/shares/);
    expect(() => submitOrder(s, { ...buy, quantity: 1.5 })).toThrow(/whole/);
    const held = advance(submitOrder(s, buy));
    const reserved = submitOrder(held, {
      ...buy,
      side: "sell",
      quantity: 7,
      type: "limit",
      limit: 150,
    });
    expect(() =>
      submitOrder(reserved, { ...buy, side: "sell", quantity: 4 }),
    ).toThrow(/shares/);
  });
  it("rejects invalid prices and brackets", () => {
    const s = fixture();
    expect(() => submitOrder(s, { ...buy, type: "limit" })).toThrow(
      /limit price/,
    );
    expect(() => submitOrder(s, { ...buy, type: "stop", stop: NaN })).toThrow(
      /positive/,
    );
    expect(() => submitOrder(s, { ...buy, stopLoss: 105 })).toThrow(/below/);
    expect(() => submitOrder(s, { ...buy, takeProfit: 95 })).toThrow(/above/);
    expect(() =>
      submitOrder(s, { ...buy, side: "sell", stopLoss: 90 }),
    ).toThrow(/Brackets/);
  });
  it("fills a buy limit at an improved gap open, never above its limit", () => {
    const s = advance(
      submitOrder(fixture([{ open: 95, high: 105, low: 90, close: 100 }]), {
        ...buy,
        type: "limit",
        limit: 98,
      }),
    );
    expect(s.account.fills[0].price).toBe(95);
  });
  it("enforces limit price after adverse slippage", () => {
    let s = fixture();
    s.settings.slippageBps = 100;
    s = advance(submitOrder(s, { ...buy, type: "limit", limit: 100 }));
    expect(s.account.fills[0].price).toBe(100);
  });
  it("keeps an untouched GTC limit pending but expires a DAY limit", () => {
    const s = fixture();
    expect(
      advance(submitOrder(s, { ...buy, type: "limit", limit: 80 })).account
        .orders[0].status,
    ).toBe("pending");
    expect(
      advance(submitOrder(s, { ...buy, type: "limit", limit: 80, tif: "DAY" }))
        .account.orders[0].status,
    ).toBe("expired");
  });
  it("fills buy stops through gaps at the opening price", () => {
    const s = advance(
      submitOrder(fixture([{ open: 120, high: 130, low: 115, close: 125 }]), {
        ...buy,
        type: "stop",
        stop: 110,
      }),
    );
    expect(s.account.fills[0].price).toBe(120);
  });
  it("defers stop-limit execution until after the trigger bar", () => {
    let s = submitOrder(fixture(), {
      ...buy,
      type: "stop-limit",
      stop: 105,
      limit: 106,
    });
    s = advance(s);
    expect(s.account.orders[0].status).toBe("triggered");
    expect(s.account.fills).toHaveLength(0);
    s = advance(s);
    expect(s.account.fills[0].price).toBe(100);
  });
  it("does not guarantee a stop-limit fill if price stays beyond the limit", () => {
    let s = submitOrder(
      fixture([
        { open: 115, high: 120, low: 110, close: 115 },
        { open: 116, high: 120, low: 112, close: 115 },
      ]),
      { ...buy, type: "stop-limit", stop: 105, limit: 106 },
    );
    s = skip(s, 2);
    expect(s.account.orders[0].status).toBe("triggered");
    expect(s.account.fills).toHaveLength(0);
  });
  it("activates OCO brackets after entry and conservatively chooses the stop on a double-touch bar", () => {
    let s = advance(
      submitOrder(fixture(), { ...buy, stopLoss: 95, takeProfit: 105 }),
    );
    expect(s.account.fills).toHaveLength(1);
    expect(s.account.orders).toHaveLength(3);
    expect(availableShares(s.account, "TEST")).toBe(0);
    s = advance(s);
    expect(s.account.fills[1].price).toBe(95);
    expect(s.account.orders.find((o) => o.type === "limit")?.status).toBe(
      "cancelled",
    );
    expect(s.account.realisedPnl).toBe(-50);
  });
  it("cancels both OCO exits together and can queue a full position close", () => {
    let s = advance(
      submitOrder(fixture(), { ...buy, stopLoss: 95, takeProfit: 105 }),
    );
    s = closePosition(s, "TEST");
    expect(
      s.account.orders.filter((o) => o.status === "cancelled"),
    ).toHaveLength(2);
    s = advance(s);
    expect(s.account.positions).toEqual({});
    expect(s.account.realisedPnl).toBe(0);
  });
  it("sell stop gaps can exceed planned stop risk", () => {
    let s = advance(
      submitOrder(fixture([{}, { open: 80, high: 85, low: 75, close: 80 }]), {
        ...buy,
        stopLoss: 95,
      }),
    );
    s = advance(s);
    expect(s.account.fills[1].price).toBe(80);
    expect(s.account.realisedPnl).toBe(-200);
  });
});

describe("causal replay and saved state", () => {
  it("rewinds cash, positions, orders and fills; retains learning and journal context", () => {
    let s = submitOrder(fixture(), buy);
    const original = structuredClone(s.account);
    s = skip(s, 4);
    s.completedLessons = ["candles"];
    s = rewind(s, 59);
    expect(s.account).toEqual(original);
    expect(s.history).toHaveLength(1);
    expect(s.completedLessons).toEqual(["candles"]);
  });
  it("replays a restored branch deterministically", () => {
    const s = skip(
        submitOrder(fixture(), { ...buy, stopLoss: 95, takeProfit: 105 }),
        5,
      ),
      back = rewind(s, 60),
      again = skip(back, 4);
    expect(again.account).toEqual(s.account);
  });
  it("future changes cannot alter earlier account outcomes", () => {
    const a = fixture(),
      b = fixture();
    b.assets[0].bars[70] = { ...b.assets[0].bars[70], high: 900, close: 850 };
    expect(skip(submitOrder(a, buy), 5).account).toEqual(
      skip(submitOrder(b, buy), 5).account,
    );
  });
  it("reconciles equity and maximum drawdown from the observed closes", () => {
    let s = advance(submitOrder(fixture([{ close: 110 }, { close: 90 }]), buy));
    s = advance(s);
    expect(performance(s).equity).toBe(9900);
    expect(performance(s).drawdown).toBeCloseTo(200 / 10100);
  });
  it("cannot advance or place orders past the final bar", () => {
    const s = skip(fixture(), 100);
    expect(advance(s)).toBe(s);
    expect(() => submitOrder(s, buy)).toThrow(/finished/);
  });
  it("round-trips full replay state through a validated backup", () => {
    const s = skip(submitOrder(fixture(), buy), 5);
    expect(importSession(JSON.stringify(s))).toEqual(s);
    expect(importSession(JSON.stringify(createSession()))).toEqual(
      expect.objectContaining({ version: 1 }),
    );
  });
  it("rejects invalid backup structure, dangerous keys and ledger mismatch", () => {
    expect(() => importSession("{}")).toThrow(/Invalid/);
    const s = fixture();
    s.account.cash += 1;
    expect(() => importSession(JSON.stringify(s))).toThrow(/reconcile/);
    expect(() =>
      importSession(JSON.stringify({ ...fixture(), constructor: {} })),
    ).toThrow(/Unsafe/);
  });
  it("rejects snapshot corruption and duplicate asset dates", () => {
    const s = skip(fixture(), 2);
    s.history[0].cursor = 60;
    expect(() => importSession(JSON.stringify(s))).toThrow(/Invalid/);
    const b = fixture();
    b.assets[0].bars[1].date = b.assets[0].bars[0].date;
    expect(() => importSession(JSON.stringify(b))).toThrow(/Invalid/);
  });
});

describe("market data and indicators", () => {
  it("generates reproducible valid OHLC universes with aligned dates", () => {
    expect(generateMarket(12)).toEqual(generateMarket(12));
    expect(generateMarket(12)).not.toEqual(generateMarket(13));
    const a = generateMarket(615, "volatile");
    for (const asset of a) {
      expect(asset.bars).toHaveLength(420);
      expect(asset.bars.map((b) => b.date)).toEqual(
        a[0].bars.map((b) => b.date),
      );
      for (const b of asset.bars) {
        expect(b.low).toBeLessThanOrEqual(Math.min(b.open, b.close));
        expect(b.high).toBeGreaterThanOrEqual(Math.max(b.open, b.close));
      }
    }
  });
  it("computes SMA, EMA, flat RSI and Bollinger with expected warm-up", () => {
    expect(sma([1, 2, 3, 4], 3)).toEqual([null, null, 2, 3]);
    expect(ema([10, 12, 14], 3)).toEqual([10, 11, 12.5]);
    expect(rsi(Array(20).fill(100)).at(-1)).toBe(50);
    expect(rsi(Array.from({ length: 20 }, (_, i) => i)).at(-1)).toBe(100);
    expect(bollinger([10, 10, 10], 3).at(-1)).toEqual({ upper: 10, lower: 10 });
  });
  it("indicator outputs are unchanged for an observed prefix", () => {
    const series = generateMarket()[0].bars.map((b) => b.close);
    for (const fn of [sma, ema, rsi, bollinger])
      expect(fn(series.slice(0, 70), 14)).toEqual(fn(series, 14).slice(0, 70));
  });
  it("aggregates only revealed bars, including incomplete current periods", () => {
    const bars = generateMarket()[0].bars.slice(0, 3),
      weekly = aggregate(bars, "1W");
    expect(weekly).toHaveLength(1);
    expect(weekly[0].open).toBe(bars[0].open);
    expect(weekly[0].close).toBe(bars[2].close);
    expect(weekly[0].date).toBe(bars[2].date);
    expect(weekly[0].volume).toBe(bars.reduce((s, b) => s + b.volume, 0));
  });
  it("imports sorted quoted CSV without inventing fundamentals", () => {
    const bars = fixture().assets[0].bars;
    const csv =
      "DATE,OPEN,HIGH,LOW,CLOSE,VOLUME\n" +
      [...bars]
        .reverse()
        .map((b) => [b.date, '"100"', 110, 90, 100, '"1,000"'].join(","))
        .join("\n");
    const a = parseCSV(csv, "abc");
    expect(a.symbol).toBe("ABC");
    expect(a.bars).toEqual(bars);
    expect(a.fundamentals).toBeNull();
  });
  it("rejects short data, duplicate dates, invalid OHLC and missing headers", () => {
    expect(() => parseCSV("date,open\n2024-01-01,100")).toThrow(/61/);
    const rows = fixture().assets[0].bars.map((b) =>
      [b.date, b.open, b.high, b.low, b.close].join(","),
    );
    expect(() =>
      parseCSV("date,open,high,low,close\n" + [...rows, rows[0]].join("\n")),
    ).toThrow(/Duplicate dates/);
    expect(() =>
      parseCSV(
        "date,open,high,low,close\n" +
          rows.join("\n").replace(",100,110,90,100", ",100,80,90,100"),
      ),
    ).toThrow(/OHLC/);
    expect(() =>
      parseCSV("date,open,high,low,price\n" + rows.join("\n")),
    ).toThrow(/Missing close/);
  });
});
