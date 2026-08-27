"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/api-url";
import { apiFetch } from "@/lib/api";

type Sku = {
  id: string;
  code: string;
  name: string;
  barcodes: { value: string; primary: boolean }[];
  balances?: { onHandQty: string; reservedQty: string; status: string }[];
};
type Line = { key: number; skuId: string; orderedQty: string };

function amount(value: number | string) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

export function SalesOrderForm() {
  const [skus, setSkus] = useState<Sku[]>([]);
  const [orderNumber, setOrderNumber] = useState("");
  const [recipient, setRecipient] = useState("");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("Seoul");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("South Korea");
  const [shippingMethod, setShippingMethod] = useState("CJ Logistics · Standard");
  const [instructions, setInstructions] = useState("");
  const [priority, setPriority] = useState("0");
  const [lines, setLines] = useState<Line[]>([{ key: 1, skuId: "", orderedQty: "1" }]);
  const [nextKey, setNextKey] = useState(2);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [createdId, setCreatedId] = useState("");

  useEffect(() => {
    let active = true;
    const numberTimer = window.setTimeout(() => {
      const now = new Date();
      const stamp = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
      setOrderNumber(`SO-${stamp}`);
    }, 0);
    async function loadSkus() {
      try {
        const response = await apiFetch(`${API_URL}/skus`);
        if (!response.ok) return;
        const body = (await response.json()) as Sku[];
        if (active) setSkus(body);
      } catch {
        // Submit provides the actionable connection error.
      }
    }
    void loadSkus();
    return () => {
      active = false;
      window.clearTimeout(numberTimer);
    };
  }, []);

  const totalUnits = useMemo(
    () => lines.reduce((sum, line) => sum + (Number(line.orderedQty) || 0), 0),
    [lines],
  );
  const selectedSkuIds = useMemo(
    () => new Set(lines.map((line) => line.skuId).filter(Boolean)),
    [lines],
  );

  function updateLine(key: number, field: "skuId" | "orderedQty", value: string) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, [field]: value } : line)));
  }

  function addLine() {
    setLines((current) => [...current, { key: nextKey, skuId: "", orderedQty: "1" }]);
    setNextKey((current) => current + 1);
  }

  function removeLine(key: number) {
    setLines((current) => (current.length === 1 ? current : current.filter((line) => line.key !== key)));
  }

  async function submit(status: "DRAFT" | "READY_TO_ALLOCATE") {
    setMessage("");
    if (!orderNumber.trim() || !recipient.trim() || !phone.trim() || !line1.trim() || !city.trim() || !postalCode.trim()) {
      setSubmitStatus("error");
      setMessage("Complete all required customer and shipping fields.");
      return;
    }
    if (lines.some((line) => !line.skuId || Number(line.orderedQty) <= 0)) {
      setSubmitStatus("error");
      setMessage("Every line needs a SKU and an ordered quantity greater than zero.");
      return;
    }
    setSubmitStatus("saving");
    try {
      const response = await apiFetch(`${API_URL}/sales-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: orderNumber.trim().toUpperCase(),
          status,
          priority: Number(priority),
          recipient: recipient.trim(),
          address: {
            line1: line1.trim(),
            line2: line2.trim() || undefined,
            city: city.trim(),
            postalCode: postalCode.trim(),
            country: country.trim(),
            phone: phone.trim(),
            shippingMethod,
            instructions: instructions.trim() || undefined,
          },
          lines: lines.map((line) => ({ skuId: line.skuId, orderedQty: Number(line.orderedQty) })),
        }),
      });
      const body = (await response.json()) as { id?: string; orderNumber?: string; message?: string | string[] };
      if (!response.ok)
        throw new Error(Array.isArray(body.message) ? body.message.join(" ") : body.message || "Could not create sales order.");
      setCreatedId(body.id ?? "");
      setSubmitStatus("success");
      setMessage(`${body.orderNumber ?? orderNumber} was ${status === "DRAFT" ? "saved as a draft" : "created and is ready to allocate"}.`);
    } catch (submitError) {
      setSubmitStatus("error");
      setMessage(submitError instanceof Error ? submitError.message : "Could not create sales order.");
    }
  }

  return (
    <form className="po-page sales-order-page" onSubmit={(event) => { event.preventDefault(); void submit("READY_TO_ALLOCATE"); }}>
      <header className="po-header">
        <div>
          <Link className="back-link" href="/outbound">← Back to outbound</Link>
          <p className="eyebrow">Outbound operations</p>
          <h1>New sales order</h1>
          <p className="subtitle">Create a customer shipment and define the items to fulfill.</p>
        </div>
        <div className="header-actions">
          <button className="button button-secondary" type="button" disabled={submitStatus === "saving"} onClick={() => void submit("DRAFT")}>Save draft</button>
          <button className="button button-primary" type="submit" disabled={submitStatus === "saving"}>{submitStatus === "saving" ? "Creating…" : "Create order"}</button>
        </div>
      </header>

      {message && (
        <div className={`form-banner ${submitStatus}`} role={submitStatus === "error" ? "alert" : "status"}>
          <strong>{submitStatus === "success" ? "✓ Order created" : "Check the order"}</strong>
          <span>{message}</span>
          {submitStatus === "success" && <Link href={createdId ? `/outbound/orders/${createdId}` : "/outbound"}>View order details →</Link>}
        </div>
      )}

      <div className="po-layout sales-order-layout">
        <div className="po-main">
          <section className="panel form-panel">
            <div className="panel-heading"><div><h2>Customer & shipping</h2><p>Order identity, recipient, and delivery destination</p></div><span className="required-note">* Required</span></div>
            <div className="form-grid">
              <label><span>Sales order number *</span><input value={orderNumber} onChange={(event) => setOrderNumber(event.target.value.toUpperCase())} placeholder="SO-260714-001" required /></label>
              <label><span>Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="0">Normal</option><option value="1">High</option><option value="2">Urgent</option><option value="3">Critical</option></select></label>
              <label><span>Recipient name *</span><input value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="e.g. Kim Min-seo" required /></label>
              <label><span>Phone number *</span><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="010-1234-5678" required /></label>
              <label className="full"><span>Address line 1 *</span><input value={line1} onChange={(event) => setLine1(event.target.value)} placeholder="Street address and building" required /></label>
              <label className="full"><span>Address line 2</span><input value={line2} onChange={(event) => setLine2(event.target.value)} placeholder="Apartment, suite, or floor" /></label>
              <label><span>City *</span><input value={city} onChange={(event) => setCity(event.target.value)} required /></label>
              <label><span>Postal code *</span><input value={postalCode} onChange={(event) => setPostalCode(event.target.value)} placeholder="04524" required /></label>
              <label><span>Country *</span><input value={country} onChange={(event) => setCountry(event.target.value)} required /></label>
              <label><span>Shipping service *</span><select value={shippingMethod} onChange={(event) => setShippingMethod(event.target.value)}><option>CJ Logistics · Standard</option><option>Hanjin · Standard</option><option>Lotte Global · Standard</option><option>Same-day courier</option><option>Customer pickup</option></select></label>
              <label className="full"><span>Delivery instructions</span><textarea rows={3} value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Gate code, safe-place, or handling instructions" /></label>
            </div>
          </section>

          <section className="panel form-panel line-panel">
            <div className="panel-heading"><div><h2>Order items</h2><p>Add each SKU requested by the customer</p></div><button className="button button-secondary small" type="button" onClick={addLine}>+ Add line</button></div>
            <div className="so-lines">
              <div className="so-line so-line-header"><span>SKU / product *</span><span>Available</span><span>Ordered qty *</span><span /></div>
              {lines.map((line, index) => {
                const sku = skus.find((item) => item.id === line.skuId);
                const available = sku?.balances
                  ?.filter((balance) => balance.status === "AVAILABLE")
                  .reduce((sum, balance) => sum + Number(balance.onHandQty) - Number(balance.reservedQty), 0);
                return (
                  <div className="so-line" key={line.key}>
                    <label data-label="SKU / product"><select aria-label={`Line ${index + 1} SKU`} value={line.skuId} onChange={(event) => updateLine(line.key, "skuId", event.target.value)} required><option value="" disabled>Select a SKU</option>{skus.map((option) => <option key={option.id} value={option.id} disabled={option.id !== line.skuId && selectedSkuIds.has(option.id)}>{option.code} · {option.name}</option>)}</select>{sku && <small>{sku.barcodes.find((barcode) => barcode.primary)?.value ?? sku.barcodes[0]?.value ?? "No barcode"}</small>}</label>
                    <div className="availability-cell" data-label="Available"><strong>{available === undefined ? "—" : amount(available)}</strong><small>units</small></div>
                    <label data-label="Ordered quantity"><input aria-label={`Line ${index + 1} ordered quantity`} type="number" min="0.001" step="0.001" value={line.orderedQty} onChange={(event) => updateLine(line.key, "orderedQty", event.target.value)} required /></label>
                    <button className="remove-line" type="button" aria-label={`Remove line ${index + 1}`} onClick={() => removeLine(line.key)} disabled={lines.length === 1}>×</button>
                  </div>
                );
              })}
            </div>
            <div className="line-footer"><button type="button" onClick={addLine}>+ Add another item</button><span>{lines.length} line{lines.length === 1 ? "" : "s"} · <strong>{amount(totalUnits)} unit{totalUnits === 1 ? "" : "s"}</strong></span></div>
          </section>
        </div>

        <aside className="po-summary panel">
          <h2>Order summary</h2>
          <div><span>Sales order</span><strong>{orderNumber || "Generating…"}</strong></div>
          <div><span>Recipient</span><strong>{recipient || "Not entered"}</strong></div>
          <div><span>Destination</span><strong>{city || "Not entered"}</strong></div>
          <div><span>SKU lines</span><strong>{lines.filter((line) => line.skuId).length}</strong></div>
          <div><span>Total units</span><strong>{amount(totalUnits)}</strong></div>
          <div><span>Priority</span><strong>{["Normal", "High", "Urgent", "Critical"][Number(priority)]}</strong></div>
          <hr /><p>Creating as <b>Ready to allocate</b> makes this order available for inventory allocation and picking.</p>
        </aside>
      </div>
    </form>
  );
}
