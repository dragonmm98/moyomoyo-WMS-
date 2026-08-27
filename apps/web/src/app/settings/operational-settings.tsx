"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/api-url";
import { apiFetch } from "@/lib/api";
import styles from "./operational-settings.module.css";

type UserRole = "Administrator" | "Supervisor" | "Operator" | "Viewer";
type Worker = { id: string; name: string; email: string; role: UserRole; active: boolean };
type OperationalSettingsValue = {
  users: Worker[];
  allocation: {
    rotation: "FIFO" | "FEFO";
    orderPriority: "OLDEST_FIRST" | "EXPEDITE_FIRST";
    allowedStatuses: string[];
    preventPartialAllocation: boolean;
  };
  labels: {
    format: "4x6" | "A4" | "A5";
    printer: string;
    copies: number;
    autoPrint: boolean;
  };
  integrations: {
    sandboxDelivery: boolean;
    webhookUrl: string;
    orderSource: "MANUAL" | "API" | "CSV";
  };
};
type SettingKey = "users" | "allocation" | "labels" | "integrations" | "audit";
type AuditEntry = {
  id: string;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  createdAt: string;
};

const DEFAULT_SETTINGS: OperationalSettingsValue = {
  users: [{ id: "local-admin", name: "Javohir", email: "admin@jably.local", role: "Administrator", active: true }],
  allocation: {
    rotation: "FEFO",
    orderPriority: "OLDEST_FIRST",
    allowedStatuses: ["AVAILABLE"],
    preventPartialAllocation: false,
  },
  labels: { format: "4x6", printer: "Browser print dialog", copies: 1, autoPrint: false },
  integrations: { sandboxDelivery: true, webhookUrl: "", orderSource: "MANUAL" },
};

const CARD_COPY: Record<SettingKey, { title: string; description: string; symbol: string }> = {
  users: { title: "Users & permissions", description: "Worker accounts, roles, and warehouse access", symbol: "♙" },
  allocation: { title: "Allocation rules", description: "FIFO, FEFO, stock status, and order priority", symbol: "⇄" },
  labels: { title: "Labels & printing", description: "Location, SKU, package, and shipping label templates", symbol: "▤" },
  integrations: { title: "Integrations", description: "Delivery providers and external order sources", symbol: "◇" },
  audit: { title: "Audit log", description: "Review privileged actions and master-data changes", symbol: "≡" },
};

function mergeSettings(value: Partial<OperationalSettingsValue>): OperationalSettingsValue {
  return {
    users: Array.isArray(value.users) ? value.users : DEFAULT_SETTINGS.users,
    allocation: { ...DEFAULT_SETTINGS.allocation, ...(value.allocation ?? {}) },
    labels: { ...DEFAULT_SETTINGS.labels, ...(value.labels ?? {}) },
    integrations: { ...DEFAULT_SETTINGS.integrations, ...(value.integrations ?? {}) },
  };
}

function titleCase(value: string) {
  return value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export function OperationalSettings({ warehouseId, warehouseName }: { warehouseId: string; warehouseName: string }) {
  const [active, setActive] = useState<SettingKey>("users");
  const [settings, setSettings] = useState<OperationalSettingsValue>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "Operator" as UserRole });

  useEffect(() => {
    let cancelled = false;
    const request = window.setTimeout(() => {
      setLoading(true);
      setError("");
      void apiFetch(`${API_URL}/warehouses/${warehouseId}/operational-settings`)
        .then(async (response) => {
          if (!response.ok) throw new Error("Could not load operational settings.");
          const body = await response.json() as Partial<OperationalSettingsValue>;
          if (!cancelled) setSettings(mergeSettings(body));
        })
        .catch((loadError) => {
          if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load operational settings.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);
    return () => { cancelled = true; window.clearTimeout(request); };
  }, [warehouseId]);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const response = await apiFetch(`${API_URL}/warehouses/audit-log?limit=50`);
      if (!response.ok) throw new Error("Could not load the audit log.");
      setAudit(await response.json() as AuditEntry[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load the audit log.");
    } finally {
      setAuditLoading(false);
    }
  }, []);

  const statuses = useMemo<Record<SettingKey, string>>(() => ({
    users: `${settings.users.filter((user) => user.active).length} active user${settings.users.filter((user) => user.active).length === 1 ? "" : "s"}`,
    allocation: `${settings.allocation.rotation} enabled`,
    labels: `${settings.labels.format} · ${settings.labels.copies} ${settings.labels.copies === 1 ? "copy" : "copies"}`,
    integrations: settings.integrations.sandboxDelivery ? "1 sandbox provider" : "No active providers",
    audit: "Recording enabled",
  }), [settings]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await apiFetch(`${API_URL}/warehouses/${warehouseId}/operational-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      if (!response.ok) throw new Error("Could not save operational settings.");
      setSettings(mergeSettings(await response.json() as Partial<OperationalSettingsValue>));
      setMessage(`${CARD_COPY[active].title} saved for ${warehouseName}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save operational settings.");
    } finally {
      setSaving(false);
    }
  }

  function addUser() {
    if (!newUser.name.trim() || !newUser.email.trim()) return;
    setSettings((current) => ({
      ...current,
      users: [...current.users, { id: crypto.randomUUID(), name: newUser.name.trim(), email: newUser.email.trim(), role: newUser.role, active: true }],
    }));
    setNewUser({ name: "", email: "", role: "Operator" });
  }

  return <section className={styles.section}>
    <div className="settings-section-heading"><h2>Operational settings</h2><p>Configure workflow defaults for {warehouseName}.</p></div>
    <div className={styles.cards}>
      {(Object.keys(CARD_COPY) as SettingKey[]).map((key) => <button className={active === key ? styles.activeCard : ""} type="button" key={key} onClick={() => { setActive(key); setMessage(""); setError(""); if (key === "audit") void loadAudit(); }}><span>{CARD_COPY[key].symbol}</span><div><strong>{CARD_COPY[key].title}</strong><p>{CARD_COPY[key].description}</p><small>{loading && key !== "audit" ? "Loading…" : statuses[key]}</small></div><b>→</b></button>)}
    </div>

    <div className={styles.panel}>
      <div className={styles.panelHeading}><div><span>{CARD_COPY[active].symbol}</span><div><h3>{CARD_COPY[active].title}</h3><p>{CARD_COPY[active].description}</p></div></div>{active === "audit" && <button type="button" onClick={() => void loadAudit()} disabled={auditLoading}>{auditLoading ? "Refreshing…" : "Refresh log"}</button>}</div>
      {(message || error) && <div className={`${styles.banner} ${error ? styles.error : ""}`} role={error ? "alert" : "status"}>{error || message}</div>}

      {active === "audit" ? <div className={styles.auditTable}>{auditLoading && !audit.length ? <p>Loading audit events…</p> : audit.length ? <table><thead><tr><th>Event</th><th>Resource</th><th>Actor</th><th>Time</th></tr></thead><tbody>{audit.map((entry) => <tr key={entry.id}><td><strong>{titleCase(entry.action)}</strong><small>{entry.id.slice(0, 8)}</small></td><td>{entry.resourceType}<small>{entry.resourceId.slice(0, 12)}</small></td><td>{entry.actorId || "System"}</td><td>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.createdAt))}</td></tr>)}</tbody></table> : <p>No audit events have been recorded yet.</p>}</div> : <form onSubmit={save}>
        {active === "users" && <div className={styles.usersPanel}>
          <div className={styles.userList}>{settings.users.map((user) => <article key={user.id}><span>{user.name.slice(0, 1).toUpperCase()}</span><div><strong>{user.name}</strong><small>{user.email}</small></div><select aria-label={`Role for ${user.name}`} value={user.role} onChange={(event) => setSettings((current) => ({ ...current, users: current.users.map((item) => item.id === user.id ? { ...item, role: event.target.value as UserRole } : item) }))}>{["Administrator", "Supervisor", "Operator", "Viewer"].map((role) => <option key={role}>{role}</option>)}</select><label><input type="checkbox" checked={user.active} onChange={(event) => setSettings((current) => ({ ...current, users: current.users.map((item) => item.id === user.id ? { ...item, active: event.target.checked } : item) }))} /> Active</label><button type="button" disabled={settings.users.length === 1} onClick={() => setSettings((current) => ({ ...current, users: current.users.filter((item) => item.id !== user.id) }))}>Remove</button></article>)}</div>
          <div className={styles.addUser}><label><span>Name</span><input value={newUser.name} onChange={(event) => setNewUser((current) => ({ ...current, name: event.target.value }))} placeholder="Worker name" /></label><label><span>Email</span><input type="email" value={newUser.email} onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))} placeholder="worker@example.com" /></label><label><span>Role</span><select value={newUser.role} onChange={(event) => setNewUser((current) => ({ ...current, role: event.target.value as UserRole }))}>{["Administrator", "Supervisor", "Operator", "Viewer"].map((role) => <option key={role}>{role}</option>)}</select></label><button type="button" disabled={!newUser.name.trim() || !newUser.email.trim()} onClick={addUser}>+ Add worker</button></div>
        </div>}

        {active === "allocation" && <div className={styles.formGrid}>
          <label><span>Stock rotation</span><select value={settings.allocation.rotation} onChange={(event) => setSettings((current) => ({ ...current, allocation: { ...current.allocation, rotation: event.target.value as "FIFO" | "FEFO" } }))}><option value="FEFO">FEFO · First expiry, first out</option><option value="FIFO">FIFO · First in, first out</option></select><small>Determines which inventory lot is reserved first.</small></label>
          <label><span>Order priority</span><select value={settings.allocation.orderPriority} onChange={(event) => setSettings((current) => ({ ...current, allocation: { ...current.allocation, orderPriority: event.target.value as "OLDEST_FIRST" | "EXPEDITE_FIRST" } }))}><option value="OLDEST_FIRST">Oldest order first</option><option value="EXPEDITE_FIRST">Expedited orders first</option></select><small>Controls the order released to picking first.</small></label>
          <fieldset><legend>Allocatable stock statuses</legend>{["AVAILABLE", "QUARANTINED", "DAMAGED"].map((status) => <label key={status}><input type="checkbox" checked={settings.allocation.allowedStatuses.includes(status)} onChange={(event) => setSettings((current) => ({ ...current, allocation: { ...current.allocation, allowedStatuses: event.target.checked ? [...current.allocation.allowedStatuses, status] : current.allocation.allowedStatuses.filter((item) => item !== status) } }))} /> {titleCase(status)}</label>)}</fieldset>
          <label className={styles.toggle}><input type="checkbox" checked={settings.allocation.preventPartialAllocation} onChange={(event) => setSettings((current) => ({ ...current, allocation: { ...current.allocation, preventPartialAllocation: event.target.checked } }))} /><span><strong>Prevent partial allocation</strong><small>Wait until every order line can be fulfilled.</small></span></label>
        </div>}

        {active === "labels" && <div className={styles.formGrid}>
          <label><span>Default label format</span><select value={settings.labels.format} onChange={(event) => setSettings((current) => ({ ...current, labels: { ...current.labels, format: event.target.value as "4x6" | "A4" | "A5" } }))}><option value="4x6">4 × 6 inch thermal</option><option value="A4">A4 sheet</option><option value="A5">A5 sheet</option></select></label>
          <label><span>Default printer</span><input value={settings.labels.printer} onChange={(event) => setSettings((current) => ({ ...current, labels: { ...current.labels, printer: event.target.value } }))} placeholder="Browser print dialog" /></label>
          <label><span>Copies per label</span><input type="number" min="1" max="10" value={settings.labels.copies} onChange={(event) => setSettings((current) => ({ ...current, labels: { ...current.labels, copies: Number(event.target.value) } }))} /></label>
          <label className={styles.toggle}><input type="checkbox" checked={settings.labels.autoPrint} onChange={(event) => setSettings((current) => ({ ...current, labels: { ...current.labels, autoPrint: event.target.checked } }))} /><span><strong>Auto-print after confirmation</strong><small>Print when receive, pack, or delivery creation completes.</small></span></label>
          <div className={styles.labelPreview}><span>JABLY</span><strong>{warehouseName}</strong><div /><small>{settings.labels.format} · TEST LABEL</small></div>
        </div>}

        {active === "integrations" && <div className={styles.integrationPanel}>
          <div className={styles.providerList}><article><span>SD</span><div><strong>Sandbox Delivery</strong><small>Labels, tracking, and webhook simulation</small></div><label><input type="checkbox" checked={settings.integrations.sandboxDelivery} onChange={(event) => setSettings((current) => ({ ...current, integrations: { ...current.integrations, sandboxDelivery: event.target.checked } }))} /> Enabled</label></article>{[["CJ", "CJ Logistics"], ["CP", "Coupang Logistics"], ["FD", "FedEx"]].map(([initials, provider]) => <article className={styles.planned} key={provider}><span>{initials}</span><div><strong>{provider}</strong><small>Provider adapter available for future integration</small></div><b>Planned</b></article>)}</div>
          <div className={styles.formGrid}><label><span>Event webhook URL</span><input type="url" value={settings.integrations.webhookUrl} onChange={(event) => setSettings((current) => ({ ...current, integrations: { ...current.integrations, webhookUrl: event.target.value } }))} placeholder="https://example.com/wms/events" /><small>Optional destination for sandbox status events.</small></label><label><span>External order source</span><select value={settings.integrations.orderSource} onChange={(event) => setSettings((current) => ({ ...current, integrations: { ...current.integrations, orderSource: event.target.value as "MANUAL" | "API" | "CSV" } }))}><option value="MANUAL">Manual entry only</option><option value="API">WMS API</option><option value="CSV">CSV import</option></select></label></div>
        </div>}

        <div className={styles.formActions}><button type="button" onClick={() => setSettings(DEFAULT_SETTINGS)}>Reset defaults</button><button type="submit" disabled={saving || loading}>{saving ? "Saving…" : "Save changes"}</button></div>
      </form>}
    </div>
  </section>;
}
