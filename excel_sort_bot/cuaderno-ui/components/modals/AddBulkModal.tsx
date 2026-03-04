"use client";

import { useState, useMemo } from "react";
import { X, FileSpreadsheet } from "lucide-react";
import { Cuaderno, SheetType, SHEET_CONFIG } from "@/lib/types";
import { api } from "@/lib/api";

interface AddBulkModalProps {
    isOpen: boolean;
    onClose: () => void;
    sheet: SheetType;
    cuaderno: Cuaderno;
    onSuccess: () => void;
}

export default function AddBulkModal({ isOpen, onClose, sheet, cuaderno, onSuccess }: AddBulkModalProps) {
    const [pasteText, setPasteText] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [created, setCreated] = useState(0);

    const config = SHEET_CONFIG[sheet];
    const isSupported = sheet === "productos" || sheet === "fertilizantes" || sheet === "cosecha";

    const parcelasOrdenadas = useMemo(() => {
        const parcelas = [...(cuaderno.parcelas || [])];
        return parcelas.sort((a, b) => {
            const aOrden = Number(a.num_orden || 0);
            const bOrden = Number(b.num_orden || 0);
            if (aOrden !== bOrden) return aOrden - bOrden;
            return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es");
        });
    }, [cuaderno.parcelas]);

    const numOrdenToParcelaIds = (numOrdenStr: string): string[] => {
        if (!numOrdenStr?.trim()) return [];
        const ordenes = numOrdenStr.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
        const ids: string[] = [];
        for (const ord of ordenes) {
            const num = parseInt(ord, 10);
            if (isNaN(num)) continue;
            const p = parcelasOrdenadas.find((p) => Number(p.num_orden) === num);
            if (p) ids.push(p.id);
        }
        return ids;
    };

    const getColumnKeys = (): string[] => {
        if (!config?.columns) return [];
        return config.columns.map((c) => c.key);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pasteText.trim() || !isSupported) return;

        setLoading(true);
        setError("");
        setCreated(0);

        const delim = pasteText.includes("\t") ? "\t" : ",";
        const lines = pasteText.trim().split(/\r?\n/).map((l) => l.split(delim).map((v) => v.trim()));
        const keys = getColumnKeys();

        let count = 0;
        try {
            for (const vals of lines) {
                if (vals.every((v) => !v)) continue;

                const row: Record<string, any> = {};
                keys.forEach((k, i) => {
                    row[k] = vals[i] ?? "";
                });

                if (sheet === "productos") {
                    if (!row.nombre_comercial?.trim()) continue;
                    await api.createProducto(cuaderno.id, {
                        nombre_comercial: row.nombre_comercial || "",
                        numero_registro: row.numero_registro || "",
                        materia_activa: row.materia_activa || "",
                        numero_lote: row.numero_lote || "",
                        cantidad_adquirida: parseFloat(row.cantidad_adquirida) || 0,
                        unidad: row.unidad || "L",
                        fecha_adquisicion: row.fecha_adquisicion || "",
                    });
                    count++;
                } else if (sheet === "fertilizantes") {
                    const parcelaIds = numOrdenToParcelaIds(row.num_orden_parcelas || "");
                    await api.createFertilizacion(cuaderno.id, {
                        fecha_inicio: row.fecha_inicio || "",
                        fecha_fin: row.fecha_fin || "",
                        parcela_ids: parcelaIds,
                        cultivo_especie: row.cultivo_especie || "",
                        cultivo_variedad: row.cultivo_variedad || "",
                        tipo_abono: row.tipo_abono || "",
                        num_albaran: row.num_albaran || "",
                        riqueza_npk: row.riqueza_npk || "",
                        dosis: row.dosis || "",
                        tipo_fertilizacion: row.tipo_fertilizacion || "",
                        observaciones: row.observaciones || "",
                    });
                    count++;
                } else if (sheet === "cosecha") {
                    const parcelaIds = numOrdenToParcelaIds(row.num_orden_parcelas || "");
                    await api.createCosecha(cuaderno.id, {
                        fecha: row.fecha || "",
                        producto: row.producto || "",
                        cantidad_kg: parseFloat(row.cantidad_kg) || 0,
                        parcela_ids: parcelaIds,
                        num_albaran: row.num_albaran || "",
                        num_lote: row.num_lote || "",
                        cliente_nombre: row.cliente_nombre || "",
                    });
                    count++;
                }
            }
            setCreated(count);
            setPasteText("");
            if (count > 0) {
                onSuccess();
                setTimeout(() => onClose(), 1500);
            } else {
                setError("No se creó ningún registro. Verifica que cada línea tenga al menos un valor válido.");
            }
        } catch (err: any) {
            setError(err.message || "Error al crear registros.");
        } finally {
            setLoading(false);
        }
    };

    const getPlaceholder = () => {
        const keys = getColumnKeys();
        return keys.join(" | ");
    };

    const getTitle = () => {
        switch (sheet) {
            case "productos": return "Añadir varios productos";
            case "fertilizantes": return "Añadir varias fertilizaciones";
            case "cosecha": return "Añadir varias cosechas";
            default: return "Añadir varios";
        }
    };

    if (!isOpen || !isSupported) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-white border border-gray-200 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                        <FileSpreadsheet size={20} className="text-violet-400" />
                        <h2 className="text-lg font-semibold text-gray-900">{getTitle()}</h2>
                    </div>
                    <button
                        onClick={() => { onClose(); setPasteText(""); setError(""); }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <p className="text-sm text-gray-600">
                        Pega filas desde Excel o escribe valores separados por tabulación o coma. Cada línea = un nuevo registro.
                    </p>
                    <p className="text-xs text-gray-500">
                        Orden de columnas: {getPlaceholder()}
                    </p>
                    <textarea
                        value={pasteText}
                        onChange={(e) => setPasteText(e.target.value)}
                        placeholder={getPlaceholder()}
                        rows={10}
                        className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-gray-500 text-sm font-mono focus:outline-none focus:border-violet-500 resize-y"
                    />
                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                            {error}
                        </div>
                    )}
                    {created > 0 && (
                        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
                            ✓ {created} registro(s) creado(s). Cerrando...
                        </div>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => { onClose(); setPasteText(""); setError(""); }}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !pasteText.trim()}
                            className="px-5 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {loading ? "Creando..." : "Crear todos"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
