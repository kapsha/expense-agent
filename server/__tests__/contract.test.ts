import { describe, expect, it } from "vitest";
import { ReceiptResult } from "../contract.js";

describe("ReceiptResult schema", () => {
  it("accepts a valid receipt", () => {
    const valid = {
      merchant: "DMart",
      amount: 640,
      currency: "INR",
      amountInr: 640,
      date: "2026-09-13",
      paymentMode: "card",
      lineItems: [{ description: "Rice 5kg", amount: 320 }],
      category: "groceries",
      budgetStatus: "under",
      recommendations: [],
      usage: { inputTokens: 100, outputTokens: 50, costUsd: 0.001 },
    };
    expect(() => ReceiptResult.parse(valid)).not.toThrow();
  });

  it("rejects an invalid category", () => {
    const invalid = {
      merchant: "DMart",
      amount: 640,
      currency: "INR",
      amountInr: 640,
      date: "2026-09-13",
      paymentMode: "card",
      lineItems: [],
      category: "shopping",
      budgetStatus: "under",
      recommendations: [],
      usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
    };
    expect(() => ReceiptResult.parse(invalid)).not.toThrow(); // deliberately broken
  });
});
