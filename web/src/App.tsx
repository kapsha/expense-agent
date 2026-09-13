import { useEffect, useRef, useState } from "react";

type LineItem = { description: string; amount: number };
type ReceiptResult = {
  merchant: string;
  amount: number;
  currency: string;
  amountInr: number;
  date: string;
  paymentMode: string;
  lineItems: LineItem[];
  category: string;
  budgetStatus: "under" | "warning" | "over";
  recommendations: string[];
  usage: { inputTokens: number; outputTokens: number; costUsd: number };
};
type Budgets = Record<string, number>;

const STATUS_COLOR: Record<string, string> = {
  under: "#22c55e",
  warning: "#f59e0b",
  over: "#ef4444",
};

export default function App() {
  const [result, setResult] = useState<ReceiptResult | null>(null);
  const [budgets, setBudgets] = useState<Budgets>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/budgets")
      .then((r) => r.json())
      .then(setBudgets)
      .catch(() => {});
  }, []);

  async function handleFile(file: File) {
    if (!file.type.match(/image\/(jpeg|png)/)) {
      setError("Only JPG and PNG receipts are supported.");
      return;
    }
    setError(null);
    setLoading(true);
    const form = new FormData();
    form.append("receipt", file);
    try {
      const res = await fetch("/api/receipt", { method: "POST", body: form });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div style={{ maxWidth: 640, margin: "2rem auto", fontFamily: "system-ui", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>Expense Agent</h1>

      {/* Dropzone */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        style={{
          border: "2px dashed #94a3b8",
          borderRadius: 8,
          padding: "2rem",
          textAlign: "center",
          cursor: "pointer",
          marginBottom: "1.5rem",
          background: "#f8fafc",
        }}
      >
        {loading ? "Processing…" : "Drop a receipt (JPG / PNG) or click to upload"}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>

      {error && <p style={{ color: "#ef4444", marginBottom: "1rem" }}>{error}</p>}

      {result && (
        <>
          {/* Results card */}
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "1rem", marginBottom: "1.5rem" }}>
            <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>{result.merchant}</h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {[
                  ["Date", result.date],
                  ["Amount", result.currency === "INR"
                    ? `₹${result.amountInr.toLocaleString("en-IN")}`
                    : `${result.currency} ${result.amount} (₹${result.amountInr.toLocaleString("en-IN")})`],
                  ["Payment mode", result.paymentMode],
                  ["Category", result.category],
                  ["Budget status", result.budgetStatus],
                ].map(([label, value]) => (
                  <tr key={label}>
                    <td style={{ color: "#64748b", paddingRight: "1rem", paddingBottom: 4 }}>{label}</td>
                    <td style={{ fontWeight: 500, paddingBottom: 4 }}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {result.lineItems.length > 0 && (
              <details style={{ marginTop: "0.75rem" }}>
                <summary style={{ cursor: "pointer", color: "#64748b" }}>
                  Line items ({result.lineItems.length})
                </summary>
                <ul style={{ marginTop: "0.5rem" }}>
                  {result.lineItems.map((li, i) => (
                    <li key={i}>{li.description} — ₹{li.amount}</li>
                  ))}
                </ul>
              </details>
            )}

            {result.recommendations.length > 0 && (
              <div style={{ marginTop: "0.75rem", padding: "0.75rem", background: "#fefce8", borderRadius: 6 }}>
                <strong>Recommendations</strong>
                <ul style={{ marginTop: "0.5rem", paddingLeft: "1.25rem" }}>
                  {result.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}

            <div style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#94a3b8" }}>
              Tokens: {result.usage.inputTokens} in / {result.usage.outputTokens} out &nbsp;·&nbsp;
              Cost: ${result.usage.costUsd.toFixed(4)}
            </div>
          </div>

          {/* Budget bars */}
          {Object.keys(budgets).length > 0 && (
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "1rem" }}>
              <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Monthly budgets (current month)</h2>
              {Object.entries(budgets).map(([cat, budget]) => {
                const spent = cat === result.category ? result.amountInr : 0;
                const pct = Math.min((spent / budget) * 100, 100);
                const status = pct >= 100 ? "over" : pct >= 80 ? "warning" : "under";
                return (
                  <div key={cat} style={{ marginBottom: "0.75rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: 2 }}>
                      <span style={{ textTransform: "capitalize" }}>{cat}</span>
                      <span style={{ color: "#64748b" }}>
                        ₹{spent.toLocaleString("en-IN")} / ₹{budget.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div style={{ background: "#e2e8f0", borderRadius: 4, height: 8 }}>
                      <div style={{
                        width: `${pct}%`,
                        background: STATUS_COLOR[status],
                        borderRadius: 4,
                        height: 8,
                        transition: "width 0.3s",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
