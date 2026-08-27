"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/api-url";
import { apiFetch } from "@/lib/api";

type Transaction = {
  id: string;
  quantity: string;
  reason: string | null;
  occurredAt: string;
  fromLocationId: string | null;
  toLocationId: string | null;
};
type Balance = {
  id: string;
  lotNumber: string;
  expiresAt: string | null;
  status: string;
  onHandQty: string;
  reservedQty: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  warehouse: { code: string; name: string };
  location: { id: string; code: string; barcode: string; zone: { name: string } };
  sku: {
    code: string;
    name: string;
    trackingPolicy: string;
    expiryTracked: boolean;
    barcodes: { value: string; primary: boolean }[];
  };
  transactions: Transaction[];
};


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

export function InventoryDetails({ id }: { id: string }) {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch(`${API_URL}/inventory-balances/${id}`);
      const body = (await response.json()) as Balance & { message?: string };
      if (!response.ok)
        throw new Error(body.message || "Could not load inventory balance.");
      setBalance(body);
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
    const request = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(request);
  }, [load]);

  const values = useMemo(() => {
    const onHand = Number(balance?.onHandQty ?? 0);
    const reserved = Number(balance?.reservedQty ?? 0);
    return { onHand, reserved, available: onHand - reserved };
  }, [balance]);

  if (loading)
    return (
      <div className="detail-state panel" role="status">
        <span className="detail-spinner" />
        <h1>Loading inventory</h1>
        <p>Retrieving stock, location, and adjustment history…</p>
      </div>
    );

  if (error || !balance)
    return (
      <div className="detail-state panel">
        <span className="detail-state-icon">!</span>
        <h1>Inventory unavailable</h1>
        <p>{error || "This balance could not be found."}</p>
        <div className="header-actions">
          <Link className="button button-secondary" href="/inventory">Back to inventory</Link>
          <button className="button button-primary" onClick={() => void load()}>Try again</button>
        </div>
      </div>
    );

  const primaryBarcode =
    balance.sku.barcodes.find((barcode) => barcode.primary)?.value ??
    balance.sku.barcodes[0]?.value ??
    "—";

  return (
    <div className="po-detail-page inventory-detail-page">
      <header className="po-header detail-header">
        <div>
          <Link className="back-link" href="/inventory">← Back to inventory</Link>
          <div className="detail-title-row">
            <h1>{balance.sku.code}</h1>
            <span className={`status ${balance.status.toLowerCase().replaceAll("_", "-")}`}>
              {label(balance.status)}
            </span>
          </div>
          <p className="subtitle">{balance.sku.name} · {balance.location.code}</p>
        </div>
        <div className="header-actions detail-actions">
          <Link className="button button-secondary" href="/scan">Scan location</Link>
          <Link className="button button-primary" href={`/inventory/adjustments/new?balanceId=${balance.id}`}>
            New adjustment
          </Link>
        </div>
      </header>

      <section className="detail-metrics inventory-metrics" aria-label="Inventory quantity summary">
        <article className="panel"><span>On hand</span><strong>{amount(values.onHand)}</strong><small>Physical stock</small></article>
        <article className="panel"><span>Available</span><strong>{amount(values.available)}</strong><small>Ready for allocation</small></article>
        <article className="panel"><span>Reserved</span><strong>{amount(values.reserved)}</strong><small>Committed to orders</small></article>
        <article className="panel"><span>Location</span><strong className="location-metric">{balance.location.code}</strong><small>{balance.location.zone.name}</small></article>
      </section>

      <div className="detail-layout">
        <main className="detail-main">
          <section className="panel transaction-panel">
            <div className="panel-heading">
              <div><h2>Adjustment history</h2><p>Most recent inventory changes for this balance</p></div>
              <span className="detail-count">{balance.transactions.length} record{balance.transactions.length === 1 ? "" : "s"}</span>
            </div>
            {balance.transactions.length ? (
              <div className="transaction-list">
                {balance.transactions.map((transaction) => {
                  const increase = transaction.toLocationId === balance.location.id;
                  return (
                    <article key={transaction.id}>
                      <span className={`transaction-icon ${increase ? "increase" : "decrease"}`}>{increase ? "+" : "−"}</span>
                      <div><strong>{increase ? "Stock increased" : "Stock decreased"}</strong><p>{transaction.reason || "Inventory adjustment"}</p></div>
                      <div className="transaction-amount"><strong>{increase ? "+" : "−"}{amount(transaction.quantity)}</strong><time>{date(transaction.occurredAt, true)}</time></div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-history"><strong>No adjustments yet</strong><p>Manual stock changes will appear here.</p></div>
            )}
          </section>
        </main>

        <aside className="panel detail-sidebar">
          <div className="panel-heading"><div><h2>Balance information</h2><p>Product and storage details</p></div></div>
          <dl>
            <div><dt>Product</dt><dd>{balance.sku.code} · {balance.sku.name}</dd></div>
            <div><dt>Primary barcode</dt><dd className="barcode-value">{primaryBarcode}</dd></div>
            <div><dt>Warehouse</dt><dd>{balance.warehouse.code} · {balance.warehouse.name}</dd></div>
            <div><dt>Location</dt><dd>{balance.location.code} · {balance.location.barcode}</dd></div>
            <div><dt>Lot number</dt><dd>{balance.lotNumber || "No lot"}</dd></div>
            <div><dt>Expiration</dt><dd>{balance.expiresAt ? date(balance.expiresAt) : "Not tracked"}</dd></div>
            <div><dt>Tracking policy</dt><dd>{label(balance.sku.trackingPolicy)}</dd></div>
            <div><dt>Last updated</dt><dd>{date(balance.updatedAt, true)}</dd></div>
          </dl>
          <div className="detail-id"><span>Inventory balance ID · version {balance.version}</span><code>{balance.id}</code></div>
        </aside>
      </div>
    </div>
  );
}
