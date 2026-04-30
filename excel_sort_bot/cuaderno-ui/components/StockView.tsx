"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Plus, Trash2, Package, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";

interface StockEntrada {
    id: string;
    producto_id: string;
    nombre_comercial: string;
    cantidad: number;
    unidad: string;
    fecha: string;
    proveedor: string;
    num_albaran: string;
    num_lote: string;
    precio_unidad: number;
    notas: string;
    fecha_creacion: string;
}

interface StockProducto {
    producto_id: string;
    nombre_comercial: string;
    unidad: string;
    proveedor: string;
    stock_actual: number;
    total_entradas: number;
    total_consumido: number;
    semaforo: "verde" | "amarillo" | "rojo";
    entradas: StockEntrada[];
}

interface Props {
    cuadernoId: string;
}

const SEMAFORO_COLOR: Record<string, string> = {
    verde: "bg-green-500",
    amarillo: "bg-amber-400",
    rojo: "bg-red-500",
};

const SEMAFORO_LABEL: Record<string, string> = {
    verde: "OK",
    amarillo: "Bajo",
    rojo: "Agotado",
};

export default function StockView({ cuadernoId }: Props) {
    const [productos, setProductos] = useState<StockProducto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [savingEntradaId, setSavingEntradaId] = useState<string | null>(null);
    const [entryDrafts, setEntryDrafts] = useState<Record<string, Partial<StockEntrada>>>({});

    const [form, setForm] = useState({
        nombre_comercial: "",
        producto_id: "",
        cantidad: "",
        unidad: "L",
        fecha: new Date().toISOString().slice(0, 10),
        proveedor: "",
        num_albaran: "",
        num_lote: "",
        precio_unidad: "",
        notas: "",
    });

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.getStock(cuadernoId);
            const next = res.productos || [];
            setProductos(next);
            try {
                localStorage.setItem(`stock_cache_${cuadernoId}`, JSON.stringify(next));
            } catch { /* ignore cache errors */ }
        } catch (e: any) {
            setError(e.message || "Error cargando stock");
        } finally {
            setLoading(false);
        }
    }, [cuadernoId]);

    useEffect(() => {
        try {
            const cached = localStorage.getItem(`stock_cache_${cuadernoId}`);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed)) {
                    setProductos(parsed);
                    setLoading(false);
                }
            }
        } catch { /* ignore cache errors */ }
        load();
    }, [load, cuadernoId]);

    // "o algo" real-time: refresco incremental periódico para no esperar acciones manuales.
    useEffect(() => {
        const id = window.setInterval(() => {
            load();
        }, 8000);
        return () => window.clearInterval(id);
    }, [load]);

    useEffect(() => {
        let ws: WebSocket | null = null;
        let retryTimer: number | null = null;
        let stopped = false;

        const getWsBase = () => {
            if (process.env.NEXT_PUBLIC_API_URL) {
                return process.env.NEXT_PUBLIC_API_URL.replace(/^http/i, "ws");
            }
            if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
                return "ws://127.0.0.1:8000";
            }
            if (typeof window !== "undefined") {
                return `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;
            }
            return "";
        };

        const connect = () => {
            if (stopped) return;
            const base = getWsBase();
            if (!base) return;
            ws = new WebSocket(`${base}/api/cuaderno/ws/stock/${cuadernoId}`);
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
    }, [cuadernoId, load]);

    const toggleRow = (id: string) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSave = async () => {
        if (!form.nombre_comercial.trim() || !form.cantidad) return;
        setSaving(true);
        try {
            await api.createStockEntrada(cuadernoId, {
                nombre_comercial: form.nombre_comercial.trim(),
                producto_id: form.producto_id || undefined,
                cantidad: parseFloat(form.cantidad),
                unidad: form.unidad,
                fecha: form.fecha,
                proveedor: form.proveedor,
                num_albaran: form.num_albaran,
                num_lote: form.num_lote,
                precio_unidad: form.precio_unidad ? parseFloat(form.precio_unidad) : undefined,
                notas: form.notas,
            });
            setShowModal(false);
            setForm({
                nombre_comercial: "", producto_id: "", cantidad: "", unidad: "L",
                fecha: new Date().toISOString().slice(0, 10),
                proveedor: "", num_albaran: "", num_lote: "", precio_unidad: "", notas: "",
            });
            await load();
        } catch (e: any) {
            alert(e.message || "Error guardando entrada");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteEntrada = async (entradaId: string) => {
        if (!confirm("¿Eliminar esta entrada de stock?")) return;
        setDeletingId(entradaId);
        try {
            await api.deleteStockEntrada(cuadernoId, entradaId);
            await load();
        } catch (e: any) {
            alert(e.message || "Error eliminando entrada");
        } finally {
            setDeletingId(null);
        }
    };

    const getEntryValue = (entry: StockEntrada, field: keyof StockEntrada): any => {
        const draft = entryDrafts[entry.id];
        if (draft && field in draft) return (draft as any)[field];
        return (entry as any)[field];
    };

    const setEntryDraft = (entryId: string, patch: Partial<StockEntrada>) => {
        setEntryDrafts(prev => ({ ...prev, [entryId]: { ...(prev[entryId] || {}), ...patch } }));
    };

    const handleSaveEntradaField = async (entry: StockEntrada, patch: Partial<StockEntrada>) => {
        setSavingEntradaId(entry.id);
        try {
            await api.updateStockEntrada(cuadernoId, entry.id, {
                cantidad: patch.cantidad as number | undefined,
                fecha: patch.fecha as string | undefined,
                proveedor: patch.proveedor as string | undefined,
                num_albaran: patch.num_albaran as string | undefined,
                num_lote: patch.num_lote as string | undefined,
                precio_unidad: patch.precio_unidad as number | undefined,
                notas: patch.notas as string | undefined,
            });
            setEntryDrafts(prev => {
                const next = { ...prev };
                delete next[entry.id];
                return next;
            });
            await load();
        } catch (e: any) {
            alert(e.message || "Error actualizando entrada");
        } finally {
            setSavingEntradaId(null);
        }
    };

    const totalVerde = productos.filter(p => p.semaforo === "verde").length;
    const totalAmarillo = productos.filter(p => p.semaforo === "amarillo").length;
    const totalRojo = productos.filter(p => p.semaforo === "rojo").length;

    // Collect all product names for autocomplete
    const productNames = Array.from(new Set(productos.map(p => p.nombre_comercial)));

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center gap-2">
                    <Package size={16} className="text-gray-500" />
                    <span className="font-semibold text-gray-800 text-sm">Stock de Productos</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={load}
                        className="p-1.5 rounded hover:bg-gray-200 text-gray-500"
                        title="Actualizar"
                    >
                        <RefreshCw size={13} />
                    </button>
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700"
                    >
                        <Plus size={13} />
                        Nueva entrada
                    </button>
                </div>
            </div>

            {/* Summary cards */}
            <div className="flex gap-3 px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-xs text-green-800 font-medium">{totalVerde} OK</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-xs text-amber-800 font-medium">{totalAmarillo} Bajo</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-xs text-red-800 font-medium">{totalRojo} Agotado</span>
                </div>
                <div className="ml-auto flex items-center text-xs text-gray-400">
                    {productos.length} producto{productos.length !== 1 ? "s" : ""}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto">
                {loading ? (
                    <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                        Cargando stock…
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center h-32 gap-2">
                        <span className="text-red-500 text-sm">{error}</span>
                        <button onClick={load} className="text-blue-600 text-xs underline">Reintentar</button>
                    </div>
                ) : productos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-400">
                        <Package size={32} className="opacity-30" />
                        <p className="text-sm">No hay entradas de stock</p>
                        <button
                            onClick={() => setShowModal(true)}
                            className="text-blue-600 text-xs underline"
                        >
                            Añadir primera entrada
                        </button>
                    </div>
                ) : (
                    <table className="w-full text-xs border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 sticky top-0">
                                <th className="w-6 px-2 py-2" />
                                <th className="text-left px-3 py-2 font-medium text-gray-600">Producto</th>
                                <th className="text-center px-2 py-2 font-medium text-gray-600 w-20">Estado</th>
                                <th className="text-right px-3 py-2 font-medium text-gray-600 w-28">Stock actual</th>
                                <th className="text-right px-3 py-2 font-medium text-gray-600 w-28">Total entrado</th>
                                <th className="text-right px-3 py-2 font-medium text-gray-600 w-28">Consumido</th>
                                <th className="text-left px-3 py-2 font-medium text-gray-600 w-36">Proveedor</th>
                            </tr>
                        </thead>
                        <tbody>
                            {productos.map(prod => (
                                <>
                                    <tr
                                        key={prod.producto_id || prod.nombre_comercial}
                                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                                        onClick={() => toggleRow(prod.producto_id || prod.nombre_comercial)}
                                    >
                                        <td className="px-2 py-2 text-gray-400">
                                            {expandedRows.has(prod.producto_id || prod.nombre_comercial)
                                                ? <ChevronDown size={12} />
                                                : <ChevronRight size={12} />}
                                        </td>
                                        <td className="px-3 py-2 font-medium text-gray-800">
                                            {prod.nombre_comercial}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-xs font-medium ${SEMAFORO_COLOR[prod.semaforo]}`}>
                                                {SEMAFORO_LABEL[prod.semaforo]}
                                            </span>
                                        </td>
                                        <td className={`px-3 py-2 text-right font-semibold ${prod.semaforo === "rojo" ? "text-red-600" : prod.semaforo === "amarillo" ? "text-amber-600" : "text-green-700"}`}>
                                            {prod.stock_actual.toFixed(2)} {prod.unidad}
                                        </td>
                                        <td className="px-3 py-2 text-right text-gray-600">
                                            {prod.total_entradas.toFixed(2)} {prod.unidad}
                                        </td>
                                        <td className="px-3 py-2 text-right text-gray-600">
                                            {prod.total_consumido.toFixed(2)} {prod.unidad}
                                        </td>
                                        <td className="px-3 py-2 text-gray-500">
                                            {prod.proveedor || "—"}
                                        </td>
                                    </tr>

                                    {/* Expanded: entradas history */}
                                    {expandedRows.has(prod.producto_id || prod.nombre_comercial) && (
                                        <tr key={`${prod.producto_id || prod.nombre_comercial}-exp`}>
                                            <td colSpan={7} className="bg-blue-50/50 px-4 pb-3 pt-1">
                                                <div className="text-xs font-medium text-blue-700 mb-2 pt-1">
                                                    Movimientos de stock
                                                </div>
                                                {prod.entradas.length === 0 ? (
                                                    <p className="text-gray-400 text-xs">Sin entradas registradas</p>
                                                ) : (
                                                    <table className="w-full text-xs border-collapse">
                                                        <thead>
                                                            <tr className="text-gray-500 border-b border-blue-200">
                                                                <th className="text-left py-1 pr-3 font-medium">Fecha</th>
                                                                <th className="text-right py-1 pr-3 font-medium">Cantidad</th>
                                                                <th className="text-left py-1 pr-3 font-medium">Proveedor</th>
                                                                <th className="text-left py-1 pr-3 font-medium">Albarán</th>
                                                                <th className="text-left py-1 pr-3 font-medium">Lote</th>
                                                                <th className="text-right py-1 pr-3 font-medium">Precio/u</th>
                                                                <th className="text-left py-1 font-medium">Notas</th>
                                                                <th className="w-6" />
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {prod.entradas.map(e => (
                                                                <tr key={e.id} className="border-b border-blue-100 hover:bg-blue-100/40">
                                                                    <td className="py-1 pr-3 text-gray-700">
                                                                        <input
                                                                            type="date"
                                                                            value={String(getEntryValue(e, "fecha") || "")}
                                                                            onChange={(ev) => setEntryDraft(e.id, { fecha: ev.target.value })}
                                                                            onBlur={() => handleSaveEntradaField(e, { fecha: String(getEntryValue(e, "fecha") || "") })}
                                                                            className="w-32 px-1 py-0.5 border border-blue-200 rounded"
                                                                            disabled={savingEntradaId === e.id}
                                                                        />
                                                                    </td>
                                                                    <td className="py-1 pr-3 text-right font-medium text-green-700">
                                                                        <div className="flex items-center justify-end gap-1">
                                                                            <span>+</span>
                                                                            <input
                                                                                type="number"
                                                                                step="0.01"
                                                                                value={Number(getEntryValue(e, "cantidad") || 0)}
                                                                                onChange={(ev) => setEntryDraft(e.id, { cantidad: parseFloat(ev.target.value || "0") })}
                                                                                onBlur={() => handleSaveEntradaField(e, { cantidad: Number(getEntryValue(e, "cantidad") || 0) })}
                                                                                className="w-20 px-1 py-0.5 border border-blue-200 rounded text-right"
                                                                                disabled={savingEntradaId === e.id}
                                                                            />
                                                                            <span>{e.unidad}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-1 pr-3 text-gray-600">
                                                                        <input
                                                                            type="text"
                                                                            value={String(getEntryValue(e, "proveedor") || "")}
                                                                            onChange={(ev) => setEntryDraft(e.id, { proveedor: ev.target.value })}
                                                                            onBlur={() => handleSaveEntradaField(e, { proveedor: String(getEntryValue(e, "proveedor") || "") })}
                                                                            className="w-28 px-1 py-0.5 border border-blue-200 rounded"
                                                                            disabled={savingEntradaId === e.id}
                                                                        />
                                                                    </td>
                                                                    <td className="py-1 pr-3 text-gray-600">
                                                                        <input
                                                                            type="text"
                                                                            value={String(getEntryValue(e, "num_albaran") || "")}
                                                                            onChange={(ev) => setEntryDraft(e.id, { num_albaran: ev.target.value })}
                                                                            onBlur={() => handleSaveEntradaField(e, { num_albaran: String(getEntryValue(e, "num_albaran") || "") })}
                                                                            className="w-24 px-1 py-0.5 border border-blue-200 rounded"
                                                                            disabled={savingEntradaId === e.id}
                                                                        />
                                                                    </td>
                                                                    <td className="py-1 pr-3 text-gray-600">
                                                                        <input
                                                                            type="text"
                                                                            value={String(getEntryValue(e, "num_lote") || "")}
                                                                            onChange={(ev) => setEntryDraft(e.id, { num_lote: ev.target.value })}
                                                                            onBlur={() => handleSaveEntradaField(e, { num_lote: String(getEntryValue(e, "num_lote") || "") })}
                                                                            className="w-20 px-1 py-0.5 border border-blue-200 rounded"
                                                                            disabled={savingEntradaId === e.id}
                                                                        />
                                                                    </td>
                                                                    <td className="py-1 pr-3 text-right text-gray-600">
                                                                        <input
                                                                            type="number"
                                                                            step="0.01"
                                                                            value={Number(getEntryValue(e, "precio_unidad") || 0)}
                                                                            onChange={(ev) => setEntryDraft(e.id, { precio_unidad: parseFloat(ev.target.value || "0") })}
                                                                            onBlur={() => handleSaveEntradaField(e, { precio_unidad: Number(getEntryValue(e, "precio_unidad") || 0) })}
                                                                            className="w-20 px-1 py-0.5 border border-blue-200 rounded text-right"
                                                                            disabled={savingEntradaId === e.id}
                                                                        />
                                                                    </td>
                                                                    <td className="py-1 text-gray-500">
                                                                        <input
                                                                            type="text"
                                                                            value={String(getEntryValue(e, "notas") || "")}
                                                                            onChange={(ev) => setEntryDraft(e.id, { notas: ev.target.value })}
                                                                            onBlur={() => handleSaveEntradaField(e, { notas: String(getEntryValue(e, "notas") || "") })}
                                                                            className="w-full min-w-28 px-1 py-0.5 border border-blue-200 rounded"
                                                                            disabled={savingEntradaId === e.id}
                                                                        />
                                                                    </td>
                                                                    <td className="py-1 pl-2">
                                                                        <button
                                                                            onClick={() => handleDeleteEntrada(e.id)}
                                                                            disabled={deletingId === e.id}
                                                                            className="p-0.5 text-red-400 hover:text-red-600 disabled:opacity-40"
                                                                            title="Eliminar entrada"
                                                                        >
                                                                            <Trash2 size={11} />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal: Nueva entrada de stock */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="font-semibold text-gray-800 text-sm">Nueva entrada de stock</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
                        </div>
                        <div className="px-5 py-4 grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Producto *</label>
                                <input
                                    list="stock-products-list"
                                    className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                                    placeholder="Nombre del producto"
                                    value={form.nombre_comercial}
                                    onChange={e => setForm(f => ({ ...f, nombre_comercial: e.target.value }))}
                                />
                                <datalist id="stock-products-list">
                                    {productNames.map(n => <option key={n} value={n} />)}
                                </datalist>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad *</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                                    placeholder="0.00"
                                    value={form.cantidad}
                                    onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Unidad</label>
                                <select
                                    className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                                    value={form.unidad}
                                    onChange={e => setForm(f => ({ ...f, unidad: e.target.value }))}
                                >
                                    <option>L</option>
                                    <option>Kg</option>
                                    <option>g</option>
                                    <option>mL</option>
                                    <option>ud</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
                                <input
                                    type="date"
                                    className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                                    value={form.fecha}
                                    onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Precio/unidad (€)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                                    placeholder="0.00"
                                    value={form.precio_unidad}
                                    onChange={e => setForm(f => ({ ...f, precio_unidad: e.target.value }))}
                                />
                            </div>

                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Proveedor</label>
                                <input
                                    type="text"
                                    className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                                    placeholder="Nombre del proveedor"
                                    value={form.proveedor}
                                    onChange={e => setForm(f => ({ ...f, proveedor: e.target.value }))}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Nº Albarán</label>
                                <input
                                    type="text"
                                    className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                                    value={form.num_albaran}
                                    onChange={e => setForm(f => ({ ...f, num_albaran: e.target.value }))}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Nº Lote</label>
                                <input
                                    type="text"
                                    className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                                    value={form.num_lote}
                                    onChange={e => setForm(f => ({ ...f, num_lote: e.target.value }))}
                                />
                            </div>

                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
                                <textarea
                                    rows={2}
                                    className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                                    value={form.notas}
                                    onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !form.nombre_comercial.trim() || !form.cantidad}
                                className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40"
                            >
                                {saving ? "Guardando…" : "Guardar entrada"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
