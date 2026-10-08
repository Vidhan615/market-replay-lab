import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bookmark,
  CheckCircle2,
  Download,
  FolderOpen,
  Plus,
  Trash2,
} from "lucide-react";
import type { Session } from "./types";
import type { Mutate } from "./Trading";
import { performance } from "./engine";
import { compact, dateLabel, percent, rupee } from "./format";
import { EquityChart } from "./Chart";
import Modal from "./Modal";

export function Analytics({ session }: { session: Session }) {
  const p = performance(session),
    change = p.equity - session.initialCapital,
    positions = Object.entries(session.account.positions),
    statuses = [
      "pending",
      "triggered",
      "filled",
      "cancelled",
      "rejected",
      "expired",
    ];
  return (
    <div className="analytics-page">
      <div className="page-heading">
        <span className="eyebrow">YOUR PROCESS, MEASURED</span>
        <h1>Learn from the whole picture.</h1>
        <p>
          Returns matter. So do drawdowns, costs and the decisions behind them.
        </p>
      </div>
      <div className="analytics-stats">
        {[
          [
            "Net return",
            percent(change / session.initialCapital),
            "After charged fees",
          ],
          [
            "Maximum drawdown",
            `${(p.drawdown * 100).toFixed(2)}%`,
            "From observed equity peaks",
          ],
          [
            "Win rate",
            p.closed ? `${(p.winRate * 100).toFixed(1)}%` : "—",
            `${p.closed} completed sell fills`,
          ],
          [
            "Total fees",
            rupee(session.account.totalFees),
            "Slippage is embedded in fills",
          ],
        ].map(([title, value, note]) => (
          <div className="panel metric" key={title}>
            <span>{title}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </div>
        ))}
      </div>
      <section className="panel equity-panel">
        <div className="panel-title">
          <div>
            <h2>Your equity curve</h2>
            <p>Cash + marked holdings at each revealed close</p>
          </div>
          <span className={change >= 0 ? "positive" : "negative"}>
            {rupee(change)}
          </span>
        </div>
        <div className="equity-big">
          <strong>{rupee(p.equity)}</strong>
          <span>Starting balance {rupee(session.initialCapital, 0)}</span>
        </div>
        <EquityChart
          values={session.account.equityHistory.map((v) => v.equity)}
          baseline={session.initialCapital}
        />
        <div className="curve-dates">
          <span>
            {dateLabel(session.assets[0].bars[session.startCursor].date)}
          </span>
          <span>
            {dateLabel(session.assets[0].bars[session.account.cursor].date)}
          </span>
        </div>
      </section>
      <div className="calculator-grid">
        <section className="panel breakdown">
          <h2>Performance breakdown</h2>
          {[
            ["Realised P&L", rupee(session.account.realisedPnl)],
            ["Unrealised P&L", rupee(p.unrealised)],
            ["Expectancy per exit", p.closed ? rupee(p.expectancy) : "—"],
            [
              "Profit factor",
              p.profitFactor === null
                ? p.closed
                  ? "No losing exits"
                  : "—"
                : p.profitFactor.toFixed(2),
            ],
            ["Completed exits", String(p.closed)],
            [
              "Replay sessions observed",
              String(session.account.cursor - session.startCursor + 1),
            ],
          ].map(([label, v]) => (
            <div className="detail-row" key={label}>
              <span>{label}</span>
              <b>{v}</b>
            </div>
          ))}
          <small>
            Each partial sell counts as an exit. No annualised return is
            inferred from a short replay.
          </small>
        </section>
        <section className="panel breakdown">
          <h2>Where your capital sits</h2>
          {[
            ["Cash", session.account.cash, "var(--accent)"],
            ...positions.map(
              ([symbol, pos]) =>
                [
                  symbol,
                  pos.quantity *
                    session.assets.find((a) => a.symbol === symbol)!.bars[
                      session.account.cursor
                    ].close,
                  session.assets.find((a) => a.symbol === symbol)!.color,
                ] as const,
            ),
          ].map(([symbol, value, color]) => (
            <div className="allocation-row" key={symbol}>
              <div>
                <span>{symbol}</span>
                <b>{rupee(Number(value), 0)}</b>
                <small>
                  {p.equity > 0
                    ? ((Number(value) / p.equity) * 100).toFixed(1)
                    : 0}
                  %
                </small>
              </div>
              <div className="progress">
                <i
                  style={{
                    width: `${p.equity > 0 ? (Number(value) / p.equity) * 100 : 0}%`,
                    background: String(color),
                  }}
                />
              </div>
            </div>
          ))}
          <h3 className="order-health">Order outcomes</h3>
          <div className="outcome-grid">
            {statuses.map((status) => (
              <div key={status}>
                <b>
                  {
                    session.account.orders.filter((o) => o.status === status)
                      .length
                  }
                </b>
                <span>{status}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
      {!p.closed && (
        <div className="info-strip">
          <CheckCircle2 size={18} />
          <span>
            Complete a buy and sell in replay to unlock exit statistics. Flat or
            empty results are a valid starting point.
          </span>
        </div>
      )}
    </div>
  );
}

export function Journal({
  session,
  mutate,
}: {
  session: Session;
  mutate: Mutate;
}) {
  const [symbol, setSymbol] = useState(session.selected),
    [thesis, setThesis] = useState(""),
    [lesson, setLesson] = useState(""),
    [mood, setMood] = useState("Calm"),
    [tags, setTags] = useState(""),
    [filter, setFilter] = useState(""),
    [remove, setRemove] = useState<string | null>(null);
  const entries = [...session.journal]
    .reverse()
    .filter((j) =>
      (j.symbol + " " + j.thesis + " " + j.lesson + " " + j.tags)
        .toLowerCase()
        .includes(filter.toLowerCase()),
    );
  const add = () => {
    if (!thesis.trim()) return;
    mutate((s) => {
      if (s.journal.length >= 2000)
        throw new Error(
          "Journal limit reached. Export a backup and begin a new workspace.",
        );
      return {
        ...s,
        journal: [
          ...s.journal,
          {
            id: crypto.randomUUID(),
            date: s.assets[0].bars[s.account.cursor].date,
            symbol,
            thesis: thesis.trim(),
            lesson: lesson.trim(),
            mood,
            tags: tags.trim(),
          },
        ],
      };
    }, "Journal entry saved.");
    setThesis("");
    setLesson("");
    setTags("");
  };
  return (
    <div className="journal-page">
      <div className="page-heading">
        <span className="eyebrow">BETTER QUESTIONS. BETTER DECISIONS.</span>
        <h1>Your trading journal.</h1>
        <p>Record what you thought before you know how it ends.</p>
      </div>
      <div className="journal-layout">
        <section className="panel journal-editor">
          <h2>A note to your future self</h2>
          <div className="field-row">
            <label>
              Stock
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
              >
                {session.assets.map((a) => (
                  <option key={a.symbol}>{a.symbol}</option>
                ))}
              </select>
            </label>
            <label>
              Mindset
              <select value={mood} onChange={(e) => setMood(e.target.value)}>
                {["Calm", "Confident", "Uncertain", "Impulsive", "Patient"].map(
                  (m) => (
                    <option key={m}>{m}</option>
                  ),
                )}
              </select>
            </label>
          </div>
          <label>
            Your thesis
            <textarea
              maxLength={3000}
              rows={5}
              placeholder="What do you see? Where is your idea invalidated?"
              value={thesis}
              onChange={(e) => setThesis(e.target.value)}
            />
          </label>
          <label>
            Lesson / reflection
            <textarea
              maxLength={3000}
              rows={4}
              placeholder="What worked? What would you do differently?"
              value={lesson}
              onChange={(e) => setLesson(e.target.value)}
            />
          </label>
          <label>
            Tags
            <input
              maxLength={200}
              placeholder="e.g. breakout, earnings, patience"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </label>
          <button
            className="primary-button full"
            onClick={add}
            disabled={!thesis.trim()}
          >
            <Plus size={16} />
            Save journal entry
          </button>
          <small>
            Attached to{" "}
            {dateLabel(session.assets[0].bars[session.account.cursor].date)}.
            Journal notes stay when you rewind.
          </small>
        </section>
        <div className="journal-entries">
          <input
            className="journal-search"
            aria-label="Search journal"
            placeholder="Search your notes…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {entries.length ? (
            entries.map((j) => (
              <article className="panel journal-note" key={j.id}>
                <div>
                  <span className="badge">{j.symbol}</span>
                  <span className="muted">
                    {dateLabel(j.date)} · {j.mood}
                  </span>
                  <button
                    className="icon-button"
                    aria-label="Delete journal entry"
                    onClick={() => setRemove(j.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <h3>Thesis</h3>
                <p>{j.thesis}</p>
                {j.lesson && (
                  <>
                    <h3>Reflection</h3>
                    <p>{j.lesson}</p>
                  </>
                )}
                {j.tags && <span className="journal-tags">{j.tags}</span>}
              </article>
            ))
          ) : (
            <div className="panel journal-empty">
              <Bookmark size={32} />
              <h3>The best record is an honest one.</h3>
              <p>
                Write your first thesis, then see what the market teaches you.
              </p>
            </div>
          )}
        </div>
      </div>
      {remove && (
        <Modal
          title="Delete this journal entry?"
          onClose={() => setRemove(null)}
        >
          <p>
            This removes the note from this workspace. Export a backup first if
            you want to keep a copy.
          </p>
          <button
            className="danger-button"
            onClick={() => {
              mutate(
                (s) => ({
                  ...s,
                  journal: s.journal.filter((j) => j.id !== remove),
                }),
                "Entry removed.",
              );
              setRemove(null);
            }}
          >
            Delete entry
          </button>
        </Modal>
      )}
    </div>
  );
}

export type SavedItem = { key: string; session: Session; savedAt: string };
export function Saved({
  items,
  onLoad,
  onDelete,
  onSave,
  onExport,
  onImport,
  refresh,
}: {
  items: SavedItem[];
  onLoad: (i: SavedItem) => void;
  onDelete: (key: string) => void;
  onSave: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  refresh: () => void;
}) {
  const [remove, setRemove] = useState<SavedItem | null>(null);
  return (
    <div>
      <div className="page-heading">
        <span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span>
        <h1>A home for your practice.</h1>
        <p>
          Named checkpoints live in this browser. Download a backup to move them
          between devices.
        </p>
      </div>
      <div className="save-actions">
        <button className="primary-button" onClick={onSave}>
          <Plus size={17} />
          Save a checkpoint
        </button>
        <button className="secondary-button" onClick={onExport}>
          <ArrowDownToLine size={17} />
          Export workspace
        </button>
        <label className="secondary-button file-button">
          <ArrowUpFromLine size={17} />
          Import backup
          <input
            aria-label="Import workspace backup"
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              if (e.target.files?.[0]) onImport(e.target.files[0]);
              e.target.value = "";
            }}
          />
        </label>
        <button className="text-button" onClick={refresh}>
          Refresh
        </button>
      </div>
      <div className="info-strip">
        <Download size={18} />
        <span>
          Autosave keeps your latest workspace on this browser. Clearing site
          data or private browsing can remove local saves. Back up sessions you
          want to keep.
        </span>
      </div>
      <div className="saved-grid">
        {items
          .filter((i) => i.key !== "autosave")
          .map((i) => (
            <section className="panel saved-card" key={i.key}>
              <div>
                <span className="saved-icon">
                  <FolderOpen size={23} />
                </span>
                <button
                  className="icon-button"
                  aria-label={`Delete checkpoint ${i.session.name}`}
                  onClick={() => setRemove(i)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <h3>{i.session.name}</h3>
              <p>
                {dateLabel(
                  i.session.assets[0].bars[i.session.account.cursor].date,
                )}{" "}
                · {i.session.scenario}
              </p>
              <strong>{rupee(performance(i.session).equity)}</strong>
              <div className="saved-meta">
                <span>{i.session.account.fills.length} fills</span>
                <span>{i.session.completedLessons.length} lessons</span>
                <span>{compact(i.session.journal.length)} notes</span>
              </div>
              <footer>
                <small>
                  Saved {new Date(i.savedAt).toLocaleString("en-IN")}
                </small>
                <button className="small-button" onClick={() => onLoad(i)}>
                  Open
                </button>
              </footer>
            </section>
          ))}
      </div>
      {items.filter((i) => i.key !== "autosave").length === 0 && (
        <div className="panel saved-empty">
          <FolderOpen size={35} />
          <h3>Keep a moment worth revisiting.</h3>
          <p>Save a named checkpoint before trying a different approach.</p>
          <button className="secondary-button" onClick={onSave}>
            Save your first checkpoint
          </button>
        </div>
      )}
      {remove && (
        <Modal title="Delete this checkpoint?" onClose={() => setRemove(null)}>
          <p>
            “{remove.session.name}” will be removed from this browser. Your
            currently open workspace is kept.
          </p>
          <button
            className="danger-button"
            onClick={() => {
              onDelete(remove.key);
              setRemove(null);
            }}
          >
            Delete checkpoint
          </button>
        </Modal>
      )}
    </div>
  );
}
