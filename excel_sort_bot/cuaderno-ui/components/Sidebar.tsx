"use client";

import { useState } from "react";
import {
    ChevronDown,
    ChevronRight,
    Plus,
    FolderOpen,
    LayoutGrid,
    FlaskConical,
    ClipboardList,
    BarChart3,
    Wheat,
    Upload,
    Trash2
} from "lucide-react";
import { Cuaderno, CuadernoSummary, SheetType } from "@/lib/types";
import { api } from "@/lib/api";
import CreateCuadernoModal from "./modals/CreateCuadernoModal";
import UploadModal from "./modals/UploadModal";

interface SidebarProps {
    cuadernos: (CuadernoSummary | Cuaderno)[];
    activeCuaderno: Cuaderno | null;
    activeSheet: SheetType;
    loading: boolean;
    onSelectCuaderno: (id: string) => void;
    onSelectSheet: (sheet: SheetType) => void;
    onCreateCuaderno: (data: Partial<Cuaderno>) => void;
    /** Tras subir/crear cuaderno desde archivo: refresca lista y selecciona el nuevo (tiempo real) */
    onUploadSuccess?: (id: string) => void | Promise<void>;
    /** Callback cuando se elimina un cuaderno (para refrescar lista y limpiar selección) */
    onCuadernoDeleted?: () => void | Promise<void>;
}

const SHEET_ITEMS: { key: SheetType; label: string; icon: React.ReactNode }[] = [
    { key: "parcelas", label: "Parcelas", icon: <LayoutGrid size={16} /> },
    { key: "productos", label: "Productos", icon: <FlaskConical size={16} /> },
    { key: "tratamientos", label: "Tratamientos", icon: <ClipboardList size={16} /> },
    { key: "historico", label: "Histórico", icon: <BarChart3 size={16} /> },
];

export default function Sidebar({
    cuadernos,
    activeCuaderno,
    activeSheet,
    loading,
    onSelectCuaderno,
    onSelectSheet,
    onCreateCuaderno,
    onUploadSuccess,
    onCuadernoDeleted,
}: SidebarProps) {
    const [cuadernosExpanded, setCuadernosExpanded] = useState(true);
    const [contenidoExpanded, setContenidoExpanded] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const toNumber = (v: unknown): number => {
        const n = typeof v === "number" ? v : Number(v);
        return Number.isFinite(n) ? n : 0;
    };

    return (
        <>
            <aside className="min-w-0 flex-1 flex flex-col bg-[var(--bg-dark)] border-r border-gray-200 overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3.5 border-b border-gray-200 electron-drag">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <Wheat className="w-4 h-4 text-emerald-400" />
                        </div>
                        <span className="font-medium text-sm text-gray-900 tracking-tight">Cuaderno Agrícola</span>
                    </div>
                </div>

                {/* Explorer */}
                <div className="flex-1 overflow-y-auto py-2">
                    <div className="flex items-center justify-between px-3 py-1.5">
                        <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                            Explorador
                        </span>
                        <div className="flex items-center gap-0.5">
                            <button
                                onClick={() => setShowUploadModal(true)}
                                className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:text-emerald-400 hover:bg-gray-100 transition-colors"
                                title="Importar archivo"
                            >
                                <Upload size={14} />
                            </button>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                                title="Nuevo cuaderno"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Cuadernos Section */}
                    <div className="px-2">
                        <button
                            onClick={() => setCuadernosExpanded(!cuadernosExpanded)}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors uppercase tracking-wider"
                        >
                            {cuadernosExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            <FolderOpen size={12} />
                            <span>Cuadernos</span>
                        </button>

                        {cuadernosExpanded && (
                            <div className="mt-1 space-y-0.5">
                                {loading ? (
                                    <div className="px-4 py-2 text-xs text-gray-500">Cargando...</div>
                                ) : cuadernos.length === 0 ? (
                                    <div className="px-4 py-2 text-xs text-gray-500">Sin cuadernos</div>
                                ) : (
                                    cuadernos.map((c) => (
                                        <div
                                            key={c.id}
                                            className={`group relative w-full px-3 py-2 rounded-md text-sm transition-colors ${activeCuaderno?.id === c.id
                                                ? "bg-emerald-500/10 ring-1 ring-emerald-500/20"
                                                : "hover:bg-gray-100"
                                                }`}
                                        >
                                            <button
                                                onClick={() => onSelectCuaderno(c.id)}
                                                className={`w-full text-left ${activeCuaderno?.id === c.id
                                                    ? "text-emerald-400"
                                                    : "text-gray-600 hover:text-gray-800"
                                                    }`}
                                            >
                                                <div className="font-medium truncate pr-6">{c.nombre_explotacion}</div>
                                                <div className="text-[10px] text-gray-500 mt-0.5">
                                                    {c.año} · {('num_parcelas' in c ? c.num_parcelas : 0)}P · {('num_tratamientos' in c ? c.num_tratamientos : 0)}T
                                                </div>
                                            </button>
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (!confirm(`¿Eliminar el cuaderno "${c.nombre_explotacion}"?\n\nSe creará un backup. Esta acción no se puede deshacer.`)) return;
                                                    try {
                                                        await api.deleteCuaderno(c.id);
                                                        if (onCuadernoDeleted) await onCuadernoDeleted();
                                                        if (activeCuaderno?.id === c.id) {
                                                            onSelectCuaderno(cuadernos.find(cu => cu.id !== c.id)?.id || "");
                                                        }
                                                    } catch (error) {
                                                        alert("No se pudo eliminar el cuaderno.");
                                                        console.error(error);
                                                    }
                                                }}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                                                title="Eliminar cuaderno"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    {/* Contenido Section */}
                    {activeCuaderno && (
                        <div className="px-2 mt-4">
                            <button
                                onClick={() => setContenidoExpanded(!contenidoExpanded)}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors uppercase tracking-wider"
                            >
                                {contenidoExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                <ClipboardList size={12} />
                                <span>Contenido</span>
                            </button>

                            {contenidoExpanded && (
                                <div className="mt-1 space-y-0.5">
                                    {SHEET_ITEMS.map((item) => {
                                        const count =
                                            item.key === "parcelas" ? activeCuaderno.parcelas?.length :
                                                item.key === "productos" ? activeCuaderno.productos?.length :
                                                    item.key === "tratamientos" ? activeCuaderno.tratamientos?.length : null;

                                        return (
                                            <button
                                                key={item.key}
                                                onClick={() => onSelectSheet(item.key)}
                                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${activeSheet === item.key
                                                    ? "bg-emerald-500/10 text-emerald-400"
                                                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                                                    }`}
                                            >
                                                {item.icon}
                                                <span className="flex-1 text-left">{item.label}</span>
                                                {count !== null && (
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${activeSheet === item.key
                                                        ? "bg-emerald-500/20 text-emerald-400"
                                                        : "bg-gray-100 text-gray-500"
                                                        }`}>
                                                        {count}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                    {/* Parcelas por Cultivo */}
                    {activeCuaderno && activeCuaderno.parcelas?.length > 0 && (
                        <div className="px-2 mt-4">
                            <div className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 uppercase tracking-wider">
                                <Wheat size={12} />
                                <span>Parcelas por Cultivo</span>
                            </div>
                            <div className="mt-1 space-y-0.5">
                                {(() => {
                                    const grouped: Record<string, { count: number; ha: number }> = {};
                                    for (const p of activeCuaderno.parcelas) {
                                        const cultivo = p.especie || p.cultivo || "Sin cultivo";
                                        if (!grouped[cultivo]) grouped[cultivo] = { count: 0, ha: 0 };
                                        grouped[cultivo].count++;
                                        grouped[cultivo].ha += toNumber(p.superficie_cultivada ?? p.superficie_ha ?? p.superficie_sigpac);
                                    }
                                    return Object.entries(grouped).sort((a, b) => b[1].ha - a[1].ha).map(([cultivo, info]) => (
                                        <button
                                            key={cultivo}
                                            onClick={() => onSelectSheet("parcelas")}
                                            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                                        >
                                            <div className="w-2 h-2 rounded-full bg-emerald-500/60 shrink-0" />
                                            <span className="flex-1 text-left truncate">{cultivo}</span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500">
                                                {info.count}
                                            </span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400/80">
                                                {toNumber(info.ha).toFixed(1)} ha
                                            </span>
                                        </button>
                                    ));
                                })()}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                {activeCuaderno && (
                    <div className="px-4 py-3 border-t border-gray-200 bg-gray-100">
                        <div className="text-[11px] space-y-1.5">
                            <div className="flex justify-between gap-2">
                                <span className="text-gray-500 shrink-0">Titular</span>
                                <span className="text-emerald-400/90 font-medium truncate text-right">
                                    {activeCuaderno.titular || "-"}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Año</span>
                                <span className="text-gray-700">{activeCuaderno.año}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Total hectáreas</span>
                                <span className="text-emerald-400 font-semibold">
                                    {(activeCuaderno.parcelas || []).reduce((sum: number, p: any) => sum + toNumber(p.superficie_cultivada ?? p.superficie_ha ?? p.superficie_sigpac), 0).toFixed(2)} ha
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </aside>

            {/* Create Modal */}
            <CreateCuadernoModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onCreate={onCreateCuaderno}
            />

            {/* Upload Modal */}
            <UploadModal
                isOpen={showUploadModal}
                onClose={() => setShowUploadModal(false)}
                onSuccess={async (id) => {
                    setShowUploadModal(false);
                    if (onUploadSuccess) {
                        await onUploadSuccess(id);
                    } else {
                        onSelectCuaderno(id);
                    }
                }}
            />
        </>
    );
}
