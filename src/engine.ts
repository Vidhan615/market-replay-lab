import type {
  Account,
  Asset,
  Order,
  OrderInput,
  Session,
  Settings,
  Scenario,
} from "./types";
import { generateMarket } from "./market";

const pending = (o: Order) =>
  o.status === "pending" || o.status === "triggered";
const money = (value: number) => Math.round(value * 100) / 100;
export const defaultSettings: Settings = {
  feeBps: 10,
  slippageBps: 5,
  riskPercent: 1,
};

export function createSession(
  options: {
    seed?: number;
    scenario?: Scenario;
    capital?: number;
    assets?: Asset[];
    name?: string;
  } = {},
): Session {
  const seed = options.seed ?? 615,
    scenario = options.scenario ?? "balanced",
    capital = options.capital ?? 1_000_000;
  if (!Number.isFinite(capital) || capital < 1000 || capital > 1e9)
    throw new Error("Starting capital must be between ₹1,000 and ₹1 billion");
  const assets = options.assets ?? generateMarket(seed, scenario);
  const cursor = Math.min(59, assets[0].bars.length - 2);
  const account: Account = {
    cursor,
    cash: capital,
    positions: {},
    orders: [],
    fills: [],
    realisedPnl: 0,
    totalFees: 0,
    equityHistory: [{ cursor, equity: capital }],
    sequence: 0,
  };
  return {
    version: 1,
    id: crypto.randomUUID(),
    name: options.name ?? "My practice workspace",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    seed,
    scenario,
    initialCapital: capital,
    startCursor: cursor,
    assets,
    account,
    history: [structuredClone(account)],
    selected: assets[0].symbol,
    settings: { ...defaultSettings },
    journal: [],
    completedLessons: [],
    quizAnswers: {},
    watchlist: assets.map((a) => a.symbol),
  };
}
export function equity(account: Account, assets: Asset[]) {
  return (
    account.cash +
    assets.reduce(
      (sum, asset) =>
        sum +
        (account.positions[asset.symbol]?.quantity ?? 0) *
          asset.bars[account.cursor].close,
      0,
    )
  );
}
export function reservation(
  order: Order,
  assets: Asset[],
  _cursor: number,
  settings: Settings,
) {
  if (order.side !== "buy" || !pending(order)) return 0;
  const price =
    order.limit ??
    order.stop ??
    assets.find((a) => a.symbol === order.symbol)!.bars[order.created].close;
  return (
    order.quantity *
    price *
    (1 + (settings.feeBps + settings.slippageBps) / 10000)
  );
}
export function availableCash(
  account: Account,
  assets: Asset[],
  settings: Settings,
  exclude?: string,
) {
  return Math.max(
    0,
    account.cash -
      account.orders
        .filter((o) => o.id !== exclude)
        .reduce(
          (s, o) => s + reservation(o, assets, account.cursor, settings),
          0,
        ),
  );
}
export function availableShares(
  account: Account,
  symbol: string,
  exclude?: string,
) {
  const groups = new Map<string, number>();
  for (const order of account.orders.filter(
    (o) =>
      o.id !== exclude &&
      o.symbol === symbol &&
      o.side === "sell" &&
      pending(o),
  )) {
    const key = order.group ?? order.id;
    groups.set(key, Math.max(groups.get(key) ?? 0, order.quantity));
  }
  return Math.max(
    0,
    (account.positions[symbol]?.quantity ?? 0) -
      [...groups.values()].reduce((a, b) => a + b, 0),
  );
}
function validate(input: OrderInput, session: Session) {
  if (
    !["buy", "sell"].includes(input.side) ||
    !["market", "limit", "stop", "stop-limit"].includes(input.type) ||
    !["GTC", "DAY"].includes(input.tif)
  )
    throw new Error("Invalid order side, type or validity");
  if (!session.assets.some((a) => a.symbol === input.symbol))
    throw new Error("Unknown stock");
  if (session.account.cursor >= session.assets[0].bars.length - 1)
    throw new Error("Replay finished. Rewind or start a new session.");
  if (
    !Number.isSafeInteger(input.quantity) ||
    input.quantity < 1 ||
    input.quantity > 1_000_000
  )
    throw new Error("Quantity must be a whole number from 1 to 1,000,000");
  if (session.account.orders.length >= 5000)
    throw new Error(
      "This session has reached 5,000 orders. Start a new workspace.",
    );
  for (const value of [
    input.limit,
    input.stop,
    input.stopLoss,
    input.takeProfit,
  ])
    if (
      value !== undefined &&
      (!Number.isFinite(value) || value <= 0 || value > 1e9)
    )
      throw new Error("Order prices must be positive and finite");
  if (
    (input.type === "limit" || input.type === "stop-limit") &&
    input.limit === undefined
  )
    throw new Error("Enter a limit price");
  if (
    (input.type === "stop" || input.type === "stop-limit") &&
    input.stop === undefined
  )
    throw new Error("Enter a trigger price");
  if (
    input.side === "sell" &&
    (input.stopLoss !== undefined || input.takeProfit !== undefined)
  )
    throw new Error("Brackets are available on buy orders only");
  const reference =
    input.limit ??
    input.stop ??
    session.assets.find((a) => a.symbol === input.symbol)!.bars[
      session.account.cursor
    ].close;
  if (input.stopLoss !== undefined && input.stopLoss >= reference)
    throw new Error("A long stop-loss must be below the reference entry");
  if (input.takeProfit !== undefined && input.takeProfit <= reference)
    throw new Error("A long profit target must be above the reference entry");
}
export function submitOrder(session: Session, input: OrderInput): Session {
  validate(input, session);
  const next = structuredClone(session),
    account = next.account;
  const order: Order = {
    ...input,
    id: `O${++account.sequence}`,
    created: account.cursor,
    status: "pending",
  };
  if (
    input.side === "buy" &&
    reservation(order, next.assets, account.cursor, next.settings) >
      availableCash(account, next.assets, next.settings) + 0.001
  )
    throw new Error(
      "Not enough unreserved cash. Reduce quantity or cancel another buy order.",
    );
  if (
    input.side === "sell" &&
    input.quantity > availableShares(account, input.symbol)
  )
    throw new Error(
      "Not enough unreserved shares. Cancel existing exit orders first; naked short selling is not enabled.",
    );
  account.orders.push(order);
  return commit(next);
}
function commit(session: Session) {
  session.updatedAt = new Date().toISOString();
  const index = session.account.cursor - session.startCursor;
  session.history = session.history.slice(0, index + 1);
  session.history[index] = structuredClone(session.account);
  return session;
}
export function cancelOrder(session: Session, id: string): Session {
  const next = structuredClone(session),
    order = next.account.orders.find((o) => o.id === id);
  if (!order || !pending(order)) return session;
  for (const current of next.account.orders)
    if (
      pending(current) &&
      (current.id === id || (order.group && current.group === order.group))
    ) {
      current.status = "cancelled";
      current.message = order.group
        ? "OCO group cancelled"
        : "Cancelled by you";
    }
  return commit(next);
}
export function closePosition(session: Session, symbol: string): Session {
  let next = session;
  for (const order of next.account.orders.filter(
    (o) => o.symbol === symbol && o.side === "sell" && pending(o),
  ))
    next = cancelOrder(next, order.id);
  const quantity = next.account.positions[symbol]?.quantity ?? 0;
  if (!quantity) throw new Error("No position to close");
  return submitOrder(next, {
    symbol,
    quantity,
    side: "sell",
    type: "market",
    tif: "GTC",
  });
}
export function advance(session: Session): Session {
  const next = structuredClone(session),
    account = next.account;
  if (account.cursor >= next.assets[0].bars.length - 1) return session;
  account.cursor++;
  // Stops take precedence over profit targets when both touch within one OHLC bar.
  // New bracket children are not evaluated on their parent's fill bar.
  const queue = account.orders
    .filter(pending)
    .sort((a, b) => Number(b.type === "stop") - Number(a.type === "stop"));
  for (const order of queue) {
    if (!pending(order) || order.created >= account.cursor) continue;
    const bar = next.assets.find((a) => a.symbol === order.symbol)!.bars[
      account.cursor
    ];
    let reference: number | undefined;
    const buy = order.side === "buy";
    if (order.type === "market") reference = bar.open;
    if (
      order.type === "limit" ||
      (order.type === "stop-limit" &&
        order.status === "triggered" &&
        order.triggeredAt! < account.cursor)
    ) {
      if (buy && bar.low <= order.limit!)
        reference = Math.min(bar.open, order.limit!);
      if (!buy && bar.high >= order.limit!)
        reference = Math.max(bar.open, order.limit!);
    }
    if (
      order.type === "stop" ||
      (order.type === "stop-limit" && order.status === "pending")
    ) {
      const touched = buy ? bar.high >= order.stop! : bar.low <= order.stop!;
      if (touched) {
        if (order.type === "stop-limit") {
          order.status = "triggered";
          order.triggeredAt = account.cursor;
          order.message = "Triggered; limit is eligible from the next bar";
        } else
          reference = buy
            ? Math.max(bar.open, order.stop!)
            : Math.min(bar.open, order.stop!);
      }
    }
    if (reference !== undefined) {
      let price =
        reference * (1 + ((buy ? 1 : -1) * next.settings.slippageBps) / 10000);
      if (order.type === "limit" || order.type === "stop-limit")
        price = buy
          ? Math.min(price, order.limit!)
          : Math.max(price, order.limit!);
      price = Math.round(price * 10000) / 10000;
      const value = money(price * order.quantity),
        fee = money((value * next.settings.feeBps) / 10000);
      const position = account.positions[order.symbol] ?? {
        quantity: 0,
        averageCost: 0,
      };
      const held = position.quantity;
      if (
        buy &&
        value + fee >
          availableCash(account, next.assets, next.settings, order.id) + 0.001
      ) {
        order.status = "rejected";
        order.message =
          "Cash was insufficient at the actual next-bar fill price";
        continue;
      }
      if (!buy && held < order.quantity) {
        order.status = "rejected";
        order.message = "Position no longer available";
        continue;
      }
      let realised: number | null = null;
      if (buy) {
        account.cash = money(account.cash - value - fee);
        account.positions[order.symbol] = {
          quantity: held + order.quantity,
          averageCost:
            (held * position.averageCost + value + fee) /
            (held + order.quantity),
        };
      } else {
        account.cash = money(account.cash + value - fee);
        realised = money(value - fee - order.quantity * position.averageCost);
        account.realisedPnl = money(account.realisedPnl + realised);
        if (held === order.quantity) delete account.positions[order.symbol];
        else
          account.positions[order.symbol] = {
            ...position,
            quantity: held - order.quantity,
          };
      }
      account.totalFees = money(account.totalFees + fee);
      account.fills.push({
        id: `F${++account.sequence}`,
        orderId: order.id,
        symbol: order.symbol,
        side: order.side,
        quantity: order.quantity,
        price,
        fee,
        date: bar.date,
        cursor: account.cursor,
        realised,
      });
      Object.assign(order, {
        status: "filled",
        filledAt: account.cursor,
        fillPrice: price,
        message: "Filled at simulated price",
      });
      if (order.group)
        for (const sibling of account.orders)
          if (
            sibling.group === order.group &&
            sibling.id !== order.id &&
            pending(sibling)
          ) {
            sibling.status = "cancelled";
            sibling.message = "Other OCO exit filled";
          }
      if (
        buy &&
        (order.stopLoss !== undefined || order.takeProfit !== undefined)
      ) {
        const group = `B${account.sequence}`;
        if (order.stopLoss !== undefined)
          account.orders.push({
            id: `O${++account.sequence}`,
            symbol: order.symbol,
            side: "sell",
            type: "stop",
            quantity: order.quantity,
            stop: order.stopLoss,
            tif: "GTC",
            status: "pending",
            created: account.cursor,
            group,
            parent: order.id,
          });
        if (order.takeProfit !== undefined)
          account.orders.push({
            id: `O${++account.sequence}`,
            symbol: order.symbol,
            side: "sell",
            type: "limit",
            quantity: order.quantity,
            limit: order.takeProfit,
            tif: "GTC",
            status: "pending",
            created: account.cursor,
            group,
            parent: order.id,
          });
      }
    }
    if (
      pending(order) &&
      order.tif === "DAY" &&
      account.cursor > order.created
    ) {
      order.status = "expired";
      order.message = "Day order expired after its eligible session";
    }
  }
  account.equityHistory.push({
    cursor: account.cursor,
    equity: equity(account, next.assets),
  });
  next.history = next.history.slice(0, account.cursor - next.startCursor);
  next.history.push(structuredClone(account));
  next.updatedAt = new Date().toISOString();
  return next;
}
export function rewind(session: Session, cursor: number): Session {
  const safe = Math.max(
    session.startCursor,
    Math.min(Math.floor(cursor), session.account.cursor),
  );
  const snapshot = session.history[safe - session.startCursor];
  if (!snapshot) return session;
  return {
    ...session,
    account: structuredClone(snapshot),
    history: session.history.slice(0, safe - session.startCursor + 1),
    updatedAt: new Date().toISOString(),
  };
}
export function skip(session: Session, count: number): Session {
  let next = session;
  for (let i = 0; i < count; i++) next = advance(next);
  return next;
}
export function performance(session: Session) {
  const curve = session.account.equityHistory.map((p) => p.equity);
  let peak = session.initialCapital,
    drawdown = 0;
  for (const value of curve) {
    peak = Math.max(peak, value);
    drawdown = Math.max(drawdown, (peak - value) / peak);
  }
  const exits = session.account.fills.filter((f) => f.realised !== null);
  const wins = exits.filter((f) => f.realised! > 0),
    losses = exits.filter((f) => f.realised! < 0);
  const grossProfit = wins.reduce((s, f) => s + f.realised!, 0),
    grossLoss = -losses.reduce((s, f) => s + f.realised!, 0);
  return {
    equity: equity(session.account, session.assets),
    drawdown,
    winRate: exits.length ? wins.length / exits.length : 0,
    closed: exits.length,
    profitFactor: grossLoss ? grossProfit / grossLoss : null,
    expectancy: exits.length ? session.account.realisedPnl / exits.length : 0,
    unrealised:
      equity(session.account, session.assets) -
      session.account.cash -
      Object.values(session.account.positions).reduce(
        (s, p) => s + p.quantity * p.averageCost,
        0,
      ),
  };
}
