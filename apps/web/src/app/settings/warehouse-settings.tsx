"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWarehouse, type Warehouse } from "@/components/warehouse-context";
import { API_URL } from "@/lib/api-url";
import { apiFetch } from "@/lib/api";
import { WarehouseMap } from "./warehouse-map";
import { OperationalSettings } from "./operational-settings";

const TIMEZONES = ["Asia/Seoul", "Asia/Tokyo", "Asia/Singapore", "UTC", "America/Los_Angeles"];
type WarehouseForm = {
  code: string;
  name: string;
  timezone: string;
  address: string;
  latitude: string;
  longitude: string;
  active: boolean;
};
const EMPTY_FORM: WarehouseForm = {
  code: "",
  name: "",
  timezone: "Asia/Seoul",
  address: "",
  latitude: "",
  longitude: "",
  active: true,
};

function initials(name: string, code: string) {
  const sequence = code.match(/\d+$/)?.[0];
  return `${name.charAt(0).toUpperCase()}${sequence ? Number(sequence) : ""}`;
}

export function WarehouseSettings() {
  const { selectedWarehouse, selectWarehouse, refreshWarehouses } = useWarehouse();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const [focusedWarehouseId, setFocusedWarehouseId] = useState<string | null>(null);
  const [form, setForm] = useState<WarehouseForm>(EMPTY_FORM);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch(`${API_URL}/warehouses?includeInactive=true`);
      if (!response.ok) throw new Error("Could not load warehouse settings.");
      setWarehouses((await response.json()) as Warehouse[]);
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

  const totals = useMemo(() => ({
    active: warehouses.filter((warehouse) => warehouse.active).length,
    zones: warehouses.reduce((sum, warehouse) => sum + warehouse.zones.length, 0),
    locations: warehouses.reduce((sum, warehouse) => sum + warehouse.zones.reduce((zoneSum, zone) => zoneSum + zone.locations.length, 0), 0),
  }), [warehouses]);
  const mappedWarehouses = useMemo(
    () => warehouses.filter(
      (warehouse): warehouse is Warehouse & { latitude: number; longitude: number } =>
        warehouse.latitude != null && warehouse.longitude != null,
    ),
    [warehouses],
  );

  function openMap(warehouseId: string | null = null) {
    setFocusedWarehouseId(warehouseId);
    setMapOpen(true);
    window.setTimeout(
      () => document.querySelector(".warehouse-map-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }),
      0,
    );
  }

  function openCreate() {
    setEditingId("");
    setForm(EMPTY_FORM);
    setError("");
    setMessage("");
    setShowForm(true);
  }

  function openEdit(warehouse: Warehouse) {
    setEditingId(warehouse.id);
    setForm({
      code: warehouse.code,
      name: warehouse.name,
      timezone: warehouse.timezone,
      address: warehouse.address ?? "",
      latitude: warehouse.latitude?.toString() ?? "",
      longitude: warehouse.longitude?.toString() ?? "",
      active: warehouse.active,
    });
    setError("");
    setMessage("");
    setShowForm(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await apiFetch(`${API_URL}/warehouses${editingId ? `/${editingId}` : ""}`, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          timezone: form.timezone,
          address: form.address.trim() || undefined,
          latitude: form.latitude === "" ? undefined : Number(form.latitude),
          longitude: form.longitude === "" ? undefined : Number(form.longitude),
          active: form.active,
        }),
      });
      const body = (await response.json()) as Warehouse & { message?: string | string[] };
      if (!response.ok) throw new Error(Array.isArray(body.message) ? body.message.join(" ") : body.message || "Could not save the warehouse.");
      const activeWarehouses = await refreshWarehouses();
      if (!editingId && body.active) {
        const created = activeWarehouses.find((warehouse) => warehouse.id === body.id);
        if (created) selectWarehouse(created);
      }
      setMessage(`${body.name} was ${editingId ? "updated" : "created"}.`);
      setShowForm(false);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the warehouse.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack warehouse-settings-page">
      <header className="page-header"><div><p className="eyebrow">Administration</p><h1>Settings</h1><p className="subtitle">Manage fulfillment centers and configure operational defaults.</p></div><button className="button button-primary" type="button" onClick={openCreate}>+ Add warehouse</button></header>

      {(error || message) && <div className={`settings-banner ${error ? "error" : "success"}`} role={error ? "alert" : "status"}><strong>{error ? "Could not save settings" : "Warehouse saved"}</strong><span>{error || message}</span></div>}

      <section className="metric-grid settings-metrics" aria-label="Warehouse metrics">
        {[{ label: "Warehouses", value: warehouses.length, detail: `${totals.active} active` }, { label: "Selected", value: selectedWarehouse?.code ?? "—", detail: selectedWarehouse?.name ?? "No warehouse selected" }, { label: "Zones", value: totals.zones, detail: "Across all warehouses" }, { label: "Locations", value: totals.locations, detail: "Configured storage points" }].map((metric, index) => <article className="metric-card compact" key={metric.label}><div className={`metric-icon ${["blue", "green", "amber", "violet"][index]}`} /><p>{metric.label}</p><strong>{loading ? "—" : metric.value}</strong><span>{metric.detail}</span></article>)}
      </section>

      {showForm && <section className="panel warehouse-form-panel">
        <div className="panel-heading"><div><h2>{editingId ? "Edit warehouse" : "Add warehouse"}</h2><p>Codes identify warehouses in orders, inventory, tasks, and reports.</p></div><span className="required-note">* Required</span></div>
        <form onSubmit={submit}>
          <label><span>Warehouse code *</span><input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="BUS-01" pattern="[A-Z0-9-]+" maxLength={20} required /></label>
          <label><span>Warehouse name *</span><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Busan Fulfillment Center" maxLength={120} required /></label>
          <label><span>Timezone</span><select value={form.timezone} onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))}>{TIMEZONES.map((timezone) => <option key={timezone}>{timezone}</option>)}</select></label>
          <label className="warehouse-active-field"><span>Status</span><span><input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} /><b>{form.active ? "Active" : "Inactive"}</b></span></label>
          <label className="warehouse-address-field"><span>Address</span><input value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} placeholder="Busan, South Korea" maxLength={240} /></label>
          <label><span>Latitude</span><input type="number" min="-90" max="90" step="any" value={form.latitude} onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value }))} placeholder="35.1796" /></label>
          <label><span>Longitude</span><input type="number" min="-180" max="180" step="any" value={form.longitude} onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value }))} placeholder="129.0756" /></label>
          <div className="warehouse-form-actions"><button className="button button-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Create warehouse"}</button></div>
        </form>
      </section>}

      <section className="panel warehouse-list-panel">
        <div className="panel-heading"><div><h2>Warehouses</h2><p>Select the current warehouse or manage its master data.</p></div><div className="warehouse-list-actions"><button type="button" disabled={!mappedWarehouses.length} onClick={() => openMap()}>⌖ View all on map</button><span className="detail-count">{warehouses.length}</span></div></div>
        <div className="warehouse-card-grid">{warehouses.map((warehouse) => {
          const zoneCount = warehouse.zones.length;
          const locationCount = warehouse.zones.reduce((sum, zone) => sum + zone.locations.length, 0);
          const selected = warehouse.id === selectedWarehouse?.id;
          const hasMap = warehouse.latitude != null && warehouse.longitude != null;
          return <article className={`${selected ? "selected" : ""} ${!warehouse.active ? "inactive" : ""}`} key={warehouse.id}><div className="warehouse-card-title"><span>{initials(warehouse.name, warehouse.code)}</span><div><h3>{warehouse.name}</h3><code>{warehouse.code}</code></div><span className={`status ${warehouse.active ? "active" : "inactive"}`}>{warehouse.active ? "Active" : "Inactive"}</span></div><dl><div><dt>Timezone</dt><dd>{warehouse.timezone}</dd></div><div><dt>Topology</dt><dd>{zoneCount} zone{zoneCount === 1 ? "" : "s"} · {locationCount} location{locationCount === 1 ? "" : "s"}</dd></div><div><dt>Location</dt><dd>{warehouse.address || (hasMap ? `${warehouse.latitude}, ${warehouse.longitude}` : "Not configured")}</dd></div></dl><div className="warehouse-card-actions"><button type="button" onClick={() => openEdit(warehouse)}>Edit</button><button className="map" type="button" disabled={!hasMap} title={hasMap ? `View ${warehouse.name} on map` : "Add coordinates in Edit to enable the map"} onClick={() => openMap(warehouse.id)}>⌖ Map</button><button className="select" type="button" disabled={!warehouse.active || selected} onClick={() => selectWarehouse(warehouse)}>{selected ? "Current warehouse" : warehouse.active ? "Switch to warehouse" : "Inactive"}</button></div></article>;
        })}{!warehouses.length && !loading && <div className="empty-history"><strong>No warehouses</strong><p>Add a warehouse to begin configuring the WMS.</p></div>}</div>
      </section>

      {mapOpen && mappedWarehouses.length > 0 && <section className="panel warehouse-map-panel" aria-label="All warehouse locations map">
        <div className="panel-heading"><div><h2>Warehouse locations</h2><p>{mappedWarehouses.length} mapped warehouse{mappedWarehouses.length === 1 ? "" : "s"} · Select a marker to view details.</p></div><div className="warehouse-map-actions"><a href="https://www.openstreetmap.org" target="_blank" rel="noreferrer">Open OpenStreetMap ↗</a><button type="button" aria-label="Close map" onClick={() => setMapOpen(false)}>×</button></div></div>
        <WarehouseMap warehouses={mappedWarehouses} focusedWarehouseId={focusedWarehouseId} onFocusWarehouse={setFocusedWarehouseId} />
      </section>}

      {selectedWarehouse && <OperationalSettings warehouseId={selectedWarehouse.id} warehouseName={selectedWarehouse.name} />}
    </div>
  );
}
