import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ReceiptResult } from "../contract.js";
import { extract, type ExtractorOutput } from "./extractor.js";
import { classify, type ClassifierInput, type ClassifierOutput } from "./classifier.js";
import { advise, type AdvisorInput, type AdvisorOutput } from "./advisor.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_BUDGETS_PATH = join(__dirname, "..", "budgets.json");
const DEFAULT_EXPENSES_PATH = join(__dirname, "..", "expenses.json");

const HAIKU_RATES = { input: 1.0, output: 5.0 };
const SONNET_RATES = { input: 3.0, output: 15.0 };

type ExpenseRecord = {
  date: string;
  merchant: string;
  category: string;
  amountInr: number;
};

type Deps = {
  budgetsPath?: string;
  expensesPath?: string;
  extractFn?: (buf: Buffer) => Promise<ExtractorOutput>;
  classifyFn?: (input: ClassifierInput) => Promise<ClassifierOutput>;
  adviseFn?: (input: AdvisorInput) => Promise<AdvisorOutput>;
};

function tokenCost(inputTokens: number, outputTokens: number, rates: typeof HAIKU_RATES): number {
  return (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
}

function monthToDateSpend(expenses: ExpenseRecord[], category: string, date: string): number {
  const yearMonth = date.slice(0, 7);
  return expenses
    .filter((e) => e.category === category && e.date.startsWith(yearMonth))
    .reduce((sum, e) => sum + e.amountInr, 0);
}

export async function supervise(imageBuffer: Buffer, deps: Deps = {}): Promise<ReceiptResult> {
  const budgetsPath = deps.budgetsPath ?? DEFAULT_BUDGETS_PATH;
  const expensesPath = deps.expensesPath ?? DEFAULT_EXPENSES_PATH;
  const extractFn = deps.extractFn ?? extract;
  const classifyFn = deps.classifyFn ?? classify;
  const adviseFn = deps.adviseFn ?? advise;

  const extracted = await extractFn(imageBuffer);

  const classified = await classifyFn({
    merchant: extracted.merchant,
    lineItems: extracted.lineItems,
  });

  const budgets: Record<string, number> = JSON.parse(readFileSync(budgetsPath, "utf-8"));
  const expenses: ExpenseRecord[] = JSON.parse(readFileSync(expensesPath, "utf-8"));

  const budget = budgets[classified.category] ?? 0;
  const prevSpend = monthToDateSpend(expenses, classified.category, extracted.date);
  const monthToDate = prevSpend + extracted.amountInr;

  const advised = await adviseFn({
    merchant: extracted.merchant,
    category: classified.category,
    monthToDateSpend: monthToDate,
    budget,
  });

  const totalInputTokens =
    extracted.usage.inputTokens +
    classified.usage.inputTokens +
    advised.usage.inputTokens;

  const totalOutputTokens =
    extracted.usage.outputTokens +
    classified.usage.outputTokens +
    advised.usage.outputTokens;

  const costUsd =
    tokenCost(extracted.usage.inputTokens, extracted.usage.outputTokens, HAIKU_RATES) +
    tokenCost(classified.usage.inputTokens, classified.usage.outputTokens, HAIKU_RATES) +
    tokenCost(advised.usage.inputTokens, advised.usage.outputTokens, SONNET_RATES);

  const result = ReceiptResult.parse({
    merchant: extracted.merchant,
    amount: extracted.amount,
    currency: extracted.currency,
    amountInr: extracted.amountInr,
    date: extracted.date,
    paymentMode: extracted.paymentMode,
    lineItems: extracted.lineItems,
    category: classified.category,
    budgetStatus: advised.budgetStatus,
    recommendations: advised.recommendations,
    usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens, costUsd },
  });

  const record: ExpenseRecord = {
    date: result.date,
    merchant: result.merchant,
    category: result.category,
    amountInr: result.amountInr,
  };
  writeFileSync(expensesPath, JSON.stringify([...expenses, record], null, 2));

  return result;
}
