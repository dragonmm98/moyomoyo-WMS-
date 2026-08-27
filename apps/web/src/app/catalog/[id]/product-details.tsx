"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/api-url";
import { apiFetch } from "@/lib/api";

type Product = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  trackingPolicy: string;
  expiryTracked: boolean;
  weightKg: string | null;
  lengthCm: string | null;
  widthCm: string | null;
  heightCm: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  barcodes: {
    id: string;
    value: string;
    symbology: string;
    primary: boolean;
    createdAt: string;
  }[];
  balances: {
    id: string;
    lotNumber: string;
    expiresAt: string | null;
    status: string;
    onHandQty: string;
    reservedQty: string;
    warehouse: { code: string; name: string };
    location: { code: string; zone: { name: string } };
  }[];
  purchaseOrderLines: {
    id: string;
    expectedQty: string;
    receivedQty: string;
    purchaseOrder: {
      id: string;
      orderNumber: string;
      status: string;
      expectedAt: string;
    };
  }[];
  orderLines: {
    id: string;
    orderedQty: string;
    allocatedQty: string;
    pickedQty: string;
    order: {
      id: string;
      orderNumber: string;
      status: string;
      createdAt: string;
    };
  }[];
};


function amount(value: number | string) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function label(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
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

const EAN13_LEFT = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const EAN13_G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const EAN13_RIGHT = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
const EAN13_PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

function isValidEan13(value: string) {
  if (!/^\d{13}$/.test(value)) return false;
  const sum = value
    .slice(0, 12)
    .split("")
    .reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === Number(value[12]);
}

function Ean13Preview({ value }: { value: string }) {
  if (!isValidEan13(value)) return <span className="barcode-invalid">Invalid EAN-13 checksum</span>;

  const digits = value.split("").map(Number);
  const parity = EAN13_PARITY[digits[0]];
  const left = digits.slice(1, 7).map((digit, index) => (parity[index] === "L" ? EAN13_LEFT[digit] : EAN13_G[digit])).join("");
  const right = digits.slice(7).map((digit) => EAN13_RIGHT[digit]).join("");
  const bars = `101${left}01010${right}101`;

  return (
    <div className="ean13-preview">
      <svg viewBox="0 0 113 45" role="img" aria-label={`EAN-13 barcode ${value}`} preserveAspectRatio="none">
        <rect width="113" height="45" fill="white" />
        {bars.split("").map((bar, index) => bar === "1" ? <rect key={index} x={index + 9} y="3" width="1" height={index < 3 || (index >= 45 && index < 50) || index >= 92 ? 38 : 33} fill="currentColor" /> : null)}
      </svg>
      <div><code>{value.slice(0, 1)} {value.slice(1, 7)} {value.slice(7)}</code><span>✓ Valid EAN-13</span></div>
    </div>
  );
}

export function ProductDetails({ id }: { id: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch(`${API_URL}/skus/${id}`);
      const body = (await response.json()) as Product & { message?: string };
      if (!response.ok) throw new Error(body.message || "Could not load product.");
      setProduct(body);
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
    if (!product) return { onHand: 0, reserved: 0, available: 0 };
    const onHand = product.balances.reduce((sum, balance) => sum + Number(balance.onHandQty), 0);
    const reserved = product.balances.reduce((sum, balance) => sum + Number(balance.reservedQty), 0);
    return { onHand, reserved, available: onHand - reserved };
  }, [product]);

  if (loading)
    return <div className="detail-state panel" role="status"><span className="detail-spinner" /><h1>Loading product</h1><p>Retrieving catalog, barcode, and inventory data…</p></div>;

  if (error || !product)
    return <div className="detail-state panel"><span className="detail-state-icon">!</span><h1>Product unavailable</h1><p>{error || "This product could not be found."}</p><div className="header-actions"><Link className="button button-secondary" href="/catalog">Back to catalog</Link><button className="button button-primary" onClick={() => void load()}>Try again</button></div></div>;

  const dimensions = [product.lengthCm, product.widthCm, product.heightCm].every(Boolean)
    ? `${amount(product.lengthCm!)} × ${amount(product.widthCm!)} × ${amount(product.heightCm!)} cm`
    : "Not specified";

  return (
    <div className="po-detail-page product-detail-page">
      <header className="po-header detail-header">
        <div><Link className="back-link" href="/catalog">← Back to catalog</Link><div className="detail-title-row"><h1>{product.code}</h1><span className={`status ${product.active ? "active" : "inactive"}`}>{product.active ? "Active" : "Inactive"}</span></div><p className="subtitle">{product.name} · {label(product.trackingPolicy)} tracking</p></div>
        <div className="header-actions detail-actions"><button className="button button-secondary" type="button" onClick={() => window.print()}>Print</button><Link className="button button-primary" href="/inventory/adjustments/new">Inventory adjustment</Link></div>
      </header>

      <section className="detail-metrics inventory-metrics" aria-label="Product inventory summary">
        <article className="panel"><span>On hand</span><strong>{amount(totals.onHand)}</strong><small>Across {product.balances.length} balance{product.balances.length === 1 ? "" : "s"}</small></article>
        <article className="panel"><span>Available</span><strong>{amount(totals.available)}</strong><small>Ready for allocation</small></article>
        <article className="panel"><span>Reserved</span><strong>{amount(totals.reserved)}</strong><small>Committed inventory</small></article>
        <article className="panel"><span>Barcode aliases</span><strong>{product.barcodes.length}</strong><small>{product.barcodes.length ? "Scanning enabled" : "No barcode assigned"}</small></article>
      </section>

      <div className="detail-layout">
        <main className="detail-main">
          <section className="panel product-overview-panel">
            <div className="panel-heading"><div><h2>Product overview</h2><p>Catalog description and physical characteristics</p></div><span className="detail-count">{label(product.trackingPolicy)}</span></div>
            <div className="product-description"><p>{product.description || "No product description has been entered."}</p></div>
            <div className="product-physical-grid">
              <div><span>Weight</span><strong>{product.weightKg ? `${amount(product.weightKg)} kg` : "Not specified"}</strong></div>
              <div><span>Dimensions</span><strong>{dimensions}</strong></div>
              <div><span>Lot / serial tracking</span><strong>{label(product.trackingPolicy)}</strong></div>
              <div><span>Expiry tracking</span><strong>{product.expiryTracked ? "Enabled" : "Disabled"}</strong></div>
            </div>
          </section>

          <section className="panel detail-lines-panel">
            <div className="panel-heading"><div><h2>Inventory locations</h2><p>Physical balances by warehouse, location, lot, and status</p></div><span className="detail-count">{product.balances.length} balance{product.balances.length === 1 ? "" : "s"}</span></div>
            {product.balances.length ? <div className="table-wrap detail-table product-balance-table"><table><thead><tr><th>Warehouse / location</th><th>Lot / expiry</th><th>On hand</th><th>Reserved</th><th>Status</th></tr></thead><tbody>{product.balances.map((balance) => <tr key={balance.id}><td><Link href={`/inventory/${balance.id}`}><strong>{balance.location.code}</strong><small>{balance.warehouse.code} · {balance.location.zone.name}</small></Link></td><td>{balance.lotNumber || "No lot"}<small>{balance.expiresAt ? `Expires ${date(balance.expiresAt)}` : "No expiry"}</small></td><td><strong>{amount(balance.onHandQty)}</strong></td><td>{amount(balance.reservedQty)}</td><td><span className={`status ${balance.status.toLowerCase().replaceAll("_", "-")}`}>{label(balance.status)}</span></td></tr>)}</tbody></table></div> : <div className="empty-history"><strong>No inventory balances</strong><p>This product has not been received into inventory yet.</p></div>}
          </section>

          <section className="panel barcode-detail-panel">
            <div className="panel-heading"><div><h2>Barcode aliases</h2><p>Identifiers accepted by receiving, picking, and inventory scanning</p></div><span className="detail-count">{product.barcodes.length}</span></div>
            {product.barcodes.length ? <div className="barcode-cards">{product.barcodes.map((barcode) => <article key={barcode.id}><div className="barcode-card-heading"><span className="barcode-symbol">▥</span><div><strong>{barcode.value}</strong><small>{barcode.symbology}</small></div>{barcode.primary && <b>Primary</b>}</div>{barcode.symbology === "EAN13" && <Ean13Preview value={barcode.value} />}</article>)}</div> : <div className="empty-history"><strong>No barcodes</strong><p>Add a barcode before using scanner workflows.</p></div>}
          </section>
        </main>

        <aside className="panel detail-sidebar">
          <div className="panel-heading"><div><h2>Product information</h2><p>Master-data and activity details</p></div></div>
          <dl>
            <div><dt>SKU code</dt><dd>{product.code}</dd></div>
            <div><dt>Product name</dt><dd>{product.name}</dd></div>
            <div><dt>Primary barcode</dt><dd className="barcode-value">{product.barcodes.find((barcode) => barcode.primary)?.value ?? product.barcodes[0]?.value ?? "—"}</dd></div>
            <div><dt>Tracking policy</dt><dd>{label(product.trackingPolicy)}</dd></div>
            <div><dt>Expiry tracked</dt><dd>{product.expiryTracked ? "Yes" : "No"}</dd></div>
            <div><dt>Inbound order lines</dt><dd>{product.purchaseOrderLines.length}</dd></div>
            <div><dt>Outbound order lines</dt><dd>{product.orderLines.length}</dd></div>
            <div><dt>Created</dt><dd>{date(product.createdAt, true)}</dd></div>
            <div><dt>Last updated</dt><dd>{date(product.updatedAt, true)}</dd></div>
          </dl>
          <div className="detail-id"><span>Product ID</span><code>{product.id}</code></div>
        </aside>
      </div>
    </div>
  );
}
