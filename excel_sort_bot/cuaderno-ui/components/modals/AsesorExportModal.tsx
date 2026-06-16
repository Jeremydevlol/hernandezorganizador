"use client";

import { useState, useEffect } from "react";
import SignatureModal from "./SignatureModal";
import { fechaFlexibleAISO, fechaFlexibleADDMMYYYY } from "@/lib/dateSpanish";

export interface AsesorExportData {
    nombre_asesor_trat: string;
    num_colegiado_asesor: string;
    fecha_recomendacion_asesor: string; // ISO (YYYY-MM-DD)
    firma_asesor: string;
    firma_cliente: string;
}

interface AsesorExportModalProps {
    isOpen: boolean;
    /** Valores ya guardados en los tratamientos asesorados (para precargar). */
    initial?: Partial<AsesorExportData> & { fecha_display?: string };
    onClose: () => void;
    /** Continúa con la exportación aplicando los datos del asesor. */
    onConfirm: (data: AsesorExportData) => void;
}

/**
 * Modal que captura los datos del asesor (nombre, nº colegiado, fecha de
 * recomendación y firmas) justo antes de exportar la hoja "Trat. Asesorados".
 * Es el mismo bloque de asesor que aparece al crear un tratamiento asesorado.
 */
export default function AsesorExportModal({ isOpen, initial, onClose, onConfirm }: AsesorExportModalProps) {
    const [nombre, setNombre] = useState("");
    const [colegiado, setColegiado] = useState("");
    const [fecha, setFecha] = useState(""); // texto DD/MM/AAAA
    const [firmaAsesor, setFirmaAsesor] = useState("");
    const [firmaCliente, setFirmaCliente] = useState("");
    const [sigModalOpen, setSigModalOpen] = useState<"asesor" | "cliente" | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setNombre(initial?.nombre_asesor_trat || "");
        setColegiado(initial?.num_colegiado_asesor || "");
        setFecha(initial?.fecha_display || "");
        setFirmaAsesor(initial?.firma_asesor || "");
        setFirmaCliente(initial?.firma_cliente || "");
        setSigModalOpen(null);
    }, [isOpen, initial]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        onConfirm({
            nombre_asesor_trat: nombre.trim(),
            num_colegiado_asesor: colegiado.trim(),
            fecha_recomendacion_asesor: fecha.trim() ? fechaFlexibleAISO(fecha.trim()) : "",
            firma_asesor: firmaAsesor,
            firma_cliente: firmaCliente,
        });
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900">Datos del asesor</h2>
                        <p className="mt-0.5 text-xs text-gray-500">
                            Se aplicarán a los tratamientos asesorados y aparecerán en el documento exportado.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                        ✕
                    </button>
                </div>

                <div className="space-y-3 px-5 py-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">Nombre del asesor</label>
                            <input
                                type="text"
                                value={nombre}
                                onChange={(e) => setNombre(e.target.value)}
                                placeholder="Nombre completo"
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">Nº colegiado</label>
                            <input
                                type="text"
                                value={colegiado}
                                onChange={(e) => setColegiado(e.target.value)}
                                placeholder="Ej: CAM-12345"
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:outline-none"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Fecha de recomendación</label>
                        <input
                            type="text"
                            value={fecha}
                            onChange={(e) => setFecha(e.target.value)}
                            onBlur={() => setFecha((f) => (f.trim() ? fechaFlexibleADDMMYYYY(f) : f))}
                            placeholder="DD/MM/AAAA"
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:outline-none"
                        />
                    </div>

                    {/* Firmas */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-gray-600">Firma del asesor</p>
                            {firmaAsesor ? (
                                <div className="group relative">
                                    <img
                                        src={firmaAsesor}
                                        alt="Firma asesor"
                                        className="h-16 w-full rounded-lg border border-gray-200 bg-white object-contain"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setSigModalOpen("asesor")}
                                        className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/30 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
                                    >
                                        Cambiar
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setSigModalOpen("asesor")}
                                    className="flex h-16 w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-blue-300 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
                                >
                                    ✍️ Firmar asesor
                                </button>
                            )}
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-gray-600">Firma del titular</p>
                            {firmaCliente ? (
                                <div className="group relative">
                                    <img
                                        src={firmaCliente}
                                        alt="Firma titular"
                                        className="h-16 w-full rounded-lg border border-gray-200 bg-white object-contain"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setSigModalOpen("cliente")}
                                        className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/30 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
                                    >
                                        Cambiar
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setSigModalOpen("cliente")}
                                    className="flex h-16 w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-blue-300 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
                                >
                                    ✍️ Firmar titular
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                        Aplicar y exportar
                    </button>
                </div>
            </div>

            {sigModalOpen && (
                <SignatureModal
                    title={sigModalOpen === "asesor" ? "Firma del asesor" : "Firma del titular"}
                    existingSignature={sigModalOpen === "asesor" ? firmaAsesor : firmaCliente}
                    onConfirm={(dataUrl) => {
                        if (sigModalOpen === "asesor") setFirmaAsesor(dataUrl);
                        else setFirmaCliente(dataUrl);
                        setSigModalOpen(null);
                    }}
                    onClose={() => setSigModalOpen(null)}
                />
            )}
        </div>
    );
}
