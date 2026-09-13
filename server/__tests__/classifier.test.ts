import { describe, expect, it, vi } from "vitest";
import { classify } from "../agents/classifier.js";

const input = {
  merchant: "DMart",
  lineItems: [
    { description: "Rice 5kg", amount: 320 },
    { description: "Dal 1kg", amount: 140 },
  ],
};

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

describe("classify", () => {
  it("returns a valid category on first attempt", async () => {
    const client = makeClient([{ text: '{"category":"groceries"}' }]);
    const result = await classify(input, client);

    expect(result.category).toBe("groceries");
    expect(client.messages.create).toHaveBeenCalledTimes(1);
  });

  it("retries once on invalid JSON and succeeds", async () => {
    const client = makeClient([
      { text: "not json", inputTokens: 10, outputTokens: 3 },
      { text: '{"category":"groceries"}', inputTokens: 12, outputTokens: 4 },
    ]);

    const result = await classify(input, client);

    expect(result.category).toBe("groceries");
    expect(client.messages.create).toHaveBeenCalledTimes(2);
    expect(result.usage.inputTokens).toBe(22);
    expect(result.usage.outputTokens).toBe(7);
  });

  it("retries once on invalid category value and succeeds", async () => {
    const client = makeClient([
      { text: '{"category":"shopping"}' },
      { text: '{"category":"other"}' },
    ]);

    const result = await classify(input, client);
    expect(result.category).toBe("other");
    expect(client.messages.create).toHaveBeenCalledTimes(2);
  });

  it("throws after two consecutive failures", async () => {
    const client = makeClient([
      { text: "garbage" },
      { text: "still garbage" },
    ]);

    await expect(classify(input, client)).rejects.toThrow();
    expect(client.messages.create).toHaveBeenCalledTimes(2);
  });

  it("strips markdown code fences before parsing", async () => {
    const client = makeClient([{ text: "```json\n{\"category\":\"food\"}\n```" }]);
    const result = await classify(input, client);

    expect(result.category).toBe("food");
    expect(client.messages.create).toHaveBeenCalledTimes(1);
  });

  it("never sends image or budget data to the model", async () => {
    const client = makeClient([{ text: '{"category":"groceries"}' }]);
    await classify(input, client);

    const callArg = client.messages.create.mock.calls[0][0];
    const messageContent = JSON.stringify(callArg.messages);
    expect(messageContent).not.toContain("base64");
    expect(messageContent).not.toContain("budget");
  });
});
