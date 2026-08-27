"use client";

import { useEffect, useMemo, useState } from "react";
import { OperationsPage } from "@/components/operations-page";
import { API_URL } from "@/lib/api-url";
import { apiFetch } from "@/lib/api";

type Balance = {
  id: string;
  lotNumber: string;
  status: string;
  onHandQty: string;
  reservedQty: string;
  location: { code: string };
  sku: { code: string; name: string };
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

export function InventoryBalances() {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await apiFetch(`${API_URL}/inventory-balances`);
        if (!response.ok) throw new Error("Could not load inventory balances.");
        const body = (await response.json()) as Balance[];
        if (active) setBalances(body);
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

  const totals = useMemo(() => {
    const onHand = balances.reduce(
      (sum, balance) => sum + Number(balance.onHandQty),
      0,
    );
    const reserved = balances.reduce(
      (sum, balance) => sum + Number(balance.reservedQty),
      0,
    );
    const quarantined = balances
      .filter((balance) => balance.status === "QUARANTINED")
      .reduce((sum, balance) => sum + Number(balance.onHandQty), 0);
    return { onHand, reserved, available: onHand - reserved, quarantined };
  }, [balances]);

  return (
    <OperationsPage
      eyebrow="Inventory control"
      title="Inventory"
      description="Search balances by SKU, barcode, lot, or physical location."
      action="New adjustment"
      actionHref="/inventory/adjustments/new"
      sectionTitle="Inventory balances"
      columns={["SKU", "Product", "Location / lot", "Quantity", "Status"]}
      metrics={[
        {
          label: "On-hand units",
          value: loading ? "—" : amount(totals.onHand),
          detail: `${balances.length} balance${balances.length === 1 ? "" : "s"}`,
        },
        {
          label: "Available",
          value: loading ? "—" : amount(totals.available),
          detail: totals.onHand
            ? `${Math.round((totals.available / totals.onHand) * 100)}% usable`
            : "No stock",
        },
        {
          label: "Reserved",
          value: loading ? "—" : amount(totals.reserved),
          detail: "Allocated to orders",
        },
        {
          label: "Quarantined",
          value: loading ? "—" : amount(totals.quarantined),
          detail: "Unavailable stock",
        },
      ]}
      rows={balances.map((balance) => ({
        id: balance.sku.code,
        primary: balance.sku.name,
        secondary: `${balance.location.code} · ${balance.lotNumber || "No lot"}`,
        owner: `${amount(balance.onHandQty)} on hand · ${amount(balance.reservedQty)} reserved`,
        status: label(balance.status),
        href: `/inventory/${balance.id}`,
      }))}
      emptyMessage={
        loading ? "Loading inventory…" : error || "No inventory balances found."
      }
    />
  );
}
