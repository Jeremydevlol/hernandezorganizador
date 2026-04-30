"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Pencil, Trash2, BookMarked, ArrowDownToLine } from "lucide-react";
import { api } from "@/lib/api";

interface CatalogoViewProps {
    /** Si se pasa, muestra botón de importar al cuaderno. Si null/undefined = vista global standalone. */
    cuadernoId?: string | null;
    /** Título a mostrar en el header */
    standalone?: boolean;
}

export default function CatalogoView({ cuadernoId, standalone }: CatalogoViewProps) {
    const [productos, setProductos] = useState<any[]>([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editFields, setEditFields] = useState<Record<string, any>>({});
    const [showNew, setShowNew] = useState(false);
    const [newProd, setNewProd] = useState({
        nombre_comercial: "", numero_registro: "", materia_activa: "",
        formulacion: "", tipo: "fitosanitario", unidad: "L", proveedor: "", notas: ""
    });

    const load = async (q = "") => {
        setLoading(true);
        try {
            const res = await api.searchCatalogoProductos(q, 200);
            setProductos(res.productos || []);
        } catch { /* ignore */ } finally { setLoading(false); }
    };

    useEffect(() => { load(""); }, []);

    const handleSearch = (e: React.FormEvent) => { e.preventDefault(); load(query); };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Eliminar este producto del catálogo global?")) return;
        await api.deleteCatalogoProducto(id);
        load(query);
    };

    const handleEdit = (p: any) => { setEditingId(p.id); setEditFields({ ...p }); };

    const handleSave = async () => {
        if (!editingId) return;
        await api.updateCatalogoProducto(editingId, editFields);
        setEditingId(null);
        load(query);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProd.nombre_comercial.trim()) return;
        await api.createCatalogoProducto(newProd);
        setShowNew(false);
        setNewProd({ nombre_comercial: "", numero_registro: "", materia_activa: "", formulacion: "", tipo: "fitosanitario", unidad: "L", proveedor: "", notas: "" });
        load(query);
    };

    const handleImport = async (catalogoId: string) => {
        if (!cuadernoId) return;
        try {
            await api.importarProductoDesdeCatalogo(cuadernoId, catalogoId);
            alert("Producto importado al inventario del cuaderno.");
        } catch (e: any) { alert(e.message || "Error al importar."); }
    };

    const COL = "px-3 py-2 text-xs border-b border-gray-200";
    const TH = "px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 bg-[var(--bg-dark)] text-left whitespace-nowrap";

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header — solo en modo standalone */}
            {standalone && (
                <div className="px-5 py-3.5 border-b border-gray-200 bg-[var(--bg-dark)] shrink-0 flex items-center gap-3">
                    <BookMarked size={16} className="text-emerald-400" />
                    <div>
                        <h2 className="text-sm font-semibold text-gray-800">Catálogo Global de Productos</h2>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                            Todos los productos de todos los cuadernos. Añade, edita o elimina desde aquí.
                        </p>
                    </div>
                </div>
            )}

            {/* Toolbar */}
            <div className="px-4 py-2.5 border-b border-gray-200 bg-[var(--bg-dark)] flex items-center gap-3 shrink-0 flex-wrap">
                <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="relative flex-1 min-w-0 max-w-xs">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => { setQuery(e.target.value); if (!e.target.value) load(""); }}
                            onKeyDown={(e) => e.key === "Enter" && load(query)}
                            placeholder="Buscar por nombre, materia activa, registro..."
                            className="w-full pl-7 pr-3 py-1.5 rounded-md bg-gray-100 border border-gray-300 text-xs focus:outline-none focus:border-emerald-400"
                        />
                    </div>
                    <button type="submit" className="px-3 py-1.5 rounded-md bg-gray-200 hover:bg-gray-300 text-xs text-gray-700 transition-colors">Buscar</button>
                </form>
                <button
                    onClick={() => setShowNew(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-medium transition-colors shrink-0"
                >
                    <Plus size={13} /> Nuevo producto
                </button>
            </div>

            {/* Formulario nuevo */}
            {showNew && (
                <form onSubmit={handleCreate} className="px-4 py-3 border-b border-gray-200 bg-emerald-500/5 flex flex-wrap gap-2 items-end">
                    {([
                        ["nombre_comercial", "Nombre comercial *"],
                        ["numero_registro", "Nº Registro"],
                        ["materia_activa", "Materia activa"],
                        ["formulacion", "Formulación"],
                        ["proveedor", "Proveedor"],
                    ] as [string, string][]).map(([k, label]) => (
                        <div key={k} className="flex flex-col gap-1">
                            <label className="text-[10px] text-gray-500">{label}</label>
                            <input
                                type="text"
                                value={(newProd as any)[k] || ""}
                                onChange={(e) => setNewProd(p => ({ ...p, [k]: e.target.value }))}
                                className="px-2 py-1.5 rounded-md border border-gray-300 text-xs w-36 focus:outline-none focus:border-emerald-400"
                            />
                        </div>
                    ))}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-gray-500">Tipo</label>
                        <select value={newProd.tipo} onChange={(e) => setNewProd(p => ({ ...p, tipo: e.target.value }))}
                            className="px-2 py-1.5 rounded-md border border-gray-300 text-xs focus:outline-none focus:border-emerald-400">
                            <option value="fitosanitario">Fitosanitario</option>
                            <option value="fertilizante">Fertilizante</option>
                            <option value="biologico">Biológico</option>
                            <option value="otro">Otro</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-gray-500">Unidad</label>
                        <select value={newProd.unidad} onChange={(e) => setNewProd(p => ({ ...p, unidad: e.target.value }))}
                            className="px-2 py-1.5 rounded-md border border-gray-300 text-xs focus:outline-none focus:border-emerald-400">
                            <option value="L">L</option>
                            <option value="Kg">Kg</option>
                            <option value="g">g</option>
                            <option value="ml">ml</option>
                            <option value="ud">ud</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-gray-500">Notas</label>
                        <input
                            type="text"
                            value={newProd.notas}
                            onChange={(e) => setNewProd(p => ({ ...p, notas: e.target.value }))}
                            className="px-2 py-1.5 rounded-md border border-gray-300 text-xs w-44 focus:outline-none focus:border-emerald-400"
                        />
                    </div>
                    <button type="submit" className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium">Crear</button>
                    <button type="button" onClick={() => setShowNew(false)} className="px-3 py-1.5 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs">Cancelar</button>
                </form>
            )}

            {/* Tabla */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0 z-10">
                        <tr>
                            {["Nombre Comercial", "Nº Registro", "Materia Activa", "Formulación", "Tipo", "Ud.", "Proveedor", "Notas", ""].map(h => (
                                <th key={h} className={TH}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={9} className="text-center py-10 text-xs text-gray-400">Cargando...</td></tr>
                        ) : productos.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="text-center py-10 text-xs text-gray-400">
                                    {query
                                        ? `No hay productos que coincidan con "${query}".`
                                        : "El catálogo está vacío. Crea el primer producto con el botón de arriba."}
                                </td>
                            </tr>
                        ) : productos.map((p) => (
                            <tr key={p.id} className="hover:bg-gray-50 group">
                                {editingId === p.id ? (
                                    <>
                                        {(["nombre_comercial", "numero_registro", "materia_activa", "formulacion"] as string[]).map(k => (
                                            <td key={k} className={COL}>
                                                <input
                                                    value={editFields[k] || ""}
                                                    onChange={(e) => setEditFields(f => ({ ...f, [k]: e.target.value }))}
                                                    className="w-full min-w-[80px] px-1.5 py-1 border border-emerald-400 rounded text-xs focus:outline-none"
                                                />
                                            </td>
                                        ))}
                                        <td className={COL}>
                                            <select value={editFields.tipo || ""} onChange={(e) => setEditFields(f => ({ ...f, tipo: e.target.value }))}
                                                className="w-full border border-emerald-400 rounded text-xs px-1 py-1 focus:outline-none">
                                                <option value="fitosanitario">Fitosanitario</option>
                                                <option value="fertilizante">Fertilizante</option>
                                                <option value="biologico">Biológico</option>
                                                <option value="otro">Otro</option>
                                            </select>
                                        </td>
                                        <td className={COL}>
                                            <input value={editFields.unidad || ""} onChange={(e) => setEditFields(f => ({ ...f, unidad: e.target.value }))} className="w-14 border border-emerald-400 rounded text-xs px-1 py-1 focus:outline-none" />
                                        </td>
                                        <td className={COL}>
                                            <input value={editFields.proveedor || ""} onChange={(e) => setEditFields(f => ({ ...f, proveedor: e.target.value }))} className="w-full min-w-[80px] border border-emerald-400 rounded text-xs px-1 py-1 focus:outline-none" />
                                        </td>
                                        <td className={COL}>
                                            <input value={editFields.notas || ""} onChange={(e) => setEditFields(f => ({ ...f, notas: e.target.value }))} className="w-full min-w-[100px] border border-emerald-400 rounded text-xs px-1 py-1 focus:outline-none" />
                                        </td>
                                        <td className={COL + " whitespace-nowrap"}>
                                            <div className="flex gap-1">
                                                <button onClick={handleSave} className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px]">Guardar</button>
                                                <button onClick={() => setEditingId(null)} className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 text-[11px]">Cancelar</button>
                                            </div>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className={COL + " font-medium text-gray-800 max-w-[180px]"}>
                                            <span className="block truncate" title={p.nombre_comercial}>{p.nombre_comercial}</span>
                                        </td>
                                        <td className={COL + " text-gray-600 font-mono text-[11px]"}>{p.numero_registro || "—"}</td>
                                        <td className={COL + " text-gray-600 max-w-[140px]"}>
                                            <span className="block truncate" title={p.materia_activa}>{p.materia_activa || "—"}</span>
                                        </td>
                                        <td className={COL + " text-gray-500 text-[11px]"}>{p.formulacion || "—"}</td>
                                        <td className={COL}>
                                            <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${p.tipo === "fitosanitario" ? "bg-amber-100 text-amber-700" : p.tipo === "fertilizante" ? "bg-emerald-100 text-emerald-700" : p.tipo === "biologico" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                                                {p.tipo}
                                            </span>
                                        </td>
                                        <td className={COL + " text-gray-500 text-[11px]"}>{p.unidad}</td>
                                        <td className={COL + " text-gray-500 text-[11px] max-w-[120px]"}>
                                            <span className="block truncate" title={p.proveedor}>{p.proveedor || "—"}</span>
                                        </td>
                                        <td className={COL + " text-gray-400 text-[11px] max-w-[160px]"}>
                                            <span className="block truncate" title={p.notas}>{p.notas || "—"}</span>
                                        </td>
                                        <td className={COL + " whitespace-nowrap"}>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {cuadernoId && (
                                                    <button
                                                        onClick={() => handleImport(p.id)}
                                                        title="Importar al inventario del cuaderno actual"
                                                        className="p-1.5 rounded hover:bg-emerald-500/15 text-gray-400 hover:text-emerald-500 transition-colors"
                                                    >
                                                        <ArrowDownToLine size={13} />
                                                    </button>
                                                )}
                                                <button onClick={() => handleEdit(p)} title="Editar" className="p-1.5 rounded hover:bg-blue-500/15 text-gray-400 hover:text-blue-500 transition-colors">
                                                    <Pencil size={13} />
                                                </button>
                                                <button onClick={() => handleDelete(p.id)} title="Eliminar del catálogo" className="p-1.5 rounded hover:bg-red-500/15 text-gray-400 hover:text-red-400 transition-colors">
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="px-4 py-2 border-t border-gray-200 text-[11px] text-gray-400 bg-[var(--bg-dark)] shrink-0 flex items-center gap-2">
                <span>{productos.length} producto{productos.length !== 1 ? "s" : ""} en el catálogo global</span>
                {cuadernoId && (
                    <span className="text-gray-300">·</span>
                )}
                {cuadernoId && (
                    <span className="flex items-center gap-1 text-gray-400">
                        <ArrowDownToLine size={11} /> = importar al inventario del cuaderno
                    </span>
                )}
            </div>
        </div>
    );
}
