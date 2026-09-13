import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ReceiptResult } from "./contract.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = new Hono();
app.use("*", cors());

const STUB: ReceiptResult = {
  merchant: "DMart",
  amount: 640,
  currency: "INR",
  amountInr: 640,
  date: new Date().toISOString().slice(0, 10),
  paymentMode: "card",
  lineItems: [
    { description: "Rice 5kg", amount: 320 },
    { description: "Dal 1kg", amount: 140 },
    { description: "Oil 1L", amount: 180 },
  ],
  category: "groceries",
  budgetStatus: "warning",
  recommendations: [
    "Your last 2 grocery runs were at DMart — consider buying staples in bulk to stay under the ₹10,000 groceries budget.",
  ],
  usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
};

app.post("/api/receipt", async (c) => {
  return c.json(STUB);
});

app.get("/api/budgets", (c) => {
  const budgets = JSON.parse(
    readFileSync(join(__dirname, "budgets.json"), "utf-8")
  );
  return c.json(budgets);
});

app.get("/api/usage", (c) => {
  return c.json({ inputTokens: 0, outputTokens: 0, costUsd: 0 });
});

serve({ fetch: app.fetch, port: 3001 }, () => {
  console.log("Server running on http://localhost:3001");
});
