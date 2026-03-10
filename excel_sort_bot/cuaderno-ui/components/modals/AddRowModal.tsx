"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
    const [productInputValue, setProductInputValue] = useState("");
    const [productDropdownOpen, setProductDropdownOpen] = useState(false);
    const productInputRef = useRef<HTMLInputElement>(null);

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
                    equipo: tratamiento.equipo || "1",
                    eficacia: tratamiento.eficacia || "BUENA",
                    observaciones: tratamiento.observaciones || "",
                });
            }).catch(() => setFormData({}));
        } else if (isOpen && !editTratamientoId) {
            const suggestedProd = (cuaderno.productos || []).find((p) => p.id === suggestionFromSelectedParcelas.productoId);
            const base: Record<string, any> = {
                fecha_aplicacion: new Date().toISOString().split("T")[0],
                parcela_ids: sheet === "tratamientos" || sheet === "fertilizantes" || sheet === "cosecha" ? initialParcelaIds : [],
                producto_id: sheet === "tratamientos" ? (suggestionFromSelectedParcelas.productoId || "") : "",
                nombre_comercial: suggestedProd?.nombre_comercial || "",
                numero_registro: suggestedProd?.numero_registro || "",
                numero_lote: suggestedProd?.numero_lote || "",
                plaga_enfermedad: sheet === "tratamientos" ? (suggestionFromSelectedParcelas.plaga || "") : "",
                equipo: "1",
                eficacia: "BUENA",
            };
            if (sheet === "fertilizantes") {
                base.fecha_inicio = new Date().toISOString().split("T")[0];
                base.fecha_fin = "";
                base.cultivo_especie = "";
                base.tipo_abono = "";
                base.riqueza_npk = "";
                base.dosis = "";
                base.tipo_fertilizacion = "";
            }
            if (sheet === "cosecha") {
                base.fecha = new Date().toISOString().split("T")[0];
                base.producto = "";
                base.cantidad_kg = "";
            }
            setFormData(base);
            setProductInputValue(suggestedProd?.nombre_comercial || "");
        }
    }, [isOpen, sheet, cuaderno.id, editTratamientoId, initialParcelaIds, suggestionFromSelectedParcelas, cuaderno.productos]);

    useEffect(() => {
        if (isOpen && sheet === "tratamientos" && editTratamientoId) {
            setProductInputValue(formData.nombre_comercial || "");
        }
    }, [isOpen, sheet, editTratamientoId, formData.nombre_comercial]);

    const productosFiltrados = useMemo(() => {
        if (!productInputValue.trim()) return cuaderno.productos || [];
        const q = productInputValue.trim().toLowerCase();
        return (cuaderno.productos || []).filter(
            (p) => (p.nombre_comercial || "").toLowerCase().includes(q)
        );
    }, [cuaderno.productos, productInputValue]);

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
            } else if (sheet === "fertilizantes") {
                const parcelaIds = Array.isArray(formData.parcela_ids) ? formData.parcela_ids : [];
                await api.createFertilizacion(cuaderno.id, {
                    fecha_inicio: formData.fecha_inicio || "",
                    fecha_fin: formData.fecha_fin || "",
                    parcela_ids: parcelaIds,
                    cultivo_especie: formData.cultivo_especie || "",
                    cultivo_variedad: formData.cultivo_variedad || "",
                    tipo_abono: formData.tipo_abono || "",
                    num_albaran: formData.num_albaran || "",
                    riqueza_npk: formData.riqueza_npk || "",
                    dosis: formData.dosis || "",
                    tipo_fertilizacion: formData.tipo_fertilizacion || "",
                    observaciones: formData.observaciones || "",
                });
            } else if (sheet === "cosecha") {
                const parcelaIds = Array.isArray(formData.parcela_ids) ? formData.parcela_ids : [];
                await api.createCosecha(cuaderno.id, {
                    fecha: formData.fecha || "",
                    producto: formData.producto || "",
                    cantidad_kg: Number(formData.cantidad_kg) || 0,
                    parcela_ids: parcelaIds,
                    num_albaran: formData.num_albaran || "",
                    num_lote: formData.num_lote || "",
                    cliente_nombre: formData.cliente_nombre || "",
                    cliente_nif: formData.cliente_nif || "",
                    cliente_direccion: formData.cliente_direccion || "",
                    cliente_rgseaa: formData.cliente_rgseaa || "",
                });
            } else if (sheet === "tratamientos") {
                const parcelaIds = Array.isArray(formData.parcela_ids) ? formData.parcela_ids : [];
                const productosLista = Array.isArray(formData.productos_lista) && formData.productos_lista.length > 0
                    ? formData.productos_lista
                    : [{ nombre_comercial: formData.nombre_comercial || productInputValue, numero_registro: formData.numero_registro, numero_lote: formData.numero_lote, dosis: formData.dosis, unidad_dosis: formData.unidad_dosis || "L/Ha", producto_id: formData.producto_id }];
                const hasValidProduct = productosLista.some((p: any) => (p.nombre_comercial || "").trim() && (p.dosis ?? "") !== "");
                if (!formData.fecha_aplicacion || parcelaIds.length === 0 || !hasValidProduct) {
                    alert("Completa: Fecha, al menos una parcela, y al menos un producto con dosis.");
                    setLoading(false);
                    return;
                }
                const buildProductosPayload = async (): Promise<Array<{ producto_id: string; nombre_comercial: string; numero_registro: string; numero_lote: string; dosis: number; unidad_dosis: string }>> => {
                    let productosLista = Array.isArray(formData.productos_lista) && formData.productos_lista.length > 0
                        ? [...formData.productos_lista]
                        : [{ nombre_comercial: formData.nombre_comercial || productInputValue, numero_registro: formData.numero_registro, numero_lote: formData.numero_lote, dosis: formData.dosis, unidad_dosis: formData.unidad_dosis || "L/Ha", producto_id: formData.producto_id }];
                    if (productosLista.length > 0) {
                        productosLista[0] = {
                            ...productosLista[0],
                            nombre_comercial: (productosLista[0].nombre_comercial || formData.nombre_comercial || productInputValue || "").trim(),
                            numero_registro: productosLista[0].numero_registro || formData.numero_registro || "",
                            numero_lote: productosLista[0].numero_lote ?? formData.numero_lote ?? "",
                            dosis: productosLista[0].dosis ?? formData.dosis,
                            unidad_dosis: productosLista[0].unidad_dosis || formData.unidad_dosis || "L/Ha",
                            producto_id: productosLista[0].producto_id || formData.producto_id || "",
                        };
                    }
                    const result: Array<{ producto_id: string; nombre_comercial: string; numero_registro: string; numero_lote: string; dosis: number; unidad_dosis: string }> = [];
                    for (const p of productosLista) {
                        const nombreProd = (p.nombre_comercial || "").trim();
                        if (!nombreProd || (p.dosis ?? "") === "") continue;
                        let pid = p.producto_id || "";
                        let ncom = p.nombre_comercial || "";
                        let nreg = p.numero_registro || "";
                        let nlot = p.numero_lote || "";
                        if (!pid) {
                            const existente = (cuaderno.productos || []).find(
                                (pr) => (pr.nombre_comercial || "").toLowerCase() === nombreProd.toLowerCase()
                            );
                            if (existente) {
                                pid = existente.id;
                                ncom = existente.nombre_comercial || "";
                                nreg = existente.numero_registro || "";
                                nlot = existente.numero_lote || "";
                            } else {
                                const nuevo = await api.createProducto(cuaderno.id, {
                                    nombre_comercial: nombreProd,
                                    numero_registro: (p.numero_registro || nreg || "-").trim() || "-",
                                    materia_activa: "",
                                    numero_lote: p.numero_lote || nlot || "",
                                    cantidad_adquirida: 0,
                                    unidad: "L",
                                    fecha_adquisicion: "",
                                });
                                pid = nuevo.producto?.id || "";
                                ncom = nuevo.producto?.nombre_comercial || nombreProd;
                                nreg = nuevo.producto?.numero_registro || "-";
                                onSuccess();
                            }
                        }
                        result.push({
                            producto_id: pid,
                            nombre_comercial: ncom,
                            numero_registro: nreg,
                            numero_lote: nlot,
                            dosis: Number(p.dosis) || 0,
                            unidad_dosis: p.unidad_dosis || "L/Ha",
                        });
                    }
                    return result;
                };
                const productosPayload = await buildProductosPayload();
                if (productosPayload.length === 0) {
                    alert("Debe indicar al menos un producto con dosis.");
                    setLoading(false);
                    return;
                }
                const payload = {
                    fecha_aplicacion: (formData.fecha_aplicacion || new Date().toISOString().split("T")[0]).trim(),
                    parcela_ids: parcelaIds,
                    productos: productosPayload,
                    plaga_enfermedad: formData.plaga_enfermedad || "",
                    operador: formData.operador || "",
                    equipo: formData.equipo || "1",
                    eficacia: formData.eficacia || "BUENA",
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

    const getTitle = () => {
        if (sheet === "tratamientos" && editTratamientoId) return "Editar tratamiento";
        switch (sheet) {
            case "parcelas": return "Nueva Parcela";
            case "productos": return "Nuevo Producto Fitosanitario";
            case "tratamientos": return "Nuevo Tratamiento";
            case "fertilizantes": return "Nueva Fertilización";
            case "cosecha": return "Nueva Cosecha";
            default: return "Nuevo Registro";
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-xl bg-white border border-gray-200 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">{getTitle()}</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
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
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Nombre *
                                    </label>
                                    <input
                                        type="text"
                                        name="nombre"
                                        value={formData.nombre || ""}
                                        onChange={handleChange}
                                        required
                                        placeholder="Nombre de la parcela"
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Ref. Catastral *
                                    </label>
                                    <input
                                        type="text"
                                        name="referencia_catastral"
                                        value={formData.referencia_catastral || ""}
                                        onChange={handleChange}
                                        required
                                        placeholder="00-000-00000"
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Superficie (Ha)
                                    </label>
                                    <input
                                        type="number"
                                        name="superficie_ha"
                                        value={formData.superficie_ha || ""}
                                        onChange={handleChange}
                                        step="0.01"
                                        placeholder="0.00"
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Cultivo
                                    </label>
                                    <input
                                        type="text"
                                        name="cultivo"
                                        value={formData.cultivo || ""}
                                        onChange={handleChange}
                                        placeholder="Tipo de cultivo"
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Variedad
                                    </label>
                                    <input
                                        type="text"
                                        name="variedad"
                                        value={formData.variedad || ""}
                                        onChange={handleChange}
                                        placeholder="Variedad"
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Municipio
                                    </label>
                                    <input
                                        type="text"
                                        name="municipio"
                                        value={formData.municipio || ""}
                                        onChange={handleChange}
                                        placeholder="Municipio"
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                    Provincia
                                </label>
                                <input
                                    type="text"
                                    name="provincia"
                                    value={formData.provincia || ""}
                                    onChange={handleChange}
                                    placeholder="Provincia"
                                    className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                />
                            </div>
                        </>
                    )}

                    {sheet === "productos" && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Nombre Comercial *
                                    </label>
                                    <input
                                        type="text"
                                        name="nombre_comercial"
                                        value={formData.nombre_comercial || ""}
                                        onChange={handleChange}
                                        required
                                        placeholder="Nombre del producto"
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Nº Registro *
                                    </label>
                                    <input
                                        type="text"
                                        name="numero_registro"
                                        value={formData.numero_registro || ""}
                                        onChange={handleChange}
                                        required
                                        placeholder="ES-00000"
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Materia Activa
                                    </label>
                                    <input
                                        type="text"
                                        name="materia_activa"
                                        value={formData.materia_activa || ""}
                                        onChange={handleChange}
                                        placeholder="Sustancia activa"
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Nº Lote *
                                    </label>
                                    <input
                                        type="text"
                                        name="numero_lote"
                                        value={formData.numero_lote || ""}
                                        onChange={handleChange}
                                        required
                                        placeholder="Lote"
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
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
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Unidad
                                    </label>
                                    <select
                                        name="unidad"
                                        value={formData.unidad || "L"}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    >
                                        <option value="L">L</option>
                                        <option value="Kg">Kg</option>
                                        <option value="g">g</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        F. Adquisición
                                    </label>
                                    <input
                                        type="date"
                                        name="fecha_adquisicion"
                                        value={formData.fecha_adquisicion || ""}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                    Proveedor
                                </label>
                                <input
                                    type="text"
                                    name="proveedor"
                                    value={formData.proveedor || ""}
                                    onChange={handleChange}
                                    placeholder="Nombre del proveedor"
                                    className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                />
                            </div>
                        </>
                    )}

                    {sheet === "tratamientos" && (
                        <>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                    Parcelas *
                                </label>
                                <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-white border border-gray-300 max-h-32 overflow-y-auto">
                                    {parcelasOrdenadas.length > 0 ? (
                                        parcelasOrdenadas.map((p) => (
                                            <label
                                                key={p.id}
                                                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 cursor-pointer"
                                            >
                                    <input
                                        type="checkbox"
                                                    name="parcela_ids"
                                                    value={p.id}
                                                    checked={Array.isArray(formData.parcela_ids) && formData.parcela_ids.includes(p.id)}
                                                    onChange={handleCheckbox}
                                                    className="w-4 h-4 rounded border-gray-400 bg-gray-100 text-green-500 focus:ring-green-500"
                                                />
                                                <span className="text-sm text-gray-700">
                                                    {p.nombre}
                                                    {!!p.num_orden && <span className="text-gray-500"> · #{p.num_orden}</span>}
                                                </span>
                                            </label>
                                        ))
                                    ) : (
                                        <p className="text-gray-500 text-sm col-span-2">No hay parcelas</p>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Fecha *
                                    </label>
                                    <input
                                        type="date"
                                        name="fecha_aplicacion"
                                        value={formData.fecha_aplicacion || new Date().toISOString().split("T")[0]}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Plaga/Enfermedad
                                    </label>
                                    <input
                                        type="text"
                                        name="plaga_enfermedad"
                                        value={formData.plaga_enfermedad || ""}
                                        onChange={handleChange}
                                        placeholder="Motivo del tratamiento"
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                            </div>
                            <div className="relative">
                                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                    Producto *
                                </label>
                                <input
                                    ref={productInputRef}
                                    type="text"
                                    value={productInputValue}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        setProductInputValue(v);
                                        setProductDropdownOpen(true);
                                        setFormData((prev) => ({
                                            ...prev,
                                            producto_id: "",
                                            nombre_comercial: v,
                                            numero_registro: prev.producto_id ? "" : prev.numero_registro,
                                            numero_lote: prev.producto_id ? "" : prev.numero_lote,
                                        }));
                                    }}
                                    onFocus={() => setProductDropdownOpen(true)}
                                    onBlur={() => setTimeout(() => setProductDropdownOpen(false), 150)}
                                    placeholder="Seleccionar producto existente o escribir para crear uno nuevo"
                                    className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                />
                                {productDropdownOpen && (
                                    <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-lg bg-white border border-gray-300 shadow-xl">
                                        {productosFiltrados.length > 0 ? (
                                            <>
                                                {!productInputValue.trim() && (
                                                    <div className="px-3 py-1.5 text-[11px] text-gray-500 border-b border-gray-300">
                                                        {productosFiltrados.length} producto(s) en la hoja — selecciona o escribe para crear
                                                    </div>
                                                )}
                                                {productosFiltrados.map((p) => (
                                                    <button
                                                    key={p.id}
                                                    type="button"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        setProductInputValue(p.nombre_comercial || "");
                                                        setFormData((prev) => ({
                                                            ...prev,
                                                            producto_id: p.id,
                                                            nombre_comercial: p.nombre_comercial,
                                                            numero_registro: p.numero_registro,
                                                            numero_lote: p.numero_lote,
                                                        }));
                                                        setProductDropdownOpen(false);
                                                    }}
                                                    className="w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-100 transition-colors"
                                                >
                                                    {p.nombre_comercial}
                                                    {p.numero_registro && (
                                                        <span className="text-gray-500 ml-1">({p.numero_registro})</span>
                                                    )}
                                                    </button>
                                                ))}
                                            </>
                                        ) : (
                                            <div className="px-3 py-2 text-sm text-gray-500">
                                                No hay coincidencias. Guarda el tratamiento para crear &quot;{productInputValue || "..."}&quot; en la hoja de Productos
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Nº Registro {formData.producto_id ? "(snapshot)" : "(obligatorio si producto nuevo)"}
                                    </label>
                                    <input
                                        type="text"
                                        name="numero_registro"
                                        value={formData.numero_registro || ""}
                                        onChange={handleChange}
                                        readOnly={!!formData.producto_id}
                                        className={`w-full px-3 py-2.5 rounded-lg border text-sm ${formData.producto_id ? "bg-gray-100 border-gray-300 text-gray-700" : "bg-white border-gray-300 text-gray-900 focus:outline-none focus:border-green-500"}`}
                                        placeholder={formData.producto_id ? "Se rellena al elegir producto" : "Ej: ES-12345 o -"}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Nº Lote (snapshot)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.numero_lote ?? ""}
                                        onChange={handleChange}
                                        name="numero_lote"
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                        placeholder="Se rellena al elegir producto"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
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
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Unidad
                                    </label>
                                    <select
                                        name="unidad_dosis"
                                        value={formData.unidad_dosis || "L/Ha"}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    >
                                        <option value="L/Ha">L/Ha</option>
                                        <option value="Kg/Ha">Kg/Ha</option>
                                        <option value="cc/L">cc/L</option>
                                        <option value="g/L">g/L</option>
                                    </select>
                                </div>
                            </div>
                            {Array.isArray(formData.productos_lista) && formData.productos_lista.length > 1 && (
                                <div className="space-y-2">
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Productos adicionales
                                    </label>
                                    {formData.productos_lista.slice(1).map((p: any, idx: number) => (
                                        <div key={idx} className="flex gap-2 items-center p-2 rounded-lg bg-gray-50 border border-gray-200">
                                            <input
                                                type="text"
                                                value={p.nombre_comercial || ""}
                                                onChange={(e) => {
                                                    const list = [...(formData.productos_lista || [])];
                                                    list[idx + 1] = { ...list[idx + 1], nombre_comercial: e.target.value };
                                                    setFormData((prev) => ({ ...prev, productos_lista: list }));
                                                }}
                                                placeholder="Producto"
                                                className="flex-1 px-2 py-1.5 rounded border border-gray-300 text-sm"
                                            />
                                            <input
                                                type="number"
                                                value={p.dosis ?? ""}
                                                onChange={(e) => {
                                                    const list = [...(formData.productos_lista || [])];
                                                    list[idx + 1] = { ...list[idx + 1], dosis: e.target.value };
                                                    setFormData((prev) => ({ ...prev, productos_lista: list }));
                                                }}
                                                placeholder="Dosis"
                                                step="0.01"
                                                className="w-20 px-2 py-1.5 rounded border border-gray-300 text-sm"
                                            />
                                            <select
                                                value={p.unidad_dosis || "L/Ha"}
                                                onChange={(e) => {
                                                    const list = [...(formData.productos_lista || [])];
                                                    list[idx + 1] = { ...list[idx + 1], unidad_dosis: e.target.value };
                                                    setFormData((prev) => ({ ...prev, productos_lista: list }));
                                                }}
                                                className="w-20 px-2 py-1.5 rounded border border-gray-300 text-sm"
                                            >
                                                <option value="L/Ha">L/Ha</option>
                                                <option value="Kg/Ha">Kg/Ha</option>
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const list = (formData.productos_lista || []).filter((_: any, i: number) => i !== idx + 1);
                                                    setFormData((prev) => ({ ...prev, productos_lista: list }));
                                                }}
                                                className="p-1.5 rounded hover:bg-red-100 text-red-600"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    const current = formData.productos_lista && formData.productos_lista.length > 0
                                        ? formData.productos_lista
                                        : [{
                                            nombre_comercial: formData.nombre_comercial || productInputValue,
                                            numero_registro: formData.numero_registro,
                                            numero_lote: formData.numero_lote,
                                            dosis: formData.dosis,
                                            unidad_dosis: formData.unidad_dosis || "L/Ha",
                                            producto_id: formData.producto_id,
                                        }];
                                    setFormData((prev) => ({
                                        ...prev,
                                        productos_lista: [...current, { nombre_comercial: "", numero_registro: "", numero_lote: "", dosis: "", unidad_dosis: "L/Ha", producto_id: "" }],
                                    }));
                                }}
                                className="text-sm text-green-600 hover:text-green-700 font-medium"
                            >
                                + Añadir otro producto
                            </button>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Operador
                                    </label>
                                    <input
                                        type="text"
                                        name="operador"
                                        value={formData.operador || ""}
                                        onChange={handleChange}
                                        placeholder="Nombre del aplicador"
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Equipo
                                    </label>
                                    <input
                                        type="text"
                                        name="equipo"
                                        value={formData.equipo ?? "1"}
                                        onChange={handleChange}
                                        placeholder="1"
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                    Eficacia
                                </label>
                                <select
                                    name="eficacia"
                                    value={formData.eficacia ?? "BUENA"}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                >
                                    <option value="BUENA">BUENA</option>
                                    <option value="REGULAR">REGULAR</option>
                                    <option value="MALA">MALA</option>
                                </select>
                            </div>
                        </>
                    )}

                    {sheet === "fertilizantes" && (
                        <>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                    Parcelas
                                </label>
                                <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-white border border-gray-300 max-h-32 overflow-y-auto">
                                    {parcelasOrdenadas.length > 0 ? (
                                        parcelasOrdenadas.map((p) => (
                                            <label
                                                key={p.id}
                                                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    name="parcela_ids"
                                                    value={p.id}
                                                    checked={Array.isArray(formData.parcela_ids) && formData.parcela_ids.includes(p.id)}
                                                    onChange={handleCheckbox}
                                                    className="w-4 h-4 rounded border-gray-400 bg-gray-100 text-green-500 focus:ring-green-500"
                                                />
                                                <span className="text-sm text-gray-700">
                                                    {p.nombre}
                                                    {!!p.num_orden && <span className="text-gray-500"> · #{p.num_orden}</span>}
                                                </span>
                                            </label>
                                        ))
                                    ) : (
                                        <p className="text-gray-500 text-sm col-span-2">No hay parcelas</p>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Fecha Inicio
                                    </label>
                                    <input
                                        type="date"
                                        name="fecha_inicio"
                                        value={formData.fecha_inicio || ""}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Fecha Fin
                                    </label>
                                    <input
                                        type="date"
                                        name="fecha_fin"
                                        value={formData.fecha_fin || ""}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Cultivo/Especie
                                    </label>
                                    <input
                                        type="text"
                                        name="cultivo_especie"
                                        value={formData.cultivo_especie || ""}
                                        onChange={handleChange}
                                        placeholder="Ej: Trigo, Olivo"
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Tipo Abono
                                    </label>
                                    <input
                                        type="text"
                                        name="tipo_abono"
                                        value={formData.tipo_abono || ""}
                                        onChange={handleChange}
                                        placeholder="Nombre del abono"
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Riqueza N/P/K
                                    </label>
                                    <input
                                        type="text"
                                        name="riqueza_npk"
                                        value={formData.riqueza_npk || ""}
                                        onChange={handleChange}
                                        placeholder="Ej: 20-10-10"
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Dosis
                                    </label>
                                    <input
                                        type="text"
                                        name="dosis"
                                        value={formData.dosis || ""}
                                        onChange={handleChange}
                                        placeholder="kg/ha, m³/ha"
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Nº Albarán
                                    </label>
                                    <input
                                        type="text"
                                        name="num_albaran"
                                        value={formData.num_albaran || ""}
                                        onChange={handleChange}
                                        placeholder="Nº albarán"
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Tipo Fertilización
                                    </label>
                                    <input
                                        type="text"
                                        name="tipo_fertilizacion"
                                        value={formData.tipo_fertilizacion || ""}
                                        onChange={handleChange}
                                        placeholder="Fondo, cobertera..."
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                    Observaciones
                                </label>
                                <input
                                    type="text"
                                    name="observaciones"
                                    value={formData.observaciones || ""}
                                    onChange={handleChange}
                                    placeholder="Observaciones"
                                    className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                />
                            </div>
                        </>
                    )}

                    {sheet === "cosecha" && (
                        <>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                    Parcelas
                                </label>
                                <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-white border border-gray-300 max-h-32 overflow-y-auto">
                                    {parcelasOrdenadas.length > 0 ? (
                                        parcelasOrdenadas.map((p) => (
                                            <label
                                                key={p.id}
                                                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    name="parcela_ids"
                                                    value={p.id}
                                                    checked={Array.isArray(formData.parcela_ids) && formData.parcela_ids.includes(p.id)}
                                                    onChange={handleCheckbox}
                                                    className="w-4 h-4 rounded border-gray-400 bg-gray-100 text-green-500 focus:ring-green-500"
                                                />
                                                <span className="text-sm text-gray-700">
                                                    {p.nombre}
                                                    {!!p.num_orden && <span className="text-gray-500"> · #{p.num_orden}</span>}
                                                </span>
                                            </label>
                                        ))
                                    ) : (
                                        <p className="text-gray-500 text-sm col-span-2">No hay parcelas</p>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Fecha
                                    </label>
                                    <input
                                        type="date"
                                        name="fecha"
                                        value={formData.fecha || ""}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Producto
                                    </label>
                                    <input
                                        type="text"
                                        name="producto"
                                        value={formData.producto || ""}
                                        onChange={handleChange}
                                        placeholder="Producto cosechado"
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Cantidad (kg)
                                    </label>
                                    <input
                                        type="number"
                                        name="cantidad_kg"
                                        value={formData.cantidad_kg || ""}
                                        onChange={handleChange}
                                        step="0.01"
                                        placeholder="0"
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Nº Albarán
                                    </label>
                                    <input
                                        type="text"
                                        name="num_albaran"
                                        value={formData.num_albaran || ""}
                                        onChange={handleChange}
                                        placeholder="Nº albarán"
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Nº Lote
                                    </label>
                                    <input
                                        type="text"
                                        name="num_lote"
                                        value={formData.num_lote || ""}
                                        onChange={handleChange}
                                        placeholder="Lote"
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                        Cliente
                                    </label>
                                    <input
                                        type="text"
                                        name="cliente_nombre"
                                        value={formData.cliente_nombre || ""}
                                        onChange={handleChange}
                                        placeholder="Nombre del cliente"
                                        className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                    Dirección cliente
                                </label>
                                <input
                                    type="text"
                                    name="cliente_direccion"
                                    value={formData.cliente_direccion || ""}
                                    onChange={handleChange}
                                    placeholder="Dirección"
                                    className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-zinc-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                                />
                            </div>
                        </>
                    )}
                </form>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors"
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
