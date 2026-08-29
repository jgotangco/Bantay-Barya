# 🪙 Bantay Barya - Multi-Wallet Expense Tracker

> A modern, private, fast, and standalone Personal Financial Ledger with Continuous Running Balance, Multi-Wallet Tracking, Live Online Currency Exchange Rates (Default PHP ₱), Bill Scheduler, Debt Snowball/Avalanche Planner, Save Vault, and Browser Extension.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-v2.9.0-emerald.svg)](index.html)
[![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20PWA%20%7C%20Chrome%20Extension-purple.svg)](manifest.json)

---

## 🌟 Key Features

### 1. 👛 Multi-Wallet Continuous Ledger
- **Running Balance Tracking**: Continuous accounting ledger recalculates balances across all wallets (*GCash, Maya, BPI, Physical Cash, Crypto, High-Yield Savings, Time Deposits, Stocks*).
- **Projected Balance Previews**: Live balance preview as you enter inflow/outflow amounts.
- **5-Field Transaction Entry**: Date, Expense Item / Classification, Credit (+), Debit (-), Running Balance, and Notes.

### 2. 💱 Multi-Currency & Live Online FX Rates
- **Philippine Peso (PHP ₱) Base**: Configurable base currency with automatic live exchange rate fetching from public FX APIs for multi-currency transactions (USD, EUR, JPY, GBP, SGD, CAD, AUD, etc.).
- **Cross-Currency Transfers**: Inter-wallet transfers automatically convert currencies and conserve total net worth without creating artificial expense records.

### 3. 📅 Bill Tracker & Recurring Payment Schedules
- **Recurring & One-Time Bills**: Set weekly, bi-weekly, monthly, quarterly, semi-annual, or annual billing cycles.
- **Calendar-Based Recurrence Math**: Preserves anchor billing days across variable month lengths (e.g. Jan 31 → Feb 28/29 → Mar 31) and leap years.
- **Glowing Header Due Alerts**: Dynamic pulsing header indicators when bills are overdue (🔴 Red) or due soon (🟡 Amber).
- **1-Click Ledger Settlement**: Mark bills as paid and auto-post the debit transaction to your ledger.

### 4. 💳 Debt & Loan (Utang / Pautang) Manager
- **Money Lent & Borrowed**: Comprehensive tracking for personal loans, credit cards, mortgages, and consumer financing.
- **Authoritative Monthly Rate Modeling**: Rates are entered and calculated primarily per month (e.g. 1% / month, 1.5% / month), matching standard Philippine lending conventions.
- **Diminishing-Balance & Flat/Add-on Calculations**: Supports both diminishing balance (interest computed on remaining principal balance) and flat add-on loans.
- **Interactive Snowball & Avalanche Simulator**: Models payoff timelines, extra monthly allocations, lump-sum early payments, same-month cash-flow rollovers, and unpayable debt/negative amortization detection.

> [!NOTE]
> **Planning Notice & Loan Caveat**: Avalanche strategy prioritizes debts by highest stated monthly interest rate. Flat/add-on and diminishing-balance debts with identical stated monthly rates do not represent identical economic borrowing costs. Bantay Barya's simulator is an educational planning tool and is not a substitute for an official lender amortization schedule.

### 5. 🛡️ Spending Buffer Runway (FIFO Financial Runway)
- **FIFO Cash Runway Metric**: Measures how many days of cash runway your account has based on chronological inflow tranches, providing a clear visual indicator of financial buffer and runway.

### 6. 💾 Save Vault & Multi-Slot Profiles
- **Instant Snapshots & `.barya` Backups**: Export and import complete budget profiles in 1 click using portable `.barya` archives.
- **Multiple Save Profiles**: Switch between Personal, Freelance, Vacation, or Business budgets seamlessly.

### 7. 🧩 Browser Extension (Manifest V3)
- Dedicated Chrome/Edge browser extension located in `extension/` for logging expenses on the fly while shopping or paying bills online.

### 8. 📱 Progressive Web App (PWA)
- **100% Client-Side**: No Bantay Barya database or application backend.
- **Installable**: Runs as a standalone app on supported desktop and mobile browsers.
- **Network-First Delivery**: Prefers updated application logic and modules when online so users receive the newest financial engine immediately.
- **Offline Fallback**: Cached application assets provide full offline ledger access when the network is unavailable.
- **Modular Pre-caching**: Required local application assets are cached separately from optional external resources.
- **Selective Cache Eviction**: Purges only versioned Bantay-Barya caches upon version upgrade, preserving unrelated origin caches.

---

## 🚀 Getting Started

### Option 1: Direct Browser Launch
Simply open [`index.html`](index.html) in any modern web browser (Chrome, Edge, Safari, Firefox, Brave). No web server, Node.js, or backend build step is required!

### Option 2: Local & Cloud Storage Backups
1. Clone or download this repository to your local drive or cloud-synced folder (such as Google Drive, OneDrive, or Dropbox).
2. Launch `index.html` in your browser.
3. Use the `.barya` export/import feature to transfer or synchronize financial records across different computers or browser profiles.

> [!IMPORTANT]
> **Browser Storage Note**: Browser `localStorage` is isolated to the specific browser and profile on each device. Storing `index.html` in a synced folder does not automatically sync browser `localStorage`. Use `.barya` file backups to move data between machines.

### Option 3: Install Browser Extension
1. Navigate to `chrome://extensions` or `edge://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the [`extension/`](extension/) directory.

---

## 🔒 Privacy & Data Sovereignty

- **Local Storage**: All financial transactions, balances, debts, and bills are stored 100% locally in your browser's `localStorage` and portable `.barya` files.
- **No Backend Database**: Bantay Barya operates without a central server or application database. Locally stored financial records are not uploaded to a Bantay Barya backend.
- **External FX Queries**: When multi-currency conversions are requested, public FX APIs (e.g. Frankfurter, Open Exchange Rates) are queried for exchange rate data.

> [!WARNING]
> **Backup Recommendation**: Browser local storage can be cleared by privacy extensions, browser clearing actions, or OS disk maintenance tools. Regularly export `.barya` backups from the Settings menu to protect your financial records.

---

## 🧪 Deterministic Regression Tests

Bantay Barya includes an automated deterministic test suite covering core accounting and application logic:

- **Debt & Amortization Engine**: Authoritative monthly rate math, diminishing vs flat interest, Snowball vs Avalanche priority, extra payment rollover invariants, lump-sum advance payoffs, and negative amortization detection.
- **Bill Scheduling & Calendar Dates**: Local calendar math (UTC+8 Asia/Manila boundary safety), anchor day preservation across month lengths (Jan 31 → Feb 28/29 → Mar 31), leap-year sequences, due distance calculations, and paid KPI aggregation.
- **Multi-Wallet & Core Ledger Engine**: Inter-wallet transfers (net worth conservation), FX conversions, chronological running balance integrity, FIFO spending buffer runway, `.barya` serialization, and legacy V6 data migration compatibility.
- **Service Worker & Offline Resilience**: Atomic required precache verification, resilient optional CDN asset handling, selective cache eviction, and offline network-first fallback.
- **Application Versioning**: Canonical version synchronization between `package.json`, `version.js`, and `sw.js` cache name derivation.

### Running Tests

```bash
npm test
```

Individual test suites can also be run:

```bash
npm run test:version   # Version synchronization & release safety
npm run test:debts     # Debt engine & amortization simulator
npm run test:bills     # Bill scheduling, calendar math & recurrence
npm run test:sw        # Service Worker precaching & offline fallbacks
npm run test:core      # Wallets, FX, running balances & .barya vault
```

> [!NOTE]
> Deterministic tests verify that internal code calculations and invariants match specified cases; they do not guarantee that real-world financial agreements follow identical rules.

---

## 📦 Application Versioning & Release Workflow

`package.json` serves as the single canonical source of truth for the application version.

```
package.json
    ↓ (npm run sync-version)
scripts/sync-version.js
    ↓
version.js (globalThis.BANTAY_BARYA_VERSION)
    ↓
sw.js (CACHE_NAME: bantay-barya-v...) & Browser Runtime
```

### Release Workflow
1. Update `"version"` in `package.json` (e.g. `"2.9.1"`).
2. Run the version generator:
   ```bash
   npm run sync-version
   ```
3. Run the test suite to verify synchronization:
   ```bash
   npm test
   ```
4. Commit `package.json` and generated `version.js` together.

`npm test` independently verifies that `version.js` matches `package.json` without automatically modifying files, ensuring version drift is caught.

---

## 📂 Project Structure

```
Bantay-Barya/
├── index.html              # Main Application Interface & Modals
├── styles.css              # Responsive Design System & Theme Engine
├── app.js                  # Ledger Engine, FX Conversion & State Management
├── version.js              # Auto-generated runtime version constant
├── package.json            # Canonical version & npm test scripts
├── scripts/
│   └── sync-version.js     # Version synchronization generator
├── modules/                # Modularized Engine Components
│   ├── data.js             # Constants, FX rates, currency formatting & defaults
│   ├── theme.js            # Seasonal theme engine, PIN security & hero charts
│   ├── wallets.js          # Multi-wallet CRUD, FIFO Spending Buffer & .barya Save Vault
│   ├── debts.js            # Liabilities manager & Debt Snowball/Avalanche simulator
│   ├── bills.js            # Bill payment schedules, recurrence & due alerts
│   └── reports.js          # Category expense report, Balance Sheet & CSV/TSV/JSON export
├── tests/                  # Deterministic Automated Test Suites
│   ├── version.test.js     # Version synchronization & release safety tests
│   ├── debts.test.js       # Debt amortization & interest strategy tests
│   ├── bills_date.test.js  # Bill recurrence & calendar math tests
│   ├── sw_upgrade.test.js  # Service Worker upgrade & offline tests
│   └── core_engine.test.js # Wallets, FX, running balances & .barya tests
├── sw.js                   # Service Worker with Network-First application strategy
├── manifest.json           # PWA Web App Manifest
├── extension/              # Chrome / Edge Browser Extension (Manifest V3)
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.css
│   ├── popup.js
│   ├── background.js
│   ├── icon.svg
│   └── README.md
├── icons/                  # App Icons & Favicons
└── README.md               # Project Documentation
```

---

## ⚖️ Financial Disclaimer

Bantay Barya is an independent personal finance tracking and planning utility. It is not an official banking application or financial advisory service. Actual bank and lender computations may differ due to daily average balance methods, compounding conventions, billing cutoff dates, late fees, finance charge minimums, payment posting order, rounding rules, early settlement rebates, and specific contract terms. Always consult your official lender statements, bank records, and loan contracts for binding financial decisions.

---

## 👤 Credits & Attribution

Designed and product-directed by **[Jerome Gotangco](https://github.com/jgotangco)**. Developed with **Google Antigravity / Gemini**.

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
