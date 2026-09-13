import { classify } from "../server/dist/agents/classifier.js";

export default class ExpenseClassifierProvider {
  id() {
    return "expense-classifier";
  }

  async callApi(_prompt, context) {
    const fixture = JSON.parse(context.vars.fixture);
    const result = await classify({
      merchant: fixture.merchant,
      lineItems: fixture.lineItems,
    });
    return { output: result.category };
  }
}
