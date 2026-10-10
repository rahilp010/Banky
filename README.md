# Banky

Banky is a React Native personal finance app for tracking income, expenses, and
savings on-device.

## Features

- Dashboard with available balance, monthly income/expense/savings totals, and
  recent activity.
- Monthly expense breakdown and daily spending charts.
- Persistent monthly spending budgets with remaining and over-budget progress.
- Quick entry for deposits, salary, fuel, dining, savings, and other expenses.
- Searchable transaction history with category and date filters, plus edit and
  delete actions.
- Light and dark themes, local database backup, and reminder notifications.

Transactions and budgets are stored locally in SQLite. Database backups can be
exported or restored from Settings.

## Getting started

Install the project dependencies:

```sh
npm install
```

Start the Metro bundler:

```sh
npm start
```

In a second terminal, run the app on a configured Android emulator or device:

```sh
npm run android
```

For iOS, open the project in Xcode after completing the React Native iOS
environment setup, then run:

```sh
npm run ios
```
