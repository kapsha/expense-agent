# Expense Agent — Agent Standards

## Hard rules

- Every supervisor response MUST validate against `ReceiptResult` in `server/contract.ts`. Invalid → HTTP 500, never a partial result.
- Never edit files under `evals/fixtures/`. Fix the code or prompt, not the ground truth.
- Never write PII values to logs.
- Subagents return JSON only, no prose.
- Extractor and Classifier never receive budget data. Advisor never receives the raw image.

## Domain language

Use the terms defined in `CONTEXT.md`. Key ones: Receipt, Merchant, LineItem, PaymentMode, Category, Expense, Budget, BudgetStatus, Recommendation, Usage, Supervisor, Extractor, Classifier, Advisor.

## Models

- Extractor: `claude-haiku-4-5-20251001`
- Classifier: `claude-haiku-4-5-20251001`
- Advisor: `claude-sonnet-4-6`

## Currency

Default currency is INR. Foreign receipts: store original `amount` + `currency`, compute `amountInr` at 1 USD = ₹95.

## BudgetStatus logic

- `under`: month-to-date spend < 80% of budget
- `warning`: ≥ 80% and < 100%
- `over`: ≥ 100%

Recommendations: 1–3 items, merchant-aware, only when status is `warning` or `over`.

## Tracker conventions

- Intent issue: title `Intent: <project>`, label `intent`
- Spec issue: title `Spec: <project>`, label `spec`, sub-issue of the Intent
- Tickets: label `ticket`, sub-issues of the Spec, `Blocked by #n` in the body; `ready-for-agent` if unblocked, else `blocked`
- Gate passed → add the `approved` label
