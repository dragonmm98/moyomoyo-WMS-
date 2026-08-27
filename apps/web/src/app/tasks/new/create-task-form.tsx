"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/api-url";
import { apiFetch } from "@/lib/api";

type Location = { id: string; code: string; type: string; status: string };
type Warehouse = {
  id: string;
  code: string;
  name: string;
  zones: { locations: Location[] }[];
};

const TASK_LABELS: Record<string, string> = {
  RECEIVE: "Receive inbound inventory",
  PUTAWAY: "Put away received inventory",
  PICK: "Pick customer order",
  PACK: "Pack customer shipment",
  SHIP: "Confirm outbound shipment",
  CYCLE_COUNT: "Perform cycle count",
  MOVE: "Move inventory",
  REPLENISHMENT: "Replenish picking location",
};

export function CreateTaskForm() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [type, setType] = useState("PICK");
  const [title, setTitle] = useState(TASK_LABELS.PICK);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("0");
  const [assignee, setAssignee] = useState("");
  const [referenceType, setReferenceType] = useState("SalesOrder");
  const [referenceId, setReferenceId] = useState("");
  const [sourceLocation, setSourceLocation] = useState("");
  const [destinationLocation, setDestinationLocation] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("EA");
  const [dueAt, setDueAt] = useState("");
  const [instructions, setInstructions] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [createdId, setCreatedId] = useState("");

  useEffect(() => {
    let active = true;
    async function loadWarehouses() {
      try {
        const response = await apiFetch(`${API_URL}/warehouses`);
        if (!response.ok) return;
        const body = (await response.json()) as Warehouse[];
        if (!active) return;
        setWarehouses(body);
        setWarehouseId(body[0]?.id || "");
      } catch {
        // Submit gives an actionable connection error.
      }
    }
    void loadWarehouses();
    return () => {
      active = false;
    };
  }, []);

  const locations = useMemo(
    () =>
      warehouses
        .find((warehouse) => warehouse.id === warehouseId)
        ?.zones.flatMap((zone) => zone.locations)
        .filter((location) => location.status === "ACTIVE") ?? [],
    [warehouseId, warehouses],
  );

  function changeType(value: string) {
    setType(value);
    setTitle(TASK_LABELS[value] ?? "Warehouse task");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    if (!warehouseId || !title.trim() || !referenceId.trim()) {
      setSubmitStatus("error");
      setMessage("Select a warehouse and enter the task title and reference.");
      return;
    }
    setSubmitStatus("saving");
    try {
      const response = await apiFetch(`${API_URL}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          priority: Number(priority),
          warehouseId,
          assigneeId: assignee || undefined,
          referenceType,
          referenceId: referenceId.trim(),
          title: title.trim(),
          description: description.trim() || undefined,
          sourceLocation: sourceLocation || undefined,
          destinationLocation: destinationLocation || undefined,
          quantity: quantity ? Number(quantity) : undefined,
          unit: quantity ? unit : undefined,
          dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
          instructions: instructions.trim() || undefined,
        }),
      });
      const body = (await response.json()) as { id?: string; taskNumber?: string; message?: string | string[] };
      if (!response.ok)
        throw new Error(Array.isArray(body.message) ? body.message.join(" ") : body.message || "Could not create task.");
      setCreatedId(body.id ?? "");
      setSubmitStatus("success");
      setMessage(`${body.taskNumber ?? "Task"} was created${assignee ? ` and assigned to ${assignee}` : " and added to the open queue"}.`);
    } catch (submitError) {
      setSubmitStatus("error");
      setMessage(submitError instanceof Error ? submitError.message : "Could not create task.");
    }
  }

  const selectedWarehouse = warehouses.find((warehouse) => warehouse.id === warehouseId);

  return (
    <form className="po-page task-form-page" onSubmit={submit}>
      <header className="po-header">
        <div><Link className="back-link" href="/tasks">← Back to tasks</Link><p className="eyebrow">Work orchestration</p><h1>Create warehouse task</h1><p className="subtitle">Define, prioritize, and assign a unit of warehouse work.</p></div>
        <div className="header-actions"><Link className="button button-secondary" href="/tasks">Cancel</Link><button className="button button-primary" type="submit" disabled={submitStatus === "saving"}>{submitStatus === "saving" ? "Creating…" : "Create task"}</button></div>
      </header>

      {message && <div className={`form-banner ${submitStatus}`} role={submitStatus === "error" ? "alert" : "status"}><strong>{submitStatus === "success" ? "✓ Task created" : "Check the task"}</strong><span>{message}</span>{submitStatus === "success" && <Link href={createdId ? `/tasks/${createdId}` : "/tasks"}>View task details →</Link>}</div>}

      <div className="po-layout task-form-layout">
        <div className="po-main">
          <section className="panel form-panel">
            <div className="panel-heading"><div><h2>Task definition</h2><p>Workflow, warehouse, priority, and ownership</p></div><span className="required-note">* Required</span></div>
            <div className="form-grid">
              <label><span>Task type *</span><select value={type} onChange={(event) => changeType(event.target.value)}>{Object.keys(TASK_LABELS).map((value) => <option key={value} value={value}>{value.toLowerCase().replaceAll("_", " ")}</option>)}</select></label>
              <label><span>Warehouse *</span><select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} required><option value="" disabled>Select warehouse</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.code} · {warehouse.name}</option>)}</select></label>
              <label className="full"><span>Task title *</span><input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
              <label><span>Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="0">Normal</option><option value="1">High</option><option value="2">Urgent</option><option value="3">Critical</option></select></label>
              <label><span>Assignee</span><select value={assignee} onChange={(event) => setAssignee(event.target.value)}><option value="">Unassigned</option><option>Min-jun</option><option>Seo-yeon</option><option>Ji-ho</option><option>Ha-neul</option></select></label>
              <label className="full"><span>Description</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the operational outcome of this task" /></label>
            </div>
          </section>

          <section className="panel form-panel">
            <div className="panel-heading"><div><h2>Route & work details</h2><p>Reference, source, destination, quantity, and timing</p></div></div>
            <div className="form-grid">
              <label><span>Reference type *</span><select value={referenceType} onChange={(event) => setReferenceType(event.target.value)}><option>SalesOrder</option><option>PurchaseOrder</option><option>InventoryBalance</option><option>CycleCount</option><option>Manual</option></select></label>
              <label><span>Reference ID *</span><input value={referenceId} onChange={(event) => setReferenceId(event.target.value)} placeholder="SO-260714-001 or manual reference" required /></label>
              <label><span>Source location</span><select value={sourceLocation} onChange={(event) => setSourceLocation(event.target.value)}><option value="">Not specified</option>{locations.map((location) => <option key={location.id} value={location.code}>{location.code} · {location.type.toLowerCase()}</option>)}</select></label>
              <label><span>Destination location</span><select value={destinationLocation} onChange={(event) => setDestinationLocation(event.target.value)}><option value="">Not specified</option>{locations.map((location) => <option key={location.id} value={location.code}>{location.code} · {location.type.toLowerCase()}</option>)}</select></label>
              <label><span>Quantity</span><input type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="Optional" /></label>
              <label><span>Unit</span><select value={unit} onChange={(event) => setUnit(event.target.value)} disabled={!quantity}><option>EA</option><option>CASE</option><option>PALLET</option><option>KG</option></select></label>
              <label className="full"><span>Due date & time</span><input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label>
              <label className="full"><span>Worker instructions</span><textarea rows={4} value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Scanning, handling, inspection, or escalation instructions" /></label>
            </div>
          </section>
        </div>

        <aside className="po-summary panel task-summary">
          <h2>Task summary</h2>
          <div><span>Workflow</span><strong>{type.toLowerCase().replaceAll("_", " ")}</strong></div>
          <div><span>Warehouse</span><strong>{selectedWarehouse?.code || "Select warehouse"}</strong></div>
          <div><span>Assignee</span><strong>{assignee || "Open queue"}</strong></div>
          <div><span>Route</span><strong>{sourceLocation || "—"} → {destinationLocation || "—"}</strong></div>
          <div><span>Quantity</span><strong>{quantity ? `${quantity} ${unit}` : "Not specified"}</strong></div>
          <div><span>Priority</span><strong>{["Normal", "High", "Urgent", "Critical"][Number(priority)]}</strong></div>
          <hr /><p>{assignee ? "This task will be created as Assigned." : "This task will be added to the open queue for assignment."}</p>
        </aside>
      </div>
    </form>
  );
}
