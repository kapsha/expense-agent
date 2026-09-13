import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { LineItem, PaymentMode } from "../contract.js";

const USD_TO_INR = 95;

const RawExtraction = z.object({
  merchant: z.string(),
  amount: z.number().nonnegative(),
  currency: z.string().length(3),
  date: z.string(),
  paymentMode: PaymentMode,
  lineItems: z.array(LineItem),
});

type RawExtraction = z.infer<typeof RawExtraction>;

export type ExtractorOutput = RawExtraction & {
  amountInr: number;
  usage: { inputTokens: number; outputTokens: number };
};

const SYSTEM_PROMPT = `You are a receipt parser. Extract receipt data and return ONLY valid JSON — no prose, no markdown.

Schema:
{
  "merchant": string,
  "amount": number (total, nonnegative),
  "currency": string (3-letter ISO code e.g. "INR" "USD"),
  "date": "YYYY-MM-DD",
  "paymentMode": "cash" | "card" | "upi" | "wallet" | "netbanking" | "unknown",
  "lineItems": [{ "description": string, "amount": number }]
}`;

type MediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

function detectMediaType(buf: Buffer): MediaType {
  if (buf.length >= 2 && buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  return "image/jpeg";
}

function stripFences(text: string): string {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return m ? m[1] : text.trim();
}

export function toAmountInr(amount: number, currency: string): number {
  return currency.toUpperCase() === "INR" ? amount : amount * USD_TO_INR;
}

export async function extract(
  imageBuffer: Buffer,
  client: Anthropic = new Anthropic(),
): Promise<ExtractorOutput> {
  const base64 = imageBuffer.toString("base64");
  const mediaType = detectMediaType(imageBuffer);
  let inputTokens = 0;
  let outputTokens = 0;

  const call = async (retryHint?: string): Promise<string> => {
    const text = retryHint
      ? `Parse the receipt. Previous attempt failed validation: ${retryHint}`
      : "Parse the receipt.";

    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text },
          ],
        },
      ],
    });

    inputTokens += resp.usage.input_tokens;
    outputTokens += resp.usage.output_tokens;

    const block = resp.content[0];
    if (!block || block.type !== "text") throw new Error("No text block in response");
    return block.text;
  };

  const parseRaw = (text: string): RawExtraction =>
    RawExtraction.parse(JSON.parse(stripFences(text)));

  const firstText = await call();
  let raw: RawExtraction;

  try {
    raw = parseRaw(firstText);
  } catch (err) {
    const hint = err instanceof Error ? err.message : String(err);
    const secondText = await call(hint);
    raw = parseRaw(secondText);
  }

  return {
    ...raw,
    amountInr: toAmountInr(raw.amount, raw.currency),
    usage: { inputTokens, outputTokens },
  };
}
