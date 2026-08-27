"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth-context";

export type Warehouse = {
  id: string;
  code: string;
  name: string;
  timezone: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  active: boolean;
  zones: { id: string; locations: { id: string }[] }[];
};

type WarehouseContextValue = {
  warehouses: Warehouse[];
  selectedWarehouse: Warehouse | null;
  loading: boolean;
  selectWarehouse: (warehouse: Warehouse) => void;
  refreshWarehouses: () => Promise<Warehouse[]>;
};

const STORAGE_KEY = "jably-selected-warehouse";
const WarehouseContext = createContext<WarehouseContextValue | null>(null);

export function WarehouseProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshWarehouses = useCallback(async () => {
    try {
      const response = await apiFetch("/warehouses");
      if (!response.ok) throw new Error("Could not load warehouses");
      const body = (await response.json()) as Warehouse[];
      setWarehouses(body);
      setSelectedWarehouse((current) => {
        const storedId = window.localStorage.getItem(STORAGE_KEY);
        const next = body.find((warehouse) => warehouse.id === current?.id)
          ?? body.find((warehouse) => warehouse.id === storedId)
          ?? body[0]
          ?? null;
        if (next) window.localStorage.setItem(STORAGE_KEY, next.id);
        else window.localStorage.removeItem(STORAGE_KEY);
        return next;
      });
      return body;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setWarehouses([]);
      setSelectedWarehouse(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const request = window.setTimeout(() => void refreshWarehouses(), 0);
    return () => window.clearTimeout(request);
  }, [refreshWarehouses, user]);

  const selectWarehouse = useCallback((warehouse: Warehouse) => {
    window.localStorage.setItem(STORAGE_KEY, warehouse.id);
    setSelectedWarehouse(warehouse);
  }, []);

  const value = useMemo(() => ({ warehouses, selectedWarehouse, loading, selectWarehouse, refreshWarehouses }), [loading, refreshWarehouses, selectWarehouse, selectedWarehouse, warehouses]);
  return <WarehouseContext.Provider value={value}>{children}</WarehouseContext.Provider>;
}

export function useWarehouse() {
  const context = useContext(WarehouseContext);
  if (!context) throw new Error("useWarehouse must be used inside WarehouseProvider");
  return context;
}
