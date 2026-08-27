"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/api-url";
import { apiFetch } from "@/lib/api";

type Balance = {
  id: string;
  lotNumber: string;
  onHandQty: string;
  reservedQty: string;
  status: string;
  location: { code: string };
  sku: { code: string; name: string };
};

function amount(value: number | string) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

export function InventoryAdjustmentForm({
  initialBalanceId,
}: {
  initialBalanceId: string;
}) {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [balanceId, setBalanceId] = useState(initialBalanceId);
  const [direction, setDirection] = useState<"INCREASE" | "DECREASE">("INCREASE");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("Cycle count correction");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await apiFetch(`${API_URL}/inventory-balances`);
        if (!response.ok) return;
        const body = (await response.json()) as Balance[];
        if (!active) return;
        setBalances(body);
        setBalanceId((current) => current || body[0]?.id || "");
      } catch {
        // Submit provides the actionable API error.
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const selected = balances.find((balance) => balance.id === balanceId);
  const projected = useMemo(() => {
    if (!selected) return 0;
    const change = Number(quantity) || 0;
    return Number(selected.onHandQty) + (direction === "INCREASE" ? change : -change);
  }, [direction, quantity, selected]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    if (!balanceId || Number(quantity) <= 0 || !reason.trim()) {
      setStatus("error");
      setMessage("Select inventory and enter a positive quantity and reason.");
      return;
    }
    setStatus("saving");
    try {
      const response = await apiFetch(`${API_URL}/inventory-adjustments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          balanceId,
          direction,
          quantity: Number(quantity),
          reason: reason.trim(),
          notes: notes.trim(),
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const body = (await response.json()) as Balance & {
        message?: string | string[];
      };
      if (!response.ok)
        throw new Error(
          Array.isArray(body.message)
            ? body.message.join(" ")
            : body.message || "Could not apply adjustment.",
        );
      setStatus("success");
      setBalances((current) =>
        current.map((balance) =>
          balance.id === body.id
            ? {
                ...balance,
                onHandQty: body.onHandQty,
                reservedQty: body.reservedQty,
                status: body.status,
              }
            : balance,
        ),
      );
      setMessage(
        `Inventory was ${direction === "INCREASE" ? "increased" : "decreased"} by ${amount(quantity)} unit${Number(quantity) === 1 ? "" : "s"}.`,
      );
    } catch (submitError) {
      setStatus("error");
      setMessage(submitError instanceof Error ? submitError.message : "Could not apply adjustment.");
    }
  }

  return (
    <form className="po-page adjustment-page" onSubmit={submit}>
      <header className="po-header">
        <div>
          <Link className="back-link" href="/inventory">← Back to inventory</Link>
          <p className="eyebrow">Inventory control</p>
          <h1>New inventory adjustment</h1>
          <p className="subtitle">Record a controlled increase or decrease to physical stock.</p>
        </div>
        <div className="header-actions">
          <Link className="button button-secondary" href="/inventory">Cancel</Link>
          <button className="button button-primary" disabled={status === "saving"} type="submit">
            {status === "saving" ? "Applying…" : "Apply adjustment"}
          </button>
        </div>
      </header>

      {message && (
        <div className={`form-banner ${status}`} role={status === "error" ? "alert" : "status"}>
          <strong>{status === "success" ? "✓ Adjustment applied" : "Check the adjustment"}</strong>
          <span>{message}</span>
          {status === "success" && <Link href={`/inventory/${balanceId}`}>View inventory details →</Link>}
        </div>
      )}

      <div className="po-layout adjustment-layout">
        <div className="po-main">
          <section className="panel form-panel">
            <div className="panel-heading"><div><h2>Inventory selection</h2><p>Choose the exact SKU, location, and lot balance</p></div><span className="required-note">* Required</span></div>
            <div className="form-grid adjustment-grid">
              <label className="full"><span>Inventory balance *</span>
                <select value={balanceId} onChange={(event) => setBalanceId(event.target.value)} required>
                  <option value="" disabled>Select inventory</option>
                  {balances.map((balance) => <option key={balance.id} value={balance.id}>{balance.sku.code} · {balance.sku.name} · {balance.location.code} · {balance.lotNumber || "No lot"}</option>)}
                </select>
              </label>
              {selected && (
                <div className="selected-balance full">
                  <div><span>On hand</span><strong>{amount(selected.onHandQty)}</strong></div>
                  <div><span>Reserved</span><strong>{amount(selected.reservedQty)}</strong></div>
                  <div><span>Available</span><strong>{amount(Number(selected.onHandQty) - Number(selected.reservedQty))}</strong></div>
                  <div><span>Status</span><strong>{selected.status.toLowerCase()}</strong></div>
                </div>
              )}
            </div>
          </section>

          <section className="panel form-panel">
            <div className="panel-heading"><div><h2>Adjustment</h2><p>Enter the stock change and operational reason</p></div></div>
            <div className="form-grid">
              <fieldset className="direction-picker full">
                <legend>Direction *</legend>
                <label className={direction === "INCREASE" ? "selected" : ""}><input type="radio" name="direction" checked={direction === "INCREASE"} onChange={() => setDirection("INCREASE")} /><span><b>+ Increase stock</b><small>Add units found or received</small></span></label>
                <label className={direction === "DECREASE" ? "selected decrease" : "decrease"}><input type="radio" name="direction" checked={direction === "DECREASE"} onChange={() => setDirection("DECREASE")} /><span><b>− Decrease stock</b><small>Remove missing or damaged units</small></span></label>
              </fieldset>
              <label><span>Quantity *</span><input aria-label="Adjustment quantity" type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label>
              <label><span>Reason *</span><select value={reason} onChange={(event) => setReason(event.target.value)}><option>Cycle count correction</option><option>Damaged stock</option><option>Found inventory</option><option>Expired stock</option><option>Data correction</option><option>Other</option></select></label>
              <label className="full"><span>Notes</span><textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Explain the count, incident, or authorization for this adjustment" /></label>
            </div>
          </section>
        </div>

        <aside className="po-summary panel adjustment-summary">
          <h2>Adjustment summary</h2>
          <div><span>SKU</span><strong>{selected?.sku.code || "Select inventory"}</strong></div>
          <div><span>Location</span><strong>{selected?.location.code || "—"}</strong></div>
          <div><span>Current on hand</span><strong>{selected ? amount(selected.onHandQty) : "—"}</strong></div>
          <div><span>Change</span><strong className={direction === "INCREASE" ? "positive" : "negative"}>{direction === "INCREASE" ? "+" : "−"}{amount(quantity || 0)}</strong></div>
          <div><span>Projected on hand</span><strong>{selected ? amount(projected) : "—"}</strong></div>
          {selected && projected < Number(selected.reservedQty) && <p className="summary-warning">Projected stock cannot be lower than {amount(selected.reservedQty)} reserved units.</p>}
          <hr /><p>This adjustment is permanent and will be recorded in the inventory ledger and audit log.</p>
        </aside>
      </div>
    </form>
  );
}
