import { describe, expect, it, vi } from "vitest";
import { extract, toAmountInr } from "../agents/extractor.js";

describe("toAmountInr", () => {
  it("returns amount unchanged for INR", () => {
    expect(toAmountInr(640, "INR")).toBe(640);
  });

  it("converts USD to INR at 95x", () => {
    expect(toAmountInr(10, "USD")).toBe(950);
  });

  it("is case-insensitive for currency", () => {
    expect(toAmountInr(100, "inr")).toBe(100);
  });
});

describe("extract retry logic", () => {
  const validPayload = JSON.stringify({
    merchant: "Test Mart",
    amount: 200,
    currency: "INR",
    date: "2026-09-13",
    paymentMode: "upi",
    lineItems: [{ description: "Milk 1L", amount: 60 }, { description: "Bread", amount: 40 }],
  });

  function makeClient(responses: Array<{ text: string; inputTokens?: number; outputTokens?: number }>) {
    const mockCreate = vi.fn();
    for (const r of responses) {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: r.text }],
        usage: { input_tokens: r.inputTokens ?? 10, output_tokens: r.outputTokens ?? 5 },
      });
    }
    return { messages: { create: mockCreate } } as any;
  }

  it("succeeds on first attempt without retry", async () => {
    const client = makeClient([{ text: validPayload }]);
    const result = await extract(Buffer.from("img"), client);

    expect(client.messages.create).toHaveBeenCalledTimes(1);
    expect(result.merchant).toBe("Test Mart");
    expect(result.amountInr).toBe(200);
    expect(result.currency).toBe("INR");
  });

  it("retries once on invalid JSON and succeeds", async () => {
    const client = makeClient([
      { text: "not json at all", inputTokens: 10, outputTokens: 3 },
      { text: validPayload, inputTokens: 15, outputTokens: 20 },
    ]);

    const result = await extract(Buffer.from("img"), client);

    expect(client.messages.create).toHaveBeenCalledTimes(2);
    expect(result.merchant).toBe("Test Mart");
    expect(result.usage.inputTokens).toBe(25);
    expect(result.usage.outputTokens).toBe(23);
  });

  it("retries once on schema validation failure and succeeds", async () => {
    const badPayload = JSON.stringify({ merchant: "Shop", amount: -1, currency: "IN", date: "bad" });
    const client = makeClient([
      { text: badPayload },
      { text: validPayload },
    ]);

    const result = await extract(Buffer.from("img"), client);

    expect(client.messages.create).toHaveBeenCalledTimes(2);
    expect(result.merchant).toBe("Test Mart");
  });

  it("throws after two consecutive failures", async () => {
    const client = makeClient([
      { text: "garbage" },
      { text: "still garbage" },
    ]);

    await expect(extract(Buffer.from("img"), client)).rejects.toThrow();
    expect(client.messages.create).toHaveBeenCalledTimes(2);
  });

  it("strips markdown code fences before parsing", async () => {
    const fenced = "```json\n" + validPayload + "\n```";
    const client = makeClient([{ text: fenced }]);

    const result = await extract(Buffer.from("img"), client);
    expect(result.merchant).toBe("Test Mart");
    expect(client.messages.create).toHaveBeenCalledTimes(1);
  });

  it("accumulates usage tokens across retry", async () => {
    const client = makeClient([
      { text: "bad", inputTokens: 100, outputTokens: 10 },
      { text: validPayload, inputTokens: 200, outputTokens: 30 },
    ]);

    const result = await extract(Buffer.from("img"), client);
    expect(result.usage.inputTokens).toBe(300);
    expect(result.usage.outputTokens).toBe(40);
  });
});
