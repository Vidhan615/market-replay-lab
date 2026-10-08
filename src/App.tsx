import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  CloudOff,
  Download,
  FolderOpen,
  LayoutDashboard,
  Menu,
  Moon,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Upload,
  X,
} from "lucide-react";
import type { Scenario, Session } from "./types";
import {
  advance,
  availableCash,
  createSession,
  performance,
  rewind,
  skip,
} from "./engine";
import { generateMarket, parseCSV } from "./market";
import {
  deleteSession,
  exportFile,
  importSession,
  listSessions,
  saveSession,
} from "./persistence";
import { dateLabel, errorText, percent, rupee } from "./format";
import {
  AccountTable,
  OrderTicket,
  Replay,
  TradingChart,
  Watchlist,
  type Mutate,
} from "./Trading";
import Learn from "./Learn";
import { Analytics, Journal, Saved, type SavedItem } from "./Pages";
import { lessons } from "./lessons";
import Modal from "./Modal";

const nav = [
  { id: "terminal", label: "Trading terminal", icon: LayoutDashboard },
  { id: "learn", label: "Learn the markets", icon: BookOpen },
  { id: "analytics", label: "Performance", icon: BarChart3 },
  { id: "journal", label: "Trading journal", icon: BookOpen },
  { id: "saved", label: "Saved workspaces", icon: FolderOpen },
  { id: "settings", label: "Settings", icon: Settings2 },
];
type Page = (typeof nav)[number]["id"];

export default function App() {
  const [session, setSession] = useState(() => createSession()),
    [ready, setReady] = useState(false),
    [page, setPage] = useState<Page>("terminal"),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1000),
    [theme, setTheme] = useState<"dark" | "light">(() => {
      try {
        return localStorage.getItem("mrl-theme") === "light" ? "light" : "dark";
      } catch {
        return "dark";
      }
    }),
    [toast, setToast] = useState<{ text: string; error: boolean } | null>(null),
    [saveStatus, setSaveStatus] = useState("Loading…"),
    [items, setItems] = useState<SavedItem[]>([]),
    [modal, setModal] = useState<"save" | "new" | "help" | null>(null),
    [name, setName] = useState(""),
    [capital, setCapital] = useState("1000000"),
    [seed, setSeed] = useState("615"),
    [scenario, setScenario] = useState<Scenario>("balanced"),
    [mobileNav, setMobileNav] = useState(false);
  const current = useRef(session),
    queue = useRef(Promise.resolve()),
    saveVersion = useRef(0);
  current.current = session;
  const notify = useCallback(
    (text: string, error = false) => setToast({ text, error }),
    [],
  );
  const refresh = useCallback(async () => {
    try {
      setItems(await listSessions());
    } catch (e) {
      notify(errorText(e), true);
    }
  }, [notify]);
  useEffect(() => {
    let live = true;
    listSessions()
      .then((saved) => {
        if (!live) return;
        setItems(saved);
        const auto = saved.find((i) => i.key === "autosave");
        if (auto) {
          try {
            setSession(importSession(JSON.stringify(auto.session)));
            setSaveStatus("Restored from browser");
          } catch (e) {
            notify("Could not restore autosave. " + errorText(e), true);
          }
        }
        setReady(true);
      })
      .catch((e) => {
        if (live) {
          notify(errorText(e), true);
          setSaveStatus("Storage unavailable");
          setReady(true);
        }
      });
    return () => {
      live = false;
    };
  }, [notify]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("mrl-theme", theme);
    } catch {
      /* Theme still works for this visit. */
    }
  }, [theme]);
  useEffect(() => {
    if (!ready) return;
    const version = ++saveVersion.current;
    setSaveStatus("Saving…");
    const timer = window.setTimeout(() => {
      queue.current = queue.current
        .catch(() => {})
        .then(() => saveSession("autosave", session))
        .then(() => {
          if (saveVersion.current === version)
            setSaveStatus("Saved on this browser");
        })
        .catch((e) => {
          setSaveStatus("Save failed — export backup");
          notify(errorText(e), true);
        });
    }, 600);
    return () => clearTimeout(timer);
  }, [session, ready, notify]);
  useEffect(() => {
    if (!ready) return;
    const flush = () => {
      void saveSession("autosave", current.current).catch(() => {});
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [ready]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () =>
        setSession((s) => {
          if (s.account.cursor === s.assets[0].bars.length - 1) {
            setPlaying(false);
            return s;
          }
          return advance(s);
        }),
      speed,
    );
    return () => clearInterval(timer);
  }, [playing, speed]);
  const seek = useCallback((cursor: number) => {
    setPlaying(false);
    setSession((s) =>
      cursor < s.account.cursor
        ? rewind(s, cursor)
        : skip(
            s,
            Math.min(
              cursor - s.account.cursor,
              s.assets[0].bars.length - 1 - s.account.cursor,
            ),
          ),
    );
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest("input,textarea,select,button,dialog,a") ||
        page !== "terminal"
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((v) => !v);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        seek(current.current.account.cursor + 1);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        seek(current.current.account.cursor - 1);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [page, seek]);
  const mutate: Mutate = useCallback(
    (fn, success) => {
      try {
        const next = fn(current.current);
        current.current = next;
        setSession(next);
        if (success) notify(success);
      } catch (e) {
        notify(errorText(e), true);
      }
    },
    [notify],
  );
  const navigate = (to: Page) => {
    setPage(to);
    setMobileNav(false);
    if (to !== "terminal") setPlaying(false);
    if (to === "saved") void refresh();
  };
  const openSave = () => {
    setPlaying(false);
    setName(current.current.name);
    setModal("save");
  };
  const checkpoint = async () => {
    if (!name.trim()) return;
    try {
      if (items.filter((i) => i.key !== "autosave").length >= 20)
        throw new Error(
          "You have 20 checkpoints. Export or delete one before saving another.",
        );
      const next = {
        ...current.current,
        name: name.trim(),
        updatedAt: new Date().toISOString(),
      };
      await saveSession(crypto.randomUUID(), next);
      setSession(next);
      await refresh();
      setModal(null);
      notify("Named checkpoint saved on this browser.");
    } catch (e) {
      notify(errorText(e), true);
    }
  };
  const backup = () =>
    exportFile(
      JSON.stringify(current.current),
      `market-replay-${current.current.assets[0].bars[current.current.account.cursor].date}.json`,
    );
  const replace = async (next: Session) => {
    setPlaying(false);
    await saveSession("previous-workspace", current.current);
    setSession(next);
    current.current = next;
    setPage("terminal");
    await refresh();
  };
  const load = async (item: SavedItem) => {
    try {
      await replace(importSession(JSON.stringify(item.session)));
      notify("Checkpoint restored. Previous workspace saved as a checkpoint.");
    } catch (e) {
      notify(errorText(e), true);
    }
  };
  const importBackup = async (file: File) => {
    try {
      if (file.size > 25_000_000) throw new Error("Backup exceeds 25 MB");
      await replace(importSession(await file.text()));
      notify("Backup imported. Previous workspace preserved.");
    } catch (e) {
      notify(errorText(e), true);
    }
  };
  const importCSV = async (file: File) => {
    try {
      if (file.size > 3_000_000) throw new Error("CSV exceeds 3 MB");
      const asset = parseCSV(
        await file.text(),
        file.name.replace(/\.csv$/i, ""),
      );
      await replace(
        createSession({
          assets: [asset],
          capital: current.current.initialCapital,
          name: `${asset.symbol} replay`,
        }),
      );
      notify("CSV imported. The first 60 bars warm up your indicators.");
    } catch (e) {
      notify(errorText(e), true);
    }
  };
  const newSession = async () => {
    try {
      if (!/^\d+$/.test(seed) || Number(seed) > 4294967295)
        throw new Error("Seed must be a whole number from 0 to 4,294,967,295");
      await replace(
        createSession({
          capital: Number(capital),
          seed: Number(seed),
          scenario,
          name: name.trim() || "My practice workspace",
        }),
      );
      setModal(null);
      notify(
        "New workspace created. Previous workspace saved as a checkpoint.",
      );
    } catch (e) {
      notify(errorText(e), true);
    }
  };
  const demoCSV = () => {
    const bars = generateMarket(615)[0].bars.slice(0, 120);
    exportFile(
      "date,open,high,low,close,volume\n" +
        bars
          .map((b) =>
            [b.date, b.open, b.high, b.low, b.close, b.volume].join(","),
          )
          .join("\n"),
      "SYNTHETIC-SAMPLE.csv",
      "text/csv",
    );
  };
  const p = performance(session),
    asset = session.assets.find((a) => a.symbol === session.selected)!,
    totalChange = (p.equity - session.initialCapital) / session.initialCapital,
    finished = lessons.filter((l) =>
      session.completedLessons.includes(l.id),
    ).length;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {mobileNav && (
        <button
          className="nav-overlay"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("terminal");
          }}
        >
          <span className="brand-symbol">
            <svg viewBox="0 0 32 32">
              <path
                d="M6 23V12l7 7 8-12h5"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span>
            market<span className="brand-second">replay lab</span>
          </span>
        </a>
        <div className="workspace-switch">
          <span className="workspace-avatar">VD</span>
          <div>
            <b>My workspace</b>
            <small>Personal · Paper trading</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <span className="nav-caption">WORKSPACE</span>
        <nav aria-label="Main navigation">
          {nav.map((n) => (
            <button
              key={n.id}
              className={page === n.id ? "active" : ""}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={18} />
              <span>{n.label}</span>
              {n.id === "learn" && (
                <span className="nav-pill">{lessons.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="practice-card">
            <span>
              <Sparkles size={17} />A little better, every day.
            </span>
            <p>Good traders never stop being students.</p>
            <div className="progress">
              <i style={{ width: `${(finished / lessons.length) * 100}%` }} />
            </div>
            <button onClick={() => navigate("learn")}>
              {finished} of {lessons.length} lessons
              <ArrowRight size={14} />
            </button>
          </div>
          <div className="sidebar-footer">
            <ShieldCheck size={15} />
            <span>Practice capital. Real learning.</span>
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobileNav(true)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            Workspace
            <ChevronRight size={13} />
            <strong>{nav.find((n) => n.id === page)?.label}</strong>
          </div>
          <div className="topbar-actions">
            <span className="save-status" role="status">
              {saveStatus.startsWith("Saved") ? (
                <CheckCircle2 size={14} />
              ) : (
                <CloudOff size={14} />
              )}
              <span>{saveStatus}</span>
            </span>
            <button
              className="icon-button theme-toggle"
              aria-label={`Switch to ${theme === "dark" ? "white" : "black"} theme`}
              title={`${theme === "dark" ? "White" : "Black"} theme`}
              onClick={() => setTheme((v) => (v === "dark" ? "light" : "dark"))}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className="icon-button"
              aria-label="How the simulator works"
              onClick={() => setModal("help")}
            >
              <CircleHelp size={18} />
            </button>
            <button
              className="save-button"
              onClick={openSave}
              disabled={!ready}
            >
              <Save size={15} />
              <span>Save workspace</span>
            </button>
          </div>
        </header>
        <main id="main" className="main-content" aria-busy={!ready}>
          {!ready ? (
            <div className="loading-screen">
              <span className="brand-symbol">
                <BarChart3 />
              </span>
              <h2>Opening your workspace…</h2>
            </div>
          ) : page === "terminal" ? (
            <>
              <div className="terminal-heading">
                <div>
                  <div className="heading-kicker">
                    <span className="eyebrow">YOUR DAILY PRACTICE</span>
                    <span className="badge">
                      <span className="live-dot" />
                      {asset.fundamentals
                        ? "Simulated market"
                        : "Imported data"}
                    </span>
                  </div>
                  <h1>A clearer view of the markets.</h1>
                  <p>
                    {session.name}
                    <span className="separator">/</span>
                    {dateLabel(asset.bars[session.account.cursor].date)}
                  </p>
                </div>
                <button
                  className="secondary-button new-session-button"
                  onClick={() => {
                    setPlaying(false);
                    setName("");
                    setModal("new");
                  }}
                >
                  <Plus size={16} />
                  New workspace
                </button>
              </div>
              <div className="account-stats">
                <div className="panel metric">
                  <span>
                    Total equity <BarChart3 size={15} />
                  </span>
                  <strong>{rupee(p.equity, 0)}</strong>
                  <small className={totalChange >= 0 ? "positive" : "negative"}>
                    {percent(totalChange)}
                    <span className="muted">since start</span>
                  </small>
                </div>
                <div className="panel metric">
                  <span>
                    Available cash <span className="metric-symbol">₹</span>
                  </span>
                  <strong>
                    {rupee(
                      availableCash(
                        session.account,
                        session.assets,
                        session.settings,
                      ),
                      0,
                    )}
                  </strong>
                  <small>After open buy reservations</small>
                </div>
                <div className="panel metric">
                  <span>
                    Unrealised P&L <span className="metric-symbol">↗</span>
                  </span>
                  <strong
                    className={p.unrealised >= 0 ? "positive" : "negative"}
                  >
                    {rupee(p.unrealised)}
                  </strong>
                  <small>
                    Across {Object.keys(session.account.positions).length} open
                    positions
                  </small>
                </div>
                <div className="panel metric">
                  <span>
                    Realised P&L <CheckCircle2 size={15} />
                  </span>
                  <strong
                    className={
                      session.account.realisedPnl >= 0 ? "positive" : "negative"
                    }
                  >
                    {rupee(session.account.realisedPnl)}
                  </strong>
                  <small>After entry and exit fees</small>
                </div>
              </div>
              <div className="terminal-grid">
                <div className="terminal-left">
                  <TradingChart session={session} />
                  <Replay
                    session={session}
                    playing={playing}
                    setPlaying={setPlaying}
                    speed={speed}
                    setSpeed={setSpeed}
                    seek={seek}
                  />
                  <div className="learning-strip">
                    <span className="learning-strip-icon">
                      <BookOpen size={19} />
                    </span>
                    <div>
                      <b>New to the chart?</b>
                      <span>Learn to read candles, trends and momentum.</span>
                    </div>
                    <button onClick={() => navigate("learn")}>
                      Explore lessons
                      <ArrowRight size={15} />
                    </button>
                  </div>
                  <AccountTable session={session} mutate={mutate} />
                </div>
                <div className="terminal-right">
                  <OrderTicket
                    key={asset.symbol + session.id}
                    session={session}
                    asset={asset}
                    mutate={mutate}
                  />
                  <Watchlist session={session} mutate={mutate} />
                </div>
              </div>
            </>
          ) : page === "learn" ? (
            <Learn session={session} mutate={mutate} />
          ) : page === "analytics" ? (
            <Analytics session={session} />
          ) : page === "journal" ? (
            <Journal key={session.id} session={session} mutate={mutate} />
          ) : page === "saved" ? (
            <Saved
              items={items}
              onLoad={(i) => void load(i)}
              onDelete={(key) => {
                void deleteSession(key)
                  .then(refresh)
                  .then(() => notify("Checkpoint deleted."))
                  .catch((e) => notify(errorText(e), true));
              }}
              onSave={openSave}
              onExport={backup}
              onImport={(f) => void importBackup(f)}
              refresh={() => void refresh()}
            />
          ) : (
            <div className="settings-page">
              <div className="page-heading">
                <span className="eyebrow">MAKE IT YOUR OWN</span>
                <h1>Your practice, your parameters.</h1>
                <p>
                  Choose a theme, model trading costs and bring your own price
                  history.
                </p>
              </div>
              <section className="panel settings-section">
                <div>
                  <h2>Appearance</h2>
                  <p>A comfortable desk, day or night.</p>
                </div>
                <div className="theme-cards">
                  <button
                    className={theme === "dark" ? "active" : ""}
                    onClick={() => setTheme("dark")}
                  >
                    <span className="theme-preview dark-preview">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span>
                      <Moon size={16} />
                      Black{theme === "dark" && <Check size={16} />}
                    </span>
                  </button>
                  <button
                    className={theme === "light" ? "active" : ""}
                    onClick={() => setTheme("light")}
                  >
                    <span className="theme-preview light-preview">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span>
                      <Sun size={16} />
                      White{theme === "light" && <Check size={16} />}
                    </span>
                  </button>
                </div>
              </section>
              <section className="panel settings-section">
                <div>
                  <h2>Execution & risk</h2>
                  <p>
                    Changes apply to future fills and cash reservations.
                    Historical fills stay recorded at their original costs.
                  </p>
                </div>
                <div className="settings-fields">
                  {(
                    [
                      {
                        key: "feeBps",
                        label: "Fee per side (basis points)",
                        min: 0,
                        max: 100,
                        step: 1,
                      },
                      {
                        key: "slippageBps",
                        label: "Adverse slippage (basis points)",
                        min: 0,
                        max: 100,
                        step: 1,
                      },
                      {
                        key: "riskPercent",
                        label: "Position sizing risk (%)",
                        min: 0.1,
                        max: 10,
                        step: 0.1,
                      },
                    ] as const
                  ).map((field) => (
                    <label key={field.key}>
                      {field.label}
                      <input
                        type="number"
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        value={session.settings[field.key]}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (
                            Number.isFinite(n) &&
                            n >= field.min &&
                            n <= field.max
                          )
                            mutate((s) => ({
                              ...s,
                              settings: { ...s.settings, [field.key]: n },
                            }));
                        }}
                      />
                    </label>
                  ))}
                </div>
                <small>
                  1 basis point = 0.01%. Fees are a simplified all-in model, not
                  an Indian broker tax schedule. Long-only, cash-funded,
                  whole-share orders.
                </small>
              </section>
              <section className="panel settings-section">
                <div>
                  <h2>Bring your own history</h2>
                  <p>
                    Import 61–5,000 daily OHLC rows. The first 60 rows warm up
                    indicators. Your current workspace is preserved as a
                    checkpoint.
                  </p>
                </div>
                <code className="csv-format">
                  date,open,high,low,close,volume
                  <br />
                  2024-01-02,100,105,98,103,250000
                </code>
                <div className="save-actions">
                  <label className="secondary-button file-button">
                    <Upload size={16} />
                    Import CSV
                    <input
                      aria-label="Import price history CSV"
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(e) => {
                        if (e.target.files?.[0])
                          void importCSV(e.target.files[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <button className="text-button" onClick={demoCSV}>
                    <Download size={16} />
                    Download synthetic sample
                  </button>
                </div>
                <small>
                  Use YYYY-MM-DD dates and positive OHLC values. Volume is
                  optional. Corporate actions, exchange holidays and data
                  adjustments depend on your file.
                </small>
              </section>
              <section className="panel settings-section">
                <div>
                  <h2>Workspace & backups</h2>
                  <p>
                    All trading data stays in your browser. There is no account,
                    broker connection or cloud sync.
                  </p>
                </div>
                <div className="save-actions">
                  <button className="secondary-button" onClick={backup}>
                    <Download size={16} />
                    Export full backup
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setName("");
                      setModal("new");
                    }}
                  >
                    <Plus size={16} />
                    New workspace
                  </button>
                </div>
                <div className="workspace-detail">
                  <span>
                    Seed <b>{session.seed}</b>
                  </span>
                  <span>
                    Scenario <b>{session.scenario}</b>
                  </span>
                  <span>
                    Data <b>{session.assets[0].bars.length} daily bars</b>
                  </span>
                </div>
              </section>
            </div>
          )}
          <footer className="app-footer">
            <span>
              Market Replay Lab <i />
              Built for curiosity.
            </span>
            <span>
              {asset.fundamentals
                ? "Fictional prices & financials"
                : "User-imported prices"}{" "}
              · Paper trading only
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div
          className={`toast ${toast.error ? "error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <CircleHelp size={19} /> : <CheckCircle2 size={19} />}
          <span>{toast.text}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {modal === "save" && (
        <Modal title="Save a checkpoint" onClose={() => setModal(null)}>
          <p>
            A named copy keeps your orders, portfolio, replay position, journal
            and learning progress together.
          </p>
          <label>
            Workspace name
            <input
              autoFocus
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void checkpoint();
              }}
            />
          </label>
          <div className="modal-actions">
            <button className="secondary-button" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button
              className="primary-button"
              disabled={!name.trim()}
              onClick={() => void checkpoint()}
            >
              <Save size={16} />
              Save checkpoint
            </button>
          </div>
          <small>
            Saved on this browser. Export a backup for another device.
          </small>
        </Modal>
      )}
      {modal === "new" && (
        <Modal
          title="Create a practice workspace"
          onClose={() => setModal(null)}
        >
          <p>
            Your current workspace will be saved as a checkpoint before
            switching.
          </p>
          <label>
            Workspace name
            <input
              autoFocus
              maxLength={120}
              placeholder="My practice workspace"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Starting capital (₹)
            <input
              type="number"
              min="1000"
              max="1000000000"
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
            />
          </label>
          <div className="field-row">
            <label>
              Scenario
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value as Scenario)}
              >
                <option value="balanced">Balanced</option>
                <option value="momentum">Trending</option>
                <option value="volatile">High volatility</option>
              </select>
            </label>
            <label>
              Random seed
              <input
                type="number"
                min="0"
                max="4294967295"
                step="1"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
              />
            </label>
          </div>
          <div className="info-strip">
            <Sparkles size={18} />
            <span>
              Same seed + scenario produces the same fictional market. Change
              your decisions and compare outcomes.
            </span>
          </div>
          <button
            className="primary-button full"
            onClick={() => void newSession()}
          >
            Create workspace
            <ArrowRight size={17} />
          </button>
        </Modal>
      )}
      {modal === "help" && (
        <Modal
          wide
          title="A safe place to learn the market"
          onClose={() => setModal(null)}
        >
          <p className="lesson-summary">
            Practice decisions with paper money, reveal one session at a time,
            then review your process.
          </p>
          <div className="help-steps">
            {[
              [
                "01",
                "Choose your stock",
                "Six stock labels come with fictional prices and worked financial examples. Import a CSV for your own daily history.",
              ],
              [
                "02",
                "Plan, then place",
                "Market, limit, stop-market and stop-limit orders become eligible on the next daily bar. Buy brackets create linked OCO exits after entry.",
              ],
              [
                "03",
                "Replay with intention",
                "Use Space and arrow keys, or the timeline. Going backward restores that account snapshot and discards the later branch; journal notes and lessons stay.",
              ],
              [
                "04",
                "Learn and preserve",
                "Explore 14 lessons, write a journal and review performance. Autosave stays on this browser; named checkpoints and JSON backups preserve your experiments.",
              ],
            ].map(([n, title, body]) => (
              <div key={n}>
                <span>{n}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="hinglish-note">
            <b>Execution assumptions</b>
            <p>
              Daily bars do not reveal an intraday path. If both OCO exits
              touch, the stop is processed first. Stop-limit orders cannot fill
              on their trigger bar. No partial fills, leverage or naked short
              selling. Stops can slip through gaps. These deliberate
              simplifications are documented in the repository.
            </p>
          </div>
          <button className="primary-button" onClick={() => setModal(null)}>
            Let’s practice
            <ArrowRight size={17} />
          </button>
        </Modal>
      )}
    </div>
  );
}
