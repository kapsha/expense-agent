import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { supervise } from "../agents/supervisor.js";
import type { ExtractorOutput } from "../agents/extractor.js";
import type { ClassifierInput, ClassifierOutput } from "../agents/classifier.js";
import type { AdvisorInput, AdvisorOutput } from "../agents/advisor.js";

function tempPaths() {
  const dir = tmpdir();
  const budgetsPath = join(dir, `budgets-${Date.now()}.json`);
  const expensesPath = join(dir, `expenses-${Date.now()}.json`);
  writeFileSync(
    budgetsPath,
    JSON.stringify({ groceries: 10000, food: 8000, other: 3000 })
  );
  writeFileSync(expensesPath, JSON.stringify([]));
  return { budgetsPath, expensesPath };
}

const mockExtracted: ExtractorOutput = {
  merchant: "DMart",
  amount: 640,
  currency: "INR",
  amountInr: 640,
  date: "2026-09-14",
  paymentMode: "card",
  lineItems: [{ description: "Rice 5kg", amount: 640 }],
  usage: { inputTokens: 100, outputTokens: 20 },
};

const mockClassified: ClassifierOutput = {
  category: "groceries",
  usage: { inputTokens: 50, outputTokens: 5 },
};

const mockAdvised: AdvisorOutput = {
  budgetStatus: "under",
  recommendations: [],
  usage: { inputTokens: 0, outputTokens: 0 },
};

function makeDeps(overrides: Partial<{
  extracted: ExtractorOutput;
  classified: ClassifierOutput;
  advised: AdvisorOutput;
}> = {}) {
  const paths = tempPaths();
  return {
    ...paths,
    extractFn: async (_: Buffer) => overrides.extracted ?? mockExtracted,
    classifyFn: async (_: ClassifierInput) => overrides.classified ?? mockClassified,
    adviseFn: async (_: AdvisorInput) => overrides.advised ?? mockAdvised,
  };
}

describe("supervise", () => {
  it("returns a valid ReceiptResult on happy path", async () => {
    const result = await supervise(Buffer.from("img"), makeDeps());

    expect(result.merchant).toBe("DMart");
    expect(result.category).toBe("groceries");
    expect(result.budgetStatus).toBe("under");
    expect(result.recommendations).toEqual([]);
  });

  it("appends expense record to expenses.json", async () => {
    const deps = makeDeps();
    await supervise(Buffer.from("img"), deps);

    const { readFileSync } = await import("node:fs");
    const expenses = JSON.parse(readFileSync(deps.expensesPath, "utf-8"));
    expect(expenses).toHaveLength(1);
    expect(expenses[0].merchant).toBe("DMart");
    expect(expenses[0].amountInr).toBe(640);
    expect(expenses[0].category).toBe("groceries");
  });

  it("accumulates month-to-date spend from prior expenses", async () => {
    const deps = makeDeps();
    const { writeFileSync } = await import("node:fs");
    writeFileSync(
      deps.expensesPath,
      JSON.stringify([
        { date: "2026-09-10", merchant: "BigBazaar", category: "groceries", amountInr: 8000 },
      ])
    );

    let capturedAdvisorInput: AdvisorInput | undefined;
    const result = await supervise(Buffer.from("img"), {
      ...deps,
      adviseFn: async (input) => {
        capturedAdvisorInput = input;
        return { budgetStatus: "warning", recommendations: ["Reduce spending"], usage: { inputTokens: 10, outputTokens: 5 } };
      },
    });

    expect(capturedAdvisorInput?.monthToDateSpend).toBe(8640); // 8000 + 640
    expect(result.budgetStatus).toBe("warning");
  });

  it("aggregates usage and computes costUsd", async () => {
    const deps = makeDeps({
      extracted: { ...mockExtracted, usage: { inputTokens: 1000, outputTokens: 200 } },
      classified: { ...mockClassified, usage: { inputTokens: 500, outputTokens: 50 } },
      advised: { ...mockAdvised, usage: { inputTokens: 300, outputTokens: 100 } },
    });

    const result = await supervise(Buffer.from("img"), deps);

    expect(result.usage.inputTokens).toBe(1800);
    expect(result.usage.outputTokens).toBe(350);
    // Haiku: (1000*1 + 200*5)/1M + (500*1 + 50*5)/1M = 0.002 + 0.00075 = 0.00275
    // Sonnet: (300*3 + 100*15)/1M = 0.0024
    expect(result.usage.costUsd).toBeCloseTo(0.00515, 6);
  });

  it("includes recommendations when advisor returns them", async () => {
    const deps = makeDeps({
      advised: {
        budgetStatus: "over",
        recommendations: ["Buy less", "Switch store"],
        usage: { inputTokens: 20, outputTokens: 10 },
      },
    });

    const result = await supervise(Buffer.from("img"), deps);
    expect(result.recommendations).toEqual(["Buy less", "Switch store"]);
  });

  it("throws if result fails ReceiptResult validation", async () => {
    const deps = makeDeps({
      extracted: { ...mockExtracted, currency: "INVALID" as any },
    });

    await expect(supervise(Buffer.from("img"), deps)).rejects.toThrow();
  });
});
