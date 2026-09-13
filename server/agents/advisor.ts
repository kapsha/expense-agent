import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { BudgetStatus } from "../contract.js";

const RawAdvice = z.object({
  recommendations: z.array(z.string()).min(1).max(3),
});

const SYSTEM_PROMPT = `You are a budget advisor. Return ONLY valid JSON — no prose, no markdown:
{"recommendations": ["...", "..."]}

Rules:
- 1 to 3 recommendations, no more
- Be specific to the merchant and spending category
- Focus on actionable ways to stay within budget`;

export type AdvisorInput = {
  merchant: string;
  category: string;
  monthToDateSpend: number;
  budget: number;
};

export type AdvisorOutput = {
  budgetStatus: z.infer<typeof BudgetStatus>;
  recommendations: string[];
  usage: { inputTokens: number; outputTokens: number };
};

export function computeBudgetStatus(spend: number, budget: number): z.infer<typeof BudgetStatus> {
  const ratio = spend / budget;
  if (ratio >= 1.0) return "over";
  if (ratio >= 0.8) return "warning";
  return "under";
}

function stripFences(text: string): string {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return m ? m[1] : text.trim();
}

export async function advise(
  input: AdvisorInput,
  client: Anthropic = new Anthropic(),
): Promise<AdvisorOutput> {
  const budgetStatus = computeBudgetStatus(input.monthToDateSpend, input.budget);

  if (budgetStatus === "under") {
    return { budgetStatus, recommendations: [], usage: { inputTokens: 0, outputTokens: 0 } };
  }

  let inputTokens = 0;
  let outputTokens = 0;

  const call = async (retryHint?: string): Promise<string> => {
    const body =
      `Merchant: ${input.merchant}\n` +
      `Category: ${input.category}\n` +
      `Month-to-date spend: ₹${input.monthToDateSpend}\n` +
      `Monthly budget: ₹${input.budget}\n` +
      `Status: ${budgetStatus}`;
    const text = retryHint ? `${body}\n\nPrevious attempt failed validation: ${retryHint}` : body;

    const resp = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
    });

    inputTokens += resp.usage.input_tokens;
    outputTokens += resp.usage.output_tokens;

    const block = resp.content[0];
    if (!block || block.type !== "text") throw new Error("No text block in response");
    return block.text;
  };

  const parseRaw = (text: string) => RawAdvice.parse(JSON.parse(stripFences(text)));

  const firstText = await call();
  let raw: z.infer<typeof RawAdvice>;

  try {
    raw = parseRaw(firstText);
  } catch (err) {
    const hint = err instanceof Error ? err.message : String(err);
    raw = parseRaw(await call(hint));
  }

  return { budgetStatus, recommendations: raw.recommendations, usage: { inputTokens, outputTokens } };
}
