"use client";

import { useState, useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { Cuaderno, SheetType } from "@/lib/types";
import { api } from "@/lib/api";

interface AddRowModalProps {
    isOpen: boolean;
    onClose: () => void;
    sheet: SheetType;
    cuaderno: Cuaderno;
    onSuccess: () => void;
    editTratamientoId?: string;
    initialParcelaIds?: string[];
}

export default function AddRowModal({ isOpen, onClose, sheet, cuaderno, onSuccess, editTratamientoId, initialParcelaIds = [] }: AddRowModalProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<Record<string, any>>({});

    const suggestionFromSelectedParcelas = useMemo(() => {
        if (!initialParcelaIds.length || sheet !== "tratamientos") {
            return { productoId: "", plaga: "" };
        }

        const selectedParcelas = (cuaderno.parcelas || []).filter((p) => initialParcelaIds.includes(p.id));
        const cultivoCount = new Map<string, number>();
        for (const p of selectedParcelas) {
            const cultivo = (p.especie || p.cultivo || "").trim().toUpperCase();
            if (!cultivo) continue;
            cultivoCount.set(cultivo, (cultivoCount.get(cultivo) || 0) + 1);
        }
        const cultivoDominante = Array.from(cultivoCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

        const tratamientos = [...(cuaderno.tratamientos || [])].sort((a, b) => {
            return String(b.fecha_aplicacion || "").localeCompare(String(a.fecha_aplicacion || ""));
        });
        const previoMismoCultivo = tratamientos.find((t: any) => {
            const c = String(t.cultivo_especie || "").trim().toUpperCase();
            return cultivoDominante && c === cultivoDominante;
        });

        const productoPrevioId = previoMismoCultivo?.productos?.[0]?.producto_id || "";
        const productoExiste = !!(cuaderno.productos || []).find((p) => p.id === productoPrevioId);

        return {
            productoId: productoExiste ? productoPrevioId : ((cuaderno.productos || [])[0]?.id || ""),
            plaga: String(previoMismoCultivo?.problema_fitosanitario || previoMismoCultivo?.plaga_enfermedad || ""),
        };
    }, [initialParcelaIds, sheet, cuaderno.parcelas, cuaderno.tratamientos, cuaderno.productos]);

    useEffect(() => {
        if (isOpen && sheet === "tratamientos" && editTratamientoId) {
            api.getTratamiento(cuaderno.id, editTratamientoId).then(({ tratamiento }) => {
                const first = tratamiento.productos?.[0];
                setFormData({
                    fecha_aplicacion: (tratamiento.fecha_aplicacion || "").split("T")[0],
                    parcela_ids: tratamiento.parcela_ids || [],
                    producto_id: first?.producto_id || "",
                    nombre_comercial: first?.nombre_comercial || "",
                    numero_registro: first?.numero_registro || "",
                    numero_lote: first?.numero_lote || "",
                    dosis: first?.dosis ?? "",
                    unidad_dosis: first?.unidad_dosis || "L/Ha",
                    plaga_enfermedad: tratamiento.plaga_enfermedad || tratamiento.problema_fitosanitario || "",
                    operador: tratamiento.operador || tratamiento.aplicador || "",
                    observaciones: tratamiento.observaciones || "",
                });
            }).catch(() => setFormData({}));
        } else if (isOpen && !editTratamientoId) {
            const suggestedProd = (cuaderno.productos || []).find((p) => p.id === suggestionFromSelectedParcelas.productoId);
            setFormData({
                fecha_aplicacion: new Date().toISOString().split("T")[0],
                parcela_ids: sheet === "tratamientos" ? initialParcelaIds : [],
                producto_id: sheet === "tratamientos" ? (suggestionFromSelectedParcelas.productoId || "") : "",
                nombre_comercial: suggestedProd?.nombre_comercial || "",
                numero_registro: suggestedProd?.numero_registro || "",
                numero_lote: suggestedProd?.numero_lote || "",
                plaga_enfermedad: sheet === "tratamientos" ? (suggestionFromSelectedParcelas.plaga || "") : "",
            });
        }
    }, [isOpen, sheet, cuaderno.id, editTratamientoId, initialParcelaIds, suggestionFromSelectedParcelas, cuaderno.productos]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === "number" ? parseFloat(value) || 0 : value,
        }));
    };

    const handleCheckbox = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, checked } = e.target;
        setFormData((prev) => {
            const current = prev[name] || [];
            if (checked) {
                return { ...prev, [name]: [...current, value] };
            } else {
                return { ...prev, [name]: current.filter((v: string) => v !== value) };
            }
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (sheet === "parcelas") {
                await api.createParcela(cuaderno.id, formData);
            } else if (sheet === "productos") {
                await api.createProducto(cuaderno.id, formData);
            } else if (sheet === "tratamientos") {
                const parcelaIds = Array.isArray(formData.parcela_ids) ? formData.parcela_ids : [];
                if (!formData.fecha_aplicacion || parcelaIds.length === 0 || !formData.producto_id || (formData.dosis ?? "") === "") {
                    alert("Completa: Fecha, al menos una parcela, producto y dosis.");
                    setLoading(false);
                    return;
                }
                const payload = {
                    fecha_aplicacion: (formData.fecha_aplicacion || new Date().toISOString().split("T")[0]).trim(),
                    parcela_ids: parcelaIds,
                    productos: [{
                        producto_id: formData.producto_id || "",
                        nombre_comercial: formData.nombre_comercial || "",
                        numero_registro: formData.numero_registro || "",
                        numero_lote: formData.numero_lote || "",
                        dosis: Number(formData.dosis) || 0,
                        unidad_dosis: formData.unidad_dosis || "L/Ha",
                    }],
                    plaga_enfermedad: formData.plaga_enfermedad || "",
                    operador: formData.operador || "",
                    observaciones: formData.observaciones || "",
                };
                if (editTratamientoId) {
                    await api.updateTratamiento(cuaderno.id, editTratamientoId, payload);
                } else {
                    await api.createTratamiento(cuaderno.id, payload);
                }
            }

            setFormData({});
            onSuccess();
        } catch (error) {
            console.error("Error creating record:", error);
        } finally {
            setLoading(false);
        }
    };

    const parcelasOrdenadas = useMemo(() => {
        const parcelas = [...(cuaderno.parcelas || [])];
        return parcelas.sort((a, b) => {
            const aOrden = Number(a.num_orden || 0);
            const bOrden = Number(b.num_orden || 0);
            if (aOrden !== bOrden) return aOrden - bOrden;
            const aCultivo = (a.especie || a.cultivo || "").toLowerCase();
            const bCultivo = (b.especie || b.cultivo || "").toLowerCase();
            if (aCultivo !== bCultivo) return aCultivo.localeCompare(bCultivo, "es");
            const aSup = Number(a.superficie_cultivada || a.superficie_ha || a.superficie_sigpac || 0);
            const bSup = Number(b.superficie_cultivada || b.superficie_ha || b.superficie_sigpac || 0);
            return bSup - aSup;
        });
    }, [cuaderno.parcelas]);

    const getTitle = () => {
        if (sheet === "tratamientos" && editTratamientoId) return "Editar tratamiento";
        switch (sheet) {
            case "parcelas": return "Nueva Parcela";
            case "productos": return "Nuevo Producto Fitosanitario";
            case "tratamientos": return "Nuevo Tratamiento";
            default: return "Nuevo Registro";
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-xl bg-[#18181b] border border-zinc-800 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                    <h2 className="text-lg font-semibold text-zinc-100">{getTitle()}</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                    {sheet === "parcelas" && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                                        Nombre *
                                    </label>
                                    <input
                                        type="text"
                                        name="nombre"
                                        value={formData.nombre || ""}
                                        onChange={handleChange}
                                        required
                                        placeholder="Nombre de la parcela"
                                        className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                                        Ref. Catastral *
                                    </label>
                                    <input
                                        type="text"
                                        name="referencia_catastral"
                                        value={formData.referencia_catastral || ""}
                                        onChange={handleChange}
                                        required
                                        placeholder="00-000-00000"
                                        className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                                        Superficie (Ha)
                                    </label>
                                    <input
                                        type="number"
                                        name="superficie_ha"
                                        value={formData.superficie_ha || ""}
                                        onChange={handleChange}
                                        step="0.01"
                                        placeholder="0.00"
                                        className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                                        Cultivo
                                    </label>
                                    <input
                                        type="text"
                                        name="cultivo"
                                        value={formData.cultivo || ""}
                                        onChange={handleChange}
                                        placeholder="Tipo de cultivo"
                                        className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                                        Variedad
                                    </label>
                                    <input
                                        type="text"
                                        name="variedad"
                                        value={formData.variedad || ""}
                                        onChange={handleChange}
                                        placeholder="Variedad"
                                        className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                                        Municipio
                                    </label>
                                    <input
                                        type="text"
                                        name="municipio"
                                        value={formData.municipio || ""}
                                        onChange={handleChange}
                                        placeholder="Municipio"
                                        className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                                    Provincia
                                </label>
                                <input
                                    type="text"
                                    name="provincia"
                                    value={formData.provincia || ""}
                                    onChange={handleChange}
                                    placeholder="Provincia"
                                    className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                />
                            </div>
                        </>
                    )}

                    {sheet === "productos" && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                                        Nombre Comercial *
                                    </label>
                                    <input
                                        type="text"
                                        name="nombre_comercial"
                                        value={formData.nombre_comercial || ""}
                                        onChange={handleChange}
                                        required
                                        placeholder="Nombre del producto"
                                        className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                                        Nº Registro *
                                    </label>
                                    <input
                                        type="text"
                                        name="numero_registro"
                                        value={formData.numero_registro || ""}
                                        onChange={handleChange}
                                        required
                                        placeholder="ES-00000"
                                        className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                                        Materia Activa
                                    </label>
                                    <input
                                        type="text"
                                        name="materia_activa"
                                        value={formData.materia_activa || ""}
                                        onChange={handleChange}
                                        placeholder="Sustancia activa"
                                        className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                                        Nº Lote *
                                    </label>
                                    <input
                                        type="text"
                                        name="numero_lote"
                                        value={formData.numero_lote || ""}
                                        onChange={handleChange}
                                        required
                                        placeholder="Lote"
                                        className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                                        Cantidad *
                                    </label>
                                    <input
                                        type="number"
                                        name="cantidad_adquirida"
                                        value={formData.cantidad_adquirida || ""}
                                        onChange={handleChange}
                                        required
                                        step="0.01"
                                        placeholder="0"
                                        className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                                        Unidad
                                    </label>
                                    <select
                                        name="unidad"
                                        value={formData.unidad || "L"}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    >
                                        <option value="L">L</option>
                                        <option value="Kg">Kg</option>
                                        <option value="g">g</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                                        F. Adquisición
                                    </label>
                                    <input
                                        type="date"
                                        name="fecha_adquisicion"
                                        value={formData.fecha_adquisicion || ""}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                                    Proveedor
                                </label>
                                <input
                                    type="text"
                                    name="proveedor"
                                    value={formData.proveedor || ""}
                                    onChange={handleChange}
                                    placeholder="Nombre del proveedor"
                                    className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                />
                            </div>
                        </>
                    )}

                    {sheet === "tratamientos" && (
                        <>
                            <div>
                                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                                    Parcelas *
                                </label>
                                <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-zinc-900 border border-zinc-700 max-h-32 overflow-y-auto">
                                    {parcelasOrdenadas.length > 0 ? (
                                        parcelasOrdenadas.map((p) => (
                                            <label
                                                key={p.id}
                                                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 cursor-pointer"
                                            >
                                    <input
                                        type="checkbox"
                                                    name="parcela_ids"
                                                    value={p.id}
                                                    checked={Array.isArray(formData.parcela_ids) && formData.parcela_ids.includes(p.id)}
                                                    onChange={handleCheckbox}
                                                    className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-green-500 focus:ring-green-500"
                                                />
                                                <span className="text-sm text-zinc-300">
                                                    {p.nombre}
                                                    {!!p.num_orden && <span className="text-zinc-500"> · #{p.num_orden}</span>}
                                                </span>
                                            </label>
                                        ))
                                    ) : (
                                        <p className="text-zinc-500 text-sm col-span-2">No hay parcelas</p>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                                        Fecha *
                                    </label>
                                    <input
                                        type="date"
                                        name="fecha_aplicacion"
                                        value={formData.fecha_aplicacion || new Date().toISOString().split("T")[0]}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                                        Plaga/Enfermedad
                                    </label>
                                    <input
                                        type="text"
                                        name="plaga_enfermedad"
                                        value={formData.plaga_enfermedad || ""}
                                        onChange={handleChange}
                                        placeholder="Motivo del tratamiento"
                                        className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                                    Producto *
                                </label>
                                <select
                                    name="producto_id"
                                    value={formData.producto_id || ""}
                                    onChange={(e) => {
                                        const id = e.target.value;
                                        const prod = cuaderno.productos?.find((p) => p.id === id);
                                        setFormData((prev) => ({
                                            ...prev,
                                            producto_id: id,
                                            nombre_comercial: prod?.nombre_comercial ?? prev.nombre_comercial,
                                            numero_registro: prod?.numero_registro ?? prev.numero_registro,
                                            numero_lote: prod?.numero_lote ?? prev.numero_lote,
                                        }));
                                    }}
                                    required
                                    className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                >
                                    <option value="">Seleccionar...</option>
                                    {cuaderno.productos?.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.nombre_comercial} ({p.numero_registro})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                                        Nº Registro (snapshot)
                                    </label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={formData.numero_registro || ""}
                                        className="w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm"
                                        placeholder="Se rellena al elegir producto"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                                        Nº Lote (snapshot)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.numero_lote ?? ""}
                                        onChange={handleChange}
                                        name="numero_lote"
                                        className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                        placeholder="Se rellena al elegir producto"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                                        Dosis *
                                    </label>
                                    <input
                                        type="number"
                                        name="dosis"
                                        value={formData.dosis || ""}
                                        onChange={handleChange}
                                        required
                                        step="0.01"
                                        placeholder="0.00"
                                        className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                                        Unidad
                                    </label>
                                    <select
                                        name="unidad_dosis"
                                        value={formData.unidad_dosis || "L/Ha"}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    >
                                        <option value="L/Ha">L/Ha</option>
                                        <option value="Kg/Ha">Kg/Ha</option>
                                        <option value="cc/L">cc/L</option>
                                        <option value="g/L">g/L</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                                    Operador
                                </label>
                                <input
                                    type="text"
                                    name="operador"
                                    value={formData.operador || ""}
                                    onChange={handleChange}
                                    placeholder="Nombre del aplicador"
                                    className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                />
                            </div>
                        </>
                    )}
                </form>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-900/30">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="px-5 py-2 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (editTratamientoId ? "Guardando..." : "Añadiendo...") : (editTratamientoId ? "Guardar" : "Añadir")}
                    </button>
                </div>
            </div>
        </div>
    );
}
