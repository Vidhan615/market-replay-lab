import type { Account, Asset, Session } from "./types";

const DB = "market-replay-lab",
  STORE = "workspaces";
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(STORE, { keyPath: "key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          "Browser storage is unavailable. Export a backup to keep your session.",
        ),
      );
  });
}
type Stored = { key: string; session: Session; savedAt: string };
export async function saveSession(key: string, session: Session) {
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({
        key,
        session: structuredClone(session),
        savedAt: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(
          new Error("Could not save. Storage may be full; export a backup."),
        );
      tx.onabort = () =>
        reject(new Error("Save was interrupted. Export a backup."));
    });
  } finally {
    db.close();
  }
}
export async function listSessions(): Promise<Stored[]> {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result as Stored[]);
      req.onerror = () => reject(new Error("Could not read saved sessions"));
    });
  } finally {
    db.close();
  }
}
export async function deleteSession(key: string) {
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error("Could not remove saved workspace"));
    });
  } finally {
    db.close();
  }
}

export function exportFile(
  content: string,
  name: string,
  type = "application/json",
) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Backups are untrusted input. Validate complete financial state before mounting.
export function importSession(text: string): Session {
  if (text.length > 25_000_000) throw new Error("Backup exceeds 25 MB");
  const raw: unknown = JSON.parse(text);
  const object = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object" && !Array.isArray(v);
  const number = (v: unknown, min = 0, max = 1e12) =>
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
  const str = (v: unknown, max = 200) =>
    typeof v === "string" && v.length <= max;
  const integer = (v: unknown, min = 0, max = 1e6) =>
    number(v, min, max) && Number.isSafeInteger(v);
  const bad = () => {
    throw new Error("Invalid or incompatible workspace backup");
  };
  if (
    !object(raw) ||
    raw.version !== 1 ||
    !str(raw.name, 120) ||
    !str(raw.id) ||
    !integer(raw.seed, 0, 4294967295) ||
    !["balanced", "momentum", "volatile"].includes(String(raw.scenario)) ||
    !number(raw.initialCapital, 1000, 1e9) ||
    !integer(raw.startCursor, 0, 4999)
  )
    return bad();
  if (
    !Array.isArray(raw.assets) ||
    raw.assets.length < 1 ||
    raw.assets.length > 20
  )
    return bad();
  const symbols = new Set<string>();
  let dates: string[] = [];
  for (const a of raw.assets) {
    if (
      !object(a) ||
      !str(a.symbol, 16) ||
      !/^[-A-Z0-9_]+$/.test(String(a.symbol)) ||
      symbols.has(String(a.symbol)) ||
      !str(a.name) ||
      !str(a.sector) ||
      !str(a.color, 20) ||
      !/^#[0-9a-fA-F]{6}$/.test(String(a.color)) ||
      !Array.isArray(a.bars) ||
      a.bars.length < 61 ||
      a.bars.length > 5000
    )
      return bad();
    symbols.add(String(a.symbol));
    let previous = "";
    for (const b of a.bars) {
      if (
        !object(b) ||
        !str(b.date, 10) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(String(b.date)) ||
        String(b.date) <= previous ||
        new Date(String(b.date)).toISOString().slice(0, 10) !== b.date ||
        !number(b.open, 0.0001, 1e9) ||
        !number(b.high, 0.0001, 1e9) ||
        !number(b.low, 0.0001, 1e9) ||
        !number(b.close, 0.0001, 1e9) ||
        !number(b.volume)
      )
        return bad();
      if (
        (b.low as number) > Math.min(b.open as number, b.close as number) ||
        (b.high as number) < Math.max(b.open as number, b.close as number)
      )
        return bad();
      previous = String(b.date);
    }
    if (!dates.length)
      dates = a.bars.map((b) => String((b as Record<string, unknown>).date));
    else if (
      a.bars.length !== dates.length ||
      a.bars.some((b, i) => (b as Record<string, unknown>).date !== dates[i])
    )
      return bad();
    if (a.fundamentals !== null) {
      if (!object(a.fundamentals)) return bad();
      for (const k of [
        "revenue",
        "profit",
        "equity",
        "debt",
        "shares",
        "growth",
        "dividend",
        "sectorPE",
      ])
        if (!number(a.fundamentals[k], 0, 1e12)) return bad();
      if (
        !number(a.fundamentals.shares, 0.0001) ||
        !number(a.fundamentals.equity, 0.0001)
      )
        return bad();
    }
  }
  if (
    !symbols.has(String(raw.selected)) ||
    !object(raw.settings) ||
    !number(raw.settings.feeBps, 0, 100) ||
    !number(raw.settings.slippageBps, 0, 100) ||
    !number(raw.settings.riskPercent, 0.1, 10)
  )
    return bad();
  const checkAccount = (account: unknown): account is Account => {
    if (
      !object(account) ||
      !integer(account.cursor, raw.startCursor as number, dates.length - 1) ||
      !number(account.cash, 0, 1e12) ||
      !number(account.realisedPnl, -1e12, 1e12) ||
      !number(account.totalFees) ||
      !integer(account.sequence) ||
      !object(account.positions) ||
      !Array.isArray(account.orders) ||
      account.orders.length > 10000 ||
      !Array.isArray(account.fills) ||
      account.fills.length > 10000 ||
      !Array.isArray(account.equityHistory) ||
      account.equityHistory.length > 5000
    )
      return false;
    for (const [symbol, p] of Object.entries(account.positions))
      if (
        !symbols.has(symbol) ||
        !object(p) ||
        !integer(p.quantity, 1, 1e9) ||
        !number(p.averageCost, 0.0001, 1e12)
      )
        return false;
    const ids = new Set<string>();
    for (const o of account.orders) {
      if (
        !object(o) ||
        !str(o.id) ||
        ids.has(String(o.id)) ||
        !symbols.has(String(o.symbol)) ||
        !["buy", "sell"].includes(String(o.side)) ||
        !["market", "limit", "stop", "stop-limit"].includes(String(o.type)) ||
        ![
          "pending",
          "triggered",
          "filled",
          "cancelled",
          "rejected",
          "expired",
        ].includes(String(o.status)) ||
        !["GTC", "DAY"].includes(String(o.tif)) ||
        !integer(o.quantity, 1, 1e6) ||
        !integer(o.created, raw.startCursor as number, account.cursor as number)
      )
        return false;
      ids.add(String(o.id));
      for (const k of ["limit", "stop", "stopLoss", "takeProfit", "fillPrice"])
        if (o[k] !== undefined && !number(o[k], 0.0001, 1e9)) return false;
      for (const k of ["triggeredAt", "filledAt"])
        if (
          o[k] !== undefined &&
          !integer(o[k], o.created as number, account.cursor as number)
        )
          return false;
      for (const k of ["message", "group", "parent"])
        if (o[k] !== undefined && !str(o[k], 300)) return false;
      if (
        ["limit", "stop-limit"].includes(String(o.type)) &&
        o.limit === undefined
      )
        return false;
      if (
        ["stop", "stop-limit"].includes(String(o.type)) &&
        o.stop === undefined
      )
        return false;
    }
    for (const f of account.fills) {
      if (
        !object(f) ||
        !str(f.id) ||
        !str(f.orderId) ||
        !symbols.has(String(f.symbol)) ||
        !["buy", "sell"].includes(String(f.side)) ||
        !integer(f.quantity, 1, 1e6) ||
        !number(f.price, 0.0001, 1e9) ||
        !number(f.fee) ||
        !integer(
          f.cursor,
          raw.startCursor as number,
          account.cursor as number,
        ) ||
        f.date !== dates[f.cursor as number] ||
        (f.realised !== null && !number(f.realised, -1e12, 1e12))
      )
        return false;
    }
    let last = -1;
    for (const e of account.equityHistory) {
      if (
        !object(e) ||
        !integer(
          e.cursor,
          raw.startCursor as number,
          account.cursor as number,
        ) ||
        (e.cursor as number) <= last ||
        !number(e.equity)
      )
        return false;
      last = e.cursor as number;
    }
    return (
      account.equityHistory.length ===
      (account.cursor as number) - (raw.startCursor as number) + 1
    );
  };
  if (
    !checkAccount(raw.account) ||
    !Array.isArray(raw.history) ||
    raw.history.length !==
      raw.account.cursor - (raw.startCursor as number) + 1 ||
    raw.history.some(
      (h, i) =>
        !checkAccount(h) || h.cursor !== (raw.startCursor as number) + i,
    )
  )
    return bad();
  if (
    !Array.isArray(raw.journal) ||
    raw.journal.length > 2000 ||
    raw.journal.some(
      (j) =>
        !object(j) ||
        !str(j.id) ||
        !str(j.date, 30) ||
        !symbols.has(String(j.symbol)) ||
        !str(j.thesis, 3000) ||
        !str(j.lesson, 3000) ||
        !str(j.mood, 30) ||
        !str(j.tags, 200),
    )
  )
    return bad();
  if (
    !Array.isArray(raw.completedLessons) ||
    raw.completedLessons.some((x) => !str(x, 100)) ||
    !object(raw.quizAnswers) ||
    Object.values(raw.quizAnswers).some((v) => !integer(v, 0, 3)) ||
    !Array.isArray(raw.watchlist) ||
    raw.watchlist.some((s) => !symbols.has(String(s)))
  )
    return bad();
  if (!str(raw.createdAt, 50) || !str(raw.updatedAt, 50)) return bad();
  // Parse into a fresh ordinary JSON object. Reject prototype-control keys.
  if (/"(?:__proto__|constructor|prototype)"\s*:/.test(text))
    throw new Error("Unsafe backup keys");
  const session = JSON.parse(text) as Session;
  const assets = session.assets as Asset[];
  const marked =
    session.account.cash +
    assets.reduce(
      (sum, a) =>
        sum +
        (session.account.positions[a.symbol]?.quantity ?? 0) *
          a.bars[session.account.cursor].close,
      0,
    );
  if (Math.abs(marked - session.account.equityHistory.at(-1)!.equity) > 0.05)
    throw new Error(
      "Backup equity does not reconcile with its cash and holdings",
    );
  if (
    JSON.stringify(session.history.at(-1)) !== JSON.stringify(session.account)
  )
    throw new Error(
      "Backup replay snapshot does not match the current account",
    );
  return session;
}
