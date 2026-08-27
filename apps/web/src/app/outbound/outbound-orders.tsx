"use client";

import { useEffect, useMemo, useState } from "react";
import { OperationsPage } from "@/components/operations-page";
import { API_URL } from "@/lib/api-url";
import { apiFetch } from "@/lib/api";

type SalesOrder = {
  id: string;
  orderNumber: string;
  recipient: string;
  status: string;
  address: { city?: string; shippingMethod?: string };
  lines: {
    orderedQty: string;
    allocatedQty: string;
    pickedQty: string;
  }[];
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

export function OutboundOrders() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await apiFetch(`${API_URL}/sales-orders`);
        if (!response.ok) throw new Error("Could not load sales orders.");
        const body = (await response.json()) as SalesOrder[];
        if (active) setOrders(body);
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
    const units = orders.reduce(
      (sum, order) =>
        sum + order.lines.reduce((lineSum, line) => lineSum + Number(line.orderedQty), 0),
      0,
    );
    const picking = orders.filter((order) => order.status === "PICKING").length;
    const ready = orders.filter((order) =>
      ["READY_TO_ALLOCATE", "ALLOCATED", "PICKED", "PACKED"].includes(order.status),
    ).length;
    const shipped = orders.filter((order) => order.status === "SHIPPED").length;
    return { units, picking, ready, shipped };
  }, [orders]);

  return (
    <OperationsPage
      eyebrow="Outbound operations"
      title="Orders & shipping"
      description="Allocate, pick, pack, and confirm customer shipments."
      action="New order"
      actionHref="/outbound/orders/new"
      scannerHref="/scan"
      sectionTitle="Sales orders"
      columns={["Order", "Recipient", "Contents", "Destination / service", "Status"]}
      metrics={[
        { label: "Sales orders", value: loading ? "—" : amount(orders.length), detail: `${amount(metrics.units)} ordered unit${metrics.units === 1 ? "" : "s"}` },
        { label: "Picking", value: loading ? "—" : amount(metrics.picking), detail: "Active fulfillment" },
        { label: "Ready to process", value: loading ? "—" : amount(metrics.ready), detail: "Allocation through packing" },
        { label: "Shipped", value: loading ? "—" : amount(metrics.shipped), detail: "Confirmed shipments" },
      ]}
      rows={orders.map((order) => {
        const units = order.lines.reduce((sum, line) => sum + Number(line.orderedQty), 0);
        return {
          id: order.orderNumber,
          primary: `${order.recipient}${order.address.city ? ` · ${order.address.city}` : ""}`,
          secondary: `${amount(units)} unit${units === 1 ? "" : "s"} · ${order.lines.length} SKU${order.lines.length === 1 ? "" : "s"}`,
          owner: `${order.address.city || "No city"} · ${order.address.shippingMethod || "Unassigned"}`,
          status: label(order.status),
          href: `/outbound/orders/${order.id}`,
        };
      })}
      emptyMessage={loading ? "Loading sales orders…" : error || "No sales orders have been created yet."}
    />
  );
}
