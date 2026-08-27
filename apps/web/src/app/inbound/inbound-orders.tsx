"use client";

import { useEffect, useMemo, useState } from "react";
import { OperationsPage } from "@/components/operations-page";
import { API_URL } from "@/lib/api-url";
import { apiFetch } from "@/lib/api";

type PurchaseOrder = {
  id: string;
  orderNumber: string;
  supplierName: string;
  expectedAt: string;
  receivingDock: string | null;
  status: string;
  lines: { expectedQty: string; receivedQty: string }[];
};

function number(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function statusLabel(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

export function InboundOrders() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadOrders() {
      try {
        const response = await apiFetch(`${API_URL}/purchase-orders`);
        if (!response.ok) throw new Error("Could not load purchase orders.");
        const body = (await response.json()) as PurchaseOrder[];
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
    void loadOrders();
    return () => {
      active = false;
    };
  }, []);

  const totals = useMemo(() => {
    const expected = orders.reduce(
      (sum, order) =>
        sum + order.lines.reduce((lineSum, line) => lineSum + Number(line.expectedQty), 0),
      0,
    );
    const received = orders.reduce(
      (sum, order) =>
        sum + order.lines.reduce((lineSum, line) => lineSum + Number(line.receivedQty), 0),
      0,
    );
    const open = orders.filter((order) =>
      ["OPEN", "PARTIALLY_RECEIVED"].includes(order.status),
    ).length;
    const complete = orders.filter((order) =>
      ["RECEIVED", "CLOSED"].includes(order.status),
    ).length;
    return { expected, received, open, complete };
  }, [orders]);

  return (
    <OperationsPage
      eyebrow="Inbound operations"
      title="Receiving & putaway"
      description="Track purchase orders from dock arrival through storage."
      action="New purchase order"
      actionHref="/inbound/purchase-orders/new"
      scannerHref="/scan"
      sectionTitle="Expected receipts"
      columns={[
        "Purchase order",
        "Supplier",
        "Expected",
        "Dock / owner",
        "Status",
      ]}
      metrics={[
        {
          label: "Expected units",
          value: loading ? "—" : number(totals.expected),
          detail: `${orders.length} purchase order${orders.length === 1 ? "" : "s"}`,
        },
        {
          label: "Received units",
          value: loading ? "—" : number(totals.received),
          detail: totals.expected
            ? `${Math.round((totals.received / totals.expected) * 100)}% complete`
            : "No receipts yet",
        },
        {
          label: "Open orders",
          value: loading ? "—" : number(totals.open),
          detail: `${number(totals.expected - totals.received)} units remaining`,
        },
        {
          label: "Completed orders",
          value: loading ? "—" : number(totals.complete),
          detail: "Received or closed",
        },
      ]}
      rows={orders.map((order) => {
        const units = order.lines.reduce(
          (sum, line) => sum + Number(line.expectedQty),
          0,
        );
        return {
          id: order.orderNumber,
          primary: order.supplierName,
          secondary: `${new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(order.expectedAt))} · ${number(units)} units · ${order.lines.length} SKU${order.lines.length === 1 ? "" : "s"}`,
          owner: order.receivingDock || "Unassigned",
          status: statusLabel(order.status),
          href: `/inbound/purchase-orders/${order.id}`,
        };
      })}
      emptyMessage={
        loading
          ? "Loading purchase orders…"
          : error || "No purchase orders have been created yet."
      }
    />
  );
}
