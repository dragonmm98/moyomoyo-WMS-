"use client";

import { useEffect, useMemo, useState } from "react";
import { OperationsPage } from "@/components/operations-page";
import { API_URL } from "@/lib/api-url";
import { apiFetch } from "@/lib/api";

type TaskPayload = {
  title?: string;
  sourceLocation?: string | null;
  destinationLocation?: string | null;
  dueAt?: string | null;
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
  payload: TaskPayload;
};

function label(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

export function TaskQueue() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await apiFetch(`${API_URL}/tasks`);
        if (!response.ok) throw new Error("Could not load warehouse tasks.");
        const body = (await response.json()) as Task[];
        if (active) setTasks(body);
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
    const open = tasks.filter((task) => ["OPEN", "ASSIGNED"].includes(task.status)).length;
    const unassigned = tasks.filter((task) => task.status === "OPEN" && !task.assigneeId).length;
    const inProgress = tasks.filter((task) => task.status === "IN_PROGRESS").length;
    const completed = tasks.filter((task) => task.status === "COMPLETED").length;
    const exceptions = tasks.filter((task) => task.status === "EXCEPTION").length;
    return { open, unassigned, inProgress, completed, exceptions };
  }, [tasks]);

  return (
    <OperationsPage
      eyebrow="Work orchestration"
      title="Warehouse tasks"
      description="Prioritize and assign work across receiving and fulfillment."
      action="Create task"
      actionHref="/tasks/new"
      scannerHref="/scan"
      sectionTitle="Task queue"
      columns={["Task", "Workflow", "Route / reference", "Assignee", "Status"]}
      metrics={[
        { label: "Open tasks", value: loading ? "—" : String(metrics.open), detail: `${metrics.unassigned} unassigned` },
        { label: "In progress", value: loading ? "—" : String(metrics.inProgress), detail: "Active warehouse work" },
        { label: "Completed", value: loading ? "—" : String(metrics.completed), detail: "Recorded tasks" },
        { label: "Exceptions", value: loading ? "—" : String(metrics.exceptions), detail: "Needs intervention" },
      ]}
      rows={tasks.map((task) => {
        const route = [task.payload.sourceLocation, task.payload.destinationLocation].filter(Boolean).join(" → ");
        return {
          id: task.taskNumber,
          primary: task.payload.title || label(task.type),
          secondary: route || `${label(task.referenceType)} · ${task.referenceId}`,
          owner: task.assigneeId || "Unassigned",
          status: label(task.status),
          href: `/tasks/${task.id}`,
        };
      })}
      emptyMessage={loading ? "Loading tasks…" : error || "No warehouse tasks have been created yet."}
    />
  );
}
