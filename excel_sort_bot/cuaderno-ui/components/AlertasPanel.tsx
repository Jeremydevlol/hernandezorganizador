"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, AlertCircle, Info, CheckCircle, X, ChevronRight } from "lucide-react";
import { Cuaderno, SheetType } from "@/lib/types";
import { api } from "@/lib/api";

interface Alerta {
    tipo: string;
    severidad: "alta" | "media" | "baja" | "info";
    mensaje: string;
    producto_id?: string;
    parcela_id?: string;
    accion: string;
}

interface AlertasPanelProps {
    cuaderno: Cuaderno | null;
    onNavigate: (sheet: SheetType) => void;
    onClose: () => void;
}

const SEV_STYLE: Record<string, { border: string; icon: React.ReactNode; badge: string }> = {
    alta: { border: "border-red-200 bg-red-50", icon: <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />, badge: "bg-red-100 text-red-700" },
    media: { border: "border-amber-200 bg-amber-50", icon: <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />, badge: "bg-amber-100 text-amber-700" },
    baja: { border: "border-blue-200 bg-blue-50", icon: <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />, badge: "bg-blue-100 text-blue-700" },
    info: { border: "border-gray-200 bg-gray-50", icon: <Info size={14} className="text-gray-400 shrink-0 mt-0.5" />, badge: "bg-gray-100 text-gray-600" },
};

const ACCION_LABEL: Record<string, string> = {
    ver_producto: "Ver productos",
    crear_asesoramiento: "Registrar asesoramiento",
    ver_asesoramiento: "Ver asesoramiento",
    crear_tratamiento: "Nuevo tratamiento",
};

const ACCION_SHEET: Record<string, SheetType> = {
    ver_producto: "productos",
    crear_asesoramiento: "asesoramiento",
    ver_asesoramiento: "asesoramiento",
    crear_tratamiento: "tratamientos",
};

export default function AlertasPanel({ cuaderno, onNavigate, onClose }: AlertasPanelProps) {
    const [alertas, setAlertas] = useState<Alerta[]>([]);
    const [loading, setLoading] = useState(false);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!cuaderno) return;
        setLoading(true);
        setDismissed(new Set());
        api.getAlertas(cuaderno.id)
            .then((r) => setAlertas(r.alertas || []))
            .catch(() => setAlertas([]))
            .finally(() => setLoading(false));
    }, [cuaderno?.id]);

    const visible = alertas.filter((_, i) => !dismissed.has(String(i)));
    const altas = visible.filter(a => a.severidad === "alta").length;
    const medias = visible.filter(a => a.severidad === "media").length;

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <AlertTriangle size={15} className={altas > 0 ? "text-red-500" : medias > 0 ? "text-amber-500" : "text-gray-400"} />
                    <span className="text-sm font-semibold text-gray-800">Alertas del cuaderno</span>
                    {visible.length > 0 && (
                        <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${altas > 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                            {visible.length}
                        </span>
                    )}
                </div>
                <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                    <X size={15} />
                </button>
            </div>

            {/* Summary bar */}
            {visible.length > 0 && (
                <div className="px-4 py-2 border-b border-gray-100 flex gap-3 text-[11px] shrink-0">
                    {altas > 0 && <span className="flex items-center gap-1 text-red-600"><AlertCircle size={11} /> {altas} urgente{altas > 1 ? "s" : ""}</span>}
                    {medias > 0 && <span className="flex items-center gap-1 text-amber-600"><AlertTriangle size={11} /> {medias} avisos</span>}
                </div>
            )}

            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
                {loading ? (
                    <div className="text-center py-8 text-xs text-gray-400">Analizando cuaderno...</div>
                ) : !cuaderno ? (
                    <div className="text-center py-8 text-xs text-gray-400">Abre un cuaderno para ver alertas.</div>
                ) : visible.length === 0 ? (
                    <div className="text-center py-8">
                        <CheckCircle size={32} className="text-emerald-400 mx-auto mb-2" />
                        <p className="text-sm font-medium text-gray-700">Todo en orden</p>
                        <p className="text-xs text-gray-400 mt-1">No hay alertas pendientes en este cuaderno.</p>
                    </div>
                ) : (
                    alertas.map((alerta, i) => {
                        if (dismissed.has(String(i))) return null;
                        const sev = SEV_STYLE[alerta.severidad] || SEV_STYLE.info;
                        const sheet = ACCION_SHEET[alerta.accion];
                        return (
                            <div key={i} className={`rounded-lg border p-3 ${sev.border}`}>
                                <div className="flex items-start gap-2">
                                    {sev.icon}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-gray-800 leading-snug">{alerta.mensaje}</p>
                                        {sheet && (
                                            <button
                                                onClick={() => { onNavigate(sheet); onClose(); }}
                                                className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-emerald-600 hover:text-emerald-700"
                                            >
                                                <ChevronRight size={11} />
                                                {ACCION_LABEL[alerta.accion] || "Ver"}
                                            </button>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setDismissed(d => new Set([...d, String(i)]))}
                                        className="p-0.5 rounded hover:bg-black/10 text-gray-400 hover:text-gray-600 shrink-0"
                                        title="Descartar esta alerta"
                                    >
                                        <X size={11} />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {visible.length > 0 && (
                <div className="px-4 py-2 border-t border-gray-100 shrink-0">
                    <button
                        onClick={() => setDismissed(new Set(alertas.map((_, i) => String(i))))}
                        className="text-xs text-gray-400 hover:text-gray-600"
                    >
                        Descartar todas
                    </button>
                </div>
            )}
        </div>
    );
}
