# Verification record

Verified locally on Windows with Node.js 24 and in the connected Chromium browser on 8 October 2026. Re-run `npm test` and `npm run build` for a fresh result; this record describes the checks performed while building the initial release.

## Automated checks

31 deterministic tests exercise:

- Next-bar market eligibility, opening gaps, adverse slippage, charged fees, cost basis and net realised P&L reconciliation.
- Weighted-average holdings and partial exits.
- Cash reservations, cancellation, actual-fill cash rejection, prevention of naked shorts and double-reserved shares.
- Buy limits with price improvement and limit protection; stop gaps; conservative stop-limit trigger timing; Day expiration.
- Bracket activation after entry, shared OCO reservations, stop-first ambiguous bars, linked cancellation and a full position close.
- Rewind restoration, deterministic branch replay, end-of-data bounds and causal invariance under changes to unrevealed data.
- Marked equity and drawdown from known account values.
- Full backup round trip and rejection of structural corruption, dangerous object keys, ledger mismatch, snapshot corruption and duplicate asset dates.
- Seed reproducibility, valid OHLC ranges and aligned multi-asset calendars.
- SMA/EMA/RSI/Bollinger reference cases, warm-up behavior and prefix causality.
- Aggregation of revealed bars, quoted/sorted CSV import and invalid data rejection.

The production build performs strict TypeScript checking. Dependency installation was audited with no known vulnerabilities at the time of verification. GitHub CI independently runs tests and a production build, and checks runtime dependencies for high-severity advisories.

## Browser checks

- Opened the terminal, placed a 10-share NALCO paper buy, advanced one session and verified the resulting holding, fee and next-open fill.
- Saved a named checkpoint, reloaded after autosave completed and verified holdings restoration.
- Completed a beginner knowledge check; waited for autosave; reloaded and verified learning progress.
- Rewound the account and reopened a named checkpoint to recover its saved branch.
- Created a thesis/reflection journal entry and verified it appeared with its replay date.
- Closed the position and inspected realised P&L, fees, win rate and exit statistics.
- Inspected both white and black themes and the responsive desktop/mobile layouts.
- Checked the phone layout for document overflow and inspected browser errors.

## Limits of the verification

These tests establish the documented simulator rules and accounting behavior, not exchange-level execution realism or investment performance. Storage quota and private-browsing behavior depend on the browser. Lifecycle autosave flushing is best-effort; wait for the saved status and export important workspaces.
