import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { supervise } from "./agents/supervisor.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = new Hono();
app.use("*", cors());

app.post("/api/receipt", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("image");
  if (!file || !(file instanceof File)) {
    return c.json({ error: "Missing image field" }, 400);
  }
  const imageBuffer = Buffer.from(await file.arrayBuffer());
  try {
    const result = await supervise(imageBuffer);
    return c.json(result);
  } catch (err) {
    console.error("Supervisor failed:", err instanceof Error ? err.message : err);
    return c.json({ error: "Receipt processing failed" }, 500);
  }
});

app.get("/api/budgets", (c) => {
  const budgets = JSON.parse(
    readFileSync(join(__dirname, "budgets.json"), "utf-8")
  );
  return c.json(budgets);
});

app.get("/api/usage", (c) => {
  const expenses = JSON.parse(
    readFileSync(join(__dirname, "expenses.json"), "utf-8")
  ) as Array<{ amountInr: number }>;
  const total = expenses.reduce((sum, e) => sum + e.amountInr, 0);
  return c.json({ totalExpenses: expenses.length, totalAmountInr: total });
});

serve({ fetch: app.fetch, port: 3001 }, () => {
  console.log("Server running on http://localhost:3001");
});
