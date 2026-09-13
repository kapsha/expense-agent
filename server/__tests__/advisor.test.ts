import { describe, expect, it, vi } from "vitest";
import { advise, computeBudgetStatus } from "../agents/advisor.js";

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

const baseInput = {
  merchant: "DMart",
  category: "groceries",
  budget: 10000,
};

describe("computeBudgetStatus", () => {
  it("returns under below 80%", () => {
    expect(computeBudgetStatus(7999, 10000)).toBe("under");
  });

  it("returns warning at exactly 80%", () => {
    expect(computeBudgetStatus(8000, 10000)).toBe("warning");
  });

  it("returns warning just below 100%", () => {
    expect(computeBudgetStatus(9999, 10000)).toBe("warning");
  });

  it("returns over at exactly 100%", () => {
    expect(computeBudgetStatus(10000, 10000)).toBe("over");
  });

  it("returns over above 100%", () => {
    expect(computeBudgetStatus(12000, 10000)).toBe("over");
  });
});

describe("advise", () => {
  it("returns empty recommendations without API call when under budget", async () => {
    const client = makeClient([]);
    const result = await advise({ ...baseInput, monthToDateSpend: 5000 }, client);

    expect(result.budgetStatus).toBe("under");
    expect(result.recommendations).toEqual([]);
    expect(result.usage.inputTokens).toBe(0);
    expect(client.messages.create).not.toHaveBeenCalled();
  });

  it("calls Sonnet and returns recommendations on warning status", async () => {
    const client = makeClient([{ text: '{"recommendations":["Buy in bulk to save more"]}' }]);
    const result = await advise({ ...baseInput, monthToDateSpend: 8500 }, client);

    expect(result.budgetStatus).toBe("warning");
    expect(result.recommendations).toHaveLength(1);
    expect(client.messages.create).toHaveBeenCalledTimes(1);
  });

  it("calls Sonnet and returns recommendations on over status", async () => {
    const client = makeClient([{ text: '{"recommendations":["Reduce grocery spend","Switch to local market"]}' }]);
    const result = await advise({ ...baseInput, monthToDateSpend: 11000 }, client);

    expect(result.budgetStatus).toBe("over");
    expect(result.recommendations).toHaveLength(2);
  });

  it("retries once on invalid response and succeeds", async () => {
    const client = makeClient([
      { text: "not json", inputTokens: 20, outputTokens: 5 },
      { text: '{"recommendations":["Spend less"]}', inputTokens: 25, outputTokens: 8 },
    ]);

    const result = await advise({ ...baseInput, monthToDateSpend: 9000 }, client);

    expect(client.messages.create).toHaveBeenCalledTimes(2);
    expect(result.usage.inputTokens).toBe(45);
    expect(result.usage.outputTokens).toBe(13);
  });

  it("throws after two consecutive failures", async () => {
    const client = makeClient([{ text: "bad" }, { text: "also bad" }]);
    await expect(advise({ ...baseInput, monthToDateSpend: 9000 }, client)).rejects.toThrow();
    expect(client.messages.create).toHaveBeenCalledTimes(2);
  });

  it("never sends image data to the model", async () => {
    const client = makeClient([{ text: '{"recommendations":["Tip"]}' }]);
    await advise({ ...baseInput, monthToDateSpend: 9000 }, client);

    const callArg = client.messages.create.mock.calls[0][0];
    expect(JSON.stringify(callArg)).not.toContain("base64");
    expect(callArg.model).toBe("claude-sonnet-4-6");
  });

  it("enforces max 3 recommendations", async () => {
    const tooMany = '{"recommendations":["a","b","c","d"]}';
    const valid = '{"recommendations":["a","b","c"]}';
    const client = makeClient([{ text: tooMany }, { text: valid }]);

    const result = await advise({ ...baseInput, monthToDateSpend: 9000 }, client);
    expect(result.recommendations).toHaveLength(3);
  });
});
