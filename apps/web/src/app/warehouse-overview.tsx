"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWarehouse } from "@/components/warehouse-context";
import { API_URL } from "@/lib/api-url";
import { apiFetch } from "@/lib/api";

type PurchaseOrder = {
  id: string;
  orderNumber: string;
  supplierName: string;
  expectedAt: string;
  status: string;
  warehouse: { id: string };
  lines: { expectedQty: string; receivedQty: string }[];
};
type Balance = {
  id: string;
  status: string;
  onHandQty: string;
  reservedQty: string;
  warehouse: { id: string };
  location: { code: string };
  sku: { code: string; name: string };
};
type Task = {
  id: string;
  taskNumber: string;
  type: string;
  status: string;
  priority: number;
  warehouseId: string;
  assigneeId: string | null;
  referenceType: string;
  referenceId: string;
  payload: { title?: string; sourceLocation?: string | null; destinationLocation?: string | null };
};
type SalesOrder = {
  id: string;
  orderNumber: string;
  status: string;
  recipient: string;
  lines: { orderedQty: string; allocatedQty: string; pickedQty: string }[];
};
type Delivery = {
  id: string;
  trackingNumber: string;
  status: string;
  order: { orderNumber: string; recipient: string };
};
type OverviewData = { purchaseOrders: PurchaseOrder[]; balances: Balance[]; tasks: Task[]; orders: SalesOrder[]; deliveries: Delivery[] };
type Alert = { tone: "danger" | "warning" | "neutral"; icon: string; title: string; detail: string; href: string };

const EMPTY_DATA: OverviewData = { purchaseOrders: [], balances: [], tasks: [], orders: [], deliveries: [] };

function amount(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

export function WarehouseOverview() {
  const { selectedWarehouse } = useWarehouse();
  const [data, setData] = useState<OverviewData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const responses = await Promise.all([
        apiFetch(`${API_URL}/purchase-orders`),
        apiFetch(`${API_URL}/inventory-balances`),
        apiFetch(`${API_URL}/tasks`),
        apiFetch(`${API_URL}/sales-orders`),
        apiFetch(`${API_URL}/deliveries`),
      ]);
      if (responses.some((response) => !response.ok)) throw new Error("One or more operational feeds could not be loaded.");
      const [purchaseOrders, balances, tasks, orders, deliveries] = await Promise.all(responses.map((response) => response.json())) as [PurchaseOrder[], Balance[], Task[], SalesOrder[], Delivery[]];
      setData({ purchaseOrders, balances, tasks, orders, deliveries });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not connect to the WMS API.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const request = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(request);
  }, [load]);

  const scoped = useMemo(() => {
    const warehouseId = selectedWarehouse?.id;
    return {
      purchaseOrders: warehouseId ? data.purchaseOrders.filter((order) => order.warehouse.id === warehouseId) : data.purchaseOrders,
      balances: warehouseId ? data.balances.filter((balance) => balance.warehouse.id === warehouseId) : data.balances,
      tasks: warehouseId ? data.tasks.filter((task) => task.warehouseId === warehouseId) : data.tasks,
    };
  }, [data.balances, data.purchaseOrders, data.tasks, selectedWarehouse?.id]);

  const metrics = useMemo(() => {
    const expected = scoped.purchaseOrders.reduce((sum, order) => sum + order.lines.reduce((lineSum, line) => lineSum + Number(line.expectedQty), 0), 0);
    const received = scoped.purchaseOrders.reduce((sum, order) => sum + order.lines.reduce((lineSum, line) => lineSum + Number(line.receivedQty), 0), 0);
    const onHand = scoped.balances.reduce((sum, balance) => sum + Number(balance.onHandQty), 0);
    const reserved = scoped.balances.reduce((sum, balance) => sum + Number(balance.reservedQty), 0);
    const activeTasks = scoped.tasks.filter((task) => ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(task.status)).length;
    const readyOrders = data.orders.filter((order) => ["PICKED", "PACKED"].includes(order.status)).length;
    const allocated = data.orders.reduce((sum, order) => sum + order.lines.reduce((lineSum, line) => lineSum + Number(line.allocatedQty), 0), 0);
    const picked = data.orders.reduce((sum, order) => sum + order.lines.reduce((lineSum, line) => lineSum + Number(line.pickedQty), 0), 0);
    return { expected, received, remaining: Math.max(expected - received, 0), onHand, reserved, available: onHand - reserved, activeTasks, readyOrders, allocated, picked };
  }, [data.orders, scoped.balances, scoped.purchaseOrders, scoped.tasks]);

  const flow = useMemo(() => {
    const values = [metrics.expected, metrics.received, metrics.onHand, metrics.allocated, metrics.picked, data.deliveries.filter((delivery) => delivery.status === "DELIVERED").length];
    const maximum = Math.max(...values, 1);
    return ["Expected", "Received", "On hand", "Allocated", "Picked", "Delivered"].map((name, index) => ({ name, value: values[index], height: Math.max(10, Math.round((values[index] / maximum) * 100)) }));
  }, [data.deliveries, metrics]);

  const alerts = useMemo(() => {
    const items: Alert[] = [];
    scoped.tasks.filter((task) => task.status === "EXCEPTION").slice(0, 2).forEach((task) => items.push({ tone: "danger", icon: "!", title: task.payload.title || `${label(task.type)} exception`, detail: task.taskNumber, href: `/tasks/${task.id}` }));
    scoped.purchaseOrders.filter((order) => ["OPEN", "PARTIALLY_RECEIVED"].includes(order.status) && new Date(order.expectedAt) < new Date()).slice(0, 2).forEach((order) => items.push({ tone: "warning", icon: "↗", title: "Receipt overdue", detail: `${order.orderNumber} · ${order.supplierName}`, href: `/inbound/purchase-orders/${order.id}` }));
    scoped.balances.filter((balance) => balance.status === "AVAILABLE" && Number(balance.onHandQty) - Number(balance.reservedQty) <= 5).slice(0, 2).forEach((balance) => items.push({ tone: "warning", icon: "△", title: "Low available stock", detail: `${balance.sku.code} · ${amount(Number(balance.onHandQty) - Number(balance.reservedQty))} at ${balance.location.code}`, href: `/inventory/${balance.id}` }));
    data.deliveries.filter((delivery) => delivery.status === "FAILED").slice(0, 2).forEach((delivery) => items.push({ tone: "danger", icon: "×", title: "Delivery failed", detail: `${delivery.trackingNumber} · ${delivery.order.recipient}`, href: "/deliveries" }));
    return items.slice(0, 5);
  }, [data.deliveries, scoped.balances, scoped.purchaseOrders, scoped.tasks]);

  const activeTasks = scoped.tasks.filter((task) => ["OPEN", "ASSIGNED", "IN_PROGRESS", "EXCEPTION"].includes(task.status)).slice(0, 6);

  return (
    <div className="page-stack overview-page">
      <header className="page-header">
        <div><p className="eyebrow">{selectedWarehouse ? `${selectedWarehouse.code} · ${selectedWarehouse.timezone}` : "Warehouse operations"}</p><h1>{selectedWarehouse?.name ?? "Warehouse overview"}</h1><p className="subtitle">Live operational health across receiving, inventory, fulfillment, and delivery.</p></div>
        <div className="header-actions"><button className="button button-secondary" type="button" disabled={refreshing} onClick={() => void load(true)}>{refreshing ? "Refreshing…" : "Refresh data"}</button><Link className="button button-primary" href="/scan">Open scanner</Link></div>
      </header>

      {error && <div className="overview-error" role="alert"><strong>Overview unavailable</strong><span>{error}</span><button type="button" onClick={() => void load(true)}>Try again</button></div>}

      <section className="metric-grid" aria-label="Operational metrics">
        {[{ label: "Inbound remaining", value: metrics.remaining, detail: `${amount(metrics.received)} of ${amount(metrics.expected)} received` }, { label: "Available inventory", value: metrics.available, detail: `${amount(metrics.reserved)} reserved` }, { label: "Active tasks", value: metrics.activeTasks, detail: `${scoped.tasks.filter((task) => task.status === "EXCEPTION").length} exceptions` }, { label: "Ready to ship", value: metrics.readyOrders, detail: "Network-wide outbound orders" }].map((metric, index) => <article className="metric-card" key={metric.label}><div className={`metric-icon ${["blue", "green", "violet", "amber"][index]}`} /><p>{metric.label}</p><strong>{loading ? "—" : amount(metric.value)}</strong><span>{metric.detail}</span></article>)}
      </section>

      <p className="overview-scope-note"><span>●</span> Inbound, inventory, and tasks are filtered to {selectedWarehouse?.name ?? "the selected warehouse"}. Outbound orders and deliveries are currently network-wide.</p>

      <div className="dashboard-grid overview-grid">
        <section className="panel flow-panel"><div className="panel-heading"><div><h2>Fulfillment flow</h2><p>Live quantities by operational stage</p></div><Link className="text-link" href="/outbound">Open outbound →</Link></div><div className="flow-chart" aria-label="Live fulfillment stages">{flow.map((stage) => <div className="flow-column" key={stage.name}><span className="flow-value">{loading ? "—" : amount(stage.value)}</span><div className="flow-bar" style={{ height: `${stage.height}%` }} /><span>{stage.name}</span></div>)}</div></section>
        <section className="panel alert-panel"><div className="panel-heading"><div><h2>Exceptions</h2><p>Live conditions requiring attention</p></div><span className="count-badge">{alerts.length}</span></div><div className="alert-list">{alerts.map((alert) => <Link className={`alert-item ${alert.tone}`} href={alert.href} key={`${alert.title}-${alert.detail}`}><span>{alert.icon}</span><div><strong>{alert.title}</strong><p>{alert.detail}</p></div><b>→</b></Link>)}{!alerts.length && <div className="overview-clear"><span>✓</span><strong>Operations clear</strong><p>No current exceptions for this warehouse.</p></div>}</div><Link className="text-button" href="/tasks">View task queue →</Link></section>
      </div>

      <section className="panel tasks-panel overview-work-panel"><div className="panel-heading"><div><h2>Active work</h2><p>Open tasks for {selectedWarehouse?.name ?? "the selected warehouse"}</p></div><Link className="button button-secondary small" href="/tasks">View all tasks</Link></div><div className="table-wrap"><table><thead><tr><th>Task</th><th>Workflow</th><th>Route / reference</th><th>Assignee</th><th>Priority</th><th>Status</th></tr></thead><tbody>{activeTasks.map((task) => { const route = [task.payload.sourceLocation, task.payload.destinationLocation].filter(Boolean).join(" → "); return <tr className="clickable-row" key={task.id}><td><Link href={`/tasks/${task.id}`}><strong>{task.taskNumber}</strong></Link></td><td><Link href={`/tasks/${task.id}`}>{task.payload.title || label(task.type)}</Link></td><td><Link href={`/tasks/${task.id}`}>{route || `${label(task.referenceType)} · ${task.referenceId}`}</Link></td><td><Link href={`/tasks/${task.id}`}>{task.assigneeId || "Unassigned"}</Link></td><td><Link href={`/tasks/${task.id}`}><span className={`priority ${task.priority >= 2 ? "urgent" : "normal"}`}>{task.priority >= 3 ? "Critical" : task.priority === 2 ? "Urgent" : task.priority === 1 ? "High" : "Normal"}</span></Link></td><td><Link href={`/tasks/${task.id}`}><span className={`status ${task.status.toLowerCase().replaceAll("_", "-")}`}>{label(task.status)}</span></Link></td></tr>; })}{!activeTasks.length && <tr className="empty-table-row"><td colSpan={6}>{loading ? "Loading active work…" : "No active tasks for this warehouse."}</td></tr>}</tbody></table></div></section>
    </div>
  );
}
