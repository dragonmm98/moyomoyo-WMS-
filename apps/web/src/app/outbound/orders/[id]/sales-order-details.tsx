"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/api-url";
import { apiFetch } from "@/lib/api";

type Address = {
  line1: string;
  line2?: string;
  city: string;
  postalCode: string;
  country: string;
  phone: string;
  shippingMethod: string;
  instructions?: string;
};
type Line = {
  id: string;
  orderedQty: string;
  allocatedQty: string;
  pickedQty: string;
  sku: {
    code: string;
    name: string;
    barcodes: { value: string; primary: boolean }[];
    balances: { onHandQty: string; reservedQty: string; status: string }[];
  };
};
type SalesOrder = {
  id: string;
  orderNumber: string;
  status: string;
  priority: number;
  recipient: string;
  address: Address;
  version: number;
  createdAt: string;
  updatedAt: string;
  lines: Line[];
};

const PRIORITIES = ["Normal", "High", "Urgent", "Critical"];
const FLOW = ["READY_TO_ALLOCATE", "ALLOCATED", "PICKING", "PICKED", "PACKED", "SHIPPED"];

function amount(value: number | string) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function label(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function date(value: string, withTime = false) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" as const } : {}),
  }).format(new Date(value));
}

export function SalesOrderDetails({ id }: { id: string }) {
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch(`${API_URL}/sales-orders/${id}`);
      const body = (await response.json()) as SalesOrder & { message?: string };
      if (!response.ok) throw new Error(body.message || "Could not load sales order.");
      setOrder(body);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not connect to the WMS API.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const request = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(request);
  }, [load]);

  const totals = useMemo(() => {
    if (!order) return { ordered: 0, allocated: 0, picked: 0, progress: 0 };
    const ordered = order.lines.reduce((sum, line) => sum + Number(line.orderedQty), 0);
    const allocated = order.lines.reduce((sum, line) => sum + Number(line.allocatedQty), 0);
    const picked = order.lines.reduce((sum, line) => sum + Number(line.pickedQty), 0);
    return { ordered, allocated, picked, progress: ordered ? Math.round((picked / ordered) * 100) : 0 };
  }, [order]);

  if (loading)
    return <div className="detail-state panel" role="status"><span className="detail-spinner" /><h1>Loading sales order</h1><p>Retrieving customer, fulfillment, and shipping details…</p></div>;

  if (error || !order)
    return (
      <div className="detail-state panel">
        <span className="detail-state-icon">!</span><h1>Sales order unavailable</h1><p>{error || "This order could not be found."}</p>
        <div className="header-actions"><Link className="button button-secondary" href="/outbound">Back to outbound</Link><button className="button button-primary" onClick={() => void load()}>Try again</button></div>
      </div>
    );

  const activeStage = FLOW.indexOf(order.status);

  return (
    <div className="po-detail-page sales-order-detail">
      <header className="po-header detail-header">
        <div>
          <Link className="back-link" href="/outbound">← Back to outbound</Link>
          <div className="detail-title-row"><h1>{order.orderNumber}</h1><span className={`status ${order.status.toLowerCase().replaceAll("_", "-")}`}>{label(order.status)}</span></div>
          <p className="subtitle">Customer order for {order.recipient} · {order.address.city}</p>
        </div>
        <div className="header-actions detail-actions"><button className="button button-secondary" type="button" onClick={() => window.print()}>Print</button><Link className="button button-secondary" href="/tasks">Fulfillment tasks</Link><Link className="button button-primary" href={`/deliveries?orderId=${order.id}`}>Create delivery</Link></div>
      </header>

      <section className="detail-metrics inventory-metrics" aria-label="Sales order quantity summary">
        <article className="panel"><span>Ordered units</span><strong>{amount(totals.ordered)}</strong><small>Across {order.lines.length} SKU line{order.lines.length === 1 ? "" : "s"}</small></article>
        <article className="panel"><span>Allocated units</span><strong>{amount(totals.allocated)}</strong><small>{amount(totals.ordered - totals.allocated)} awaiting allocation</small></article>
        <article className="panel"><span>Picked units</span><strong>{amount(totals.picked)}</strong><small>{amount(totals.ordered - totals.picked)} remaining</small></article>
        <article className="panel progress-metric"><span>Picking progress</span><strong>{totals.progress}%</strong><div className="progress-track" aria-label={`${totals.progress}% picked`}><i style={{ width: `${totals.progress}%` }} /></div></article>
      </section>

      <section className="panel fulfillment-flow">
        {FLOW.map((stage, index) => (
          <div className={index <= activeStage ? "complete" : ""} key={stage}><span>{index < activeStage ? "✓" : index + 1}</span><strong>{label(stage)}</strong></div>
        ))}
      </section>

      <div className="detail-layout">
        <main className="detail-main">
          <section className="panel detail-lines-panel">
            <div className="panel-heading"><div><h2>Order items</h2><p>Allocation, picking, and available stock by SKU</p></div><span className="detail-count">{order.lines.length} line{order.lines.length === 1 ? "" : "s"}</span></div>
            <div className="table-wrap detail-table sales-lines-table">
              <table><thead><tr><th>SKU / product</th><th>Barcode</th><th>Ordered</th><th>Allocated</th><th>Picked</th><th>Available</th></tr></thead>
                <tbody>{order.lines.map((line) => {
                  const barcode = line.sku.barcodes.find((item) => item.primary)?.value ?? line.sku.barcodes[0]?.value ?? "—";
                  const available = line.sku.balances.filter((balance) => balance.status === "AVAILABLE").reduce((sum, balance) => sum + Number(balance.onHandQty) - Number(balance.reservedQty), 0);
                  return <tr key={line.id}><td><strong>{line.sku.code}</strong><small>{line.sku.name}</small></td><td className="barcode-value">{barcode}</td><td>{amount(line.orderedQty)}</td><td>{amount(line.allocatedQty)}</td><td>{amount(line.pickedQty)}</td><td><strong>{amount(available)}</strong></td></tr>;
                })}</tbody>
              </table>
            </div>
          </section>
          {order.address.instructions && <section className="panel order-notes"><h2>Delivery instructions</h2><p>{order.address.instructions}</p></section>}
        </main>

        <aside className="panel detail-sidebar">
          <div className="panel-heading"><div><h2>Shipping information</h2><p>Customer and delivery details</p></div></div>
          <dl>
            <div><dt>Recipient</dt><dd>{order.recipient}</dd></div>
            <div><dt>Phone</dt><dd>{order.address.phone}</dd></div>
            <div><dt>Shipping address</dt><dd>{order.address.line1}{order.address.line2 ? `, ${order.address.line2}` : ""}<br />{order.address.city} {order.address.postalCode}<br />{order.address.country}</dd></div>
            <div><dt>Shipping service</dt><dd>{order.address.shippingMethod}</dd></div>
            <div><dt>Priority</dt><dd>{PRIORITIES[order.priority] ?? "Normal"}</dd></div>
            <div><dt>Created</dt><dd>{date(order.createdAt, true)}</dd></div>
            <div><dt>Last updated</dt><dd>{date(order.updatedAt, true)}</dd></div>
          </dl>
          <div className="detail-id"><span>Sales order ID · version {order.version}</span><code>{order.id}</code></div>
        </aside>
      </div>
    </div>
  );
}
