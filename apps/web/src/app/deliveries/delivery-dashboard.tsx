"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/api-url";
import { apiFetch } from "@/lib/api";
import logoStyles from "./provider-logo.module.css";

type Provider = {
  id: string;
  name: string;
  status: string;
  description: string;
  capabilities: string[];
};

type SalesOrder = {
  id: string;
  orderNumber: string;
  recipient: string;
  status: string;
  address: { city?: string; postalCode?: string; line1?: string; country?: string };
};

type DeliveryEvent = {
  id: string;
  status: string;
  description: string;
  location: string | null;
  occurredAt: string;
};

type Delivery = {
  id: string;
  provider: string;
  service: string;
  trackingNumber: string;
  status: string;
  estimatedDeliveryAt: string | null;
  createdAt: string;
  order: SalesOrder & { lines: { orderedQty: string }[] };
  events: DeliveryEvent[];
};

const TERMINAL_STATUSES = ["DELIVERED", "FAILED", "CANCELLED"];

function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function date(value: string, withTime = false) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" as const } : {}),
  }).format(new Date(value));
}

function nextAction(status: string) {
  return ({ CREATED: "Mark picked up", PICKED_UP: "Move in transit", IN_TRANSIT: "Out for delivery", OUT_FOR_DELIVERY: "Mark delivered" } as Record<string, string>)[status] ?? "Complete";
}

function ProviderLogo({ provider }: { provider: Provider }) {
  const providerClass = ({
    SANDBOX: logoStyles.sandbox,
    KAKAO: logoStyles.kakao,
    KOREA_POST: logoStyles.koreaPost,
    CJ: logoStyles.cj,
    HANJIN: logoStyles.hanjin,
    LOTTE: logoStyles.lotte,
    DHL_FEDEX: logoStyles.dhlFedex,
  } as Record<string, string>)[provider.id];
  const logoClass = `${logoStyles.logo} ${providerClass}`;

  if (provider.id === "SANDBOX")
    return <span className={logoClass} role="img" aria-label="Sandbox Delivery logo"><svg viewBox="0 0 72 40"><path d="M8 13 19 6l11 7v14l-11 7-11-7Z" /><path d="m8 13 11 7 11-7M19 20v14" /><text x="38" y="25">SBOX</text></svg></span>;
  if (provider.id === "KAKAO")
    return <span className={logoClass} role="img" aria-label="Kakao Mobility logo"><svg viewBox="0 0 72 40"><rect x="4" y="4" width="32" height="32" rx="9" /><text className={logoStyles.kakaoT} x="20" y="27">T</text><text x="42" y="24">kakao</text></svg></span>;
  if (provider.id === "KOREA_POST")
    return <span className={logoClass} role="img" aria-label="Korea Post logo"><svg viewBox="0 0 72 40"><path d="M5 23c8-13 18-14 29-10-6 1-11 4-14 9 6-3 12-3 18-1-10 0-17 4-22 11Z" /><text x="40" y="20">KOREA</text><text x="40" y="29">POST</text></svg></span>;
  if (provider.id === "CJ")
    return <span className={logoClass} role="img" aria-label="CJ Logistics logo"><svg viewBox="0 0 72 40"><ellipse className={logoStyles.cjRed} cx="14" cy="12" rx="9" ry="6" transform="rotate(-28 14 12)" /><ellipse className={logoStyles.cjOrange} cx="12" cy="25" rx="9" ry="6" transform="rotate(28 12 25)" /><ellipse className={logoStyles.cjBlue} cx="26" cy="22" rx="9" ry="6" transform="rotate(-58 26 22)" /><text x="37" y="24">CJ</text><text className={logoStyles.sub} x="37" y="32">LOGISTICS</text></svg></span>;
  if (provider.id === "HANJIN")
    return <span className={logoClass} role="img" aria-label="Hanjin logo"><svg viewBox="0 0 72 40"><circle cx="18" cy="20" r="15" /><path d="M10 11v18M26 11v18M10 20h16" /><text x="38" y="24">HANJIN</text></svg></span>;
  if (provider.id === "LOTTE")
    return <span className={logoClass} role="img" aria-label="Lotte Global Logistics logo"><svg viewBox="0 0 72 40"><circle cx="17" cy="20" r="15" /><path d="M13 11v17h11" /><text x="38" y="21">LOTTE</text><text className={logoStyles.sub} x="38" y="30">GLOBAL</text></svg></span>;
  return <span className={logoClass} role="img" aria-label="DHL and FedEx logos"><svg viewBox="0 0 92 40"><rect className={logoStyles.dhlBg} x="2" y="6" width="40" height="28" rx="4" /><text className={logoStyles.dhlText} x="7" y="25">DHL</text><text className={logoStyles.fed} x="47" y="25">Fed</text><text className={logoStyles.ex} x="72" y="25">Ex</text></svg></span>;
}

export function DeliveryDashboard() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [service, setService] = useState("STANDARD");
  const [selectedId, setSelectedId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [deliveryResponse, providerResponse, orderResponse] = await Promise.all([
        apiFetch(`${API_URL}/deliveries`),
        apiFetch(`${API_URL}/deliveries/providers`),
        apiFetch(`${API_URL}/sales-orders`),
      ]);
      if (!deliveryResponse.ok || !providerResponse.ok || !orderResponse.ok) throw new Error("Could not load the delivery sandbox.");
      const [deliveryBody, providerBody, orderBody] = await Promise.all([
        deliveryResponse.json() as Promise<Delivery[]>,
        providerResponse.json() as Promise<Provider[]>,
        orderResponse.json() as Promise<SalesOrder[]>,
      ]);
      setDeliveries(deliveryBody);
      setProviders(providerBody);
      setOrders(orderBody);
      setSelectedId((current) => current || deliveryBody[0]?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not connect to the WMS API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const request = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(request);
  }, [load]);

  useEffect(() => {
    const request = window.setTimeout(() => {
      if (new URLSearchParams(window.location.search).has("orderId")) setShowCreate(true);
    }, 0);
    return () => window.clearTimeout(request);
  }, []);

  const eligibleOrders = useMemo(() => {
    const activeOrderIds = new Set(deliveries.filter((delivery) => !["FAILED", "CANCELLED"].includes(delivery.status)).map((delivery) => delivery.order.id));
    return orders.filter((order) => order.status !== "CANCELLED" && !activeOrderIds.has(order.id));
  }, [deliveries, orders]);

  useEffect(() => {
    if (!showCreate || orderId || !eligibleOrders.length) return;
    const request = window.setTimeout(() => {
      const requestedOrderId = new URLSearchParams(window.location.search).get("orderId");
      setOrderId(eligibleOrders.some((order) => order.id === requestedOrderId) ? requestedOrderId! : eligibleOrders[0].id);
    }, 0);
    return () => window.clearTimeout(request);
  }, [eligibleOrders, orderId, showCreate]);

  const metrics = useMemo(() => ({
    pending: deliveries.filter((delivery) => ["CREATED", "PICKED_UP"].includes(delivery.status)).length,
    transit: deliveries.filter((delivery) => ["IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(delivery.status)).length,
    delivered: deliveries.filter((delivery) => delivery.status === "DELIVERED").length,
    exceptions: deliveries.filter((delivery) => ["FAILED", "CANCELLED"].includes(delivery.status)).length,
  }), [deliveries]);

  const selected = deliveries.find((delivery) => delivery.id === selectedId) ?? null;

  async function createDelivery(event: React.FormEvent) {
    event.preventDefault();
    if (!orderId) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await apiFetch(`${API_URL}/deliveries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, service }),
      });
      const body = (await response.json()) as Delivery & { message?: string | string[] };
      if (!response.ok) throw new Error(Array.isArray(body.message) ? body.message.join(" ") : body.message || "Could not create the test delivery.");
      setMessage(`${body.trackingNumber} was created with Sandbox Delivery.`);
      setSelectedId(body.id);
      setShowCreate(false);
      setOrderId("");
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create the test delivery.");
    } finally {
      setSaving(false);
    }
  }

  async function runAction(delivery: Delivery, action: "ADVANCE" | "FAIL" | "CANCEL") {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await apiFetch(`${API_URL}/deliveries/${delivery.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = (await response.json()) as Delivery & { message?: string };
      if (!response.ok) throw new Error(body.message || "Could not update the delivery.");
      setMessage(`${body.trackingNumber} moved to ${label(body.status)}.`);
      setSelectedId(body.id);
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not update the delivery.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack delivery-page">
      <header className="page-header">
        <div><p className="eyebrow">Last-mile simulation</p><h1>Deliveries</h1><p className="subtitle">Create labels and test delivery tracking without connecting a production carrier.</p></div>
        <div className="header-actions"><Link className="button button-secondary" href="/outbound">View outbound</Link><button className="button button-primary" type="button" onClick={() => setShowCreate((current) => !current)}>+ Test delivery</button></div>
      </header>

      {(error || message) && <div className={`delivery-banner ${error ? "error" : "success"}`} role={error ? "alert" : "status"}><strong>{error ? "Delivery sandbox error" : "Sandbox event recorded"}</strong><span>{error || message}</span></div>}

      <section className="metric-grid" aria-label="Delivery metrics">
        {[{ label: "Pending pickup", value: metrics.pending, detail: "Created or collected" }, { label: "In transit", value: metrics.transit, detail: "Moving through network" }, { label: "Delivered", value: metrics.delivered, detail: "Completed simulations" }, { label: "Exceptions", value: metrics.exceptions, detail: "Failed or cancelled" }].map((metric, index) => <article className="metric-card compact" key={metric.label}><div className={`metric-icon ${["blue", "amber", "green", "violet"][index]}`} /><p>{metric.label}</p><strong>{loading ? "—" : metric.value}</strong><span>{metric.detail}</span></article>)}
      </section>

      {showCreate && <section className="panel delivery-create-panel">
        <div className="panel-heading"><div><h2>Create test delivery</h2><p>The sandbox provider generates a label, ETA, tracking number, and initial event.</p></div><span className="sandbox-badge">Sandbox only</span></div>
        <form onSubmit={createDelivery}>
          <label><span>Outbound order</span><select value={orderId} onChange={(event) => setOrderId(event.target.value)} required><option value="">Select an order</option>{eligibleOrders.map((order) => <option value={order.id} key={order.id}>{order.orderNumber} · {order.recipient} · {order.address.city || "No city"}</option>)}</select></label>
          <label><span>Test service</span><select value={service} onChange={(event) => setService(event.target.value)}><option value="STANDARD">Standard · 3 days</option><option value="EXPRESS">Express · next day</option><option value="SAME_DAY">Same day · by 20:00</option></select></label>
          <div><button className="button button-secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</button><button className="button button-primary" type="submit" disabled={saving || !orderId}>{saving ? "Creating…" : "Create sandbox shipment"}</button></div>
        </form>
        {!eligibleOrders.length && <p className="delivery-form-note">Every eligible outbound order already has an active delivery. Create another order or fail/cancel a sandbox delivery to test again.</p>}
      </section>}

      <section className="panel delivery-list-panel">
        <div className="panel-heading"><div><h2>Sandbox shipments</h2><p>Use the controls to simulate carrier status callbacks.</p></div><span className="detail-count">{deliveries.length}</span></div>
        <div className="table-wrap"><table className="delivery-table"><thead><tr><th>Tracking</th><th>Order / recipient</th><th>Provider / service</th><th>ETA</th><th>Status</th><th>Simulation</th></tr></thead><tbody>
          {deliveries.map((delivery) => <tr key={delivery.id} className={selectedId === delivery.id ? "selected" : ""}><td><button className="delivery-tracking-link" type="button" onClick={() => setSelectedId(delivery.id)}><strong>{delivery.trackingNumber}</strong><small>{date(delivery.createdAt, true)}</small></button></td><td><Link href={`/outbound/orders/${delivery.order.id}`}><strong>{delivery.order.orderNumber}</strong><small>{delivery.order.recipient} · {delivery.order.address.city || "No city"}</small></Link></td><td><strong>Sandbox Delivery</strong><small>{label(delivery.service)}</small></td><td>{delivery.estimatedDeliveryAt ? date(delivery.estimatedDeliveryAt, true) : "—"}</td><td><span className={`status ${delivery.status.toLowerCase().replaceAll("_", "-")}`}>{label(delivery.status)}</span></td><td><div className="delivery-row-actions"><button type="button" onClick={() => setSelectedId(delivery.id)}>Label</button><button type="button" disabled={saving || TERMINAL_STATUSES.includes(delivery.status)} onClick={() => void runAction(delivery, "ADVANCE")}>{nextAction(delivery.status)}</button><button className="danger" type="button" disabled={saving || TERMINAL_STATUSES.includes(delivery.status)} onClick={() => void runAction(delivery, "FAIL")}>Fail</button></div></td></tr>)}
          {!deliveries.length && <tr className="empty-table-row"><td colSpan={6}>{loading ? "Loading deliveries…" : "No sandbox deliveries yet. Create one from an outbound order."}</td></tr>}
        </tbody></table></div>
      </section>

      {selected && <section className="delivery-detail-grid">
        <article className="panel delivery-label-card delivery-print-area">
          <div className="panel-heading"><div><h2>Test shipping label</h2><p>Generated by Sandbox Delivery · not valid for real postage</p></div><button className="button button-secondary small no-print" type="button" onClick={() => window.print()}>Print label</button></div>
          <div className="mock-label"><div className="mock-label-top"><strong>JABLY</strong><span>SANDBOX DELIVERY</span></div><div className="mock-label-route"><div><small>SHIP TO</small><strong>{selected.order.recipient}</strong><p>{selected.order.address.line1}<br />{selected.order.address.city} {selected.order.address.postalCode}<br />{selected.order.address.country}</p></div><b>{label(selected.service)}</b></div><div className="mock-tracking-bars" aria-hidden="true" /><code>{selected.trackingNumber}</code><p className="mock-label-warning">TEST LABEL · NO POSTAGE · SIMULATION ONLY</p></div>
        </article>
        <article className="panel delivery-timeline-card">
          <div className="panel-heading"><div><h2>Tracking events</h2><p>Webhook-style events generated by the sandbox adapter.</p></div><span className={`status ${selected.status.toLowerCase().replaceAll("_", "-")}`}>{label(selected.status)}</span></div>
          <ol>{selected.events.map((event, index) => <li key={event.id} className={index === 0 ? "current" : ""}><span>{index === 0 ? "●" : "✓"}</span><div><strong>{label(event.status)}</strong><p>{event.description}</p><small>{event.location || "Sandbox network"} · {date(event.occurredAt, true)}</small></div></li>)}</ol>
        </article>
      </section>}

      <section className="panel provider-panel">
        <div className="panel-heading"><div><h2>Delivery providers</h2><p>Only Sandbox Delivery is connected. The remaining cards show the adapter roadmap.</p></div><span className="sandbox-badge">1 active</span></div>
        <div className="provider-grid">{providers.map((provider) => <article className={provider.status === "ACTIVE" ? "active" : ""} key={provider.id}><div><ProviderLogo provider={provider} /><span className={`provider-status ${provider.status.toLowerCase()}`}>{provider.status === "ACTIVE" ? "Default" : label(provider.status)}</span></div><h3>{provider.name}</h3><p>{provider.description}</p><ul>{provider.capabilities.map((capability) => <li key={capability}>{capability}</li>)}</ul>{provider.status === "ACTIVE" ? <button type="button" disabled>Connected</button> : <button type="button" disabled>Not configured</button>}</article>)}</div>
      </section>
    </div>
  );
}
