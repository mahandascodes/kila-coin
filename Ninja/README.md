# Budgetly — Personal & Business Money Tracker (Kenya)

A simple, offline-first budgeting and M-Pesa spending tracker for Kenyan households and small businesses.

**No build step. No dependencies. Plain HTML + CSS + JS.**

## Features

-   **Two ledgers** — separate Personal (household) and Business budgets, each with its own income, categories, transactions and goals.
-   **Kenyan Shillings (KSh)** throughout.
-   **M-Pesa SMS import** — paste one or many confirmation SMS; the app extracts amount, direction (in/out), merchant/sender, date and M-Pesa code, auto-categorizes by Kenyan merchant keywords, and skips duplicates by transaction code.
-   **Editable dashboard** — tap income or any category name/budget to edit inline; saves instantly.
-   **Transactions** — manual add plus imported, filterable by income/expense, with month-by-month history.
-   **Savings goals** — targets, deadlines, progress bars.
-   **Insights** — budget usage, spending pace vs. the month, over-budget categories, biggest spend, goal progress.
-   **Installable PWA** — manifest + service worker, works offline, Add to Home Screen.
-   **Local-first** — all data stays on the device in `localStorage`. No server, no accounts, no tracking.

## Run locally

Any static server works:

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

Opening `index.html` directly via `file://` mostly works, but the service worker and manifest require `http://` or `https://`.

## Deploy

Drop the folder on GitHub Pages, Netlify, Vercel, Cloudflare Pages — anything static. No config needed.

For GitHub Pages: push these files to a repo, then Settings → Pages → deploy from branch → root.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Markup and layout |
| `styles.css` | All styling, responsive + mobile |
| `app.js` | Data model, state, rendering, M-Pesa parser |
| `manifest.webmanifest` | PWA metadata (name, icons, theme) |
| `sw.js` | Service worker (network-first, offline fallback) |
| `icon-192.png`, `icon-512.png` | App icons |

## Data model

Stored under the `budgetly.v2` localStorage key:

```js
{
  version: 2,
  active: 'personal' | 'business',
  month: 'YYYY-MM',
  ledgers: {
    personal: { income, categories[], transactions[], goals[] },
    business: { income, categories[], transactions[], goals[] }
  }
}
```

Transaction shape: `{ id, type: 'income'|'expense', amount, category, merchant, date: 'YYYY-MM-DD', source: 'manual'|'mpesa'|'sample', code }`

## M-Pesa parser

`parseMessage()` in `app.js` handles the common Safaricom confirmation formats:

-   `QGH4XYZ12 Confirmed. Ksh1,250.00 paid to NAIVAS SUPERMARKET. on 12/5/24 at 3:45 PM...`
-   `... Ksh2,000.00 sent to JOHN KAMAU 0712345678 on 13/5/24 ...`
-   `... Withdraw Ksh3,000.00 from AGENT 456789 ...`
-   `... You have received Ksh5,500.00 from JANE WANJIKU 0723456789 on 15/5/24 ...`

It is also hardened against the messy spacing Safaricom actually sends:

-   `... at 10:00 AM.New M-PESA balance ...` (no space after the full stop)
-   `UK2690GUXZ Confirmed.You have received Ksh600.00 from ZIIDI ...` (no space after `Confirmed.`)
-   `... sent to Timothy Mbugua 0727314376 on 2/11/26 ...` (double spaces, no full stop before `on`)
-   `... sent to justin mutwiri on ...` (all-lowercase names are title-cased)
-   `... on 2/11/26 9:34 AM ...` (no `at` before the time)
-   Many messages pasted at once, separated by `/` — split by transaction code, not by punctuation.

Categorization rules live in the `CAT_RULES` array — add a `{ re, cat }` entry to teach it new merchants. Money received from **ZIIDI** (or any MMF / SACCO / unit trust) is categorized as **Savings** rather than income, since it is your own money moving into a money-market fund.

Note: the parser deliberately ignores the `Transaction cost, Ksh0.00` boilerplate when categorizing — otherwise every single message would be filed under "Fees & Charges".

## Known limitation

A browser **cannot** read the phone's SMS inbox — that requires a native Android app with `READ_SMS` permission. The current flow is copy → paste → auto-parse. A native Android wrapper is the path to fully automatic capture.

## Roadmap ideas

-   Editable auto-categorization rules in the UI
-   Recurring bills with due dates and paid checkboxes
-   Debt / loan tracking
-   CSV export and printable monthly summary
-   Carry-over budgets between months
-   Dark mode
-   Native Android wrapper with SMS auto-read