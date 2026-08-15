# 🪙 Bantay Barya - Multi-Wallet Expense Tracker

> A modern, private, fast, and standalone Personal Financial Ledger with Continuous Running Balance, Multi-Wallet Tracking, Live Online Currency Exchange Rates (Default PHP ₱), Bill Scheduler, Debt Snowball/Avalanche Planner, Save Vault, and Browser Extension.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-v2.9.0-emerald.svg)](index.html)
[![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20PWA%20%7C%20Chrome%20Extension-purple.svg)](manifest.json)

---

## 🌟 Key Features

### 1. 👛 Multi-Wallet Continuous Ledger
- **Running Balance Tracking**: Continuous accounting ledger recalculates balances instantly across all wallets (*GCash, Maya, BPI, Physical Cash, Crypto, High-Yield Savings, Time Deposits, Stocks*).
- **Projected Balance Previews**: Live balance preview as you type inflow/outflow amounts.
- **5-Field Transaction Entry**: Date, Expense Item / Classification, Credit (+), Debit (-), Running Balance, and Notes.

### 2. 💱 Multi-Currency & Live Online FX Rates
- **Philippine Peso (PHP ₱) Base**: Configurable base currency with automatic live exchange rate fetching from public FX APIs for multi-currency transactions (USD, EUR, JPY, GBP, SGD, CAD, AUD, etc.).
- **Live & Historical FX Rates**: Supports custom date-based exchange rates and manual override.

### 3. 📅 Bill Tracker & Recurring Payment Schedules
- **Recurring & One-Time Bills**: Set weekly, bi-weekly, monthly, quarterly, semi-annual, or annual billing cycles.
- **Glowing Header Due Alerts**: Dynamic pulsing header indicators when bills are overdue (🔴 Red) or due soon (🟡 Amber).
- **1-Click Ledger Settlement**: Mark bills as paid and auto-post the debit transaction to your ledger.

### 4. 💳 Debt & Loan (Utang / Pautang) Manager
- **Money Lent & Borrowed**: Comprehensive tracking for personal loans, credit cards, mortgages, and auto loans.
- **Interactive Snowball & Avalanche Simulator**: Calculate payoff dates, monthly interest savings, and step-by-step debt freedom timelines.

### 5. 🛡️ Spending Buffer Runway
- **FIFO Financial Runway Metric**: Measures how many days of cash runway your account has, tracking financial independence and emergency preparedness.

### 6. 💾 Save Vault & Multi-Slot Profiles
- **Instant Snapshots & `.barya` Backups**: Export and import complete budget profiles in 1 click.
- **Multiple Save Profiles**: Switch between Personal, Freelance, Vacation, or Business budgets seamlessly.

### 7. 🧩 Browser Extension (Manifest V3)
- Dedicated Chrome/Edge browser extension located in `extension/` for logging expenses on the fly while shopping or paying bills online.

### 8. 📱 Progressive Web App (PWA) & Offline First
- 100% client-side with zero external database dependencies.
- Installable on desktop (Chrome, Edge) and mobile home screens (iOS Safari, Android Chrome).
- Offline capable via Service Worker.

---

## 🚀 Getting Started

### Option 1: Direct Browser Launch
Simply open [`index.html`](index.html) in any web browser (Chrome, Edge, Safari, Firefox, Brave). No web server, Node.js, or backend build step is required!

### Option 2: Run with Google Drive for Desktop
1. Copy or clone this folder into your Google Drive folder (`G:\My Drive\Bantay-Barya\`).
2. Double-click `index.html` to run the app with automatic cloud synchronization across your computers.

### Option 3: Install Browser Extension
1. Navigate to `chrome://extensions` or `edge://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the [`extension/`](extension/) directory.

---

## 📂 Project Structure

```
Bantay-Barya/
├── index.html        # Main Application Interface & Modals
├── styles.css        # Responsive Design System & Theme Engine
├── app.js            # Ledger Engine, FX Conversion & State Management
├── modules/          # Modularized Engine Components
│   ├── data.js       # Constants, FX rates, currency formatting & defaults
│   ├── theme.js      # Seasonal theme engine, PIN security & hero charts
│   ├── wallets.js    # Multi-wallet CRUD, FIFO Spending Buffer & .barya Save Vault
│   ├── debts.js      # Liabilities manager & Debt Snowball/Avalanche simulator
│   ├── bills.js      # Bill payment schedules, recurrence & due alerts
│   └── reports.js    # Category expense report, Balance Sheet & CSV/TSV/JSON export
├── manifest.json     # PWA Web App Manifest
├── sw.js             # Service Worker for Offline Caching
├── extension/        # Chrome / Edge Browser Extension (Manifest V3)
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.css
│   ├── popup.js
│   ├── background.js
│   ├── icon.svg
│   └── README.md
├── icons/            # App Icons & Favicons
└── README.md         # Project Documentation
```

---

## 🔒 Privacy & Data Sovereignty
All financial data is stored **100% locally** in your browser's `localStorage` and optional `.barya` snapshot files. None of your financial records, balances, or transactions are ever sent to a remote server.

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
