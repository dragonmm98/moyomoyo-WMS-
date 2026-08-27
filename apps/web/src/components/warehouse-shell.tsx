"use client";

import Link from "next/link";
import { useState } from "react";
import { AppNavigation } from "./app-navigation";
import { useAuth } from "./auth-context";
import { LoginScreen } from "./login-screen";
import { useWarehouse } from "./warehouse-context";

function avatar(name: string, code = "") {
  const sequence = code.match(/\d+$/)?.[0];
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);
  return `${initials}${sequence ? Number(sequence) : ""}`.slice(0, 3);
}

export function WarehouseShell({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, logout } = useAuth();
  const { warehouses, selectedWarehouse, loading, selectWarehouse } = useWarehouse();
  const [open, setOpen] = useState(false);
  const current = selectedWarehouse ?? warehouses[0] ?? null;

  if (authLoading) {
    return (
      <main className="login-shell">
        <p className="login-boot">Checking session…</p>
      </main>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <>
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Moyomoyo warehouse home">
          <img className="brand-logo" src="/moyomoyo-logo.png" alt="Moyomoyo" width={92} height={44} />
          <small>Warehouse</small>
        </Link>
        <div className="warehouse-picker">
          <button className="warehouse-switcher" type="button" aria-expanded={open} aria-haspopup="listbox" onClick={() => setOpen((value) => !value)}>
            <span className="warehouse-avatar">{current ? avatar(current.name, current.code) : "—"}</span>
            <span className="warehouse-copy"><strong>{current?.name ?? (loading ? "Loading…" : "No warehouse")}</strong><small>{current?.code ?? "Add in Settings"}</small></span>
            <b>{open ? "⌃" : "⌄"}</b>
          </button>
          {open && <div className="warehouse-menu" role="listbox" aria-label="Select warehouse">
            {warehouses.map((warehouse) => <button className={warehouse.id === current?.id ? "selected" : ""} type="button" role="option" aria-selected={warehouse.id === current?.id} key={warehouse.id} onClick={() => { selectWarehouse(warehouse); setOpen(false); }}><span>{avatar(warehouse.name, warehouse.code)}</span><span><strong>{warehouse.name}</strong><small>{warehouse.code} · {warehouse.timezone}</small></span>{warehouse.id === current?.id && <b>✓</b>}</button>)}
            {!warehouses.length && !loading && <p>No active warehouses</p>}
            <Link href="/settings" onClick={() => setOpen(false)}>⚙ Manage warehouses</Link>
          </div>}
        </div>
        <AppNavigation />
        <div className="sidebar-bottom">
          <Link href="/scan"><span>▣</span>Scanner mode</Link>
          <Link href="/settings"><span>⚙</span>Settings</Link>
          <div className="user-card">
            <span>{avatar(user.name)}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.role === "ADMIN" ? "Administrator" : "Operator"}</small>
            </div>
            <button className="logout-button" type="button" onClick={() => void logout()}>
              Log out
            </button>
          </div>
        </div>
      </aside>
      <main className="app-main">{children}</main>
    </>
  );
}
