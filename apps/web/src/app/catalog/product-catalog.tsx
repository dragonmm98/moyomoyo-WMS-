"use client";

import { useEffect, useMemo, useState } from "react";
import { OperationsPage } from "@/components/operations-page";
import { API_URL } from "@/lib/api-url";
import { apiFetch } from "@/lib/api";

type Product = {
  id: string;
  code: string;
  name: string;
  trackingPolicy: string;
  expiryTracked: boolean;
  active: boolean;
  barcodes: { value: string; primary: boolean }[];
};

function label(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

export function ProductCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await apiFetch(`${API_URL}/skus`, { cache: "no-store" });
        if (!response.ok) throw new Error("Could not load product catalog.");
        const body = (await response.json()) as Product[];
        if (active) setProducts(body);
      } catch (loadError) {
        if (active)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not connect to the WMS API.",
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const metrics = useMemo(() => {
    const active = products.filter((product) => product.active).length;
    const barcoded = products.filter((product) => product.barcodes.length).length;
    const lotTracked = products.filter((product) => product.trackingPolicy === "LOT").length;
    const missing = products.filter((product) => !product.barcodes.length).length;
    return { active, barcoded, lotTracked, missing };
  }, [products]);

  return (
    <OperationsPage
      eyebrow="Master data"
      title="Product catalog"
      description="Manage SKUs, barcode aliases, dimensions, and tracking rules."
      action="New SKU"
      actionHref="/catalog/new"
      secondaryAction="Import products"
      secondaryActionHref="/catalog/import"
      sectionTitle="Products"
      columns={["SKU", "Product", "Barcode", "Tracking", "Status"]}
      metrics={[
        { label: "Active SKUs", value: loading ? "—" : String(metrics.active), detail: `${products.length} total products` },
        { label: "With barcodes", value: loading ? "—" : String(metrics.barcoded), detail: products.length ? `${Math.round((metrics.barcoded / products.length) * 100)}% coverage` : "No products" },
        { label: "Lot tracked", value: loading ? "—" : String(metrics.lotTracked), detail: `${products.filter((product) => product.expiryTracked).length} expiry tracked` },
        { label: "Missing barcode", value: loading ? "—" : String(metrics.missing), detail: "Needs review" },
      ]}
      rows={products.map((product) => ({
        id: product.code,
        primary: product.name,
        secondary: product.barcodes.find((barcode) => barcode.primary)?.value ?? product.barcodes[0]?.value ?? "No barcode",
        owner: product.trackingPolicy === "NONE" ? "No tracking" : `${label(product.trackingPolicy)}${product.expiryTracked ? " · expiry" : ""}`,
        status: product.active ? "Active" : "Inactive",
        href: `/catalog/${product.id}`,
      }))}
      emptyMessage={loading ? "Loading products…" : error || "No products have been created yet."}
    />
  );
}
