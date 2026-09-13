# Expense Schema

When producing expense JSON for this project, conform to the `ReceiptResult` schema in `server/contract.ts`.

## Category taxonomy

`food` · `entertainment` · `fuel` · `transport` · `utility` · `medical` · `groceries` · `other`

## PaymentMode values

`cash` · `card` · `upi` · `wallet` · `netbanking` · `unknown`

## BudgetStatus values

`under` (< 80%) · `warning` (≥ 80%) · `over` (≥ 100%)

## Worked examples

**Fuel receipt**

Input: merchant "HP Petrol Station", line items [{ "Petrol 10L": 1050 }], payment "UPI"

Expected JSON:
```json
{
  "merchant": "HP Petrol Station",
  "amount": 1050,
  "currency": "INR",
  "amountInr": 1050,
  "date": "2026-09-10",
  "paymentMode": "upi",
  "lineItems": [{ "description": "Petrol 10L", "amount": 1050 }],
  "category": "fuel"
}
```

**Grocery receipt**

Input: merchant "DMart", line items [{ "Rice 5kg": 320 }, { "Dal 1kg": 140 }, { "Oil 1L": 180 }], payment "card"

Expected JSON:
```json
{
  "merchant": "DMart",
  "amount": 640,
  "currency": "INR",
  "amountInr": 640,
  "date": "2026-09-11",
  "paymentMode": "card",
  "lineItems": [
    { "description": "Rice 5kg", "amount": 320 },
    { "description": "Dal 1kg", "amount": 140 },
    { "description": "Oil 1L", "amount": 180 }
  ],
  "category": "groceries"
}
```
