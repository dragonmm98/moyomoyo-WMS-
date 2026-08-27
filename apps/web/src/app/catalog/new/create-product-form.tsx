"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/api-url";
import { apiFetch } from "@/lib/api";
import { createEan13 } from "@/lib/barcode";

type BarcodeLine = {
  key: number;
  value: string;
  symbology: string;
  primary: boolean;
};

export function CreateProductForm() {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [trackingPolicy, setTrackingPolicy] = useState("NONE");
  const [expiryTracked, setExpiryTracked] = useState(false);
  const [active, setActive] = useState(true);
  const [weightKg, setWeightKg] = useState("");
  const [lengthCm, setLengthCm] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [barcodes, setBarcodes] = useState<BarcodeLine[]>([
    { key: 1, value: "", symbology: "EAN13", primary: true },
  ]);
  const [nextKey, setNextKey] = useState(2);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [createdId, setCreatedId] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const now = new Date();
      setCode(`SKU-${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const dimensionsComplete = useMemo(
    () => [lengthCm, widthCm, heightCm].every(Boolean),
    [heightCm, lengthCm, widthCm],
  );

  function updateBarcode(key: number, field: "value" | "symbology", value: string) {
    setBarcodes((current) => current.map((barcode) => (barcode.key === key ? { ...barcode, [field]: value } : barcode)));
  }

  function generateBarcode(key: number) {
    setBarcodes((current) => {
      const existingValues = new Set(current.map((barcode) => barcode.value.trim()).filter(Boolean));
      let value = createEan13();
      while (existingValues.has(value)) value = createEan13();
      return current.map((barcode) =>
        barcode.key === key ? { ...barcode, value, symbology: "EAN13" } : barcode,
      );
    });
  }

  function setPrimaryBarcode(key: number) {
    setBarcodes((current) => current.map((barcode) => ({ ...barcode, primary: barcode.key === key })));
  }

  function addBarcode() {
    setBarcodes((current) => [...current, { key: nextKey, value: "", symbology: "CODE128", primary: false }]);
    setNextKey((current) => current + 1);
  }

  function removeBarcode(key: number) {
    setBarcodes((current) => {
      if (current.length === 1) return current;
      const removed = current.find((barcode) => barcode.key === key);
      const remaining = current.filter((barcode) => barcode.key !== key);
      return removed?.primary ? remaining.map((barcode, index) => ({ ...barcode, primary: index === 0 })) : remaining;
    });
  }

  function changeTrackingPolicy(value: string) {
    setTrackingPolicy(value);
    if (value !== "LOT") setExpiryTracked(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    if (!code.trim() || !name.trim()) {
      setSubmitStatus("error");
      setMessage("Enter a valid SKU code and product name.");
      return;
    }
    const barcodeValues = barcodes.map((barcode) => barcode.value.trim()).filter(Boolean);
    if (new Set(barcodeValues).size !== barcodeValues.length) {
      setSubmitStatus("error");
      setMessage("Barcode values must be unique.");
      return;
    }
    setSubmitStatus("saving");
    try {
      const response = await apiFetch(`${API_URL}/skus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          description: description.trim() || undefined,
          trackingPolicy,
          expiryTracked,
          active,
          weightKg: weightKg ? Number(weightKg) : undefined,
          lengthCm: lengthCm ? Number(lengthCm) : undefined,
          widthCm: widthCm ? Number(widthCm) : undefined,
          heightCm: heightCm ? Number(heightCm) : undefined,
          barcodes: barcodes
            .filter((barcode) => barcode.value.trim())
            .map((barcode) => ({ value: barcode.value.trim(), symbology: barcode.symbology, primary: barcode.primary })),
        }),
      });
      const body = (await response.json()) as { id?: string; code?: string; message?: string | string[] };
      if (!response.ok)
        throw new Error(Array.isArray(body.message) ? body.message.join(" ") : body.message || "Could not create product.");
      setCreatedId(body.id ?? "");
      setSubmitStatus("success");
      setMessage(`${body.code ?? code} was added to the product catalog.`);
    } catch (submitError) {
      setSubmitStatus("error");
      setMessage(submitError instanceof Error ? submitError.message : "Could not create product.");
    }
  }

  return (
    <form className="po-page product-form-page" onSubmit={submit}>
      <header className="po-header">
        <div><Link className="back-link" href="/catalog">← Back to catalog</Link><p className="eyebrow">Master data</p><h1>New product</h1><p className="subtitle">Create a warehouse SKU with tracking, dimensions, and barcode aliases.</p></div>
        <div className="header-actions"><Link className="button button-secondary" href="/catalog">Cancel</Link><button className="button button-primary" type="submit" disabled={submitStatus === "saving"}>{submitStatus === "saving" ? "Creating…" : "Create product"}</button></div>
      </header>

      {message && <div className={`form-banner ${submitStatus}`} role={submitStatus === "error" ? "alert" : "status"}><strong>{submitStatus === "success" ? "✓ Product created" : "Check the product"}</strong><span>{message}</span>{submitStatus === "success" && <Link href={createdId ? `/catalog/${createdId}` : "/catalog"}>View product details →</Link>}</div>}

      <div className="po-layout product-form-layout">
        <div className="po-main">
          <section className="panel form-panel">
            <div className="panel-heading"><div><h2>Product identity</h2><p>SKU code, display name, description, and status</p></div><span className="required-note">* Required</span></div>
            <div className="form-grid">
              <label><span>SKU code *</span><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="SKU-001" required /></label>
              <label className="toggle-field"><span>Catalog status</span><span className="toggle-control"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /><b>{active ? "Active" : "Inactive"}</b></span></label>
              <label className="full"><span>Product name *</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Organic Green Tea 20ct" required /></label>
              <label className="full"><span>Description</span><textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Product details, handling notes, or merchandising description" /></label>
            </div>
          </section>

          <section className="panel form-panel">
            <div className="panel-heading"><div><h2>Tracking & physical data</h2><p>Traceability policy, expiry handling, weight, and dimensions</p></div></div>
            <div className="form-grid">
              <label><span>Tracking policy</span><select value={trackingPolicy} onChange={(event) => changeTrackingPolicy(event.target.value)}><option value="NONE">No tracking</option><option value="LOT">Lot tracking</option><option value="SERIAL">Serial tracking</option></select></label>
              <label className="toggle-field"><span>Expiry tracking</span><span className={`toggle-control ${trackingPolicy !== "LOT" ? "disabled" : ""}`}><input type="checkbox" checked={expiryTracked} disabled={trackingPolicy !== "LOT"} onChange={(event) => setExpiryTracked(event.target.checked)} /><b>{expiryTracked ? "Enabled" : "Disabled"}</b></span></label>
              <label><span>Weight (kg)</span><input type="number" min="0" step="0.001" value={weightKg} onChange={(event) => setWeightKg(event.target.value)} placeholder="0.000" /></label>
              <div className="dimension-fields"><label><span>Length (cm)</span><input aria-label="Length in centimeters" type="number" min="0" step="0.01" value={lengthCm} onChange={(event) => setLengthCm(event.target.value)} placeholder="0.00" /></label><label><span>Width (cm)</span><input aria-label="Width in centimeters" type="number" min="0" step="0.01" value={widthCm} onChange={(event) => setWidthCm(event.target.value)} placeholder="0.00" /></label><label><span>Height (cm)</span><input aria-label="Height in centimeters" type="number" min="0" step="0.01" value={heightCm} onChange={(event) => setHeightCm(event.target.value)} placeholder="0.00" /></label></div>
            </div>
          </section>

          <section className="panel form-panel barcode-panel">
            <div className="panel-heading"><div><h2>Barcodes</h2><p>Add product identifiers and choose the primary scanning code</p></div><button className="button button-secondary small" type="button" onClick={addBarcode}>+ Add barcode</button></div>
            <div className="barcode-lines">
              <div className="barcode-line barcode-line-header"><span>Barcode value</span><span>Symbology</span><span>Primary</span><span /></div>
              {barcodes.map((barcode, index) => (
                <div className="barcode-line" key={barcode.key}>
                  <label data-label="Barcode value">
                    <span className="barcode-input-row">
                      <input aria-label={`Barcode ${index + 1} value`} value={barcode.value} onChange={(event) => updateBarcode(barcode.key, "value", event.target.value)} placeholder="Scan or enter code" />
                      <button className="barcode-generate-button" type="button" aria-label={`Generate barcode ${index + 1}`} onClick={() => generateBarcode(barcode.key)}>Generate</button>
                    </span>
                  </label>
                  <label data-label="Symbology"><select aria-label={`Barcode ${index + 1} symbology`} value={barcode.symbology} onChange={(event) => updateBarcode(barcode.key, "symbology", event.target.value)}><option>EAN13</option><option>UPC-A</option><option>CODE128</option><option>QR</option><option>DATA_MATRIX</option></select></label>
                  <label className="primary-barcode" data-label="Primary"><input aria-label={`Make barcode ${index + 1} primary`} type="radio" name="primary-barcode" checked={barcode.primary} onChange={() => setPrimaryBarcode(barcode.key)} /><span>Primary</span></label>
                  <button className="remove-line" type="button" aria-label={`Remove barcode ${index + 1}`} disabled={barcodes.length === 1} onClick={() => removeBarcode(barcode.key)}>×</button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="po-summary panel product-summary">
          <h2>Product summary</h2>
          <div><span>SKU</span><strong>{code || "Generating…"}</strong></div>
          <div><span>Status</span><strong>{active ? "Active" : "Inactive"}</strong></div>
          <div><span>Tracking</span><strong>{trackingPolicy === "NONE" ? "None" : trackingPolicy}</strong></div>
          <div><span>Barcodes</span><strong>{barcodes.filter((barcode) => barcode.value.trim()).length}</strong></div>
          <div><span>Weight</span><strong>{weightKg ? `${weightKg} kg` : "Not entered"}</strong></div>
          <div><span>Dimensions</span><strong>{dimensionsComplete ? `${lengthCm} × ${widthCm} × ${heightCm} cm` : "Incomplete"}</strong></div>
          <hr /><p>Active products are immediately available for purchase orders, sales orders, inventory, and warehouse tasks.</p>
        </aside>
      </div>
    </form>
  );
}
