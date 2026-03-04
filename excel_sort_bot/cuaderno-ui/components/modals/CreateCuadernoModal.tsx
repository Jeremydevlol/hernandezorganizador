"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Cuaderno } from "@/lib/types";

interface CreateCuadernoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (data: Partial<Cuaderno>) => void;
}

export default function CreateCuadernoModal({ isOpen, onClose, onCreate }: CreateCuadernoModalProps) {
    const [formData, setFormData] = useState({
        nombre_explotacion: "",
        titular: "",
        nif_titular: "",
        domicilio: "",
        codigo_explotacion: "",
        año: new Date().getFullYear(),
    });
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onCreate(formData);
            setFormData({
                nombre_explotacion: "",
                titular: "",
                nif_titular: "",
                domicilio: "",
                codigo_explotacion: "",
                año: new Date().getFullYear(),
            });
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: name === "año" ? parseInt(value) : value }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-white border border-gray-200 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Nuevo Cuaderno</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">
                            Nombre de la Explotación *
                        </label>
                        <input
                            type="text"
                            name="nombre_explotacion"
                            value={formData.nombre_explotacion}
                            onChange={handleChange}
                            required
                            placeholder="Ej: Finca El Olivar"
                            className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-gray-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                Titular
                            </label>
                            <input
                                type="text"
                                name="titular"
                                value={formData.titular}
                                onChange={handleChange}
                                placeholder="Nombre del titular"
                                className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-gray-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                NIF/CIF
                            </label>
                            <input
                                type="text"
                                name="nif_titular"
                                value={formData.nif_titular}
                                onChange={handleChange}
                                placeholder="12345678A"
                                className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-gray-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">
                            Domicilio
                        </label>
                        <input
                            type="text"
                            name="domicilio"
                            value={formData.domicilio}
                            onChange={handleChange}
                            placeholder="Dirección completa"
                            className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-gray-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                Código de Explotación
                            </label>
                            <input
                                type="text"
                                name="codigo_explotacion"
                                value={formData.codigo_explotacion}
                                onChange={handleChange}
                                placeholder="REGA, etc."
                                className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-gray-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">
                                Año
                            </label>
                            <input
                                type="number"
                                name="año"
                                value={formData.año}
                                onChange={handleChange}
                                min={2020}
                                max={2050}
                                className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-gray-500 text-sm focus:outline-none focus:border-green-500 transition-colors"
                            />
                        </div>
                    </div>
                </form>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-white/30">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-zinc-200 hover:bg-gray-100 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !formData.nombre_explotacion}
                        className="px-5 py-2 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? "Creando..." : "Crear Cuaderno"}
                    </button>
                </div>
            </div>
        </div>
    );
}
