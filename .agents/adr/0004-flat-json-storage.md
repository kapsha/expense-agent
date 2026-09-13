# Flat JSON files over a database

Expenses are appended to `expenses.json` and budgets live in `budgets.json`. A database (SQLite, Postgres) would be the natural choice for a production app but introduces setup, migrations, and schema management that distract from the demo's focus — the agent pipeline and governance gates. Flat JSON requires zero setup, is human-readable at a glance, and is sufficient for a single-user local demo with a small number of records. The date field on every Expense record means the data is queryable later if a database becomes necessary.
