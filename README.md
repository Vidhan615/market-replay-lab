# Market Replay Lab

**Learn the chart. Read the business. Practise the decision.**

A browser-based stock market simulator by **Vidhan Doshi**, combining a paper-trading terminal, causal market replay and a beginner learning room.

[Open the live demo](https://Vidhan615.github.io/market-replay-lab/) · [Test status](https://github.com/Vidhan615/market-replay-lab/actions/workflows/ci.yml)

## What you can do

- **Trade with paper money:** market, limit, stop-market and stop-limit orders; whole shares; cash and share reservations; GTC and Day validity.
- **Plan exits:** optional stop-loss and take-profit brackets with linked one-cancels-other (OCO) exits. Size a long position from a risk budget.
- **Replay deliberately:** reveal daily bars one by one, play at four speeds, jump forward, rewind or restart. The account restores with the timeline.
- **Read charts:** candles or line, daily/weekly/monthly views, volume, SMA 20, EMA 50, Bollinger Bands, RSI 14, crosshair readout and fill markers.
- **Learn from scratch:** 14 lessons across foundations, technical analysis, fundamental analysis and risk. Worked examples, Hinglish notes, exercises and quizzes save with the workspace.
- **Understand company metrics:** illustrative EPS, P/E, debt/equity, ROE, margins, growth, dividend yield and market capitalisation. Interactive valuation and risk calculators.
- **Review performance:** equity curve, drawdown, net realised/unrealised P&L, fees, win rate, exit expectancy, profit factor and capital allocation.
- **Keep a trading journal:** thesis, invalidation idea, reflection, mindset, tags and search, attached to the current replay date.
- **Preserve your work:** IndexedDB autosave, named checkpoints, a previous-workspace safety checkpoint and validated JSON backup import/export.
- **Bring your own history:** import a daily OHLC CSV; download a synthetic sample from Settings.
- **Use white or black theme:** persistent appearance preference, responsive layouts, keyboard controls and accessible native dialogs.

## Try this first

1. Open the terminal with ₹10,00,000 of practice capital.
2. Choose NALCO, keep a small quantity and place a paper buy.
3. Click **Next session**. The queued order becomes eligible at that session’s open.
4. Inspect your position, fills and charged fees. Add a journal note before revealing more candles.
5. Open **Learn the markets**, complete a quiz, then save a named checkpoint.
6. Rewind and try another approach. Open your checkpoint to recover the saved branch.

Keyboard shortcuts in the terminal: **Space** plays/pauses, **← / →** steps. Shortcuts are disabled while editing fields or using dialogs/buttons.

## Data: fictional by default

The six company labels—NALCO, RELIANCE, TCS, HDFCBANK, INFY and HINDALCO—are familiar examples. **All bundled OHLC prices, volumes and company financials are fictional.** They are deterministically generated from a seed and scenario and must not be mistaken for market quotes or company disclosures. The calendar skips weekends, but does not model exchange holidays.

Each generated market has 420 daily bars. The first 60 provide chart warm-up; 361 replay states remain including the initial state. Financial examples stay static while price-dependent ratios update. There is no live feed, brokerage connection or actual money. Nothing in the app forecasts a real stock or establishes a profitable strategy.

Imported CSVs use your supplied history. The app does not verify its provenance or adjust splits, dividends or other corporate actions. Imported assets have no fabricated company financials.

## Execution model

The simulator is **long-only, cash-funded and all-or-nothing**, with one decision point per daily OHLC bar. It models costs without pretending to reproduce an exchange order book.

| Order            | Earliest execution and price rule                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Market           | Next daily open, plus adverse slippage                                                                                          |
| Buy / sell limit | Next bar touching the limit; favorable opening gaps improve price; slippage cannot violate the limit                            |
| Stop-market      | Next bar touching the stop; unfavorable opening gaps execute beyond the stop, plus slippage                                     |
| Stop-limit       | Triggered on one bar; the limit becomes eligible on a **later** bar, avoiding assumptions about the trigger bar’s intraday path |

- Fees apply separately to each fill. Entry fees enter weighted-average cost; sell P&L includes both the allocated entry cost and exit fee. Slippage is embedded in fill prices.
- Pending buys reserve estimated cost; pending sells reserve shares. OCO siblings reserve the same shares once. A gap can cause a buy to be rejected if actual cost exceeds remaining unreserved cash.
- Bracket children activate after the entry fill and **cannot fill on the entry bar**. When both linked exits touch on a later bar, the stop is processed first. Filling either exit cancels the other. Cancelling one child cancels the pair.
- GTC remains pending. A Day order expires after its next eligible daily session; a Day stop-limit may therefore trigger and expire without filling.
- Whole shares only. No short selling, margin, options, partial fills, market depth, interest or real broker tax schedule. The default 10 bps fee per side and 5 bps adverse slippage are editable illustrative assumptions.
- Changing cost settings affects future fills and reservations, not recorded fills.
- Forward movement processes each intermediate bar and order; it does not skip executions. Backward movement restores cash, holdings, orders, fills and equity history, truncating the later branch. Learning progress and journal notes remain. Save a checkpoint before rewinding if you want the original branch.

## Saving and privacy

Trading data is stored on this browser/origin in IndexedDB, not uploaded to a server. Autosave is debounced by 600 ms: **wait for “Saved on this browser” before closing**. Lifecycle flushing is best-effort; a named checkpoint or downloaded backup is safer for important work. Theme preference uses localStorage. Clearing site data, private browsing or changing the deployment origin can remove/separate local saves.

Named checkpoints are independent snapshots. Creating/opening/importing a workspace keeps the most recently open workspace in a reusable safety checkpoint; the next switch replaces that safety checkpoint. Download JSON backups to transfer between devices. Imports validate version, bounds, dates, OHLC structure, aligned calendars, financial state and current equity/snapshot reconciliation before loading. Backups contain a full workspace, including all generated bars, and are portable rather than encrypted or anti-cheat records.

No login, analytics tracker, API key or paid service is required. Google Fonts may be requested for typography; local system fonts provide a fallback. The simulator works without a market-data subscription.

## Run locally

Use **Node.js 24** and npm.

```sh
git clone https://github.com/Vidhan615/market-replay-lab.git
cd market-replay-lab
npm ci
npm run dev
```

```sh
npm test          # financial ledger, order behavior, replay causality, indicators, CSV and backup validation
npm run build    # strict TypeScript check and production bundle
npm run preview  # serve the built application
```

The app is a static React + TypeScript application built with Vite, with SVG charts and Lucide icons. No backend or environment secrets are needed. The relative Vite base supports GitHub Pages project paths.

## CSV format

```csv
date,open,high,low,close,volume
2024-01-02,100,105,98,103,250000
2024-01-03,103,107,101,104,300000
```

Supply **61–5,000 rows**, up to 3 MB, with unique valid `YYYY-MM-DD` dates. Column names are case-insensitive; volume is optional. Imports are sorted by date, preserve quoted numeric fields, and reject invalid OHLC ranges. Dates represent daily bars, so use at most one row per date. JSON backups are limited to 25 MB; browser quota can be smaller.

## Project structure

```text
src/
  engine.ts          order execution, reservations, ledger, replay snapshots, metrics
  engine.test.ts     deterministic accounting and data validation regression tests
  market.ts          seeded scenarios, causal indicators, aggregation and CSV parser
  persistence.ts     IndexedDB operations and validated backup import/export
  App.tsx            workspace lifecycle, autosave, navigation and settings
  Trading.tsx        order ticket, replay controls, watchlist, tables and fundamentals
  Chart.tsx          SVG price/volume/RSI and equity charts
  Learn.tsx          learning room, quizzes and calculators
  lessons.ts         authored lessons and primary-source reading links
  Pages.tsx          performance, journal and saved checkpoints
  styles.css         responsive white/black themes
docs/
  VERIFICATION.md    test coverage and browser verification record
```

GitHub Actions runs the tests and production build for pushes and pull requests. A separate workflow deploys the live demo to GitHub Pages after its tests pass. To reuse the workflow in a fork, enable **Settings → Pages → Source: GitHub Actions**.

## Learning references

Lessons use original explanations and fictional worked examples. For further reading:

- [SEBI Investor: technical and fundamental analysis](https://investor.sebi.gov.in/tech_fund_analysis.html)
- [NSE: fundamental analysis learning module](https://www.nseindia.com/static/learn/self-study-ncfm-modules-intermediate-fundamental-analysis)
- [Investor.gov: stock ownership and risks](https://www.investor.gov/introduction-investing/investing-basics/investment-products/stocks)
- [Investor.gov: asset allocation and diversification](https://www.investor.gov/introduction-investing/getting-started/asset-allocation)

MIT licensed. Educational software, with explicit and reproducible simulation assumptions.
