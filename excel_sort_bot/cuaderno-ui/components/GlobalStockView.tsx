"use client";

import { useEffect, useState } from "react";
import { Package, Pencil, X } from "lucide-react";
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

type EditState = {
  // clave original (para identificar el producto en el backend)
  origNombre: string;
  origRegistro: string;
  origUnidad: string;
  // valores editables
  nombre_comercial: string;
  numero_registro: string;
  unidad: string;
};

export default function GlobalStockView() {
  const [rows, setRows] = useState<GlobalStockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

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

  const openEdit = (r: GlobalStockRow) => {
    setEdit({
      origNombre: r.nombre_comercial || "",
      origRegistro: r.numero_registro || "",
      origUnidad: r.unidad || "L",
      nombre_comercial: r.nombre_comercial || "",
      numero_registro: r.numero_registro || "",
      unidad: r.unidad || "L",
    });
  };

  const saveEdit = async () => {
    if (!edit) return;
    if (!edit.nombre_comercial.trim()) {
      alert("El nombre del producto no puede estar vacío.");
      return;
    }
    setSaving(true);
    try {
      const res = await api.editProductoStockGlobal({
        match_nombre: edit.origNombre,
        match_registro: edit.origRegistro,
        match_unidad: edit.origUnidad,
        nombre_comercial: edit.nombre_comercial.trim(),
        numero_registro: edit.numero_registro.trim(),
        unidad: edit.unidad.trim() || "L",
      });
      setEdit(null);
      await load();
      if ((res.productos_actualizados ?? 0) > 0) {
        // feedback discreto: el cambio se aplicó en N cuadernos
        console.log(`Producto actualizado en ${res.cuadernos_actualizados} cuaderno(s).`);
      }
    } catch (e: any) {
      alert(e.message || "No se pudo actualizar el producto.");
    } finally {
      setSaving(false);
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
                <th className="px-3 py-2 text-center font-medium text-gray-500">Editar</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.producto_id} className="border-b border-gray-100 hover:bg-gray-50 group">
                  <td className="px-3 py-2 text-gray-800">{r.nombre_comercial}</td>
                  <td className="px-3 py-2 text-gray-500">{r.numero_registro || "—"}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] ${BADGE[r.semaforo]}`}>{r.semaforo}</span>
                  </td>
                  <td className="px-3 py-2 text-right">{r.stock_actual.toFixed(2)} {r.unidad}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{r.total_entradas.toFixed(2)} {r.unidad}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{r.total_consumido.toFixed(2)} {r.unidad}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{r.cuadernos_count}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => openEdit(r)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                      title="Corregir nombre / Nº registro / unidad en todos los cuadernos"
                    >
                      <Pencil size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de edición de producto global */}
      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && setEdit(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h2 className="font-semibold text-gray-800 text-sm">Corregir producto (todos los cuadernos)</h2>
              <button onClick={() => !saving && setEdit(null)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-[11px] text-gray-500 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
                El cambio se aplicará a este producto en <b>todos los cuadernos</b> donde aparezca.
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre comercial</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={edit.nombre_comercial}
                  onChange={(e) => setEdit({ ...edit, nombre_comercial: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nº Registro</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={edit.numero_registro}
                  onChange={(e) => setEdit({ ...edit, numero_registro: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Unidad</label>
                <select
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={edit.unidad}
                  onChange={(e) => setEdit({ ...edit, unidad: e.target.value })}
                >
                  <option>L</option>
                  <option>Kg</option>
                  <option>g</option>
                  <option>mL</option>
                  <option>ud</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200">
              <button
                onClick={() => setEdit(null)}
                disabled={saving}
                className="px-3 py-1.5 text-xs rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="px-3 py-1.5 text-xs rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
