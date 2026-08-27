"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/api-url";
import { apiFetch } from "@/lib/api";

type Barcode = { value: string; primary: boolean };
type PurchaseOrderLine = {
  id: string;
  expectedQty: string;
  receivedQty: string;
  unit: string;
  notes: string | null;
  sku: {
    code: string;
    name: string;
    barcodes: Barcode[];
  };
};
type PurchaseOrder = {
  id: string;
  orderNumber: string;
  supplierName: string;
  supplierReference: string | null;
  expectedAt: string;
  receivingDock: string | null;
  priority: number;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  warehouse: { code: string; name: string };
  lines: PurchaseOrderLine[];
};


const PRIORITIES = ["Normal", "High", "Urgent", "Critical"];

function quantity(value: string) {
  const amount = Number(value);
  return Number.isInteger(amount)
    ? amount.toLocaleString()
    : amount.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function dateTime(value: string, includeTime = false) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
  }).format(new Date(value));
}

function label(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

export function PurchaseOrderDetails({ id }: { id: string }) {
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOrder = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch(`${API_URL}/purchase-orders/${id}`);
      const body = (await response.json()) as PurchaseOrder & {
        message?: string | string[];
      };
      if (!response.ok) {
        const message = Array.isArray(body.message)
          ? body.message.join(" ")
          : body.message;
        throw new Error(message || "Could not load purchase order");
      }
      setOrder(body);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not connect to the WMS API.",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const request = window.setTimeout(() => void loadOrder(), 0);
    return () => window.clearTimeout(request);
  }, [loadOrder]);

  const totals = useMemo(() => {
    if (!order) return { expected: 0, received: 0, progress: 0 };
    const expected = order.lines.reduce(
      (sum, line) => sum + Number(line.expectedQty),
      0,
    );
    const received = order.lines.reduce(
      (sum, line) => sum + Number(line.receivedQty),
      0,
    );
    return {
      expected,
      received,
      progress: expected ? Math.round((received / expected) * 100) : 0,
    };
  }, [order]);

  if (loading) {
    return (
      <div className="detail-state panel" role="status">
        <span className="detail-spinner" />
        <h1>Loading purchase order</h1>
        <p>Retrieving receiving details and expected items…</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="detail-state panel">
        <span className="detail-state-icon">!</span>
        <h1>Purchase order unavailable</h1>
        <p>{error || "This order could not be found."}</p>
        <div className="header-actions">
          <Link className="button button-secondary" href="/inbound">
            Back to inbound
          </Link>
          <button className="button button-primary" onClick={() => void loadOrder()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const statusClass = order.status.toLowerCase().replaceAll("_", "-");

  return (
    <div className="po-detail-page">
      <header className="po-header detail-header">
        <div>
          <Link className="back-link" href="/inbound">
            ← Back to inbound
          </Link>
          <div className="detail-title-row">
            <h1>{order.orderNumber}</h1>
            <span className={`status ${statusClass}`}>{label(order.status)}</span>
          </div>
          <p className="subtitle">
            Expected receipt from {order.supplierName} at {order.warehouse.name}
          </p>
        </div>
        <div className="header-actions detail-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={() => window.print()}
          >
            Print
          </button>
          <Link className="button button-primary" href={`/scan?purchaseOrder=${order.id}`}>
            Receive items
          </Link>
        </div>
      </header>

      <section className="detail-metrics" aria-label="Purchase order summary">
        <article className="panel">
          <span>Expected units</span>
          <strong>{quantity(String(totals.expected))}</strong>
          <small>Across {order.lines.length} SKU lines</small>
        </article>
        <article className="panel">
          <span>Received units</span>
          <strong>{quantity(String(totals.received))}</strong>
          <small>{quantity(String(totals.expected - totals.received))} remaining</small>
        </article>
        <article className="panel progress-metric">
          <span>Receiving progress</span>
          <strong>{totals.progress}%</strong>
          <div className="progress-track" aria-label={`${totals.progress}% received`}>
            <i style={{ width: `${totals.progress}%` }} />
          </div>
        </article>
      </section>

      <div className="detail-layout">
        <main className="detail-main">
          <section className="panel detail-lines-panel">
            <div className="panel-heading">
              <div>
                <h2>Expected items</h2>
                <p>Line-level quantities and receiving progress</p>
              </div>
              <span className="detail-count">
                {order.lines.length} line{order.lines.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="table-wrap detail-table">
              <table>
                <thead>
                  <tr>
                    <th>SKU / product</th>
                    <th>Barcode</th>
                    <th>Expected</th>
                    <th>Received</th>
                    <th>Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((line) => {
                    const expected = Number(line.expectedQty);
                    const received = Number(line.receivedQty);
                    const barcode =
                      line.sku.barcodes.find((item) => item.primary)?.value ??
                      line.sku.barcodes[0]?.value ??
                      "—";
                    return (
                      <tr key={line.id}>
                        <td>
                          <strong>{line.sku.code}</strong>
                          <small>{line.sku.name}</small>
                          {line.notes && <em>{line.notes}</em>}
                        </td>
                        <td className="barcode-value">{barcode}</td>
                        <td>{quantity(line.expectedQty)} {line.unit}</td>
                        <td>{quantity(line.receivedQty)} {line.unit}</td>
                        <td><strong>{quantity(String(expected - received))} {line.unit}</strong></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {order.notes && (
            <section className="panel order-notes">
              <h2>Receiving notes</h2>
              <p>{order.notes}</p>
            </section>
          )}
        </main>

        <aside className="panel detail-sidebar">
          <div className="panel-heading">
            <div>
              <h2>Order information</h2>
              <p>Receiving and supplier details</p>
            </div>
          </div>
          <dl>
            <div><dt>Supplier</dt><dd>{order.supplierName}</dd></div>
            <div><dt>Supplier reference</dt><dd>{order.supplierReference || "—"}</dd></div>
            <div><dt>Warehouse</dt><dd>{order.warehouse.code} · {order.warehouse.name}</dd></div>
            <div><dt>Expected arrival</dt><dd>{dateTime(order.expectedAt)}</dd></div>
            <div><dt>Receiving dock</dt><dd>{order.receivingDock || "Unassigned"}</dd></div>
            <div><dt>Priority</dt><dd>{PRIORITIES[order.priority] ?? "Normal"}</dd></div>
            <div><dt>Created</dt><dd>{dateTime(order.createdAt, true)}</dd></div>
            <div><dt>Last updated</dt><dd>{dateTime(order.updatedAt, true)}</dd></div>
          </dl>
          <div className="detail-id">
            <span>Internal order ID</span>
            <code>{order.id}</code>
          </div>
        </aside>
      </div>
    </div>
  );
}
