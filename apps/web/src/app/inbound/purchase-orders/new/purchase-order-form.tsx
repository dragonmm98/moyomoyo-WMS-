"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/api-url";
import { apiFetch } from "@/lib/api";

type Warehouse = { id: string; code: string; name: string };
type Sku = {
  id: string;
  code: string;
  name: string;
  barcodes: { value: string; primary: boolean }[];
};
type Line = {
  key: number;
  skuId: string;
  expectedQty: string;
  unit: string;
  notes: string;
};
type SubmitStatus = "idle" | "saving" | "success" | "error";

const FALLBACK_WAREHOUSE: Warehouse = {
  id: "",
  code: "SEL-01",
  name: "Seoul Fulfillment Center",
};
const FALLBACK_SKU: Sku = {
  id: "",
  code: "DEMO-001",
  name: "Demo Expiry-Tracked Product",
  barcodes: [{ value: "880000000001", primary: true }],
};

export function PurchaseOrderForm({
  initialOrderNumber,
  initialExpectedAt,
}: {
  initialOrderNumber: string;
  initialExpectedAt: string;
}) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([
    FALLBACK_WAREHOUSE,
  ]);
  const [skus, setSkus] = useState<Sku[]>([FALLBACK_SKU]);
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [warehouseId, setWarehouseId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierReference, setSupplierReference] = useState("");
  const [expectedAt, setExpectedAt] = useState(initialExpectedAt);
  const [receivingDock, setReceivingDock] = useState("Dock 01");
  const [priority, setPriority] = useState("0");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { key: 1, skuId: "", expectedQty: "1", unit: "EA", notes: "" },
  ]);
  const [nextKey, setNextKey] = useState(2);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [message, setMessage] = useState("");
  const [createdOrderId, setCreatedOrderId] = useState("");

  useEffect(() => {
    async function loadReferenceData() {
      try {
        const [warehouseResponse, skuResponse] = await Promise.all([
          apiFetch(`${API_URL}/warehouses`),
          apiFetch(`${API_URL}/skus`),
        ]);
        if (!warehouseResponse.ok || !skuResponse.ok) return;
        const warehouseData = (await warehouseResponse.json()) as Warehouse[];
        const skuData = (await skuResponse.json()) as Sku[];
        if (warehouseData.length) {
          setWarehouses(warehouseData);
          setWarehouseId(warehouseData[0].id);
        }
        if (skuData.length) setSkus(skuData);
      } catch {
        // The form remains usable and explains connection errors during submit.
      }
    }
    void loadReferenceData();
  }, []);

  const totalUnits = useMemo(
    () =>
      lines.reduce((total, line) => total + (Number(line.expectedQty) || 0), 0),
    [lines],
  );
  const selectedSkuIds = useMemo(
    () => new Set(lines.map((line) => line.skuId).filter(Boolean)),
    [lines],
  );

  function updateLine(
    key: number,
    field: keyof Omit<Line, "key">,
    value: string,
  ) {
    setLines((current) =>
      current.map((line) =>
        line.key === key ? { ...line, [field]: value } : line,
      ),
    );
  }

  function addLine() {
    setLines((current) => [
      ...current,
      { key: nextKey, skuId: "", expectedQty: "1", unit: "EA", notes: "" },
    ]);
    setNextKey((current) => current + 1);
  }

  function removeLine(key: number) {
    setLines((current) =>
      current.length === 1
        ? current
        : current.filter((line) => line.key !== key),
    );
  }

  async function submit(status: "DRAFT" | "OPEN") {
    setMessage("");
    if (
      !warehouseId ||
      !supplierName.trim() ||
      !orderNumber.trim() ||
      !expectedAt
    ) {
      setSubmitStatus("error");
      setMessage("Complete the required order details before continuing.");
      return;
    }
    if (lines.some((line) => !line.skuId || Number(line.expectedQty) <= 0)) {
      setSubmitStatus("error");
      setMessage(
        "Every line needs a SKU and an expected quantity greater than zero.",
      );
      return;
    }

    setSubmitStatus("saving");
    try {
      const response = await apiFetch(`${API_URL}/purchase-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: orderNumber.trim().toUpperCase(),
          warehouseId,
          supplierName: supplierName.trim(),
          supplierReference: supplierReference.trim() || undefined,
          expectedAt: new Date(`${expectedAt}T09:00:00`).toISOString(),
          receivingDock: receivingDock.trim() || undefined,
          priority: Number(priority),
          status,
          notes: notes.trim() || undefined,
          lines: lines.map((line) => ({
            skuId: line.skuId,
            expectedQty: Number(line.expectedQty),
            unit: line.unit,
            notes: line.notes.trim() || undefined,
          })),
        }),
      });
      const body = (await response.json()) as {
        id?: string;
        orderNumber?: string;
        message?: string | string[];
      };
      if (!response.ok)
        throw new Error(
          Array.isArray(body.message)
            ? body.message.join(" ")
            : body.message || "Could not create purchase order",
        );
      setSubmitStatus("success");
      setCreatedOrderId(body.id ?? "");
      setMessage(
        `${body.orderNumber ?? orderNumber} was ${status === "DRAFT" ? "saved as a draft" : "opened for receiving"}.`,
      );
    } catch (error) {
      setSubmitStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "The API is unavailable. Start the WMS API and try again.",
      );
    }
  }

  return (
    <form
      className="po-page"
      onSubmit={(event) => {
        event.preventDefault();
        void submit("OPEN");
      }}
    >
      <header className="po-header">
        <div>
          <Link className="back-link" href="/inbound">
            ← Back to inbound
          </Link>
          <p className="eyebrow">Inbound operations</p>
          <h1>New purchase order</h1>
          <p className="subtitle">
            Create an expected receipt and define the SKUs arriving at the
            warehouse.
          </p>
        </div>
        <div className="header-actions">
          <button
            className="button button-secondary"
            type="button"
            disabled={submitStatus === "saving"}
            onClick={() => void submit("DRAFT")}
          >
            Save draft
          </button>
          <button
            className="button button-primary"
            type="submit"
            disabled={submitStatus === "saving"}
          >
            {submitStatus === "saving" ? "Creating…" : "Create purchase order"}
          </button>
        </div>
      </header>

      {message && (
        <div
          className={`form-banner ${submitStatus}`}
          role={submitStatus === "error" ? "alert" : "status"}
        >
          <strong>
            {submitStatus === "success" ? "✓ Success" : "Check the order"}
          </strong>
          <span>{message}</span>
          {submitStatus === "success" && (
            <Link
              href={
                createdOrderId
                  ? `/inbound/purchase-orders/${createdOrderId}`
                  : "/inbound"
              }
            >
              View order details →
            </Link>
          )}
        </div>
      )}

      <div className="po-layout">
        <div className="po-main">
          <section className="panel form-panel">
            <div className="panel-heading">
              <div>
                <h2>Order details</h2>
                <p>Supplier, destination, and receiving schedule</p>
              </div>
              <span className="required-note">* Required</span>
            </div>
            <div className="form-grid">
              <label>
                <span>Purchase order number *</span>
                <input
                  value={orderNumber}
                  onChange={(event) =>
                    setOrderNumber(event.target.value.toUpperCase())
                  }
                  placeholder="PO-260714-001"
                  required
                />
              </label>
              <label>
                <span>Warehouse *</span>
                <select
                  value={warehouseId}
                  onChange={(event) => setWarehouseId(event.target.value)}
                  required
                >
                  <option value="" disabled>
                    Select warehouse
                  </option>
                  {warehouses.map((warehouse) => (
                    <option
                      key={warehouse.id || warehouse.code}
                      value={warehouse.id}
                    >
                      {warehouse.code} · {warehouse.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Supplier name *</span>
                <input
                  value={supplierName}
                  onChange={(event) => setSupplierName(event.target.value)}
                  placeholder="e.g. Hanul Distribution"
                  required
                />
              </label>
              <label>
                <span>Supplier reference</span>
                <input
                  value={supplierReference}
                  onChange={(event) => setSupplierReference(event.target.value)}
                  placeholder="Invoice or ASN number"
                />
              </label>
              <label>
                <span>Expected arrival *</span>
                <input
                  type="date"
                  value={expectedAt}
                  onChange={(event) => setExpectedAt(event.target.value)}
                  required
                />
              </label>
              <label>
                <span>Receiving dock</span>
                <select
                  value={receivingDock}
                  onChange={(event) => setReceivingDock(event.target.value)}
                >
                  <option>Dock 01</option>
                  <option>Dock 02</option>
                  <option>Dock 03</option>
                  <option>Unassigned</option>
                </select>
              </label>
              <label>
                <span>Priority</span>
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                >
                  <option value="0">Normal</option>
                  <option value="1">High</option>
                  <option value="2">Urgent</option>
                  <option value="3">Critical</option>
                </select>
              </label>
              <label className="full">
                <span>Receiving notes</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Delivery instructions, inspection requirements, or handling notes"
                  rows={3}
                />
              </label>
            </div>
          </section>

          <section className="panel form-panel line-panel">
            <div className="panel-heading">
              <div>
                <h2>Expected items</h2>
                <p>Add each SKU expected in this delivery</p>
              </div>
              <button
                className="button button-secondary small"
                type="button"
                onClick={addLine}
              >
                + Add line
              </button>
            </div>
            <div className="po-lines">
              <div className="po-line po-line-header">
                <span>SKU / product *</span>
                <span>Expected qty *</span>
                <span>Unit</span>
                <span>Line notes</span>
                <span />
              </div>
              {lines.map((line, index) => {
                const sku = skus.find((item) => item.id === line.skuId);
                return (
                  <div className="po-line" key={line.key}>
                    <label data-label="SKU / product">
                      <select
                        aria-label={`Line ${index + 1} SKU`}
                        value={line.skuId}
                        onChange={(event) =>
                          updateLine(line.key, "skuId", event.target.value)
                        }
                        required
                      >
                        <option value="" disabled>
                          Select a SKU
                        </option>
                        {skus.map((option) => (
                          <option
                            key={option.id || option.code}
                            value={option.id}
                            disabled={
                              option.id !== line.skuId &&
                              selectedSkuIds.has(option.id)
                            }
                          >
                            {option.code} · {option.name}
                          </option>
                        ))}
                      </select>
                      {sku && (
                        <small>
                          {sku.barcodes.find((barcode) => barcode.primary)
                            ?.value ??
                            sku.barcodes[0]?.value ??
                            "No barcode"}
                        </small>
                      )}
                    </label>
                    <label data-label="Expected quantity">
                      <input
                        aria-label={`Line ${index + 1} expected quantity`}
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={line.expectedQty}
                        onChange={(event) =>
                          updateLine(
                            line.key,
                            "expectedQty",
                            event.target.value,
                          )
                        }
                        required
                      />
                    </label>
                    <label data-label="Unit">
                      <select
                        aria-label={`Line ${index + 1} unit`}
                        value={line.unit}
                        onChange={(event) =>
                          updateLine(line.key, "unit", event.target.value)
                        }
                      >
                        <option>EA</option>
                        <option>CASE</option>
                        <option>PALLET</option>
                        <option>KG</option>
                      </select>
                    </label>
                    <label data-label="Line notes">
                      <input
                        aria-label={`Line ${index + 1} notes`}
                        value={line.notes}
                        onChange={(event) =>
                          updateLine(line.key, "notes", event.target.value)
                        }
                        placeholder="Optional"
                      />
                    </label>
                    <button
                      className="remove-line"
                      type="button"
                      aria-label={`Remove line ${index + 1}`}
                      onClick={() => removeLine(line.key)}
                      disabled={lines.length === 1}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="line-footer">
              <button type="button" onClick={addLine}>
                + Add another item
              </button>
              <span>
                {lines.length} line{lines.length === 1 ? "" : "s"} ·{" "}
                <strong>{totalUnits.toLocaleString()} units</strong>
              </span>
            </div>
          </section>
        </div>
        <aside className="po-summary panel">
          <h2>Order summary</h2>
          <div>
            <span>Purchase order</span>
            <strong>{orderNumber || "Not assigned"}</strong>
          </div>
          <div>
            <span>Destination</span>
            <strong>
              {warehouses.find((warehouse) => warehouse.id === warehouseId)
                ?.code ?? "Select warehouse"}
            </strong>
          </div>
          <div>
            <span>Expected arrival</span>
            <strong>{expectedAt || "Not scheduled"}</strong>
          </div>
          <div>
            <span>SKU lines</span>
            <strong>{lines.filter((line) => line.skuId).length}</strong>
          </div>
          <div>
            <span>Total expected</span>
            <strong>{totalUnits.toLocaleString()} units</strong>
          </div>
          <hr />
          <p>
            Creating this order as <b>Open</b> makes it available to receiving
            workers immediately.
          </p>
        </aside>
      </div>
    </form>
  );
}
