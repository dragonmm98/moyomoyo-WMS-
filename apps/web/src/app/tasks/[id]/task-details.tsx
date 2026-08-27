"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { API_URL } from "@/lib/api-url";
import { apiFetch } from "@/lib/api";

type TaskPayload = {
  title?: string;
  description?: string | null;
  sourceLocation?: string | null;
  destinationLocation?: string | null;
  quantity?: number | null;
  unit?: string | null;
  dueAt?: string | null;
  instructions?: string | null;
};
type Task = {
  id: string;
  taskNumber: string;
  type: string;
  status: string;
  priority: number;
  assigneeId: string | null;
  referenceType: string;
  referenceId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  payload: TaskPayload;
  warehouse: { code: string; name: string; timezone: string } | null;
};

const PRIORITIES = ["Normal", "High", "Urgent", "Critical"];
const TASK_FLOW = ["OPEN", "ASSIGNED", "IN_PROGRESS", "COMPLETED"];

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

export function TaskDetails({ id }: { id: string }) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadedAt, setLoadedAt] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch(`${API_URL}/tasks/${id}`);
      const body = (await response.json()) as Task & { message?: string };
      if (!response.ok) throw new Error(body.message || "Could not load task.");
      setTask(body);
      setLoadedAt(Date.now());
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

  if (loading)
    return <div className="detail-state panel" role="status"><span className="detail-spinner" /><h1>Loading task</h1><p>Retrieving assignment, route, and work instructions…</p></div>;

  if (error || !task)
    return (
      <div className="detail-state panel"><span className="detail-state-icon">!</span><h1>Task unavailable</h1><p>{error || "This task could not be found."}</p><div className="header-actions"><Link className="button button-secondary" href="/tasks">Back to tasks</Link><button className="button button-primary" onClick={() => void load()}>Try again</button></div></div>
    );

  const flowIndex = TASK_FLOW.indexOf(task.status);
  const due = task.payload.dueAt ? new Date(task.payload.dueAt) : null;
  const overdue = due
    ? due.getTime() < loadedAt && task.status !== "COMPLETED"
    : false;

  return (
    <div className="po-detail-page task-detail-page">
      <header className="po-header detail-header">
        <div>
          <Link className="back-link" href="/tasks">← Back to tasks</Link>
          <div className="detail-title-row"><h1>{task.taskNumber}</h1><span className={`status ${task.status.toLowerCase().replaceAll("_", "-")}`}>{label(task.status)}</span></div>
          <p className="subtitle">{task.payload.title || label(task.type)} · {task.warehouse?.name || "Warehouse"}</p>
        </div>
        <div className="header-actions detail-actions"><button className="button button-secondary" type="button" onClick={() => window.print()}>Print</button><Link className="button button-primary" href={`/scan?task=${task.id}`}>Open in scanner</Link></div>
      </header>

      <section className="detail-metrics inventory-metrics" aria-label="Task summary">
        <article className="panel"><span>Workflow</span><strong className="task-metric-text">{label(task.type)}</strong><small>{task.referenceType}</small></article>
        <article className="panel"><span>Priority</span><strong className="task-metric-text">{PRIORITIES[task.priority] ?? "Normal"}</strong><small>Queue priority {task.priority}</small></article>
        <article className="panel"><span>Assignee</span><strong className="task-metric-text">{task.assigneeId || "Unassigned"}</strong><small>{task.assigneeId ? "Assigned worker" : "Open queue"}</small></article>
        <article className={`panel ${overdue ? "overdue-metric" : ""}`}><span>Due</span><strong className="task-metric-text">{due ? date(due.toISOString(), true) : "No deadline"}</strong><small>{overdue ? "Overdue" : due ? "Scheduled work" : "No due time set"}</small></article>
      </section>

      <section className="panel task-progress-flow">
        {TASK_FLOW.map((stage, index) => (
          <div className={flowIndex >= index ? "complete" : ""} key={stage}><span>{index < flowIndex ? "✓" : index + 1}</span><div><strong>{label(stage)}</strong><small>{["Waiting for assignment", "Worker assigned", "Work underway", "Work confirmed"][index]}</small></div></div>
        ))}
      </section>

      <div className="detail-layout">
        <main className="detail-main">
          <section className="panel task-work-panel">
            <div className="panel-heading"><div><h2>Work instructions</h2><p>Route and execution details for the assigned worker</p></div><span className={`priority priority-${task.priority}`}>{PRIORITIES[task.priority]}</span></div>
            <div className="task-route">
              <article><span>From</span><strong>{task.payload.sourceLocation || "Not specified"}</strong><small>Source location</small></article>
              <b>→</b>
              <article><span>To</span><strong>{task.payload.destinationLocation || "Not specified"}</strong><small>Destination location</small></article>
              <article className="task-quantity"><span>Quantity</span><strong>{task.payload.quantity ? `${task.payload.quantity} ${task.payload.unit || "EA"}` : "Not specified"}</strong><small>Expected work quantity</small></article>
            </div>
            {(task.payload.description || task.payload.instructions) && (
              <div className="task-instructions">
                {task.payload.description && <div><h3>Description</h3><p>{task.payload.description}</p></div>}
                {task.payload.instructions && <div><h3>Worker instructions</h3><p>{task.payload.instructions}</p></div>}
              </div>
            )}
          </section>

          <section className="panel task-reference-panel">
            <div><span>Reference type</span><strong>{label(task.referenceType)}</strong></div>
            <div><span>Reference ID</span><strong>{task.referenceId}</strong></div>
            <div><span>Warehouse</span><strong>{task.warehouse ? `${task.warehouse.code} · ${task.warehouse.name}` : "Unavailable"}</strong></div>
          </section>
        </main>

        <aside className="panel detail-sidebar">
          <div className="panel-heading"><div><h2>Task information</h2><p>Ownership and lifecycle metadata</p></div></div>
          <dl>
            <div><dt>Task number</dt><dd>{task.taskNumber}</dd></div>
            <div><dt>Status</dt><dd>{label(task.status)}</dd></div>
            <div><dt>Workflow</dt><dd>{label(task.type)}</dd></div>
            <div><dt>Priority</dt><dd>{PRIORITIES[task.priority] ?? "Normal"}</dd></div>
            <div><dt>Assignee</dt><dd>{task.assigneeId || "Unassigned"}</dd></div>
            <div><dt>Due</dt><dd>{due ? date(due.toISOString(), true) : "No deadline"}</dd></div>
            <div><dt>Created</dt><dd>{date(task.createdAt, true)}</dd></div>
            <div><dt>Last updated</dt><dd>{date(task.updatedAt, true)}</dd></div>
          </dl>
          <div className="detail-id"><span>Operational task ID · version {task.version}</span><code>{task.id}</code></div>
        </aside>
      </div>
    </div>
  );
}
