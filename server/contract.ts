import { z } from "zod";

export const PaymentMode = z.enum([
  "cash", "card", "upi", "wallet", "netbanking", "unknown",
]);

export const Category = z.enum([
  "food", "entertainment", "fuel", "transport", "utility",
  "medical", "groceries", "other",
]);

export const BudgetStatus = z.enum(["under", "warning", "over"]);

export const LineItem = z.object({
  description: z.string(),
  amount: z.number().nonnegative(),
});

export const ReceiptResult = z.object({
  merchant: z.string(),
  amount: z.number().nonnegative(),
  currency: z.string().length(3),
  amountInr: z.number().nonnegative(),
  date: z.string(),
  paymentMode: PaymentMode,
  lineItems: z.array(LineItem),
  category: Category,
  budgetStatus: BudgetStatus,
  recommendations: z.array(z.string()),
  usage: z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    costUsd: z.number().nonnegative(),
  }),
});

export type ReceiptResult = z.infer<typeof ReceiptResult>;
export type Category = z.infer<typeof Category>;
export type PaymentMode = z.infer<typeof PaymentMode>;
export type BudgetStatus = z.infer<typeof BudgetStatus>;
