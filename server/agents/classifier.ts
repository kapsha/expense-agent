import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { Category } from "../contract.js";
import type { LineItem } from "../contract.js";

const RawClassification = z.object({ category: Category });

const SYSTEM_PROMPT = `You are a receipt classifier. Given a merchant name and line items, return ONLY valid JSON — no prose, no markdown:
{"category": "<value>"}

Valid categories: food | entertainment | fuel | transport | utility | medical | groceries | other`;

export type ClassifierInput = {
  merchant: string;
  lineItems: Array<z.infer<typeof LineItem>>;
};

export type ClassifierOutput = {
  category: z.infer<typeof Category>;
  usage: { inputTokens: number; outputTokens: number };
};

function stripFences(text: string): string {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return m ? m[1] : text.trim();
}

export async function classify(
  input: ClassifierInput,
  client: Anthropic = new Anthropic(),
): Promise<ClassifierOutput> {
  let inputTokens = 0;
  let outputTokens = 0;

  const call = async (retryHint?: string): Promise<string> => {
    const items = input.lineItems.map((i) => `- ${i.description}`).join("\n");
    const body = `Merchant: ${input.merchant}\nItems:\n${items}`;
    const text = retryHint
      ? `${body}\n\nPrevious attempt failed validation: ${retryHint}`
      : body;

    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 64,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
    });

    inputTokens += resp.usage.input_tokens;
    outputTokens += resp.usage.output_tokens;

    const block = resp.content[0];
    if (!block || block.type !== "text") throw new Error("No text block in response");
    return block.text;
  };

  const parseRaw = (text: string) =>
    RawClassification.parse(JSON.parse(stripFences(text)));

  const firstText = await call();
  let raw: z.infer<typeof RawClassification>;

  try {
    raw = parseRaw(firstText);
  } catch (err) {
    const hint = err instanceof Error ? err.message : String(err);
    raw = parseRaw(await call(hint));
  }

  return { category: raw.category, usage: { inputTokens, outputTokens } };
}
