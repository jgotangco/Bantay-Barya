# 👛 Bantay Barya — Complete User Manual & Documentation
*A Local-First, Multi-Wallet Continuous Income & Expense Tracker for Personal Financial Resilience*

---

## 📑 Table of Contents

1. [Introduction & Core Philosophy](#1-introduction--core-philosophy)
2. [Visual Direction & Design System](#2-visual-direction--design-system)
3. [Quick Start & Onboarding](#3-quick-start--onboarding)
   - [Welcome Dialog & Saved Ledger Detection](#welcome-dialog--saved-ledger-detection)
   - [Active Ledger Overwrite Safeguard](#active-ledger-overwrite-safeguard)
4. [Multi-Wallet Architecture & Multi-Currency Engine](#4-multi-wallet-architecture--multi-currency-engine)
   - [Wallet Types & Currencies](#wallet-types--currencies)
   - [Zero-Expense Inter-Wallet Transfers](#zero-expense-inter-wallet-transfers)
   - [Safe Wallet Deletion & Balance Reallocation](#safe-wallet-deletion--balance-reallocation)
   - [Live Multi-Currency FX Conversion](#live-multi-currency-fx-conversion)
5. [Continuous Transaction Logging & Ledger Operations](#5-continuous-transaction-logging--ledger-operations)
   - [Recording Income (Credit) & Expenses (Debit)](#recording-income-credit--expenses-debit)
   - [Category Management & Datalist Autofill](#category-management--datalist-autofill)
   - [Filtering, Searching & Multi-Column Sorting](#filtering-searching--multi-column-sorting)
   - [Editing & Deleting Entries](#editing--deleting-entries)
6. [Balance Reconciliation Workflow (🤝 Two Hands Shaking)](#6-balance-reconciliation-workflow--two-hands-shaking)
7. [Spending Buffer Habit (Rule 4 Financial Runway)](#7-spending-buffer-habit-rule-4-financial-runway)
8. [Debt Payoff & Snowball/Avalanche Engine](#8-debt-payoff--snowballavalanche-engine)
   - [Adding Debts with Monthly & Effective Interest Rates (EIR)](#adding-debts-with-monthly--effective-interest-rates-eir)
   - [Snowball vs. Avalanche Payoff Strategies](#snowball-vs-avalanche-payoff-strategies)
   - [Extra Monthly Payments & 13th-Month Lump Sum Simulation](#extra-monthly-payments--13th-month-lump-sum-simulation)
9. [Recurring Bills & Subscriptions Calendar](#9-recurring-bills--subscriptions-calendar)
10. [Financial Reports & Statement of Financial Position (Balance Sheet)](#10-financial-reports--statement-of-financial-position-balance-sheet)
    - [Expense Category Breakdown Charts](#expense-category-breakdown-charts)
    - [Formal Accounting Balance Sheet](#formal-accounting-balance-sheet)
11. [Save Vault & Multi-Profile Ledger System (`.barya`)](#11-save-vault--multi-profile-ledger-system-barya)
12. [Security, PIN Lock & Privacy](#12-security-pin-lock--privacy)
13. [PWA Installation & Browser Extension Integration](#13-pwa-installation--browser-extension-integration)
14. [Philippine Financial Context & Best Practices](#14-philippine-financial-context--best-practices)
15. [Keyboard Shortcuts, FAQ & Troubleshooting](#15-keyboard-shortcuts-faq--troubleshooting)

---

## 1. Introduction & Core Philosophy

**Bantay Barya** (Filipino for *"Coin Sentinel"* or *"Guard of Every Cent"*) is an offline-capable, local-first single-page web application designed to help individuals and families achieve permanent financial stability and net worth growth.

### 🌟 Key Principles:
- **100% Client-Side Privacy**: All data is stored directly inside your browser's encrypted `localStorage`. No external database, no mandatory user accounts, and zero cloud tracking.
- **Zero-Dependency Portability**: Runs standalone on any modern browser (Chrome, Edge, Safari, Firefox) on desktop, tablet, and mobile.
- **Continuous Cash Flow Tracking**: Balances update automatically on every entry with immediate multi-wallet currency conversions.
- **Comprehensive Financial Health**: Tracks liquid cash, high-yield digital banks, debt liabilities, recurring bills, and true balance sheet equity.

---

## 2. Visual Direction & Design System

Bantay Barya utilizes the **Deep Teal / Fintech** saturated color palette (credited to [unslop.site](https://unslop.site/)):

- **Canvas Background**: `#07343e` (Deep Petrol Teal)
- **Surfaces & Cards**: `#052a33` / `#083b47`
- **Primary Accent & Inflows**: `#7be3a8` (Electric Spring Mint)
- **Expenses & Outflows**: `#ff7b92` (Rose Coral)
- **Secondary Highlights**: `#38bdf8` (Cyan) & `#1a7a8e` (Mid Teal)
- **Typography**: 
  - *Inter Tight* (Structured geometric fintech headings & UI text)
  - *Plus Jakarta Sans* (Body readability)
  - *JetBrains Mono* (Tabular numbers, financial balances, and day counters)

---

## 3. Quick Start & Onboarding

### Welcome Dialog & Saved Ledger Detection
When you launch the app, the **Welcome Dialog** opens:
1. **Active Saved Ledger Card**: If you already have existing data, the app detects it and presents your converted net balance, wallet count, transaction count, and a dynamic relative timestamp (*"Saved 2m ago (Aug 17, 2026, 9:40 PM)"*). Click **▶️ Load Latest Saved Ledger** to jump straight in.
2. **Start Fresh**: Creates a clean slate with a default Personal Spending wallet.
3. **Try Sample Data**: Pre-loads realistic Philippine financial profiles (BPI checking, Maya savings, GCash, Wise USD, RTB treasury bonds, Meralco/PLDT bills, and mortgage/auto/credit card loans).
4. **Restore Backup**: Imports a `.json` or `.barya` file.

### Active Ledger Overwrite Safeguard
To prevent accidental data loss, any action that could overwrite an active ledger (such as clicking *Start Fresh*, *Try Sample Data*, or *Restore Backup*) triggers a dedicated **Safeguard Modal**:
- Summarizes the active ledger to be overwritten.
- Provides a **💾 Download Backup First (.barya)** button so you never lose your records.
- Requires explicit confirmation before replacing existing data.

---

## 4. Multi-Wallet Architecture & Multi-Currency Engine

### Wallet Types & Currencies
Bantay Barya lets you isolate cash flows across different financial buckets:
- **E-Wallets (📱)**: GCash, Maya, GrabPay.
- **High-Yield Savings (🏦)**: Digital banks (Maya 6%, SeaBank, GoTyme, Tonik, CIMB, NetBank).
- **Checking / Current Accounts (🏛️)**: BPI, BDO, Metrobank, UnionBank (with PDC check tracking).
- **Cash on Hand (💵)**: Physical wallet money and envelope budgets.
- **Time Deposits & Treasury Bonds (📜)**: RTB-30, Retail Dollar Bonds, Pag-IBIG MP2.
- **Investment Portfolios (📈)**: PSE stocks, Global ETFs, Mutual Funds.
- **Crypto & Digital Assets (🪙)**: Cold storage, Bitcoin, Ethereum.

### Zero-Expense Inter-Wallet Transfers
Transferring funds between your accounts (e.g. moving ₱10,000 from BPI Checking to GCash) is **not an expense**.
1. Click **⇄ Transfer Money** on the top Wallets Bar.
2. Select the **Source Wallet** and **Destination Wallet**.
3. Enter the amount, date, and optional notes.
4. Bantay Barya records two linked transactions (`transfer_out` and `transfer_in`) that update both wallet balances without inflating your monthly expense reports or spending buffer!

### Safe Wallet Deletion & Balance Reallocation
You cannot accidentally delete a wallet that has an active balance:
1. If a wallet has a non-zero balance, the app prompts you to select a destination wallet to transfer the remaining balance.
2. Existing transactions belonging to that wallet are safely archived or reallocated to the destination wallet of your choice, ensuring your historical audit trail remains intact.

### Live Multi-Currency FX Conversion
- Supported currencies: **PHP (₱)**, **USD ($)**, **EUR (€)**, **JPY (¥)**, **GBP (£)**, **SGD (S$)**, **AUD (A$)**, **CAD (C$)**, **HKD (HK$)**, **CNY (¥)**, **KRW (₩)**, **THB (฿)**, and **AED (د.إ)**.
- Real-time exchange rates are fetched and cached locally with a live status indicator and manual override capability.

---

## 5. Continuous Transaction Logging & Ledger Operations

### Recording Income (Credit) & Expenses (Debit)
1. **Choose Type**: Select **Debit (Expense)** or **Credit (Income)** using the top pill switcher.
2. **Select Account / Wallet**: Choose the originating or receiving account.
3. **Date Picker & Quick Chips**: Choose any date or tap **Today** / **Yesterday** for 1-tap entry.
4. **Category / Description**: Choose from the categorized list or type a custom name.
5. **Amount**: Enter the amount; the real-time **Resulting Wallet Balance** preview updates as you type.
6. **Save**: Click **Record Transaction** (or press `Ctrl+Enter`).

### Filtering, Searching & Multi-Column Sorting
- **Instant Search**: Filter by item description, wallet name, notes, or specific numbers.
- **Filter Dropdowns**: Filter by specific wallet, entry type (All, Debits, Credits, Transfers), or timeframe (This Month, Last Month, This Year).
- **Sortable Columns**: Click any header (**Date**, **Wallet**, **Description**, **Debit**, **Credit**, **Running Balance**) to toggle ascending/descending order.

---

## 6. Balance Reconciliation Workflow (🤝 Two Hands Shaking)

*Reconciliation* guarantees your digital ledger matches the exact real-world balance of your bank account or physical cash.

1. Tap **🤝 Reconcile** on the Wallets Bar or in the balance card.
2. Select the wallet you want to reconcile.
3. Enter your **Actual Statement Balance** from your bank app or physical count.
4. The system calculates the discrepancy. If a difference exists, it automatically records a categorized `Balance Reconciliation` adjustment entry.

---

## 7. Spending Buffer Habit (Rule 4 Financial Runway)

The **Spending Buffer** measures how many days your cash reserves will last based on your average daily outflow rate (similar to the *Age of Money* rule):

$$\text{Spending Buffer (Days)} = \frac{\text{Total Liquid Converted Assets}}{\text{Average Daily Outflow (Last 30 Days)}}$$

- **🟢 Green (≥ 30 Days)**: Excellent financial buffer. You are spending money earned over a month ago, breaking the paycheck-to-paycheck cycle!
- **🟡 Yellow (15–29 Days)**: Moderate buffer. Build up your emergency reserves.
- **🔴 Red (< 15 Days)**: Urgent attention needed. Cut non-essential debit expenses and boost inflow.

---

## 8. Debt Payoff & Snowball/Avalanche Engine

Access **💳 Debts & Payoff** from the top header to manage all loans (Credit Cards, Home Mortgages, Auto Loans, Personal Loans, SSS/GSIS Salary Loans).

### Strategies:
1. **⛄ Debt Snowball**: Prioritizes loans with the smallest balance first for rapid psychological wins.
2. **⚡ Debt Avalanche**: Prioritizes loans with the highest **Effective Interest Rate (EIR %)** first to minimize overall interest paid.
3. **Lump Sum & 13th-Month Pay Acceleration**:
   - Use the slider to simulate extra monthly payments (e.g. +₱2,500/mo).
   - Enter a year-end bonus lump sum (e.g. ₱30,000) to see how many months or years you cut off your Debt-Free Date!

---

## 9. Recurring Bills & Subscriptions Calendar

Click **📅 Bills & Due Dates** to monitor recurring obligations:
- Set recurring frequencies: Monthly, Bi-monthly, Quarterly, Annually.
- Configure notification reminders (e.g. alert 3 days before due date).
- One-tap payment posting directly into your chosen wallet.

---

## 10. Financial Reports & Balance Sheet

Click **Reports** on the header:

### 1. Expense Breakdown Reports
- Dynamic **Doughnut**, **Pie**, and **Bar** visual charts.
- Detailed percentage breakdown and debit transaction frequencies by category.
- Filterable by wallet and date range (This Month, Last 30 Days, This Year, All Time).

### 2. Formal Accounting Balance Sheet
Enforces the fundamental accounting equation:

$$\text{Total Assets} = \text{Total Liabilities} + \text{Real Net Worth}$$

- **Assets Section**: Breaks down Liquid Cash, Digital Savings, Fixed Income/Bonds, and Portfolios.
- **Liabilities Section**: Overdrafts, Credit Cards, Mortgages, and Car Loans.
- **Equity Section**: Starting Capital + Cumulative Net Surplus + Reconciliation adjustments.
- **Print Friendly**: One-click print for personal loan applications, visa financial proof, or archive.

---

## 11. Save Vault & Multi-Profile Ledger System (`.barya`)

Click **💾 Save Vault** to manage multiple independent budget profiles:
- **Multiple Slots**: Keep separate profiles for *Personal Living*, *Side Hustle / Freelance*, *Family Budget*, or *What-If Simulations*.
- **Instant Snapshots**: Duplicate or archive a snapshot before major financial changes.
- **Portable `.barya` Files**: Export standalone archives that bundle all wallets, transactions, debts, bills, and settings into one encrypted JSON file.

---

## 12. Security, PIN Lock & Privacy

- **7-Digit PIN Protection**: Enable in Settings (⚙️). Locks the entire application upon startup or refresh with an on-screen keypad and physical numeric key listener.
- **100% Offline Storage**: Works seamlessly without an active internet connection.
- **No Cloud Trackers**: Your financial data never leaves your personal device.

---

## 13. PWA Installation & Browser Extension Integration

### Progressive Web App (PWA)
- **Desktop (Chrome/Edge)**: Click the Install icon in the address bar to install Bantay Barya as a standalone windowed desktop app.
- **iOS (iPhone/iPad)**: Open in Safari ➔ Tap **Share** ➔ **Add to Home Screen**.
- **Android**: Open in Chrome ➔ Tap **Menu (⋮)** ➔ **Install app** / **Add to Home Screen**.

### Browser Extension
- Located in the `/extension` directory of the repository.
- Allows logging expenses directly from shopping sites (Shopee, Lazada, Amazon, food delivery) with a single click without opening the main app!

---

## 14. Philippine Financial Context & Best Practices

1. **The 3-to-6 Months Emergency Fund**: Keep liquid cash in high-yield digital banks (Maya, SeaBank, GoTyme) earning 4%–6% p.a.
2. **The 13th-Month Pay 50/30/20 Strategy**:
   - **50%**: Debt Paydown / Lump Sum Advance on high-rate loans.
   - **30%**: Emergency Fund & MP2 / Treasury Bond savings.
   - **20%**: Holiday celebrations, family gifts, and personal rewards.
3. **Beware the "Monthly Add-on" Rate Trap**: Lenders advertise "1% monthly add-on rate", but the actual **Effective Interest Rate (EIR)** is almost double (~21%–24% p.a.). Always check the Truth in Lending disclosure statement.
4. **Credit Card Discipline**: Always pay 100% of your statement balance to avoid compounding finance charges (BSP capped at 3.0%/mo | 36% EIR).

---

## 15. Keyboard Shortcuts, FAQ & Troubleshooting

### Keyboard Shortcuts:
| Shortcut | Action |
|---|---|
| `Ctrl + Enter` (or `Cmd + Enter`) | Save & Record Transaction |
| `Escape` | Close any open modal dialog |
| `Tab` / `Shift + Tab` | Navigate form inputs |

### FAQ & Troubleshooting:

**Q: Where is my data saved?**  
A: In your browser's local storage. To back it up, go to *Save Vault* (💾) and click **Export All Slots (.barya)**.

**Q: Can I use Bantay Barya on multiple computers?**  
A: Yes! Export your `.barya` file to Google Drive, Dropbox, or a USB drive, and load it on any other device.

**Q: What happens if I forget my 7-digit PIN?**  
A: Because Bantay Barya is local-first, the PIN is stored in your browser storage. If forgotten, clearing browser data for the site resets the PIN (be sure you have your `.barya` backup handy).

---

*Bantay Barya • Built by Jerome Gotangco (<jeromesg@google.com>) with [Google Antigravity](https://antigravity.google/). Visual direction credited to [unslop.site](https://unslop.site/).*
