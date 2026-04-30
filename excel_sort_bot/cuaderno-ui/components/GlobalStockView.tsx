"use client";

import { useEffect, useState } from "react";
import { Package } from "lucide-react";
import { api } from "@/lib/api";

type GlobalStockRow = {
  producto_id: string;
  nombre_comercial: string;
  numero_registro?: string;
  unidad: string;
  stock_actual: number;
  total_entradas: number;
  total_consumido: number;
  cuadernos_count: number;
  semaforo: "verde" | "amarillo" | "rojo";
};

const BADGE: Record<string, string> = {
  verde: "bg-green-500 text-white",
  amarillo: "bg-amber-400 text-white",
  rojo: "bg-red-500 text-white",
};

export default function GlobalStockView() {
  const [rows, setRows] = useState<GlobalStockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getStockGlobal();
      setRows(res.productos || []);
    } catch (e: any) {
      setError(e.message || "Error cargando stock global");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retryTimer: number | null = null;
    let stopped = false;

    const getWsBase = () => {
      if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL.replace(/^http/i, "ws");
      if (typeof window !== "undefined" && process.env.NODE_ENV === "development") return "ws://127.0.0.1:8000";
      if (typeof window !== "undefined") return `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;
      return "";
    };

    const connect = () => {
      if (stopped) return;
      const base = getWsBase();
      if (!base) return;
      ws = new WebSocket(`${base}/api/cuaderno/ws/stock/global`);
      ws.onmessage = () => load();
      ws.onclose = () => {
        if (stopped) return;
        retryTimer = window.setTimeout(connect, 1500);
      };
      ws.onerror = () => {
        try { ws?.close(); } catch { /* ignore */ }
      };
    };

    connect();
    return () => {
      stopped = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      try { ws?.close(); } catch { /* ignore */ }
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 bg-[var(--bg-dark)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package size={16} className="text-emerald-500" />
          <span className="text-sm font-semibold text-gray-800">Stock Global</span>
          <span className="text-xs text-gray-400">Todos los cuadernos</span>
        </div>
        <button
          onClick={load}
          className="px-2.5 py-1.5 text-xs rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700"
        >
          Actualizar
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="h-40 flex items-center justify-center text-sm text-gray-400">Cargando stock global...</div>
        ) : error ? (
          <div className="h-40 flex items-center justify-center text-sm text-red-500">{error}</div>
        ) : rows.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-sm text-gray-400">No hay productos en stock global.</div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[var(--bg-dark)] border-b border-gray-200">
                <th className="px-3 py-2 text-left font-medium text-gray-500">Producto</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Nº Registro</th>
                <th className="px-3 py-2 text-center font-medium text-gray-500">Estado</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Stock Actual</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Entradas</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Consumido</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Cuadernos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.producto_id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-800">{r.nombre_comercial}</td>
                  <td className="px-3 py-2 text-gray-500">{r.numero_registro || "—"}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] ${BADGE[r.semaforo]}`}>{r.semaforo}</span>
                  </td>
                  <td className="px-3 py-2 text-right">{r.stock_actual.toFixed(2)} {r.unidad}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{r.total_entradas.toFixed(2)} {r.unidad}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{r.total_consumido.toFixed(2)} {r.unidad}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{r.cuadernos_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
